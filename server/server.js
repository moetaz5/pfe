require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const JSZip = require("jszip");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const db = require("./db");
const passport = require("./googleAuth");
const crypto = require("crypto");

const app = express();

// ===================== GOOGLE EXCHANGE TOKENS =====================
// Store temporaire pour les tokens d'échange OAuth Google (5 minutes)
const googleExchangeTokens = new Map();
// Nettoyage automatique toutes les 10 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of googleExchangeTokens.entries()) {
      if (now > val.expires) googleExchangeTokens.delete(key);
    }
  },
  10 * 60 * 1000,
);

// ===================== AUTO-MIGRATION =====================
// Ajoute la colonne date_suppression si elle n'existe pas encore (compatible toutes versions MySQL)
db.query(
  `SELECT COUNT(*) AS cnt
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'transactions'
     AND COLUMN_NAME  = 'date_suppression'`,
  (err, results) => {
    if (err) {
      console.warn("⚠️ Migration check error:", err.message);
      return;
    }
    if (results[0].cnt === 0) {
      db.query(
        `ALTER TABLE transactions ADD COLUMN date_suppression DATETIME DEFAULT NULL`,
        (err2) => {
          if (err2)
            console.warn("⚠️ Migration date_suppression:", err2.message);
          else console.log("✅ Colonne date_suppression ajoutée avec succès");
        },
      );
    }
  },
);

// Ajoute la colonne last_activity si elle n'existe pas encore
db.query(
  `SELECT COUNT(*) AS cnt
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'users'
     AND COLUMN_NAME  = 'last_activity'`,
  (err, results) => {
    if (err) {
      console.warn("⚠️ Migration check error (last_activity):", err.message);
      return;
    }
    if (results[0].cnt === 0) {
      db.query(
        `ALTER TABLE users ADD COLUMN last_activity DATETIME DEFAULT NULL`,
        (err2) => {
          if (err2) console.warn("⚠️ Migration last_activity:", err2.message);
          else console.log("✅ Colonne last_activity ajoutée avec succès");
        },
      );
    }
  },
);

// Auto-création de la table notifications si elle n'existe pas
db.query(
  `
  CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  (err) => {
    if (err)
      console.warn("⚠️Table notifications auto-creation error:", err.message);
    else console.log("Table notifications prête");
  },
);
// ==========================================================
//**TTN*================ */
const TTN_URL = "http://127.0.0.1:5001/ElfatouraServices/EfactService";

const TTN_LOGIN = "testuser";
const TTN_PASSWORD = "testpass";
const TTN_MATRICULE = "1234567ABC";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cleanBase64 = (value) => String(value || "").replace(/\s+/g, "");

const extractSoapReturn = (xmlText) => {
  const match = String(xmlText || "").match(
    /<[^>]*return[^>]*>([\s\S]*?)<\/[^>]*return>/i,
  );
  return match ? match[1].trim() : null;
};

const extractSoapFault = (xmlText) => {
  const match = String(xmlText || "").match(
    /<[^>]*faultstring[^>]*>([\s\S]*?)<\/[^>]*faultstring>/i,
  );
  return match ? match[1].trim() : null;
};

const saveEfactTTN = async (xmlBase64) => {
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <saveEfact xmlns="http://services.elfatoura.tradenet.com.tn/">
      <login>${TTN_LOGIN}</login>
      <password>${TTN_PASSWORD}</password>
      <matricule>${TTN_MATRICULE}</matricule>
      <documentEfact>${cleanBase64(xmlBase64)}</documentEfact>
    </saveEfact>
  </soap:Body>
</soap:Envelope>`;

  const response = await axios.post(TTN_URL, soapBody, {
    timeout: 60000,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    validateStatus: () => true,
  });

  const raw = response.data;

  return {
    httpStatus: response.status,
    raw,
    returnText: extractSoapReturn(raw),
    fault: extractSoapFault(raw),
  };
};
const consultEfactTTN = async (idSaveEfact) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <consultEfact xmlns="http://services.elfatoura.tradenet.com.tn/">
      <login>${TTN_LOGIN}</login>
      <password>${TTN_PASSWORD}</password>
      <matricule>${TTN_MATRICULE}</matricule>
      <efactCriteria>
        <idSaveEfact>${idSaveEfact}</idSaveEfact>
      </efactCriteria>
    </consultEfact>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios.post(TTN_URL, soapBody, {
      timeout: 60000,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      validateStatus: () => true,
    });

    const raw = response.data;

    const xmlMatch = raw.match(
      /<[^>]*xmlContent[^>]*>([\s\S]*?)<\/[^>]*xmlContent>/i,
    );

    if (xmlMatch) {
      return xmlMatch[1].trim();
    }

    await sleep(3000);
  }

  throw new Error("TTN_CONSULT_FAILED");
};

/**
 * TÂCHE DE FOND : Envoi automatique TTN et tamponnage PDF
 */
const processTTNSubmission = async (
  transactionId,
  signedDocs,
  userId,
  clientEmail,
  originalQrConfig,
  originalRefConfig,
) => {
  console.log(
    `[TTN] Début de traitement en tâche de fond pour TX #${transactionId}`,
  );
  const qrConfig = resolveConfig(originalQrConfig);
  const refConfig = resolveConfig(originalRefConfig);

  try {
    for (const doc of signedDocs) {
      console.log(`[TTN] Traitement doc ${doc.id} (${doc.filename})`);

      try {
        // 📡 SAVE TTN
        const saveRes = await saveEfactTTN(doc.xml_signed);
        console.log(
          `[TTN] raw saveRes for doc ${doc.id}: HTTP ${saveRes.httpStatus}, RAW: ${saveRes.raw?.substring(0, 300)}...`,
        );
        console.log(
          `[TTN] returnText/fault for doc ${doc.id}: returnText: ${saveRes.returnText}, fault: ${saveRes.fault}`,
        );

        const idMatch = saveRes.returnText?.match(/idSaveEfact=(\d+)/i);
        const refMatch = saveRes.returnText?.match(
          /Reference TTN=([A-Z0-9]+)/i,
        );

        const idSaveEfact = idMatch ? idMatch[1] : null;
        const referenceTTN = refMatch ? refMatch[1] : null;

        if (!idSaveEfact) {
          throw new Error(
            `TTN_ID_NOT_FOUND (returnText was: ${saveRes.returnText})`,
          );
        }

        // 🔁 CONSULT TTN
        console.log(`[TTN] Consultation TTN avec idSaveEfact: ${idSaveEfact}`);
        const xmlSignedTTN = await consultEfactTTN(idSaveEfact);
        const xmlDecoded = decodeXmlB64(xmlSignedTTN);

        let qrPngB64 = extractReferenceCEVFromXml(xmlDecoded);
        if (!qrPngB64 && referenceTTN)
          qrPngB64 = await generateQrPngBase64(referenceTTN);

        // 🏷 STAMP PDF
        const pdfStampedB64 = await stampPdfWithTTN({
          pdfB64: doc.pdf_file,
          qrPngB64,
          ttnReference: referenceTTN,
          qrConfig,
          refConfig,
        });

        // 💾 UPDATE DOCUMENT to 'signée_ttn'
        await db.promise().query(
          `
          UPDATE transaction_documents
          SET statut='signée_ttn',
              xml_signed_ttn=?,
              ttn_reference=?,
              ttn_id_save=?,
              pdf_file=?,
              signed_ttn_at=NOW()
          WHERE id=?
          `,
          [xmlSignedTTN, referenceTTN, idSaveEfact, pdfStampedB64, doc.id],
        );
        console.log(
          `[TTN] Document ${doc.id} terminé avec succès (signée_ttn)`,
        );
      } catch (ttnErr) {
        console.error(`[TTN] Document ${doc.id} ÉCHEC:`, ttnErr.message);
        // 💾 UPDATE DOCUMENT to 'refusée par TTN'
        await db
          .promise()
          .query(
            "UPDATE transaction_documents SET statut='refusée par TTN' WHERE id=?",
            [doc.id],
          );
      }
    }

    // 🔄 UPDATE TRANSACTION status based on documents
    const [finalDocs] = await db
      .promise()
      .query(
        "SELECT statut FROM transaction_documents WHERE transaction_id = ?",
        [transactionId],
      );

    let finalTxStatut = "signée_ttn";
    if (finalDocs.some((d) => d.statut === "refusée par TTN")) {
      finalTxStatut = "refusée par TTN";
    }

    await db
      .promise()
      .query("UPDATE transactions SET statut=? WHERE id=?", [
        finalTxStatut,
        transactionId,
      ]);

    // Notifications
    if (finalTxStatut === "signée_ttn") {
      await createNotification(
        userId,
        "Transaction signée TTN",
        `La transaction #${transactionId} a été signée avec succès par TTN`,
        "success",
      );
      // 📧 ENVOI EMAIL CLIENT
      const [signedDocsForEmail] = await db
        .promise()
        .query(
          "SELECT filename, pdf_file FROM transaction_documents WHERE transaction_id = ? AND statut = 'signée_ttn'",
          [transactionId],
        );
      if (clientEmail && signedDocsForEmail.length) {
        await sendSignedPdfsToClient(
          clientEmail,
          transactionId,
          signedDocsForEmail,
        );
      }
    } else {
      await createNotification(
        userId,
        "Transaction refusée par TTN",
        `La transaction #${transactionId} a été refusée par les services TTN`,
        "error",
      );
      // 📧 ENVOI EMAIL REFUS CLIENT
      if (clientEmail) {
        await sendRejectionEmailToClient(clientEmail, transactionId);
      }
    }
  } catch (globalErr) {
    console.error(
      `[TTN] Global background error for TX #${transactionId}:`,
      globalErr,
    );
  }
};

////////////////////*==============insertion QR CODE ============*/
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const QRCode = require("qrcode");

const safeJsonParse = (val) => {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
};
const resolveConfig = (config) => {
  if (!config) return null;

  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch {
      return null;
    }
  }

  return config.configuration || config;
};

// xmlSignedTTN est base64 => decode en utf8
const decodeXmlB64 = (xmlB64) => {
  try {
    return Buffer.from(String(xmlB64 || ""), "base64").toString("utf8");
  } catch {
    return "";
  }
};

const extractReferenceCEVFromXml = (xmlText) => {
  const m = String(xmlText || "").match(
    /<ReferenceCEV>([\s\S]*?)<\/ReferenceCEV>/i,
  );
  return m ? m[1].trim() : null; // base64 PNG
};

const extractReferenceTTNFromXml = (xmlText) => {
  const m = String(xmlText || "").match(
    /<ReferenceTTN[^>]*>([\s\S]*?)<\/ReferenceTTN>/i,
  );
  return m ? m[1].trim() : null;
};

// Génère un QR PNG base64 depuis une chaine (fallback)
const generateQrPngBase64 = async (text) => {
  const dataUrl = await QRCode.toDataURL(String(text || ""), {
    margin: 1,
    scale: 6,
  });
  // "data:image/png;base64,...."
  return dataUrl.split(",")[1];
};

const stampPdfWithTTN = async ({
  pdfB64,
  qrPngB64,
  ttnReference,
  qrConfig,
  refConfig,
}) => {
  const pdfBytes = Buffer.from(String(pdfB64), "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (!pages.length) throw new Error("PDF vide");

  const qrConf = resolveConfig(qrConfig) || {};
  const refConf = resolveConfig(refConfig) || {};

  const pageIndex = Math.max(
    0,
    (qrConf.qrPositionP || refConf.labelPositionP || 1) - 1,
  );

  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const { width, height } = page.getSize();

  // ================= QR =================
  if (qrPngB64) {
    const pngImage = await pdfDoc.embedPng(Buffer.from(qrPngB64, "base64"));

    const qrW = Number(qrConf.qrWidth || 120);
    const qrH = Number(qrConf.qrHeight || 120);

    // Frontend already converts to pdf-lib bottom-origin coordinates
    let x = Number(qrConf.qrPositionX || 0);
    let y = Number(qrConf.qrPositionY || 0);

    // Protection limites
    if (x + qrW > width) x = width - qrW - 5;
    if (x < 0) x = 5;
    if (y < 0) y = 5;
    if (y + qrH > height) y = height - qrH - 5;

    page.drawImage(pngImage, {
      x,
      y,
      width: qrW,
      height: qrH,
    });
  }

  // ================= REFERENCE =================
  if (ttnReference) {
    const labelText =
      (refConf.referenceText ||
        "Copie de la facture electronique enregistree aupres de TTN sous la reference unique n :") +
      " " +
      ttnReference;

    // Frontend already converts to pdf-lib bottom-origin coordinates
    let x = Number(refConf.labelPositionX || 0);
    let y = Number(refConf.labelPositionY || 0);

    if (x < 0) x = 5;
    if (y < 0) y = 5;

    page.drawText(labelText, {
      x,
      y,
      size: 9,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Number(refConf.labelWidth || 400),
    });
  }

  const outBytes = await pdfDoc.save();
  return Buffer.from(outBytes).toString("base64");
};
// ===================== BASE64 HELPERS =====================
const bufferToB64 = (buf) => {
  if (!buf) return null;
  if (Buffer.isBuffer(buf)) return buf.toString("base64");
  return null;
};

const b64ToBuffer = (b64) => {
  if (!b64) return null;
  return Buffer.from(String(b64), "base64");
};

// accepte: base64 direct OU xml string => on convertit en base64
const ensureBase64String = (value) => {
  if (!value) return null;
  const v = String(value);

  // Si ça ressemble à du XML, on encode en base64
  if (v.trim().startsWith("<")) {
    return Buffer.from(v, "utf8").toString("base64");
  }

  // Sinon on considère que c'est déjà base64
  return v;
};
/*notification*/
const createNotification = async (userId, title, message, type = "info") => {
  try {
    await db.promise().query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
      `,
      [userId, title, message, type],
    );
  } catch (err) {
    console.error("NOTIFICATION ERROR:", err);
  }
};

const notifyAdmins = async (title, message, type = "info") => {
  try {
    const [admins] = await db
      .promise()
      .query("SELECT id FROM users WHERE role = 'ADMIN'");
    for (const admin of admins) {
      await createNotification(admin.id, title, message, type);
    }
  } catch (err) {
    console.error("NOTIFY ADMINS ERROR:", err);
  }
};

/* ===================== EMAIL SIGNATURE ===================== */
const sendSignatureEmail = async (
  email,
  transactionId,
  host = "medicasign.medicacom.tn",
) => {
  const link = `http://${host}/signature/${transactionId}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Signature de facture requise",
    html: `
      <h2>Signature requise</h2>
      <p>Veuillez signer le document en cliquant sur le bouton ci-dessous :</p>

      <a href="${link}"
         style="
           display:inline-block;
           padding:12px 20px;
           background:#0247AA;
           color:#fff;
           text-decoration:none;
           border-radius:6px;
         ">
        Signer le document
      </a>

      <p>Ou copiez ce lien :</p>
      <p>${link}</p>
    `,
  });
};
/* ===================== EMAIL CLIENT PDF ===================== */
const sendSignedPdfsToClient = async (clientEmail, transactionId, docs) => {
  try {
    const attachments = docs.map((doc) => ({
      filename: `${doc.filename}.pdf`,
      content: Buffer.from(doc.pdf_file, "base64"),
      contentType: "application/pdf",
    }));

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: clientEmail,
      subject: `Facture(s) signée(s) - Transaction #${transactionId}`,
      html: `
        <h2>Vos factures ont été signées avec succès</h2>
        <p>La transaction <strong>#${transactionId}</strong> a été validée par TTN.</p>
        <p>Vous trouverez les factures signées en pièces jointes.</p>
        <br/>
        <p>Cordialement,<br/>Equipe Signature</p>
      `,
      attachments,
    });

    console.log("📧 PDF envoyés au client:", clientEmail);
  } catch (err) {
    console.error("SEND CLIENT PDF ERROR:", err);
  }
};
/* ===================== EMAIL REFUS CLIENT ===================== */
const sendRejectionEmailToClient = async (clientEmail, transactionId) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: clientEmail,
      subject: `Transaction Refusée - #${transactionId}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #d32f2f;">Transaction Refusée</h2>
          <p>Bonjour,</p>
          <p>Nous vous informons que votre transaction <strong>#${transactionId}</strong> a été refusée par les services officiels du réseau TTN.</p>
          <p>Cela peut être dû à un problème de format de fichier ou à une erreur de validation externe.</p>
          <p>Veuillez contacter notre support ou vérifier vos documents avant de tenter un nouvel envoi.</p>
          <br/>
          <p>Cordialement,<br/>L'équipe Medica-Sign</p>
        </div>
      `,
    });
    console.log("📧 Email de refus envoyé au client:", clientEmail);
  } catch (err) {
    console.error("SEND REJECTION EMAIL ERROR:", err);
  }
};
/* ===================== MIDDLEWARES ===================== */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  "https://medicasign.medicacom.tn",
  "http://localhost:52001",
  "http://127.0.0.1:52001",
  "http://10.0.2.2:52001",
  "http://localhost:52622",
  "http://127.0.0.1:52622",
];

app.use(
  cors({
    origin: true, // Accepte toutes les origines pour le test
    credentials: true,
  }),
);

app.use(passport.initialize());

/* ===================== EMAIL TRANSPORT ===================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (toEmail, code) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "Code de confirmation",
    html: `
      <h2>Confirmation Email</h2>
      <p>Voici votre code :</p>
      <h1 style="letter-spacing:3px;">${code}</h1>
      <p>Ce code expire dans 10 minutes.</p>
    `,
  });
};
/* ===================== EMAIL confirm jeton ===================== */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (value) =>
  EMAIL_REGEX.test(
    String(value || "")
      .trim()
      .toLowerCase(),
  );

const sanitizeEmailHtml = (value) => String(value || "").replace(/</g, "&lt;");

const sendTokenRequestPaymentPendingEmail = async ({
  toEmail,
  packName,
  tokens,
  priceTnd,
  adminNote,
}) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "Demande jetons: premiere confirmation",
    html: `
      <h2>Votre demande de jetons est validee (etape 1)</h2>
      <p>Merci. Votre demande a passe la premiere confirmation admin.</p>
      <p><strong>Pack:</strong> ${packName}</p>
      <p><strong>Jetons:</strong> ${tokens}</p>
      <p><strong>Prix:</strong> ${priceTnd} TND</p>
      <p>Veuillez envoyer la preuve de virement (PDF/image) depuis votre espace client pour passer a la confirmation finale.</p>
      ${
        adminNote
          ? `<p><strong>Note admin:</strong> ${sanitizeEmailHtml(adminNote)}</p>`
          : ""
      }
    `,
  });
};

const sendTokenRequestDecisionEmail = async ({
  toEmail,
  packName,
  tokens,
  priceTnd,
  decision,
  adminNote,
}) => {
  const isApproved = decision === "approved";
  const decisionLabel = isApproved ? "confirmee" : "refusee";
  const color = isApproved ? "#166534" : "#991b1b";

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: `Demande jetons ${decisionLabel}`,
    html: `
      <h2>Decision sur votre demande de jetons</h2>
      <p>Votre demande a ete <strong style="color:${color};">${decisionLabel}</strong>.</p>
      <p><strong>Pack:</strong> ${packName}</p>
      <p><strong>Jetons:</strong> ${tokens}</p>
      <p><strong>Prix:</strong> ${priceTnd} TND</p>
      ${
        adminNote
          ? `<p><strong>Note admin:</strong> ${sanitizeEmailHtml(adminNote)}</p>`
          : ""
      }
    `,
  });
};
/* ===================== JWT VERIFY ===================== */
const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.query.token;
  if (!token) return res.status(401).json({ message: "Non autorisé" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: "Token invalide" });

    const [rows] = await db
      .promise()
      .query("SELECT statut FROM users WHERE id = ?", [decoded.id]);

    if (!rows.length || rows[0].statut === 0) {
      return res.status(403).json({
        message: "Compte désactivé",
      });
    }

    req.user = decoded;

    // 🔥 Mise à jour de la dernière activité (last_activity)
    db.query(
      "UPDATE users SET last_activity = NOW() WHERE id = ?",
      [decoded.id],
      (err) => {
        if (err) console.error("⚠️ Error updating last_activity:", err.message);
      },
    );

    next();
  });
};

/* ===================== ROLE VERIFY ===================== */
const verifyRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }
    next();
  };
};
/* ===================== VERIFY API TOKEN ===================== */
const verifyApiToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Bearer token requis" });
    }

    const apiToken = authHeader.split(" ")[1];

    // 🔐 Vérifier signature JWT
    const decoded = jwt.verify(apiToken, process.env.JWT_SECRET);

    if (decoded.type !== "api") {
      return res.status(403).json({ message: "Token invalide" });
    }

    const [rows] = await db
      .promise()
      .query("SELECT id, statut FROM users WHERE id = ? AND api_token = ?", [
        decoded.id,
        apiToken,
      ]);

    if (!rows.length) {
      return res.status(403).json({ message: "Token invalide" });
    }

    if (rows[0].statut === 0) {
      return res.status(403).json({ message: "Compte désactivé" });
    }

    req.apiUser = { id: decoded.id };
    next();
  } catch (err) {
    console.error("BEARER TOKEN ERROR:", err);
    return res.status(403).json({ message: "Token invalide" });
  }
};

/* ===================== GENERATE API TOKEN ===================== */
app.post("/api/generate-api-token", verifyToken, async (req, res) => {
  try {
    // vérifier si déjà généré
    const [rows] = await db
      .promise()
      .query("SELECT api_token, name, email FROM users WHERE id = ?", [
        req.user.id,
      ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const user = rows[0];

    // Si token déjà existe -> renvoyer le même
    if (user.api_token) {
      return res.json({ apiToken: user.api_token });
    }

    // Générer JWT API TOKEN
    const apiToken = jwt.sign(
      {
        id: req.user.id,
        name: user.name,
        email: user.email,
        type: "api",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10y", // longue durée
      },
    );

    // stocker en base
    await db
      .promise()
      .query("UPDATE users SET api_token = ? WHERE id = ?", [
        apiToken,
        req.user.id,
      ]);

    res.json({ apiToken });
  } catch (err) {
    console.error("API TOKEN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/**************************regenerer tocken */
app.post("/api/regenerate-api-token", verifyToken, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query("SELECT name, email FROM users WHERE id = ?", [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const user = rows[0];

    const newToken = jwt.sign(
      {
        id: req.user.id,
        name: user.name,
        email: user.email,
        type: "api",
      },
      process.env.JWT_SECRET,
      { expiresIn: "10y" },
    );

    await db
      .promise()
      .query("UPDATE users SET api_token = ? WHERE id = ?", [
        newToken,
        req.user.id,
      ]);

    res.json({ apiToken: newToken });
  } catch (err) {
    console.error("REGENERATE TOKEN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*========================get tocken existant==================*/
app.get("/api/my-api-token", verifyToken, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query("SELECT api_token FROM users WHERE id = ?", [req.user.id]);

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    res.json({ apiToken: rows[0].api_token || null });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== GOOGLE AUTH ===================== */
app.get("/api/auth/google", (req, res, next) => {
  const { session_id } = req.query;
  console.log("GOOGLE AUTH START - Session ID:", session_id);

  // ✅ FIX: Store session_id to avoid deep link issues
  const state = session_id || "web_client";

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: state,
    accessType: "offline",
    prompt: "consent",
  })(req, res, next);
});

app.get(
  "/api/auth/google/callback",
  (req, res, next) => {
    const redirectTo = req.query.state || "https://medicasign.medicacom.tn";
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${redirectTo}/login?error=google_failed`,
      accessType: "offline", // ✅ Maintain consistency
      prompt: "consent", // ✅ Maintain consistency
    })(req, res, next);
  },
  async (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(
          `https://medicasign.medicacom.tn/login?error=auth_failed`,
        );
      }

      // 🔎 Vérifier le statut réel en base
      const [rows] = await db
        .promise()
        .query("SELECT id, role, statut FROM users WHERE id = ?", [
          req.user.id,
        ]);

      if (!rows.length) {
        return res.redirect(
          `https://medicasign.medicacom.tn/login?error=user_not_found`,
        );
      }

      const user = rows[0];

      // ❌ Compte désactivé
      if (user.statut === 0) {
        return res.redirect(
          `https://medicasign.medicacom.tn/login?error=disabled`,
        );
      }

      // 🔐 Génération d'un JWT de session
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "10d" },
      );

      // ✅ NEW: Store token with session_id for mobile polling
      const sessionId = req.query.state;
      if (sessionId && sessionId !== "web_client") {
        // Mobile app is waiting - store token for it to retrieve
        googleExchangeTokens.set(sessionId, {
          token: token,
          userId: user.id,
          role: user.role,
          expires: Date.now() + 5 * 60 * 1000, // 5 minutes
        });
        console.log(
          "✅ GOOGLE AUTH SUCCESS (MOBILE) - Token stored for session:",
          sessionId,
        );

        // Redirect to a simple success page
        return res.redirect(
          `https://medicasign.medicacom.tn/auth-success?session_id=${sessionId}`,
        );
      }

      // 🔐 Web client - use exchange token
      const exchangeToken = crypto.randomBytes(32).toString("hex");
      googleExchangeTokens.set(exchangeToken, {
        userId: user.id,
        role: user.role,
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes
      });

      console.log(
        "GOOGLE CALLBACK SUCCESS (WEB) - Exchange token generated, redirecting.",
      );

      // Rediriger vers le frontend IP avec le token d'échange
      return res.redirect(
        `https://medicasign.medicacom.tn/google/callback?exchange_token=${exchangeToken}`,
      );
    } catch (error) {
      console.error("GOOGLE CALLBACK ERROR:", error);
      return res.redirect(`https://medicasign.medicacom.tn/login?error=server`);
    }
  },
);

/* =================== GOOGLE EXCHANGE TOKEN ENDPOINT =================== */
// Échange un token temporaire contre un cookie de session valide
// Résout le problème cross-domain entre nip.io et l'IP directe
app.post("/api/auth/exchange-google-token", async (req, res) => {
  try {
    const { exchange_token } = req.body;

    if (!exchange_token) {
      return res.status(400).json({ message: "Token d'échange manquant" });
    }

    const data = googleExchangeTokens.get(exchange_token);

    if (!data || Date.now() > data.expires) {
      googleExchangeTokens.delete(exchange_token);
      return res.status(401).json({ message: "Token expiré ou invalide" });
    }

    // Supprimer le token (usage unique)
    googleExchangeTokens.delete(exchange_token);

    // Générer le JWT de session
    const token = jwt.sign(
      { id: data.userId, role: data.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    // Définir le cookie sur le bon domaine (51.178.39.67)
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    // Récupérer les infos utilisateur
    const [rows] = await db
      .promise()
      .query("SELECT id, name, email, role FROM users WHERE id = ?", [
        data.userId,
      ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("EXCHANGE TOKEN ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =================== GOOGLE AUTH EXCHANGE (Session-based) =================== */
// ✅ NEW: Get token for mobile app using session_id polling
app.get("/api/auth/google/exchange", async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ message: "Session ID manquant" });
    }

    const data = googleExchangeTokens.get(session_id);

    if (!data || Date.now() > data.expires) {
      return res.status(202).json({ message: "En attente d'authentification" });
    }

    // Delete token after retrieval (one-time use)
    googleExchangeTokens.delete(session_id);

    // If token already exists, return it
    if (data.token) {
      return res.json({ token: data.token });
    }

    // Otherwise, we need to generate the JWT from user info
    const token = jwt.sign(
      { id: data.userId, role: data.role },
      process.env.JWT_SECRET,
      { expiresIn: "10d" },
    );

    return res.json({ token });
  } catch (err) {
    console.error("GOOGLE EXCHANGE ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =================== GOOGLE MOBILE (Native SDK) ENDPOINT =================== */
// Vérifie un id_token Google natif (depuis google_sign_in Flutter)
// et retourne un JWT de session sans passer par le navigateur
app.post("/api/auth/google-mobile", async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) {
      return res.status(400).json({ message: "id_token manquant" });
    }

    // Vérifier le token auprès de Google
    const googleRes = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`,
    );
    const payload = googleRes.data;

    if (!payload.email) {
      return res.status(401).json({ message: "Token Google invalide" });
    }

    const email = payload.email;
    const name = payload.name || email.split("@")[0];

    // Chercher ou créer l'utilisateur
    const [rows] = await db
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [email]);

    let user;
    if (rows.length > 0) {
      user = rows[0];
    } else {
      const [result] = await db
        .promise()
        .query(
          "INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)",
          [name, email, "", "user", 1],
        );
      const [newRows] = await db
        .promise()
        .query("SELECT * FROM users WHERE id = ?", [result.insertId]);
      user = newRows[0];
    }

    if (user.statut === 0) {
      return res
        .status(403)
        .json({ message: "Compte désactivé. Contactez l'administrateur." });
    }

    // Générer le JWT de session
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (err) {
    console.error(
      "GOOGLE MOBILE AUTH ERROR:",
      err?.response?.data || err.message,
    );
    return res.status(401).json({ message: "Authentification Google échouée" });
  }
});

/* ===================== NOTIFICATIONS ROUTES ===================== */
app.get("/api/notifications", verifyToken, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        [req.user.id],
      );
    res.json(rows);
  } catch (err) {
    console.error("GET NOTIFS ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.put("/api/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        [req.params.id, req.user.id],
      );
    res.json({ message: "Succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.put("/api/notifications/read-all", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [
        req.user.id,
      ]);
    res.json({ message: "Succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.delete("/api/notifications/:id", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query("DELETE FROM notifications WHERE id = ? AND user_id = ?", [
        req.params.id,
        req.user.id,
      ]);
    res.json({ message: "Succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== REGISTER (OTP EMAIL) ===================== */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "Champs manquants" });

    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "Mot de passe trop court (min 8 caractères)" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // generate OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const sql = `
      INSERT INTO users 
      (name, email, password, phone, address, is_verified, email_verification_code, email_verification_expires)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `;

    db.query(
      sql,
      [
        name,
        email,
        hashedPassword,
        phone || null,
        address || null,
        code,
        expires,
      ],
      async (err) => {
        if (err) {
          console.log("REGISTER ERROR:", err);
          return res.status(400).json({ message: "Email déjà utilisé" });
        }

        // send email
        try {
          await sendVerificationEmail(email, code);
        } catch (mailErr) {
          console.log("EMAIL ERROR:", mailErr);
        }

        res.status(201).json({
          message: "Compte créé. Code envoyé par email.",
          email,
        });
      },
    );
  } catch (error) {
    console.log("REGISTER SERVER ERROR:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== VERIFY EMAIL CODE ===================== */
app.post("/api/auth/verify-email", (req, res) => {
  const { email, code } = req.body;

  if (!email || !code)
    return res.status(400).json({ message: "Champs manquants" });

  const sql = `
    SELECT id, is_verified, email_verification_code, email_verification_expires
    FROM users
    WHERE email = ?
  `;

  db.query(sql, [email], (err, results) => {
    if (err || results.length === 0)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    const user = results[0];

    if (user.is_verified === 1)
      return res.json({ message: "Email déjà vérifié" });

    if (user.email_verification_code !== code)
      return res.status(400).json({ message: "Code incorrect" });

    if (new Date(user.email_verification_expires) < new Date())
      return res.status(400).json({ message: "Code expiré" });

    const updateSql = `
      UPDATE users 
      SET is_verified = 1,
          email_verification_code = NULL,
          email_verification_expires = NULL
      WHERE email = ?
    `;

    db.query(updateSql, [email], (err2) => {
      if (err2) return res.status(500).json({ message: "Erreur serveur" });

      res.json({ message: "Email vérifié avec succès" });
    });
  });
});

/* ===================== LOGIN ===================== */
/* ===================== LOGIN ===================== */
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email et mot de passe requis",
    });
  }

  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("LOGIN DB ERROR:", err);
      return res.status(500).json({
        message: "Erreur serveur",
      });
    }

    if (results.length === 0) {
      return res.status(401).json({
        message: "Email invalide",
      });
    }

    const user = results[0];

    // 🔵 COMPTE GOOGLE
    if (!user.password) {
      return res.status(401).json({
        message: "Ce compte utilise Google. Connectez-vous avec Google.",
      });
    }

    // 🔴 EMAIL NON VERIFIE
    if (user.is_verified === 0) {
      return res.status(403).json({
        message: "Compte non vérifié",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    // 🔴 COMPTE DESACTIVE
    if (user.statut === 0) {
      return res.status(403).json({
        message: "Votre compte est désactivé. Contactez l’administrateur.",
      });
    }

    // 🔐 VERIFICATION PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Mot de passe incorrect",
      });
    }

    // 🔐 GENERATION JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: false, // mettre true en production HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 1 jour en millisecondes
    });

    return res.json({
      message: "Connexion réussie",
      token: token,
    });
  });
});
/* ===================== RESEND VERIFICATION CODE ===================== */
app.post("/api/auth/resend-verification-code", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    // 🔎 Vérifier si utilisateur existe
    const [rows] = await db
      .promise()
      .query("SELECT id, is_verified FROM users WHERE email = ?", [email]);

    if (!rows.length) {
      return res.status(404).json({
        message: "Utilisateur introuvable",
      });
    }

    const user = rows[0];

    // ✅ Si déjà vérifié
    if (user.is_verified === 1) {
      return res.status(400).json({
        message: "Compte déjà vérifié",
      });
    }

    // 🔥 Générer nouveau code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await db.promise().query(
      `
      UPDATE users
      SET email_verification_code = ?,
          email_verification_expires = ?
      WHERE email = ?
      `,
      [code, expires, email],
    );

    // 🔥 Envoi email
    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr) {
      console.error("RESEND EMAIL ERROR:", mailErr);
      return res.status(500).json({
        message: "Erreur lors de l'envoi de l'email",
      });
    }

    return res.json({
      message: "Nouveau code envoyé avec succès",
    });
  } catch (err) {
    console.error("RESEND VERIFY ERROR:", err);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
});
app.post("/api/auth/certify", verifyToken, async (req, res) => {
  try {
    const {
      matricule_fiscale,
      adresse,
      ville,
      code_postal,
      ttn_login,
      ttn_password,
    } = req.body;

    if (
      !matricule_fiscale ||
      !adresse ||
      !ville ||
      !code_postal ||
      !ttn_login
    ) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires",
      });
    }

    let query = `
      UPDATE users
      SET matricule_fiscale = ?,
          adresse = ?,
          ville = ?,
          code_postal = ?,
          ttn_login = ?
    `;

    const values = [matricule_fiscale, adresse, ville, code_postal, ttn_login];

    // 🔐 Si nouveau mot de passe fourni
    if (ttn_password) {
      const hashedTTN = await bcrypt.hash(ttn_password, 10);
      query += `, ttn_password = ?`;
      values.push(hashedTTN);
    }

    query += `, certified = 1 WHERE id = ?`;
    values.push(req.user.id);

    await db.promise().query(query, values);

    res.json({
      message: "Informations mises à jour avec succès",
      status: "CERTIFIED",
    });
  } catch (err) {
    console.error("CERTIFY ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/* ===================== GET CERTIFICATION INFO ===================== */
app.get("/api/auth/certification-info", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT
        matricule_fiscale,
        adresse,
        ville,
        code_postal,
        ttn_login,
        certified
      FROM users
      WHERE id = ?
      `,
      [req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Utilisateur introuvable",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("GET CERTIFICATION INFO ERROR:", err);
    res.status(500).json({
      message: "Erreur serveur",
    });
  }
});
/* ===================== forgetpassword ===================== */
app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email manquant" });

  const sql = "SELECT id, password FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    // ✅ réponse générique (sécurité)
    if (err)
      return res.json({ message: "Si l'email existe, un code a été envoyé." });
    if (results.length === 0)
      return res.json({ message: "Si l'email existe, un code a été envoyé." });

    const user = results[0];

    // si user Google (password vide)
    if (!user.password) {
      return res.status(400).json({
        message: "Ce compte utilise Google. Connectez-vous avec Google.",
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const updateSql =
      "UPDATE users SET reset_code = ?, reset_expires = ? WHERE email = ?";
    db.query(updateSql, [code, expires, email], async (err2) => {
      if (err2) return res.status(500).json({ message: "Erreur serveur" });

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Code de réinitialisation du mot de passe",
          html: `
            <h2>Réinitialisation du mot de passe</h2>
            <p>Votre code est :</p>
            <h1 style="letter-spacing:3px;">${code}</h1>
            <p>Ce code expire dans 10 minutes.</p>
          `,
        });
      } catch (mailErr) {
        console.log("RESET MAIL ERROR:", mailErr);
      }

      return res.json({ message: "Si l'email existe, un code a été envoyé." });
    });
  });
});

/* ===================== verify-reset-code ===================== */
app.post("/api/auth/verify-reset-code", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code)
    return res.status(400).json({ message: "Champs manquants" });

  const sql = "SELECT reset_code, reset_expires FROM users WHERE email = ?";
  db.query(sql, [email], (err, results) => {
    if (err || results.length === 0)
      return res.status(400).json({ message: "Code invalide" });

    const user = results[0];
    if (!user.reset_code || user.reset_code !== code)
      return res.status(400).json({ message: "Code invalide" });

    if (new Date(user.reset_expires) < new Date())
      return res.status(400).json({ message: "Code expiré" });

    res.json({ message: "Code valide" });
  });
});

/* ===================== reset-password===================== */
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword)
      return res.status(400).json({ message: "Champs manquants" });

    if (newPassword.length < 8)
      return res
        .status(400)
        .json({ message: "Mot de passe trop court (min 8 caractères)" });

    const sql = "SELECT reset_code, reset_expires FROM users WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
      if (err || results.length === 0)
        return res.status(400).json({ message: "Code invalide" });

      const user = results[0];

      if (!user.reset_code || user.reset_code !== code)
        return res.status(400).json({ message: "Code invalide" });

      if (new Date(user.reset_expires) < new Date())
        return res.status(400).json({ message: "Code expiré" });

      const hashed = await bcrypt.hash(newPassword, 10);

      const updateSql =
        "UPDATE users SET password = ?, reset_code = NULL, reset_expires = NULL WHERE email = ?";
      db.query(updateSql, [hashed, email], (err2) => {
        if (err2) return res.status(500).json({ message: "Erreur serveur" });

        res.json({ message: "Mot de passe réinitialisé avec succès" });
      });
    });
  } catch (e) {
    console.log("RESET PASSWORD ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/*============== renvoyer le code ============*/
app.post("/api/auth/resend-reset-code", (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email manquant" });

  const sql = "SELECT id, password FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err || results.length === 0)
      return res.json({ message: "Si l'email existe, un code a été renvoyé." });

    const user = results[0];

    // si compte Google
    if (!user.password) {
      return res.status(400).json({
        message: "Ce compte utilise Google. Connectez-vous avec Google.",
      });
    }

    // nouveau code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    const updateSql =
      "UPDATE users SET reset_code = ?, reset_expires = ? WHERE email = ?";
    db.query(updateSql, [code, expires, email], async (err2) => {
      if (err2) return res.status(500).json({ message: "Erreur serveur" });

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Nouveau code de réinitialisation",
          html: `
            <h2>Réinitialisation du mot de passe</h2>
            <p>Voici votre nouveau code :</p>
            <h1 style="letter-spacing:3px;">${code}</h1>
            <p>Ce code expire dans 10 minutes.</p>
          `,
        });
      } catch (mailErr) {
        console.log("RESEND RESET MAIL ERROR:", mailErr);
      }

      return res.json({ message: "Code renvoyé avec succès." });
    });
  });
});

/* ===================== GET USER ===================== */
app.get("/api/auth/me", verifyToken, (req, res) => {
  const sql = `
    SELECT 
      id,
      name,
      email,
      role,
      phone,
      address,
      matricule_fiscale,
      adresse,
      ville,
      code_postal,
      ttn_login,
      certified,
      is_verified,
      total_jetons
    FROM users 
    WHERE id = ?
  `;

  db.query(sql, [req.user.id], (err, results) => {
    if (err || results.length === 0)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json(results[0]);
  });
});

/* ===================== UPDATE PROFILE ===================== */
app.put("/api/auth/profile", verifyToken, (req, res) => {
  const { name, phone, address } = req.body;

  if (!name) return res.status(400).json({ message: "Le nom est obligatoire" });

  const sql = "UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?";
  db.query(sql, [name, phone || null, address || null, req.user.id], (err) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });

    const getSql =
      "SELECT id, name, email, role, phone, address, is_verified FROM users WHERE id = ?";
    db.query(getSql, [req.user.id], (err2, results) => {
      if (err2 || results.length === 0)
        return res.status(500).json({ message: "Erreur serveur" });

      res.json({ message: "Profil mis à jour", user: results[0] });
    });
  });
});

/* ===================== LOGOUT ===================== */
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Déconnecté" });
});

/* ===================== NOTIFICATIONS ===================== */
// Récupérer les notifications de l'utilisateur
app.get("/api/notifications", verifyToken, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.user.id],
      );
    res.json(rows);
  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Marquer une notification comme lue
app.put("/api/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query(
        `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
      );
    res.json({ message: "Notification marquée comme lue" });
  } catch (err) {
    console.error("READ NOTIFICATION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Marquer toutes les notifications comme lues
app.put("/api/notifications/read-all", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [
        req.user.id,
      ]);
    res.json({ message: "Toutes les notifications marquées comme lues" });
  } catch (err) {
    console.error("READ ALL NOTIFICATIONS ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Supprimer une notification
app.delete("/api/notifications/:id", verifyToken, async (req, res) => {
  try {
    await db
      .promise()
      .query(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [
        req.params.id,
        req.user.id,
      ]);
    res.json({ message: "Notification supprimée" });
  } catch (err) {
    console.error("DELETE NOTIFICATION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/*récupérer les factures utilisables*/
// Récupérer les factures liées à l'utilisateur (en fonction des transactions associées)
app.get("/api/factures", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        td.id,
        td.filename,
        td.invoice_number,
        td.statut,
        td.created_at,
        td.signed_at,
        t.id AS transaction_id,
        t.facture_number
      FROM transaction_documents td
      JOIN transactions t ON t.id = td.transaction_id
      WHERE t.user_id = ?
      ORDER BY td.id DESC
      `,
      [req.user.id],
    );

    res.json(rows || []);
  } catch (err) {
    console.error("FACTURES ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== FACTURES (UPLOAD PDF) ===================== */
/* ===================== FACTURES (BASE64) ===================== */
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get("/api/my-transaction-factures", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        td.id,
        td.filename,
        td.invoice_number,
        td.statut,
        td.created_at,
        t.id AS transaction_id
      FROM transaction_documents td
      JOIN transactions t ON t.id = td.transaction_id
      WHERE t.user_id = ?
      ORDER BY td.id DESC
      `,
      [req.user.id],
    );

    res.json(rows || []);
  } catch (err) {
    console.error("MY TX FACTURES ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
app.get(
  "/api/my-transaction-factures/:docId/pdf",
  verifyToken,
  async (req, res) => {
    try {
      const { docId } = req.params;

      const [rows] = await db.promise().query(
        `
      SELECT d.pdf_file, d.filename, t.user_id
      FROM transaction_documents d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.id = ?
      `,
        [docId],
      );

      if (!rows.length || rows[0].user_id !== req.user.id) {
        return res.status(404).json({ message: "Document introuvable" });
      }

      const pdfBuffer = Buffer.from(rows[0].pdf_file, "base64");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${rows[0].filename}.pdf"`,
      );

      res.send(pdfBuffer);
    } catch (err) {
      console.error("DOWNLOAD DOC ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* LIST factures disponibles (en attente) */
app.get("/api/factures/available", verifyToken, (req, res) => {
  const sql = `
    SELECT id, statut, file_name
    FROM factures
    WHERE user_id = ?
      AND statut = 'en attente'
    ORDER BY id DESC
  `;
  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results || []);
  });
});

/* DOWNLOAD facture -> decode base64 */

/* ===================== TRANSACTIONS ===================== */
/* ===================== CRÉATION TRANSACTION ===================== */
/* ===================== TRANSACTIONS (BASE64) ===================== */
app.post(
  "/api/transactions",
  verifyToken,
  upload.fields([
    { name: "pdf_files", maxCount: 50 },
    { name: "xml_files", maxCount: 50 },
  ]),
  async (req, res) => {
    try {
      const {
        facture_number,
        signataire_email,
        client_email,
        qr_config,
        ref_config,
      } = req.body;

      if (!facture_number || !signataire_email || !client_email) {
        return res.status(400).json({ message: "Champs manquants" });
      }
      // 🔥 Vérifier certification
      const [userCheck] = await db
        .promise()
        .query("SELECT certified FROM users WHERE id = ?", [req.user.id]);

      if (!userCheck.length || userCheck[0].certified === 0) {
        return res.status(403).json({
          message:
            "Votre compte doit être certifié avant de créer une transaction",
        });
      }
      // 🔥 CONFIGURATION PROPRE
      const qrConfig =
        typeof qr_config === "string" ? JSON.parse(qr_config) : qr_config || {};

      const refConfig =
        typeof ref_config === "string"
          ? JSON.parse(ref_config)
          : ref_config || {};

      const [txRes] = await db.promise().query(
        `
        INSERT INTO transactions
        (facture_number, signataire_email, client_email, user_id, statut, qr_config, ref_config)
        VALUES (?, ?, ?, ?, 'créé', ?, ?)
        `,
        [
          facture_number,
          signataire_email,
          client_email,
          req.user.id,
          JSON.stringify(qrConfig),
          JSON.stringify(refConfig),
        ],
      );

      const transactionId = txRes.insertId;

      const pdfFiles = req.files?.pdf_files || [];
      const xmlFiles = req.files?.xml_files || [];

      if (pdfFiles.length !== xmlFiles.length) {
        return res.status(400).json({ message: "Mismatch PDF/XML" });
      }

      for (let i = 0; i < pdfFiles.length; i++) {
        await db.promise().query(
          `
          INSERT INTO transaction_documents
          (transaction_id, filename, invoice_number, pdf_file, xml_file, statut)
          VALUES (?, ?, ?, ?, ?, 'créé')
          `,
          [
            transactionId,
            path.parse(pdfFiles[i].originalname).name,
            facture_number,
            pdfFiles[i].buffer.toString("base64"),
            xmlFiles[i].buffer.toString("base64"),
          ],
        );
      }

      await sendSignatureEmail(signataire_email, transactionId);
      await createNotification(
        req.user.id,
        "Nouvelle transaction créée",
        `Transaction #${transactionId} créée avec succès`,
        "success",
      );
      res.status(201).json({
        message: "Transaction créée",
        transactionId,
      });
    } catch (err) {
      console.error("CREATE TX ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);
/* ===================== DELETE TRANSACTION ===================== */
app.delete("/api/transactions/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 🔎 Vérifier transaction + propriétaire
    const [rows] = await db.promise().query(
      `
      SELECT id, user_id, statut
      FROM transactions
      WHERE id = ?
      `,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Transaction introuvable" });
    }

    const transaction = rows[0];

    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // ❌ Interdire suppression si signée
    if (
      transaction.statut === "signée" ||
      transaction.statut === "signée_ttn"
    ) {
      return res.status(400).json({
        message: "Impossible de supprimer une transaction signée",
      });
    }

    // 🗑 Soft delete transaction
    await db.promise().query(
      `
      UPDATE transactions
      SET statut = 'supprimée', date_suppression = NOW()
      WHERE id = ?
      `,
      [id],
    );

    // Mettre à jour aussi les documents
    await db.promise().query(
      `
      UPDATE transaction_documents
      SET statut = 'supprimée'
      WHERE transaction_id = ?
      `,
      [id],
    );

    await createNotification(
      req.user.id,
      "Transaction supprimée",
      `La transaction #${id} a été supprimée`,
      "info",
    );

    res.json({ message: "Transaction supprimée avec succès" });
  } catch (err) {
    console.error("DELETE TX ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/* ===================== EXTERNAL CREATE TRANSACTION ===================== */
/* ===================== EXTERNAL CREATE TRANSACTION (MULTIPART -> BASE64) ===================== */
/* ===================== EXTERNAL CREATE TRANSACTION (JSON MULTI) ===================== */
/*
POST /api/external/transactions
Authorization: Bearer <API_TOKEN>

Body example:
{
  "signer_email":"profiletestdigigo@yopmail.com",
  "clientEmail":"contact@ng-sign.com",
  "invoices":[
    {
      "invoiceNumber":"12345",
      "invoiceTIEF":"<TEIF>...</TEIF>" OR "BASE64....",
      "invoiceFileB64":"JVBERi0xLjQK..."  // PDF base64
    }
  ]
}
*/
app.post("/api/external/transactions", verifyApiToken, async (req, res) => {
  try {
    // 🔥 TOKEN SAFE
    const [updateToken] = await db.promise().query(
      `
  UPDATE users
  SET total_jetons = total_jetons - 1
  WHERE id = ? AND total_jetons > 0
  `,
      [req.apiUser.id],
    );

    if (!updateToken.affectedRows) {
      return res.status(402).json({
        message: "Jetons insuffisants",
      });
    }

    const { signer_email, clientEmail, invoices } = req.body;

    // ==============================
    // VALIDATION
    // ==============================
    if (!signer_email || !clientEmail) {
      return res
        .status(400)
        .json({ message: "Champs manquants: signer_email, clientEmail" });
    }

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ message: "invoices[] requis" });
    }

    // ==============================
    // CREER TRANSACTION (facture_number = 1er invoiceNumber)
    // ==============================
    const firstInvoiceNumber = String(invoices[0]?.invoiceNumber || "").trim();
    if (!firstInvoiceNumber) {
      return res.status(400).json({
        message: "invoiceNumber requis (au moins pour la 1ere facture)",
      });
    }

    const [txRes] = await db.promise().query(
      `
        INSERT INTO transactions
        (facture_number, signataire_email, client_email, user_id, statut)
        VALUES (?, ?, ?, ?, 'créé')
      `,
      [firstInvoiceNumber, signer_email, clientEmail, req.apiUser.id],
    );

    const transactionId = txRes.insertId;

    // ==============================
    // INSERER DOCUMENTS
    // ==============================
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];

      const invoiceNumber = String(inv?.invoiceNumber || "").trim();
      const pdfB64 = String(
        inv?.invoiceFileB64 || inv?.invoiceFileB64 || "",
      ).trim(); // accepte invoiceFileB64
      const xmlB64 = ensureBase64String(inv?.invoiceTIEF);

      if (!invoiceNumber || !pdfB64 || !xmlB64) {
        return res.status(400).json({
          message: `invoiceNumber, invoiceFileB64, invoiceTIEF requis (index ${i})`,
        });
      }

      // filename = invoiceNumber (safe)
      const filename = invoiceNumber
        .toLowerCase()
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 120);

      await db.promise().query(
        `
          INSERT INTO transaction_documents
          (transaction_id, filename, invoice_number, pdf_file, xml_file, statut)
          VALUES (?, ?, ?, ?, ?, 'créé')
        `,
        [transactionId, filename, invoiceNumber, pdfB64, xmlB64],
      );
    }

    // email signature
    await sendSignatureEmail(signer_email, transactionId);

    res.status(201).json({
      message: "Transaction créée via API (JSON)",
      transactionId,
      facture_number: firstInvoiceNumber,
      invoicesCount: invoices.length,
    });
  } catch (e) {
    console.error("EXTERNAL TX JSON ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== EXTERNAL CREATE TRANSACTION (JSON BASE64) ===================== */
/*
POST /api/external/transactions/json
Headers:
  x-api-key: <TOKEN>

Body example:
{
  "facture_number":"TRX-1",
  "signer_email":"profiletestdigigo@yopmail.com",
  "clientEmail":"contact@ng-sign.com",
  "invoices":[
    {
      "invoiceNumber":"12345",
      "invoiceTIEF":"<TEIF>...</TEIF>" OR "BASE64....",
      "invoiceFileB64":"JVBERi0xLjQK..."
    }
  ]
}
*/
app.post(
  "/api/external/transactions/json",
  verifyApiToken,
  async (req, res) => {
    try {
      const { facture_number, signer_email, clientEmail, invoices } = req.body;

      if (!facture_number || !signer_email || !clientEmail)
        return res.status(400).json({ message: "Champs manquants" });

      if (!Array.isArray(invoices) || !invoices.length)
        return res.status(400).json({ message: "invoices[] requis" });

      const [txRes] = await db.promise().query(
        `
        INSERT INTO transactions
        (facture_number, signataire_email, client_email, user_id, statut)
        VALUES (?, ?, ?, ?, 'créé')
      `,
        [facture_number, signer_email, clientEmail, req.apiUser.id],
      );

      const transactionId = txRes.insertId;

      for (const inv of invoices) {
        const invoiceNumber = String(inv.invoiceNumber || "").trim();
        const pdfB64 = String(inv.invoiceFileB64 || "").trim();
        const xmlB64 = ensureBase64String(inv.invoiceTIEF);

        if (!invoiceNumber || !pdfB64 || !xmlB64)
          return res.status(400).json({
            message: "invoiceNumber, invoiceFileB64, invoiceTIEF requis",
          });

        const filename = invoiceNumber.toLowerCase();

        const invoiceUniqueNumber = `INV-${transactionId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        await db.promise().query(
          `
          INSERT INTO transaction_documents
          (transaction_id, filename, invoice_number, pdf_file, xml_file, statut)
          VALUES (?, ?, ?, ?, ?, 'créé')
        `,
          [transactionId, filename, invoiceUniqueNumber, pdfB64, xmlB64],
        );
      }

      res
        .status(201)
        .json({ message: "Transaction créée (JSON)", transactionId });
    } catch (e) {
      console.error("EXTERNAL JSON TX ERROR:", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== EXTERNAL DOWNLOAD ZIP (BASE64) ===================== */
app.get(
  "/api/external/transactions/:id/zip",
  verifyApiToken,
  async (req, res) => {
    const { id } = req.params;

    const [txRows] = await db
      .promise()
      .query("SELECT id FROM transactions WHERE id = ? AND user_id = ?", [
        id,
        req.apiUser.id,
      ]);

    if (!txRows.length)
      return res.status(404).json({ message: "Transaction introuvable" });

    // 🔥 IMPORTANT : AJOUT xml_signed_ttn
    const [docs] = await db.promise().query(
      `
    SELECT 
      filename, 
      pdf_file, 
      xml_file, 
      xml_signed, 
      xml_signed_ttn, 
      statut
    FROM transaction_documents
    WHERE transaction_id = ?
    `,
      [id],
    );

    const zip = new JSZip();

    docs.forEach((d) => {
      const pdfBuffer = Buffer.from(d.pdf_file, "base64");
      zip.file(`${d.filename}.pdf`, pdfBuffer);

      let xmlToUse;

      if (d.statut === "signée_ttn" && d.xml_signed_ttn) {
        xmlToUse = d.xml_signed_ttn;
        console.log("XML TTN utilisé:", d.filename);
      } else if (
        (d.statut === "signée" || d.statut === "refusée par TTN") &&
        d.xml_signed
      ) {
        xmlToUse = d.xml_signed;
      } else {
        xmlToUse = d.xml_file;
      }

      if (!xmlToUse) return;

      const xmlBuffer = Buffer.from(xmlToUse, "base64");
      zip.file(`${d.filename}.xml`, xmlBuffer);
    });

    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transaction_${id}.zip`,
    );

    res.send(content);
  },
);

/* ===================== EXTERNAL LIST FACTURES ===================== */
app.get("/api/external/factures", verifyApiToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
        SELECT 
          id,
          file_name,
          statut,
          date_facture
        FROM factures
        WHERE user_id = ?
        ORDER BY id DESC
        `,
      [req.apiUser.id],
    );

    res.json({
      total: rows.length,
      factures: rows,
    });
  } catch (err) {
    console.error("EXTERNAL LIST FACTURES ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

////Lister les docs d’une transaction (PUBLIC pour page signature)
app.get("/api/public/transactions/:id/docs", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.promise().query(
      `
      SELECT id, filename, statut
      FROM transaction_documents
      WHERE transaction_id = ?
      ORDER BY id ASC
      `,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Transaction introuvable" });
    }

    res.json(rows);
  } catch (e) {
    console.error("PUBLIC DOCS ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
///////Afficher PDF d’un doc (PUBLIC)
app.get("/api/public/docs/:docId/pdf", async (req, res) => {
  const { docId } = req.params;

  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT pdf_file, filename FROM transaction_documents WHERE id = ?`,
        [docId],
      );

    if (!rows.length)
      return res.status(404).json({ message: "Doc non trouvé" });

    const pdfBuffer = Buffer.from(rows[0].pdf_file, "base64");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=${rows[0].filename}.pdf`,
    );
    res.send(pdfBuffer);
  } catch (e) {
    console.error("PUBLIC PDF ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/transactions", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        t.id,
        t.facture_number,
        t.statut,
        t.date_creation,
        t.date_suppression,
        u.name AS user_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.user_id = ?
      ORDER BY t.id DESC
      `,
      [req.user.id],
    );

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/transactions/:id/docs", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        id,
        filename,
        invoice_number,
        statut,
        created_at,
        signed_at
      FROM transaction_documents
      WHERE transaction_id = ?
      ORDER BY id DESC
      `,
      [req.params.id],
    );

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/transactions/:id/details", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        t.*,
        u.name AS user_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
      `,
      [req.params.id],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Transaction introuvable" });

    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

//*telecharger le fichier xml selon le statut
app.get("/api/transactions/:id/download", verifyToken, async (req, res) => {
  const { id } = req.params;
  const fileType = req.query.type || "pdf";

  try {
    const [docs] = await db.promise().query(
      `
      SELECT d.*, t.user_id
      FROM transaction_documents d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.transaction_id = ?
      `,
      [id],
    );

    if (!docs.length || docs[0].user_id !== req.user.id)
      return res.status(404).json({ message: "Transaction non trouvée" });

    const doc = docs[0];

    let fileBuffer;
    let contentType;
    let filename;

    if (fileType === "xml") {
      if (doc.statut === "signée_ttn" && doc.xml_signed_ttn)
        fileBuffer = doc.xml_signed_ttn;
      else if (
        (doc.statut === "signée" || doc.statut === "refusée par TTN") &&
        doc.xml_signed
      )
        fileBuffer = doc.xml_signed;
      else fileBuffer = doc.xml_file;

      contentType = "application/xml";
      filename = `${doc.filename}.xml`;
    } else {
      fileBuffer = doc.pdf_file;
      contentType = "application/pdf";
      filename = `${doc.filename}.pdf`;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    res.send(Buffer.from(fileBuffer, "base64"));
  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
//*telecharger le fichier zip selon le statut
app.get("/api/transactions/:id/zip", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [txRows] = await db
      .promise()
      .query("SELECT * FROM transactions WHERE id = ?", [id]);

    if (!txRows.length || txRows[0].user_id !== req.user.id)
      return res.status(404).json({ message: "Transaction non trouvée" });

    const [docs] = await db
      .promise()
      .query(`SELECT * FROM transaction_documents WHERE transaction_id = ?`, [
        id,
      ]);

    const zip = new JSZip();

    for (const d of docs) {
      let xmlToUse;

      if (d.statut === "signée_ttn" && d.xml_signed_ttn)
        xmlToUse = d.xml_signed_ttn;
      else if (
        (d.statut === "signée" || d.statut === "refusée par TTN") &&
        d.xml_signed
      )
        xmlToUse = d.xml_signed;
      else xmlToUse = d.xml_file;

      // ON PREND LE PDF TEL QUEL (déjà stampé à la signature)
      zip.file(`${d.filename}.pdf`, Buffer.from(d.pdf_file, "base64"));
      zip.file(`${d.filename}.xml`, Buffer.from(xmlToUse, "base64"));
    }

    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transaction_${id}.zip`,
    );

    res.send(content);
  } catch (err) {
    console.error("ZIP ERROR:", err);
    res.status(500).json({ message: "Erreur ZIP" });
  }
});

//* ADMIN : telecharger le fichier zip complet d'une transaction sans check user_id
app.get(
  "/api/admin/transactions/:id/zip",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [txRows] = await db
        .promise()
        .query("SELECT * FROM transactions WHERE id = ?", [id]);
      if (!txRows.length)
        return res.status(404).json({ message: "Transaction non trouvée" });

      const [docs] = await db
        .promise()
        .query(`SELECT * FROM transaction_documents WHERE transaction_id = ?`, [
          id,
        ]);

      const zip = new JSZip();

      for (const d of docs) {
        let xmlToUse = d.xml_file;
        if (d.statut === "signée_ttn" && d.xml_signed_ttn)
          xmlToUse = d.xml_signed_ttn;
        else if (
          (d.statut === "signée" || d.statut === "refusée par TTN") &&
          d.xml_signed
        )
          xmlToUse = d.xml_signed;

        zip.file(`${d.filename}.pdf`, Buffer.from(d.pdf_file, "base64"));
        zip.file(`${d.filename}.xml`, Buffer.from(xmlToUse, "base64"));
      }

      const content = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transaction_admin_${id}.zip`,
      );
      res.send(content);
    } catch (err) {
      console.error("ADMIN ZIP ERROR:", err);
      res
        .status(500)
        .json({ message: "Erreur lors de la génération du ZIP Admin" });
    }
  },
);

/* ===================== STATISTIQUES ===================== */
/* ===================== STATISTIQUE USER ===================== */
/* ===================== RESEND TO TTN (Universal Route) ===================== */
// Supports:
// POST /api/resend-ttn (body: {transaction_id})
// POST /api/transactions/:id/resend-ttn
// POST /api/admin/transactions/:id/resend-ttn
const handleResendTTNCore = async (req, res) => {
  const transaction_id = req.params.id || req.body.transaction_id;

  if (!transaction_id)
    return res.status(400).json({ message: "ID transaction requis" });

  try {
    const [txRows] = await db
      .promise()
      .query(
        "SELECT id, user_id, client_email, qr_config, ref_config FROM transactions WHERE id = ?",
        [transaction_id],
      );

    if (!txRows.length)
      return res.status(404).json({ message: "Transaction non trouvée" });

    const tx = txRows[0];

    // Vérifier si l'utilisateur est propriétaire ou admin
    if (req.user.role !== "ADMIN" && tx.user_id !== req.user.id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // Récupérer les documents refusés OU signés (si on veut tout renvoyer)
    // Mais ici le besoin est spécifiquement pour les refusés par default
    const [docs] = await db
      .promise()
      .query(
        "SELECT * FROM transaction_documents WHERE transaction_id = ? AND (statut = 'refusée par TTN' OR statut = 'signée')",
        [transaction_id],
      );

    if (!docs.length) {
      return res.status(400).json({
        message:
          "La transaction n'est pas dans un état permettant le renvoi (doit être Signée ou Refusée par TTN)",
      });
    }

    // Réinitialiser le statut de la transaction
    await db
      .promise()
      .query("UPDATE transactions SET statut = 'en attente TTN' WHERE id = ?", [
        transaction_id,
      ]);

    // Réinitialiser le statut des documents pour qu'ils soient retraités
    await db
      .promise()
      .query(
        "UPDATE transaction_documents SET statut = 'signée' WHERE transaction_id = ? AND (statut = 'refusée par TTN' OR statut = 'signée')",
        [transaction_id],
      );

    // Lancer le traitement en tâche de fond
    processTTNSubmission(
      tx.id,
      docs,
      tx.user_id,
      tx.client_email,
      tx.qr_config,
      tx.ref_config,
    );

    res.json({ message: "La transaction a été relancée vers TTN" });
  } catch (err) {
    console.error("RESEND TTN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

app.post("/api/resend-ttn", verifyToken, handleResendTTNCore);
app.post("/api/transactions/:id/resend-ttn", verifyToken, handleResendTTNCore);
app.post(
  "/api/admin/transactions/:id/resend-ttn",
  verifyToken,
  handleResendTTNCore,
);

/* ===================== DASHBOARD STATS ===================== */
app.get("/api/dashboard/stats", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (isAdmin) {
      // 🌍 STATS GLOBALES (ADMIN)
      const [txResult, userResult, orgResult] = await Promise.all([
        db.promise().query(
          `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN (statut LIKE '%signe%' OR statut LIKE '%signé%') THEN 1 ELSE 0 END) as signed
          FROM transactions 
          `,
        ),
        db.promise().query(
          `
          SELECT 
            SUM(total_jetons) as total_jetons,
            COUNT(*) as total_users
          FROM users
          `,
        ),
        db.promise().query(
          `
          SELECT COUNT(*) as total FROM organizations
          `,
        ),
      ]);

      return res.json({
        transactions: txResult[0][0].total || 0,
        signatures: userResult[0][0].total_users || 0, // Dans le grid admin on affiche users
        factures: txResult[0][0].signed || 0, // Dans le grid admin on affiche signées
        totalJetons: userResult[0][0].total_jetons || 0,
        organizations: orgResult[0][0].total || 0,
      });
    }

    // 👤 STATS PERSONNELLES (USER)
    const [txResult, docsResult, userResult] = await Promise.all([
      db.promise().query(
        `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN (statut LIKE '%signe%' OR statut LIKE '%signé%') THEN 1 ELSE 0 END) as signed
        FROM transactions 
        WHERE user_id = ?
      `,
        [userId],
      ),
      db.promise().query(
        `
        SELECT COUNT(*) as total 
        FROM transaction_documents td
        JOIN transactions t ON t.id = td.transaction_id
        WHERE t.user_id = ?
      `,
        [userId],
      ),
      db.promise().query(
        `
        SELECT total_jetons FROM users WHERE id = ?
      `,
        [userId],
      ),
    ]);

    res.json({
      transactions: txResult[0][0].total || 0,
      signatures: txResult[0][0].signed || 0,
      factures: docsResult[0][0].total || 0,
      totalJetons: userResult[0][0].total_jetons || 0,
    });
  } catch (err) {
    console.error("DASHBOARD STATS ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/statistiquesUSER", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const normalizeStatus = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const [
      txTotalResult,
      txByStatusResult,
      docsByStatusResult,
      txByMonthResult,
    ] = await Promise.all([
      // Total transactions
      db
        .promise()
        .query("SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?", [
          userId,
        ]),

      // Transactions par statut
      db.promise().query(
        `
        SELECT statut, COUNT(*) AS total
        FROM transactions
        WHERE user_id = ?
        GROUP BY statut
        `,
        [userId],
      ),

      // Documents (factures) par statut
      db.promise().query(
        `
        SELECT td.statut, COUNT(*) AS total
        FROM transaction_documents td
        JOIN transactions t ON t.id = td.transaction_id
        WHERE t.user_id = ?
        GROUP BY td.statut
        `,
        [userId],
      ),

      // Transactions par mois
      db.promise().query(
        `
        SELECT MONTH(date_creation) AS mois, COUNT(*) AS total
        FROM transactions
        WHERE user_id = ?
        GROUP BY MONTH(date_creation)
        ORDER BY mois
        `,
        [userId],
      ),
    ]);

    const txTotal = txTotalResult[0][0]?.total || 0;
    const txByStatus = txByStatusResult[0];
    const docsByStatus = docsByStatusResult[0];
    const txByMonth = txByMonthResult[0];

    // =============================
    // TRANSACTIONS
    // =============================
    let transactionsCreees = 0;
    let transactionsSignees = 0;
    let transactionsAutres = 0;

    txByStatus.forEach((row) => {
      const status = normalizeStatus(row.statut);
      const total = Number(row.total || 0);

      if (status.includes("cree")) transactionsCreees += total;
      else if (status.includes("sign")) transactionsSignees += total;
      else transactionsAutres += total;
    });

    // =============================
    // DOCUMENTS (FACTURES)
    // =============================
    let facturesCreees = 0;
    let facturesSignees = 0;
    let facturesAutres = 0;

    docsByStatus.forEach((row) => {
      const status = normalizeStatus(row.statut);
      const total = Number(row.total || 0);

      if (status.includes("cree")) facturesCreees += total;
      else if (status.includes("sign")) facturesSignees += total;
      else facturesAutres += total;
    });

    const stats = {
      totalTransactions: txTotal,
      transactionsCreees,
      transactionsSignees,
      transactionsEnAttente: transactionsCreees + transactionsAutres,

      totalFactures: facturesCreees + facturesSignees + facturesAutres,
      facturesCreees,
      facturesSignees,
      facturesEnAttente: facturesCreees + facturesAutres,

      transactionsParMois: txByMonth.map((row) => ({
        mois: "M" + row.mois,
        total: Number(row.total || 0),
      })),
    };

    res.json(stats);
  } catch (err) {
    console.error("STAT USER ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

//*****************STATISTIQUE ADMIN****//////////////////////// */
app.get("/api/statistiqueadmin", verifyToken, async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "admin" && role !== "superadmin")
      return res.status(403).json({ message: "Accès refusé" });

    const normalizeStatus = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const [
      usersCountResult,
      txRowsResult,
      docsRowsResult,
      txByMonthResult,
      organizationsCountResult,
      utilisateursListeResult,
    ] = await Promise.all([
      // Total users
      db.promise().query("SELECT COUNT(*) AS total FROM users"),

      // Transactions + user
      db.promise().query(`
        SELECT 
          t.id, t.facture_number, t.signataire_email, t.client_email, t.user_id, t.statut, t.date_creation, t.signed_at,
          u.name AS user_name, u.email AS user_email
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.date_creation DESC
      `),

      // Documents (Exclure les BLOBs pour éviter de crasher l'app mobile par saturation JSON)
      db.promise().query(`
        SELECT 
          td.id, td.transaction_id, td.filename, td.invoice_number, td.statut, td.created_at, td.signed_at, td.signed_ttn_at,
          t.user_id, u.name AS user_name
        FROM transaction_documents td
        JOIN transactions t ON t.id = td.transaction_id
        JOIN users u ON u.id = t.user_id
        ORDER BY td.created_at DESC
      `),

      // Transactions par mois
      db.promise().query(`
        SELECT MONTH(date_creation) AS mois, COUNT(*) AS total
        FROM transactions
        GROUP BY MONTH(date_creation)
        ORDER BY mois
      `),

      // Total organizations
      db.promise().query("SELECT COUNT(*) AS total FROM organizations"),

      // Liste des utilisateurs (colonnes sûres uniquement)
      db
        .promise()
        .query(
          "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC",
        ),
    ]);

    const usersCount = usersCountResult[0][0]?.total || 0;
    const txRows = txRowsResult[0];
    const docsRows = docsRowsResult[0];
    const txByMonth = txByMonthResult[0];
    const organizationsCount = organizationsCountResult[0][0]?.total || 0;
    const utilisateursListe = utilisateursListeResult[0] || [];

    let transactionsCreees = 0;
    let transactionsSignees = 0;

    txRows.forEach((row) => {
      const status = normalizeStatus(row.statut);
      if (status.includes("cree")) transactionsCreees++;
      else if (status.includes("sign")) transactionsSignees++;
    });

    let facturesCreees = 0;
    let facturesSignees = 0;

    docsRows.forEach((row) => {
      const status = normalizeStatus(row.statut);
      if (status.includes("cree")) facturesCreees++;
      else if (status.includes("sign")) facturesSignees++;
    });

    // Online Users (active in the last 5 minutes) — safe fallback if column missing
    let onlineUsersCount = 0;
    try {
      const [onlineUsersResult] = await db
        .promise()
        .query(
          "SELECT COUNT(*) AS total FROM users WHERE last_activity >= NOW() - INTERVAL 5 MINUTE",
        );
      onlineUsersCount = onlineUsersResult[0]?.total || 0;
    } catch (e) {
      console.warn("⚠️ last_activity column not available:", e.message);
    }

    const stats = {
      utilisateurs: usersCount,
      onlineUsers: onlineUsersCount,
      totalOrganizations: organizationsCount,

      totalTransactions: txRows.length,
      transactionsCreees,
      transactionsSignees,
      transactionsEnAttente:
        transactionsCreees +
        (txRows.length - transactionsCreees - transactionsSignees),

      totalFactures: docsRows.length,
      facturesCreees,
      facturesSignees,
      facturesEnAttente:
        facturesCreees + (docsRows.length - facturesCreees - facturesSignees),

      transactionsParMois: txByMonth.map((row) => ({
        mois: "M" + row.mois,
        total: Number(row.total || 0),
      })),

      transactionsListe: txRows,
      facturesListe: docsRows,
      utilisateursListe: utilisateursListe,
    };

    res.json(stats);
  } catch (err) {
    console.error("STAT ADMIN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// 📄 Affichage PDF pour le signataire (PUBLIC)
app.get("/api/public/transactions/:id/pdf", (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT pdf_file FROM transactions WHERE id = ?",
    [id],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ message: "Document non trouvé" });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=document.pdf");
      res.send(results[0].pdf_file);
    },
  );
});
app.get("/api/docs/:docId/download", verifyToken, async (req, res) => {
  const { docId } = req.params;
  const fileType = req.query.type || "pdf";

  try {
    const [rows] = await db.promise().query(
      `
      SELECT d.*, t.user_id
      FROM transaction_documents d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.id = ?
      `,
      [docId],
    );

    if (!rows.length || rows[0].user_id !== req.user.id) {
      return res.status(404).json({ message: "Document non trouvé" });
    }

    const doc = rows[0];

    let fileBuffer;
    let contentType;
    let filename;

    if (fileType === "xml") {
      if (doc.statut === "signée_ttn" && doc.xml_signed_ttn)
        fileBuffer = doc.xml_signed_ttn;
      else if (
        (doc.statut === "signée" || doc.statut === "refusée par TTN") &&
        doc.xml_signed
      )
        fileBuffer = doc.xml_signed;
      else fileBuffer = doc.xml_file;

      contentType = "application/xml";
      filename = `${doc.filename}.xml`;
    } else {
      fileBuffer = doc.pdf_file;
      contentType = "application/pdf";
      filename = `${doc.filename}.pdf`;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    res.send(Buffer.from(fileBuffer, "base64"));
  } catch (err) {
    console.error("DOC DOWNLOAD ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
// ✍️ Signature logique (SSCD - sans signature manuscrite)
// ✍️ Signature XML (publique)
// ✍️ Signature XML (publique)
// ✍️ ÉTAPE 1 : Préparer la signature (Vérifier jetons et envoyer les XML au frontend)
app.get("/api/public/transactions/:id/prepare-signature", async (req, res) => {
  const { id } = req.params;

  try {
    const [txRows] = await db
      .promise()
      .query("SELECT id, user_id, statut FROM transactions WHERE id = ?", [id]);

    if (!txRows.length)
      return res.status(404).json({ message: "Transaction introuvable" });
    const transaction = txRows[0];

    // Vérifier les jetons
    const [userRows] = await db
      .promise()
      .query("SELECT total_jetons FROM users WHERE id = ?", [
        transaction.user_id,
      ]);
    if (!userRows.length || userRows[0].total_jetons <= 0) {
      return res
        .status(402)
        .json({ message: "Jetons insuffisants pour signer" });
    }

    const [docs] = await db
      .promise()
      .query(
        "SELECT id, filename, xml_file FROM transaction_documents WHERE transaction_id = ?",
        [id],
      );

    const docsToSign = docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      xmlBase64: d.xml_file,
    }));

    res.json({ docsToSign });
  } catch (err) {
    console.error("PREPARE SIGNATURE ERROR:", err);
    res
      .status(500)
      .json({ message: "Erreur lors de la préparation de la signature" });
  }
});

// ✍️ ÉTAPE 2 : Finaliser la signature (Recevoir les XML signés du local et enregistrer)
app.post(
  "/api/public/transactions/:id/finalize-signature",
  async (req, res) => {
    const { id } = req.params;
    const { signedResults } = req.body; // Array de {id: docId, xmlSigned: base64}

    if (!signedResults || !signedResults.length) {
      return res.status(400).json({ message: "Données signées manquantes" });
    }

    try {
      const [txRows] = await db
        .promise()
        .query(
          "SELECT id, user_id, qr_config, ref_config, client_email FROM transactions WHERE id = ?",
          [id],
        );
      const transaction = txRows[0];

      // Déduire 1 jeton
      const [tokenUpdate] = await db
        .promise()
        .query(
          "UPDATE users SET total_jetons = total_jetons - 1 WHERE id = ? AND total_jetons > 0",
          [transaction.user_id],
        );

      if (!tokenUpdate.affectedRows) {
        return res.status(402).json({
          message: "Erreur jeton (insuffisant ou utilisateur non trouvé)",
        });
      }

      const finalDocs = [];

      // Enregistrer chaque document signé
      for (const result of signedResults) {
        const [docRows] = await db
          .promise()
          .query(
            "SELECT filename, pdf_file FROM transaction_documents WHERE id = ?",
            [result.id],
          );
        const doc = docRows[0];

        await db
          .promise()
          .query(
            "UPDATE transaction_documents SET statut='signée', xml_signed=?, signed_at=NOW() WHERE id=?",
            [result.xmlSigned, result.id],
          );

        finalDocs.push({
          id: result.id,
          filename: doc.filename,
          pdf_file: doc.pdf_file,
          xml_signed: result.xmlSigned,
        });
      }

      // Update statut transaction
      await db
        .promise()
        .query(
          "UPDATE transactions SET statut='signée', signed_at=NOW() WHERE id=?",
          [id],
        );

      res.json({
        success: true,
        message: "Signature enregistrée avec succès.",
      });

      // Lancer TTN en arrière-plan
      processTTNSubmission(
        id,
        finalDocs,
        transaction.user_id,
        transaction.client_email,
        transaction.qr_config,
        transaction.ref_config,
      ).catch((e) => console.error("TTN BACKGROUND ERROR:", e));
    } catch (err) {
      console.error("FINALIZE SIGNATURE ERROR:", err);
      res
        .status(500)
        .json({ message: "Erreur serveur lors de la finalisation" });
    }
  },
);

// 🚀 RENVOYER À LA TTN (MANUELLEMENT SI RÉFUSÉ OU OUBLIÉ)
app.post("/api/transactions/:id/resend-ttn", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [txRows] = await db
      .promise()
      .query(
        "SELECT id, user_id, statut, client_email, qr_config, ref_config FROM transactions WHERE id = ? AND user_id = ?",
        [id, req.user.id],
      );

    if (!txRows.length)
      return res.status(404).json({ message: "Transaction introuvable" });

    const transaction = txRows[0];

    // Ne renvoyer que si c'est 'signée' ou 'refusée par TTN'
    const allowed = ["signée", "refusée par TTN"];
    if (!allowed.includes(transaction.statut)) {
      return res.status(400).json({
        message: `Le statut '${transaction.statut}' ne permet pas le renvoi TTN.`,
      });
    }

    const [docs] = await db
      .promise()
      .query(
        "SELECT id, filename, xml_file, pdf_file, xml_signed FROM transaction_documents WHERE transaction_id = ?",
        [id],
      );

    if (!docs.length)
      return res.status(404).json({ message: "Documents introuvables" });

    // On prépare les docs "signés" pour la fonction de fond
    const signedDocs = docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      pdf_file: d.pdf_file,
      xml_signed: d.xml_signed,
    }));

    // On change le statut pour indiquer l'action
    await db
      .promise()
      .query(
        "UPDATE transactions SET statut='Renvoi TTN en cours...' WHERE id=?",
        [id],
      );

    res.json({ message: "Processus de renvoi TTN lancé avec succès." });

    // Lancer la tâche de fond
    processTTNSubmission(
      id,
      signedDocs,
      req.user.id,
      transaction.client_email,
      transaction.qr_config,
      transaction.ref_config,
    ).catch((e) => console.error("RESEND TTN BG ERROR:", e));
  } catch (err) {
    console.error("RESEND TTN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur lors du renvoi TTN" });
  }
});

app.get("/api/transactions/:id/xml", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [docs] = await db.promise().query(
      `
      SELECT d.*, t.user_id
      FROM transaction_documents d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.transaction_id = ?
      `,
      [id],
    );

    if (!docs.length || docs[0].user_id !== req.user.id)
      return res.status(404).json({ message: "Transaction introuvable" });

    const doc = docs[0];

    let xml;

    if (doc.statut === "signée_ttn" && doc.xml_signed_ttn)
      xml = doc.xml_signed_ttn;
    else if (
      (doc.statut === "signée" || doc.statut === "refusée par TTN") &&
      doc.xml_signed
    )
      xml = doc.xml_signed;
    else xml = doc.xml_file;

    res.setHeader("Content-Type", "application/xml");
    res.send(Buffer.from(xml, "base64"));
  } catch (err) {
    console.error("XML ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// 🔐 Vérification du PIN (sans signer)
app.post("/api/public/transactions/:id/check-pin", async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ message: "PIN requis" });
  }

  try {
    await axios.post(
      "http://127.0.0.1:9000/sign/xml",
      {
        pin,
        checkOnly: true,
      },
      { headers: { "Content-Type": "application/json" } },
    );

    res.json({ valid: true });
  } catch (e) {
    if (e.response?.status === 401) {
      return res.status(401).json({ valid: false });
    }
    res.status(500).json({ message: "Erreur moteur signature" });
  }
});
/////////////////////////////////////////////////////////////ADMINNNN/////////////////////////////////////µ

// 🚀 ADMIN - RENVOYER À LA TTN
app.post(
  "/api/admin/transactions/:id/resend-ttn",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [txRows] = await db
        .promise()
        .query(
          "SELECT id, user_id, statut, client_email, qr_config, ref_config FROM transactions WHERE id = ?",
          [id],
        );

      if (!txRows.length)
        return res.status(404).json({ message: "Transaction introuvable" });

      const transaction = txRows[0];

      const allowed = ["signée", "refusée par TTN"];
      if (!allowed.includes(transaction.statut)) {
        return res.status(400).json({
          message: `Le statut '${transaction.statut}' ne permet pas le renvoi TTN.`,
        });
      }

      const [docs] = await db
        .promise()
        .query(
          "SELECT id, filename, xml_file, pdf_file, xml_signed FROM transaction_documents WHERE transaction_id = ?",
          [id],
        );

      if (!docs.length)
        return res.status(404).json({ message: "Documents introuvables" });

      const signedDocs = docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        pdf_file: d.pdf_file,
        xml_signed: d.xml_signed,
      }));

      await db
        .promise()
        .query(
          "UPDATE transactions SET statut='Renvoi TTN en cours...' WHERE id=?",
          [id],
        );

      res.json({
        message: "Processus de renvoi TTN lancé par l'administrateur.",
      });

      processTTNSubmission(
        id,
        signedDocs,
        transaction.user_id,
        transaction.client_email,
        transaction.qr_config,
        transaction.ref_config,
      ).catch((e) => console.error("ADMIN RESEND TTN BG ERROR:", e));
    } catch (err) {
      console.error("ADMIN RESEND TTN ERROR:", err);
      res
        .status(500)
        .json({ message: "Erreur serveur lors du renvoi TTN Admin" });
    }
  },
);

/* ===================== ADMIN - LIST USERS (filters) ===================== */
app.get("/api/admin/users", verifyToken, verifyRole(["ADMIN"]), (req, res) => {
  const { name = "", email = "", phone = "" } = req.query;

  const sql = `
    SELECT id, name, email, role, phone, address, is_verified, statut
    FROM users
    WHERE (? = '' OR name LIKE ?)
      AND (? = '' OR email LIKE ?)
      AND (? = '' OR phone LIKE ?)
    ORDER BY id DESC
  `;

  const params = [name, `%${name}%`, email, `%${email}%`, phone, `%${phone}%`];

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("ADMIN USERS ERROR:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    res.json(results || []);
  });
});

/* ===================== ADMIN - UPDATE ROLE ===================== */
app.put(
  "/api/admin/users/:id/role",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!["USER", "ADMIN"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide" });
    }

    db.query("UPDATE users SET role = ? WHERE id = ?", [role, id], (err) => {
      if (err) {
        console.error("UPDATE ROLE ERROR:", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }
      res.json({ message: "Rôle mis à jour" });
    });
  },
);

/* ===================== ADMIN - TOGGLE ACTIVE/DISABLED ===================== */
app.put(
  "/api/admin/users/:id/status",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;
    const { statut } = req.body; // 1 ou 0

    db.query(
      "UPDATE users SET statut = ? WHERE id = ?",
      [statut ? 1 : 0, id],
      (err) => {
        if (err) {
          console.error("STATUS UPDATE ERROR:", err);
          return res.status(500).json({ message: "Erreur serveur" });
        }
        res.json({ message: "Statut compte mis à jour" });
      },
    );
  },
);

/* ===================== ADMIN - UPDATE USER INFO ===================== */
app.put(
  "/api/admin/users/:id",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;
    const { name, phone, address } = req.body;

    if (!name) return res.status(400).json({ message: "Nom obligatoire" });

    db.query(
      "UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?",
      [name, phone || null, address || null, id],
      (err) => {
        if (err) {
          console.error("ADMIN UPDATE USER ERROR:", err);
          return res.status(500).json({ message: "Erreur serveur" });
        }
        res.json({ message: "Utilisateur mis à jour" });
      },
    );
  },
);

/* ===================== ADMIN - CHANGE USER PASSWORD ===================== */
app.put(
  "/api/admin/users/:id/password",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res
          .status(400)
          .json({ message: "Mot de passe min 8 caractères" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);

      db.query(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashed, id],
        (err) => {
          if (err) {
            console.error("ADMIN PASSWORD ERROR:", err);
            return res.status(500).json({ message: "Erreur serveur" });
          }
          res.json({ message: "Mot de passe modifié" });
        },
      );
    } catch (e) {
      console.error("ADMIN PASSWORD SERVER ERROR:", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - DELETE USER ===================== */
app.delete(
  "/api/admin/users/:id",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM users WHERE id = ?", [id], (err) => {
      if (err) {
        console.error("DELETE USER ERROR:", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }
      res.json({ message: "Utilisateur supprimé" });
    });
  },
);
/* ===================== ADMIN - LIST ALL TRANSACTIONS ===================== */
app.get(
  "/api/admin/transactions/all",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(`
        SELECT t.*, u.name as user_name, u.email as user_email
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.date_creation DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error("ADMIN GET ALL TX ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - LIST ALL INVOICES ===================== */
app.get(
  "/api/admin/invoices/all",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(`
        SELECT td.*, u.name as user_name, u.email as user_email, t.facture_number as tx_number
        FROM transaction_documents td
        JOIN transactions t ON t.id = td.transaction_id
        JOIN users u ON u.id = t.user_id
        ORDER BY td.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error("ADMIN GET ALL INVOICES ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - LIST ALL ORGANIZATIONS ===================== */
app.get(
  "/api/admin/organizations/all",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(`
        SELECT o.*, u.name as owner_name, u.email as owner_email,
               (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) as members_count
        FROM organizations o
        JOIN users u ON u.id = o.owner_id
        ORDER BY o.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error("ADMIN GET ALL ORGS ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - GET ORGANIZATION MEMBERS ===================== */
app.get(
  "/api/admin/organizations/:id/members",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [members] = await db
        .promise()
        .query(
          "SELECT om.role, u.id, u.name, u.email FROM organization_members om JOIN users u ON u.id = om.user_id WHERE om.organization_id = ?",
          [id],
        );
      res.json(members);
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - GET ORGANIZATION TRANSACTIONS ===================== */
app.get(
  "/api/admin/organizations/:id/transactions",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [txs] = await db.promise().query(
        `SELECT t.*, u.name as user_name 
         FROM transactions t 
         JOIN users u ON u.id = t.user_id 
         JOIN organization_members om ON om.user_id = t.user_id 
         WHERE om.organization_id = ? 
         ORDER BY t.date_creation DESC`,
        [id],
      );
      res.json(txs);
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - UPDATE TRANSACTION STATUS ===================== */
app.put(
  "/api/admin/transactions/:id/status",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { statut } = req.body;
      await db
        .promise()
        .query("UPDATE transactions SET statut = ? WHERE id = ?", [statut, id]);
      res.json({ message: "Statut transaction mis à jour" });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - GET TRANSACTION DOCUMENTS ===================== */
app.get(
  "/api/admin/transactions/:id/documents",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [docs] = await db
        .promise()
        .query(
          "SELECT id, filename, statut, invoice_number, signed_at, created_at FROM transaction_documents WHERE transaction_id = ?",
          [id],
        );
      res.json(docs);
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== ADMIN - DELETE ORGANIZATION ===================== */
app.delete(
  "/api/admin/organizations/:id",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      await db.promise().query("DELETE FROM organizations WHERE id = ?", [id]);
      res.json({ message: "Organisation supprimée" });
    } catch (err) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== DEMANDES JETONS ===================== */
/* ===================== JETON - CREER DEMANDE ===================== */
app.post("/api/jeton", verifyToken, (req, res) => {
  const {
    pack_name,
    tokens,
    price_tnd,
    contact_email,
    contact_info,
    request_source,
  } = req.body;
  const userId = req.user.id;

  const parsedTokens = Number(tokens);
  const parsedPrice = Number(price_tnd);
  const contactEmail = String(contact_email || contact_info || "")
    .trim()
    .toLowerCase();

  if (!pack_name || !Number.isFinite(parsedTokens) || parsedTokens < 1) {
    return res.status(400).json({ message: "Donnees invalides" });
  }

  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ message: "Prix invalide" });
  }

  if (!isValidEmail(contactEmail)) {
    return res.status(400).json({ message: "Email invalide" });
  }

  const source = String(request_source || "pack").toLowerCase();
  if (!["pack", "custom"].includes(source)) {
    return res.status(400).json({ message: "Source invalide" });
  }

  const sql = `
    INSERT INTO jeton
    (
      user_id,
      pack_name,
      tokens,
      price_tnd,
      contact_info,
      request_source,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `;

  db.query(
    sql,
    [
      userId,
      String(pack_name).trim(),
      Math.floor(parsedTokens),
      Number(parsedPrice.toFixed(2)),
      contactEmail,
      source,
    ],
    (err, result) => {
      if (err) {
        console.error("TOKEN REQUEST CREATE ERROR:", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }

      // 🔔 Notification pour l'Admin
      notifyAdmins(
        "Nouvelle demande de jetons",
        `Un utilisateur a demandé un pack ${pack_name} (${parsedTokens} jetons).`,
        "info",
      );

      res.status(201).json({
        message: "Demande envoyee avec succes",
        id: result.insertId,
      });
    },
  );
});

/* ===================== JETON - ENVOYER PREUVE ===================== */
app.put(
  "/api/jeton/:id/payment-proof",
  verifyToken,
  upload.single("payment_proof"),
  async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        message: "Preuve de virement obligatoire (PDF ou image)",
      });
    }

    const mime = String(req.file.mimetype || "").toLowerCase();
    const isAllowedProof =
      mime === "application/pdf" || mime.startsWith("image/");

    if (!isAllowedProof) {
      return res.status(400).json({
        message: "Format preuve invalide (PDF, JPG, PNG, WebP...)",
      });
    }

    try {
      const [rows] = await db.promise().query(
        `
          SELECT id, status
          FROM jeton
          WHERE id = ? AND user_id = ?
        `,
        [id, req.user.id],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Demande introuvable" });
      }

      if (rows[0].status !== "payment_pending") {
        return res.status(409).json({
          message: "Preuve non autorisee pour ce statut",
        });
      }

      const [updateRes] = await db.promise().query(
        `
          UPDATE jeton
          SET payment_proof = ?,
              payment_proof_mime = ?,
              payment_proof_name = ?,
              payment_uploaded_at = NOW(),
              status = 'payment_submitted'
          WHERE id = ? AND user_id = ? AND status = 'payment_pending'
        `,
        [
          req.file.buffer,
          mime,
          String(req.file.originalname || "preuve_virement").slice(0, 190),
          id,
          req.user.id,
        ],
      );

      if (!updateRes.affectedRows) {
        return res.status(409).json({
          message: "Statut modifie, veuillez actualiser la page",
        });
      }

      res.json({
        message: "Preuve envoyee. En attente de confirmation finale.",
      });

      // 🔔 Notification pour l'Admin
      notifyAdmins(
        "Preuve de paiement reçue",
        `Une preuve de paiement a été soumise pour la demande de jetons #${id}.`,
        "payment",
      );
    } catch (err) {
      console.error("TOKEN REQUEST UPLOAD PROOF ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== JETON - LISTE UTILISATEUR ===================== */
app.get("/api/jeton/mine", verifyToken, (req, res) => {
  const sql = `
    SELECT
      id,
      pack_name,
      tokens,
      price_tnd,
      contact_info,
      request_source,
      status,
      admin_note,
      created_at,
      decided_at,
      payment_uploaded_at,
      payment_proof_name,
      payment_proof_mime,
      CASE WHEN payment_proof IS NULL THEN 0 ELSE 1 END AS has_payment_proof
    FROM jeton
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) {
      console.error("TOKEN REQUEST MINE ERROR:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    res.json(results || []);
  });
});

/* ===================== JETON - TELECHARGER PREUVE UTILISATEUR ===================== */
app.get("/api/jeton/:id/proof", verifyToken, (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT payment_proof, payment_proof_mime, payment_proof_name
    FROM jeton
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [id, req.user.id], (err, results) => {
    if (err || !results.length) {
      return res.status(404).json({ message: "Preuve introuvable" });
    }

    const row = results[0];
    if (!row.payment_proof) {
      return res.status(404).json({ message: "Preuve introuvable" });
    }

    const contentType = row.payment_proof_mime || "application/octet-stream";
    const filename = row.payment_proof_name || `preuve_${id}`;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(row.payment_proof);
  });
});

/* ===================== JETON - LISTE ADMIN ===================== */
app.get("/api/admin/jeton", verifyToken, verifyRole(["ADMIN"]), (req, res) => {
  const status = String(req.query.status || "")
    .toLowerCase()
    .trim();
  const hasFilter = [
    "payment_pending",
    "payment_submitted",
    "pending",
    "approved",
    "rejected",
  ].includes(status);

  const sql = `
      SELECT
        tr.id,
        tr.user_id,
        tr.pack_name,
        tr.tokens,
        tr.price_tnd,
        tr.contact_info,
        tr.request_source,
        tr.status,
        tr.admin_note,
        tr.created_at,
        tr.payment_uploaded_at,
        tr.decided_at,
        tr.decided_by,
        tr.payment_proof_name,
        tr.payment_proof_mime,
        CASE WHEN tr.payment_proof IS NULL THEN 0 ELSE 1 END AS has_payment_proof,
        u.name AS user_name,
        u.email AS user_email
      FROM jeton tr
      JOIN users u ON u.id = tr.user_id
      ${hasFilter ? "WHERE tr.status = ?" : ""}
      ORDER BY tr.created_at DESC
    `;

  const params = hasFilter ? [status] : [];
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("TOKEN REQUEST ADMIN LIST ERROR:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    res.json(results || []);
  });
});

/* ===================== JETON - TELECHARGER PREUVE ADMIN ===================== */
app.get(
  "/api/admin/jeton/:id/proof",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const { id } = req.params;

    const sql = `
      SELECT payment_proof, payment_proof_mime, payment_proof_name
      FROM jeton
      WHERE id = ?
    `;

    db.query(sql, [id], (err, results) => {
      if (err || !results.length) {
        return res.status(404).json({ message: "Preuve introuvable" });
      }

      const row = results[0];
      if (!row.payment_proof) {
        return res.status(404).json({ message: "Preuve introuvable" });
      }

      const contentType = row.payment_proof_mime || "application/octet-stream";
      const filename = row.payment_proof_name || `preuve_${id}`;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.send(row.payment_proof);
    });
  },
);

/* ===================== JETON - DECISION ADMIN ===================== */
app.put(
  "/api/admin/jeton/:id/decision",
  verifyToken,
  verifyRole(["ADMIN"]),
  async (req, res) => {
    const { id } = req.params;
    const { decision, admin_note } = req.body;

    const nextStatus = String(decision || "")
      .toLowerCase()
      .trim();

    if (!["payment_pending", "approved", "rejected"].includes(nextStatus)) {
      return res.status(400).json({ message: "Decision invalide" });
    }

    try {
      const [rows] = await db.promise().query(
        `
        SELECT tr.*, u.email AS user_email
        FROM jeton tr
        JOIN users u ON u.id = tr.user_id
        WHERE tr.id = ?
        `,
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Demande introuvable" });
      }

      const tokenRequest = rows[0];

      await db.promise().query(
        `
        UPDATE jeton
        SET status = ?, admin_note = ?, decided_by = ?, decided_at = NOW()
        WHERE id = ?
        `,
        [nextStatus, admin_note || null, req.user.id, id],
      );

      // 🔔 Notification pour l'Utilisateur
      let notificationTitle = "";
      let notificationMessage = "";
      let notificationType = "info";

      if (nextStatus === "payment_pending") {
        notificationTitle = "Paiement requis";
        notificationMessage = `Votre demande de jetons #${id} a été validée. Veuillez envoyer la preuve de paiement.`;
        notificationType = "warning";
      } else if (nextStatus === "approved") {
        notificationTitle = "Demande approuvée";
        notificationMessage = `Votre demande #${id} a été approuvée. ${tokenRequest.tokens} jetons ont été ajoutés.`;
        notificationType = "success";
      } else if (nextStatus === "rejected") {
        notificationTitle = "Demande refusée";
        notificationMessage = `Votre demande #${id} a été refusée.`;
        notificationType = "error";
      }

      if (notificationTitle) {
        await createNotification(
          tokenRequest.user_id,
          notificationTitle,
          notificationMessage,
          notificationType,
        );
      }

      /* ================= EMAIL ENVOI ================= */

      if (nextStatus === "payment_pending") {
        await sendTokenRequestPaymentPendingEmail({
          toEmail: tokenRequest.user_email,
          packName: tokenRequest.pack_name,
          tokens: tokenRequest.tokens,
          priceTnd: tokenRequest.price_tnd,
          adminNote: admin_note,
        });
      }

      if (nextStatus === "approved") {
        // 🔥 Ajouter jetons
        await db.promise().query(
          `
          UPDATE users
          SET total_jetons = total_jetons + ?
          WHERE id = ?
          `,
          [tokenRequest.tokens, tokenRequest.user_id],
        );
        await createNotification(
          tokenRequest.user_id,
          "Jetons approuvés",
          `${tokenRequest.tokens} jetons ont été ajoutés à votre compte`,
          "success",
        );
        await sendTokenRequestDecisionEmail({
          toEmail: tokenRequest.user_email,
          packName: tokenRequest.pack_name,
          tokens: tokenRequest.tokens,
          priceTnd: tokenRequest.price_tnd,
          decision: "approved",
          adminNote: admin_note,
        });
      }

      if (nextStatus === "rejected") {
        await createNotification(
          tokenRequest.user_id,
          "Demande rejetée",
          "Votre demande de jetons a été refusée",
          "error",
        );
        await sendTokenRequestDecisionEmail({
          toEmail: tokenRequest.user_email,
          packName: tokenRequest.pack_name,
          tokens: tokenRequest.tokens,
          priceTnd: tokenRequest.price_tnd,
          decision: "rejected",
          adminNote: admin_note,
        });
      }

      res.json({
        message: "Decision enregistrée + email envoyé",
      });
    } catch (err) {
      console.error("TOKEN DECISION ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== JETON - TOTAL UTILISATEUR ===================== */
app.get("/api/jeton/total", verifyToken, async (req, res) => {
  const [rows] = await db
    .promise()
    .query("SELECT total_jetons FROM users WHERE id = ?", [req.user.id]);

  res.json({
    total_jetons: rows[0]?.total_jetons || 0,
  });
});

///////*=========ORGANIZATION++++++++++++++*/
app.post("/api/organizations", verifyToken, async (req, res) => {
  try {
    const {
      name,
      matricule_fiscale,
      adresse,
      ville,
      code_postal,
      telephone,
      email,
      fax,
      invitedUsers = [],
    } = req.body;

    // ================= VALIDATION =================
    if (
      !name ||
      !matricule_fiscale ||
      !adresse ||
      !ville ||
      !code_postal ||
      !telephone
    ) {
      return res.status(400).json({
        message: "Champs obligatoires manquants",
      });
    }

    // ================= CHECK SI USER DEJA MEMBRE =================
    const [alreadyMember] = await db
      .promise()
      .query(
        `SELECT organization_id FROM organization_members WHERE user_id = ?`,
        [req.user.id],
      );

    if (alreadyMember.length) {
      return res.status(409).json({
        message: "Vous êtes déjà membre d'une organisation",
      });
    }

    // ================= CREATION ORGANISATION =================
    const [orgResult] = await db.promise().query(
      `
      INSERT INTO organizations
      (name, matricule_fiscale, adresse, ville, code_postal, telephone, email, fax, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        matricule_fiscale,
        adresse,
        ville,
        code_postal,
        telephone,
        email || null,
        fax || null,
        req.user.id,
      ],
    );

    const organizationId = orgResult.insertId;

    // ================= AJOUT OWNER =================
    await db.promise().query(
      `
      INSERT INTO organization_members
      (organization_id, user_id, role)
      VALUES (?, ?, 'OWNER')
      `,
      [organizationId, req.user.id],
    );

    // ================= INVITATIONS =================
    const added = [];
    const rejected = [];

    for (const userEmail of invitedUsers) {
      const [users] = await db
        .promise()
        .query("SELECT id FROM users WHERE email = ?", [userEmail]);

      if (!users.length) {
        rejected.push(`${userEmail} : utilisateur introuvable`);
        continue;
      }

      const userId = users[0].id;

      const [existingMembership] = await db
        .promise()
        .query(
          `SELECT organization_id FROM organization_members WHERE user_id = ?`,
          [userId],
        );

      if (existingMembership.length) {
        rejected.push(`${userEmail} : déjà membre d'une organisation`);
        continue;
      }

      await db.promise().query(
        `
        INSERT INTO organization_members
        (organization_id, user_id, role)
        VALUES (?, ?, 'MEMBER')
        `,
        [organizationId, userId],
      );

      // 🔥 NOTIFICATION CORRIGÉE
      await createNotification(
        userId,
        "Nouvelle organisation",
        `Vous avez été ajouté à l'organisation "${name}"`,
        "info",
      );

      added.push(userEmail);
    }

    res.status(201).json({
      message: "Organisation créée avec succès",
      organizationId,
      added,
      rejected,
    });
  } catch (err) {
    console.error("CREATE ORGANIZATION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/* ===================== DELETE ORGANIZATION (OWNER ONLY) ===================== */
app.delete("/api/organizations/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 Vérifier que l'utilisateur est OWNER
    const [check] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER") {
      return res.status(403).json({
        message: "Seul le OWNER peut supprimer l'organisation",
      });
    }

    // 🧹 Supprimer membres
    await db
      .promise()
      .query(`DELETE FROM organization_members WHERE organization_id = ?`, [
        id,
      ]);

    // 🧹 Supprimer invitations
    await db
      .promise()
      .query(`DELETE FROM organization_invitations WHERE organization_id = ?`, [
        id,
      ]);

    // 🗑 Supprimer organisation
    await db.promise().query(`DELETE FROM organizations WHERE id = ?`, [id]);

    res.json({ message: "Organisation supprimée avec succès" });
  } catch (err) {
    console.error("DELETE ORG ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/* ===================== LEAVE ORGANIZATION (MEMBER) ===================== */
app.delete("/api/organizations/:id/leave", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!check.length) {
      return res.status(404).json({
        message: "Vous n'êtes pas membre de cette organisation",
      });
    }

    // ❌ OWNER ne peut pas quitter (il doit supprimer l'organisation)
    if (check[0].role === "OWNER") {
      return res.status(403).json({
        message:
          "Le OWNER ne peut pas quitter. Supprimez l'organisation si nécessaire.",
      });
    }

    // ✅ Supprimer membre
    await db.promise().query(
      `
      DELETE FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    res.json({ message: "Vous avez quitté l'organisation" });
  } catch (err) {
    console.error("LEAVE ORG ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/*========================lister les organization============*/ app.get(
  "/api/organizations/mine",
  verifyToken,
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        `
      SELECT o.*
      FROM organizations o
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = ?
      ORDER BY o.id DESC
      `,
        [req.user.id],
      );

      res.json(rows);
    } catch (err) {
      console.error("LIST ORGANIZATIONS ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);
/*========================Détails organisation + membres ==================*/
app.get("/api/organizations/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [memberCheck] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!memberCheck.length) {
      return res
        .status(403)
        .json({ message: "Vous n'êtes pas membre de cette organisation" });
    }

    const [orgRows] = await db
      .promise()
      .query("SELECT * FROM organizations WHERE id = ?", [id]);

    const [members] = await db.promise().query(
      `
      SELECT u.id, u.name, u.email, om.role
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ?
      `,
      [id],
    );

    res.json({
      organization: orgRows[0],
      members,
      myRole: memberCheck[0].role,
    });
  } catch (err) {
    console.error("ORG DETAIL ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*=======================modifier une organisation============*/
app.put("/api/organizations/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER") {
      return res
        .status(403)
        .json({ message: "Seul le propriétaire peut modifier" });
    }

    await db.promise().query(
      `
      UPDATE organizations
      SET name=?, matricule_fiscale=?, adresse=?, ville=?,
          code_postal=?, telephone=?, email=?, fax=?
      WHERE id=?
      `,
      [
        req.body.name,
        req.body.matricule_fiscale,
        req.body.adresse,
        req.body.ville,
        req.body.code_postal,
        req.body.telephone,
        req.body.email || null,
        req.body.fax || null,
        id,
      ],
    );

    res.json({ message: "Organisation mise à jour" });
  } catch (err) {
    console.error("UPDATE ORG ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/*====================ajouter un memebre a une organization=============*/
app.post("/api/organizations/:id/add-member", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    // 🔐 Vérifier que l'utilisateur actuel est OWNER
    const [check] = await db.promise().query(
      `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER") {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // 🔎 Vérifier si user existe
    const [userRows] = await db
      .promise()
      .query("SELECT id FROM users WHERE email = ?", [email]);

    if (!userRows.length) {
      return res.status(404).json({
        message: `❌ ${email} : utilisateur introuvable`,
      });
    }

    const userId = userRows[0].id;

    // 🔥 Vérifier si déjà membre d'une organisation
    const [existingMembership] = await db.promise().query(
      `
      SELECT organization_id FROM organization_members
      WHERE user_id = ?
      `,
      [userId],
    );

    if (existingMembership.length) {
      return res.status(409).json({
        message: `⚠ ${email} est déjà membre d'une autre organisation`,
      });
    }

    // ✅ Ajouter membre
    await db.promise().query(
      `
      INSERT INTO organization_members
      (organization_id, user_id, role)
      VALUES (?, ?, 'MEMBER')
      `,
      [id, userId],
    );

    res.json({
      message: `${email} ajouté avec succès`,
    });
  } catch (err) {
    console.error("ADD MEMBER ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
app.post("/api/organizations/:id/invite", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email requis" });

    // 🔐 Vérifier OWNER
    const [check] = await db.promise().query(
      `SELECT role FROM organization_members 
       WHERE organization_id = ? AND user_id = ?`,
      [id, req.user.id],
    );

    if (!check.length || check[0].role !== "OWNER")
      return res.status(403).json({ message: "Accès refusé" });

    // 🔎 Vérifier utilisateur existe
    const [users] = await db
      .promise()
      .query("SELECT id FROM users WHERE email = ?", [email]);

    if (!users.length)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    const invitedUserId = users[0].id;

    // 🔥 Vérifier pas déjà membre
    const [existingMember] = await db
      .promise()
      .query(`SELECT id FROM organization_members WHERE user_id = ?`, [
        invitedUserId,
      ]);

    if (existingMember.length)
      return res
        .status(409)
        .json({ message: "Déjà membre d'une organisation" });

    // 🔥 Vérifier pas déjà invité
    const [existingInvite] = await db.promise().query(
      `SELECT id FROM organization_invitations
       WHERE organization_id = ? AND invited_user_id = ? AND status='pending'`,
      [id, invitedUserId],
    );

    if (existingInvite.length)
      return res.status(409).json({ message: "Invitation déjà envoyée" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    await db.promise().query(
      `
      INSERT INTO organization_invitations
      (organization_id, invited_user_id, invited_email, token, expires_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [id, invitedUserId, email, token, expiresAt],
    );

    const inviteLink = `http://51.178.39.67/organization/invite/${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Invitation organisation",
      html: `
        <h2>Invitation à rejoindre une organisation</h2>
        <p>Vous avez été invité à rejoindre une organisation.</p>

        <a href="${inviteLink}"
           style="padding:12px 20px;background:#0247AA;color:#fff;text-decoration:none;border-radius:6px;">
           Accepter l'invitation
        </a>

        <p>Ce lien expire dans 48 heures.</p>
      `,
    });

    res.json({ message: "Invitation envoyée par email" });
  } catch (err) {
    console.error("INVITE ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
app.get("/api/organizations/invite/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await db.promise().query(
      `
      SELECT oi.*, o.name AS organization_name
      FROM organization_invitations oi
      JOIN organizations o ON o.id = oi.organization_id
      WHERE oi.token = ? AND oi.status='pending'
      `,
      [token],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Invitation invalide" });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});
app.post("/api/organizations/invite/:token/accept", async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await db.promise().query(
      `
      SELECT *
      FROM organization_invitations
      WHERE token = ? AND status='pending'
      `,
      [token],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Invitation invalide" });

    const invite = rows[0];

    // 🔥 Vérifier expiration
    if (new Date(invite.expires_at) < new Date()) {
      await db
        .promise()
        .query(
          `UPDATE organization_invitations SET status='expired' WHERE id=?`,
          [invite.id],
        );
      return res.status(410).json({ message: "Invitation expirée" });
    }

    // 🔥 Vérifier que l'utilisateur existe
    const [userRows] = await db
      .promise()
      .query(`SELECT id FROM users WHERE id=?`, [invite.invited_user_id]);

    if (!userRows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const userId = invite.invited_user_id;

    // 🔥 Vérifier pas déjà membre
    const [alreadyMember] = await db
      .promise()
      .query(`SELECT id FROM organization_members WHERE user_id=?`, [userId]);

    if (alreadyMember.length) {
      return res.status(409).json({
        message: "Déjà membre d'une organisation",
      });
    }

    // ✅ Ajouter membre
    await db.promise().query(
      `
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES (?, ?, 'MEMBER')
      `,
      [invite.organization_id, userId],
    );

    // ✅ Marquer invitation acceptée
    await db.promise().query(
      `
      UPDATE organization_invitations
      SET status='accepted', accepted_at=NOW()
      WHERE id=?
      `,
      [invite.id],
    );

    res.json({ message: "Invitation acceptée avec succès" });
  } catch (err) {
    console.error("ACCEPT ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
app.get(
  "/api/organizations/invitations/mine",
  verifyToken,
  async (req, res) => {
    try {
      const [rows] = await db.promise().query(
        `
      SELECT oi.*, o.name AS organization_name
      FROM organization_invitations oi
      JOIN organizations o ON o.id = oi.organization_id
      WHERE oi.invited_user_id = ? AND oi.status='pending'
      ORDER BY oi.created_at DESC
      `,
        [req.user.id],
      );

      res.json(rows);
    } catch (err) {
      console.error("LIST INVITE ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);
app.post("/api/organizations/invite/:token/reject", async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await db.promise().query(
      `SELECT id FROM organization_invitations
       WHERE token=? AND status='pending'`,
      [token],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Invitation invalide" });

    await db.promise().query(
      `UPDATE organization_invitations
       SET status='rejected'
       WHERE token=?`,
      [token],
    );

    res.json({ message: "Invitation refusée" });
  } catch (err) {
    console.error("REJECT ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
/*=========Supprimer un membre========*/
app.delete(
  "/api/organizations/:id/member/:userId",
  verifyToken,
  async (req, res) => {
    try {
      const { id, userId } = req.params;

      const [check] = await db.promise().query(
        `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
        [id, req.user.id],
      );

      if (!check.length || check[0].role !== "OWNER") {
        return res.status(403).json({ message: "Accès refusé" });
      }

      await db.promise().query(
        `
      DELETE FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
        [id, userId],
      );

      res.json({ message: "Membre supprimé" });
    } catch (err) {
      console.error("REMOVE MEMBER ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);
/* ===================== ORGANIZATION - LIST TRANSACTIONS ===================== */
app.get(
  "/api/organizations/:id/transactions",
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Vérifier membership
      const [memberCheck] = await db.promise().query(
        `
      SELECT role FROM organization_members
      WHERE organization_id = ? AND user_id = ?
      `,
        [id, req.user.id],
      );

      if (!memberCheck.length) {
        // 🔥 IMPORTANT → renvoyer tableau vide au lieu d'objet
        return res.json([]);
      }

      const [rows] = await db.promise().query(
        `
      SELECT 
        t.id,
        t.facture_number,
        t.statut,
        t.date_creation,
        u.name AS user_name
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      JOIN organization_members om ON om.user_id = t.user_id
      WHERE om.organization_id = ?
      ORDER BY t.date_creation DESC
      `,
        [id],
      );

      // 🔥 Toujours tableau
      return res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("ORG TX ERROR:", err);
      // 🔥 Toujours tableau même en erreur
      return res.json([]);
    }
  },
);
/*=============notification=============*/
app.get("/api/notifications", verifyToken, async (req, res) => {
  const [rows] = await db.promise().query(
    `
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [req.user.id],
  );

  res.json(rows);
});
app.put("/api/notifications/:id/read", verifyToken, async (req, res) => {
  await db.promise().query(
    `
    UPDATE notifications
    SET is_read = 1
    WHERE id = ? AND user_id = ?
    `,
    [req.params.id, req.user.id],
  );

  res.json({ success: true });
});
/*=================chatboot==============*/
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Tu es l'assistant IA officiel de Medica-Sign.

Medica-Sign est une plateforme SaaS professionnelle de signature électronique connectée au système TTN (Tunisie TradeNet).
Elle permet aux entreprises et professionnels de signer électroniquement des factures XML (format TEIF) et de générer des QR codes certifiés.

Tu dois agir comme :
- Un expert technique TTN
- Un conseiller produit SaaS
- Un assistant support client
- Un guide utilisateur professionnel

========================
FONCTIONNALITÉS PRINCIPALES
========================

1) Transactions
- Création de transaction avec PDF + XML
- Signature électronique via TTN
- Génération QR code
- Suivi de statut (créé, signé, rejeté)
- Historique des transactions

2) Jetons
- Chaque signature consomme des jetons
- Achat de jetons via demande de paiement
- Validation finale par ADMIN
- Affichage du solde en temps réel

3) Organisation
- Création d’organisation
- Invitation de membres
- Gestion des transactions organisationnelles
- Rôles utilisateurs

4) API Développeur
- Génération Token API sécurisé
- Intégration signature via API REST
- Authentification JWT
- Documentation technique

5) Statistiques
- Nombre de signatures
- Consommation jetons
- Activité utilisateur
- Dashboard analytique

6) Rôles
- USER : créer transactions, gérer profil, jetons
- ADMIN : gérer utilisateurs, valider paiements jetons, statistiques globales

========================
RÈGLES DE RÉPONSE
========================

- Réponds de manière professionnelle et claire
- Donne des instructions concrètes si nécessaire
- Si la question concerne une erreur TTN, explique les causes possibles (XML invalide, jetons insuffisants, configuration QR incorrecte)
- Si la question est hors sujet, réponds poliment puis recentre vers Medica-Sign
- Ne parle jamais de toi comme "ChatGPT"
- Ne mentionne jamais OpenRouter ou OpenAI
- Reste concis mais utile

Tu es un assistant SaaS premium niveau international.
`,
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://51.178.39.67",
          "X-Title": "Medica-Sign",
        },
      },
    );

    res.json({
      reply: response.data.choices[0].message.content,
    });
  } catch (error) {
    console.error("OPENROUTER ERROR:", error.response?.data || error.message);
    res.status(500).json({
      reply: "Erreur IA. Vérifiez la configuration OpenRouter.",
    });
  }
});
/* ===================== SUPPORT CONTACT ===================== */
/*
POST /api/support/contact
Body: { type: "signature|facture|compte|facturation|autre", message: "..." }
Envoie email vers: amri.aymen@medicacom.tn
*/

app.post("/api/support/contact", verifyToken, async (req, res) => {
  try {
    const SUPPORT_EMAIL = "kobbi.moetez@medicacom.tn";

    const { type, message } = req.body;

    const cleanType = String(type || "")
      .trim()
      .toLowerCase();
    const cleanMessage = String(message || "").trim();

    const allowedTypes = [
      "signature",
      "facture",
      "compte",
      "facturation",
      "autre",
    ];
    if (!allowedTypes.includes(cleanType)) {
      return res.status(400).json({ message: "Type de demande invalide" });
    }
    if (!cleanMessage || cleanMessage.length < 10) {
      return res.status(400).json({ message: "Message trop court" });
    }

    // 🔎 Récupérer info user
    const [rows] = await db
      .promise()
      .query("SELECT id, name, email, phone FROM users WHERE id = ?", [
        req.user.id,
      ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const user = rows[0];
    const typeLabelMap = {
      signature: "Vérification de signature",
      facture: "Dépôt de facture",
      compte: "Accès au compte",
      facturation: "Facturation",
      autre: "Autre",
    };

    const subject = `[Support Medica-Sign] ${typeLabelMap[cleanType]} - ${user.email} (ID:${user.id})`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Nouvelle demande support</h2>

        <p><strong>Type:</strong> ${typeLabelMap[cleanType]}</p>
        <p><strong>Utilisateur:</strong> ${String(user.name || "—").replace(/</g, "&lt;")}</p>
        <p><strong>Email:</strong> ${String(user.email || "—").replace(/</g, "&lt;")}</p>
        <p><strong>Téléphone:</strong> ${String(user.phone || "—").replace(/</g, "&lt;")}</p>
        <p><strong>User ID:</strong> ${user.id}</p>

        <hr />
        <h3>Message</h3>
        <pre style="white-space: pre-wrap; background:#f6f6f6; padding:12px; border-radius:8px;">${cleanMessage
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre>

        <p style="color:#666; font-size: 12px;">
          Envoyé depuis Medica-Sign.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject,
      html,
      replyTo: user.email, // 🔥 très utile: le support répond directement au client
    });

    // Optionnel: notification interne
    await createNotification(
      req.user.id,
      "Support",
      "Votre demande a été envoyée au support.",
      "success",
    );

    return res.json({ message: "Demande envoyée au support avec succès." });
  } catch (err) {
    console.error("SUPPORT CONTACT ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});
/* =========================================================
   NEW INVOICE & TRANSACTION MANAGEMENT API (TTN STANDARD)
========================================================= */

// 1. Create Advanced Transaction
app.post(
  "/protected/invoice/xml/transaction/advanced",
  verifyApiToken,
  async (req, res) => {
    try {
      const { signer_email, clientEmail, invoices } = req.body;

      // Check tokens
      const [updateToken] = await db
        .promise()
        .query(
          `UPDATE users SET total_jetons = total_jetons - 1 WHERE id = ? AND total_jetons > 0`,
          [req.apiUser.id],
        );

      if (!updateToken.affectedRows) {
        return res.status(402).json({
          object: null,
          errorCode: 1,
          message: "Jetons insuffisants",
        });
      }

      if (!signer_email || !invoices || !invoices.length) {
        return res.status(400).json({
          errorCode: 1,
          message: "signer_email constraints and invoices required.",
        });
      }

      const firstInvoiceNumber = String(
        invoices[0]?.invoiceNumber || "",
      ).trim();

      const [txRes] = await db
        .promise()
        .query(
          `INSERT INTO transactions (facture_number, signataire_email, client_email, user_id, statut) VALUES (?, ?, ?, ?, 'créé')`,
          [firstInvoiceNumber, signer_email, clientEmail || "", req.apiUser.id],
        );

      const transactionId = txRes.insertId;
      const createdInvoices = [];

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const invoiceNumber = String(inv?.invoiceNumber || "").trim();
        const pdfB64 = String(inv?.invoiceFileB64 || "").trim();
        const xmlB64 = ensureBase64String(inv?.invoiceTIEF);

        const filename = invoiceNumber
          .toLowerCase()
          .replace(/[^\w\-]+/g, "_")
          .slice(0, 120);

        const [docRes] = await db
          .promise()
          .query(
            `INSERT INTO transaction_documents (transaction_id, filename, invoice_number, pdf_file, xml_file, statut) VALUES (?, ?, ?, ?, ?, 'créé')`,
            [transactionId, filename, invoiceNumber, pdfB64, xmlB64],
          );

        createdInvoices.push({
          status: "CREATED",
          uuid: String(docRes.insertId),
          invoiceNumber: invoiceNumber,
          invoiceDate: new Date().toISOString(),
          withPDF: !!pdfB64,
        });
      }

      // Send signature email
      await sendSignatureEmail(signer_email, transactionId);

      res.status(200).json({
        object: {
          uuid: String(transactionId),
          status: "CREATED",
          invoices: createdInvoices,
          creationDate: new Date().toISOString(),
        },
        errorCode: 0,
      });
    } catch (error) {
      console.error("ADVANCED TX ERROR:", error);
      res.status(500).json({ errorCode: 1, message: "Erreur serveur" });
    }
  },
);

// 2. Check Invoice Status
app.post(
  "/protected/invoice/xml/check/:invoice_uid",
  verifyApiToken,
  async (req, res) => {
    try {
      const docId = req.params.invoice_uid;
      // Verify ownership via transaction
      const [docs] = await db.promise().query(
        `
       SELECT d.id, d.statut, d.invoice_number, d.pdf_file, t.user_id 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?
     `,
        [docId, req.apiUser.id],
      );

      if (!docs.length)
        return res.status(404).json({
          errorCode: 1,
          message: "Invoice not found or access denied",
        });

      const doc = docs[0];

      res.status(200).json({
        object: {
          status:
            doc.statut === "signée_ttn"
              ? "TTN_SIGNED"
              : doc.statut === "signée"
                ? "SIGNED"
                : "CREATED",
          uuid: String(doc.id),
          ttnReference: "REF-TTN-" + doc.id,
          invoiceNumber: doc.invoice_number,
          twoDocImage:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // Mocked 1x1 transparent PNG Base64 for seal
          withPDF: !!doc.pdf_file,
        },
        errorCode: 0,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ errorCode: 1 });
    }
  },
);

// 3. Get Transaction Details (No token required since /any/)
app.get("/any/invoice/xml/:transaction_uid", async (req, res) => {
  try {
    const txId = req.params.transaction_uid;
    const [txs] = await db
      .promise()
      .query(
        "SELECT id, statut, date_creation FROM transactions WHERE id = ?",
        [txId],
      );
    if (!txs.length)
      return res
        .status(404)
        .json({ errorCode: 1, message: "Transaction not found" });

    const [docs] = await db
      .promise()
      .query(
        "SELECT id, statut, invoice_number FROM transaction_documents WHERE transaction_id = ?",
        [txId],
      );

    const invoices = docs.map((d) => ({
      status:
        d.statut === "signée_ttn"
          ? "TTN_SIGNED"
          : d.statut === "signée"
            ? "SIGNED"
            : "CREATED",
      uuid: String(d.id),
      invoiceNumber: d.invoice_number,
      ttnReference: "REF-TTN-" + d.id,
      twoDocImage:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // Mock 1x1
    }));

    res.status(200).json({
      object: {
        uuid: String(txs[0].id),
        status:
          txs[0].statut === "signée_ttn"
            ? "TTN_SIGNED"
            : txs[0].statut === "signée"
              ? "SIGNED"
              : "CREATED",
        invoices: invoices,
        creationDate: txs[0].date_creation,
      },
      errorCode: 0,
    });
  } catch (e) {
    res.status(500).json({ errorCode: 1 });
  }
});

// 4. Download Invoice PDF
app.get(
  "/protected/invoice/xml/pdf/:invoice_uid",
  verifyApiToken,
  async (req, res) => {
    try {
      const docId = req.params.invoice_uid;
      const [docs] = await db.promise().query(
        `
       SELECT d.pdf_file 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?
     `,
        [docId, req.apiUser.id],
      );

      if (!docs.length)
        return res.status(404).json({
          errorCode: 1,
          message: "Invoice not found or access denied",
        });

      res.status(200).json({
        object: docs[0].pdf_file,
        errorCode: 0,
      });
    } catch (e) {
      res.status(500).json({ errorCode: 1 });
    }
  },
);

// 5. Download Invoice XML
app.get(
  "/protected/invoice/xml/xml/:invoice_uid",
  verifyApiToken,
  async (req, res) => {
    try {
      const docId = req.params.invoice_uid;
      const [docs] = await db.promise().query(
        `
       SELECT d.xml_file, d.xml_signed, d.xml_signed_ttn, d.statut 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?
     `,
        [docId, req.apiUser.id],
      );

      if (!docs.length)
        return res.status(404).json({
          errorCode: 1,
          message: "Invoice not found or access denied",
        });

      const doc = docs[0];
      let xml = doc.xml_file;
      if (doc.statut === "signée_ttn" && doc.xml_signed_ttn)
        xml = doc.xml_signed_ttn;
      else if (
        (doc.statut === "signée" || doc.statut === "refusée par TTN") &&
        doc.xml_signed
      )
        xml = doc.xml_signed;

      res.status(200).json({
        object: xml,
        errorCode: 0,
      });
    } catch (e) {
      res.status(500).json({ errorCode: 1 });
    }
  },
);

/* ===================== ADMIN ROUTES API ===================== */
app.get("/api/admin/routes", verifyToken, verifyRole(["ADMIN"]), (req, res) => {
  db.query("SELECT * FROM api_routes ORDER BY path ASC", (err, results) => {
    if (err) {
      console.error("DB ROUTE ERROR:", err);
      return res
        .status(500)
        .json({ error: "Erreur lors de la lecture des routes depuis la base" });
    }

    const grouped = {};
    results.forEach((r) => {
      if (!grouped[r.path]) grouped[r.path] = { methods: [], role: r.role };
      grouped[r.path].methods.push(r.method);
    });

    const routes = Object.keys(grouped).map((path) => ({
      path,
      methods: grouped[path].methods,
      role: grouped[path].role,
    }));

    res.status(200).json({ routes });
  });
});

/* ===================== FCM / PUSH NOTIFICATIONS ===================== */

/// Enregistre le token FCM mobile auprès du serveur
app.post("/api/notifications/register-fcm", verifyToken, async (req, res) => {
  try {
    const { fcm_token, device_name } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ message: "Token FCM requis" });
    }

    // Ajouter colonne fcm_token à la table users si elle n'existe pas
    db.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500)`,
      (err) => {
        if (err && !err.message.includes("exists")) {
          console.error("FCM Column error:", err);
        }
      },
    );

    // Sauvegarder le token FCM
    await db
      .promise()
      .query(`UPDATE users SET fcm_token = ? WHERE id = ?`, [
        fcm_token,
        req.user.id,
      ]);

    debugPrint(`✅ Token FCM enregistré pour utilisateur ${req.user.id}`);

    return res.json({
      message: "Token FCM enregistré avec succès",
      device_name,
    });
  } catch (err) {
    console.error("REGISTER FCM ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur FCM" });
  }
});

/// Envoie une notification de test
app.post("/api/notifications/test", verifyToken, async (req, res) => {
  try {
    const testNotification = {
      title: "Notification de test",
      message: "🎉 Les notifications fonctionnent correctement !",
      type: "success",
    };

    // Créer une notification test
    await createNotification(
      req.user.id,
      testNotification.title,
      testNotification.message,
      testNotification.type,
    );

    return res.json({
      message: "Notification de test envoyée",
      notification: testNotification,
    });
  } catch (err) {
    console.error("TEST NOTIFICATION ERROR:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de l'envoi de notification" });
  }
});

/// Met à jour les préférences de notifications
app.put("/api/notifications/preferences", verifyToken, async (req, res) => {
  try {
    const preferences = req.body; // { email: true, push: true, sms: false }

    // Ajouter colonne notification_preferences si elle n'existe pas
    db.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSON`,
      (err) => {
        if (err && !err.message.includes("exists")) {
          console.error("Prefs Column error:", err);
        }
      },
    );

    // Sauvegarder les préférences
    await db
      .promise()
      .query(`UPDATE users SET notification_preferences = ? WHERE id = ?`, [
        JSON.stringify(preferences),
        req.user.id,
      ]);

    return res.json({
      message: "Préférences de notification mises à jour",
      preferences,
    });
  } catch (err) {
    console.error("UPDATE PREFERENCES ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== SERVER ===================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // SYNC ROUTES TO DATABASE AUTOMATICALLY
  db.query(
    `CREATE TABLE IF NOT EXISTS api_routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    path VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    role VARCHAR(255) DEFAULT 'Non défini',
    UNIQUE KEY unique_route (path, method)
  )`,
    (err) => {
      if (err) {
        console.error(
          "⚠️ Erreur de création de la table api_routes:",
          err.message,
        );
        return;
      }

      // Role mapping helper
      const getRouteRole = (p) => {
        const path = p.toLowerCase();
        if (path.includes("/api/auth/login")) return "Connexion utilisateur";
        if (path.includes("/api/auth/register"))
          return "Inscription nouvel utilisateur";
        if (path.includes("/api/auth/verify-email"))
          return "Verification OTP email";
        if (path.includes("/api/auth/me")) return "Infos profil connecte";
        if (path.includes("/api/auth/logout")) return "Deconnexion";
        if (path.includes("/api/auth/google")) return "Auth via Google";
        if (path.includes("/api/auth/forgot-password"))
          return "Demande reset mot de passe";
        if (path.includes("/api/auth/reset-password"))
          return "Reinitialisation mot de passe";
        if (path.includes("/api/admin/users"))
          return "Gestion des utilisateurs (Admin)";
        if (path.includes("/api/admin/routes"))
          return "Gestion des routes API (Admin)";
        if (path.includes("/api/transactions"))
          return "Gestion des transactions";
        if (path.includes("/api/factures")) return "Acces aux factures";
        if (path.includes("/api/notifications"))
          return "Gestion des notifications";
        if (path.includes("/api/generate-api-token")) return "Generer Cle API";
        if (path.includes("/api/my-api-token")) return "Recuperer Cle API";
        if (path.includes("/protected/invoice"))
          return "API Publique Export Documents";
        if (path.includes("/signature/")) return "Page de signature client";
        return "Route systeme ou utilitaire";
      };

      const syncRoutes = () => {
        const routesList = [];

        const extractRoutes = (stack, prefix = "") => {
          stack.forEach((layer) => {
            if (layer.route) {
              const p = layer.route.path;
              const fullPath = prefix + (p === "/" ? "" : p);
              Object.keys(layer.route.methods).forEach((method) => {
                if (layer.route.methods[method]) {
                  routesList.push({
                    path: fullPath || "/",
                    method: method.toUpperCase(),
                  });
                }
              });
            } else if (
              layer.name === "router" &&
              layer.handle &&
              layer.handle.stack
            ) {
              let newPrefix = prefix;
              if (layer.regexp && layer.regexp.source !== "^\\/?$") {
                const match = layer.regexp.source.match(/\\\/([^\\?]+)/);
                if (match && match[1]) newPrefix += "/" + match[1];
              }
              extractRoutes(layer.handle.stack, newPrefix);
            }
          });
        };

        const routerStack =
          (app.router && app.router.stack) ||
          (app._router && app._router.stack);
        if (routerStack) extractRoutes(routerStack);

        const uniqueMap = {};
        routesList.forEach((r) => {
          uniqueMap[r.path + r.method] = r;
        });
        const cleanRoutes = Object.values(uniqueMap);

        cleanRoutes.forEach((r) => {
          const role = getRouteRole(r.path);
          db.query(
            "INSERT INTO api_routes (path, method, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)",
            [String(r.path), String(r.method), role],
            (e) => {
              if (e) console.error("Sync error:", e.message);
            },
          );
        });

        setTimeout(() => {
          console.log(
            `OK Table api_routes synchronisee (${cleanRoutes.length} APIs).`,
          );
        }, 1500);
      };

      // MIGRATION: Ajoute la colonne role si absente, puis lance la sync
      db.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_routes' AND COLUMN_NAME = 'role'`,
        (mErr, mResults) => {
          if (!mErr && mResults[0].cnt === 0) {
            // Colonne manquante -> ALTER puis sync
            db.query(
              "ALTER TABLE api_routes ADD COLUMN role VARCHAR(255) DEFAULT 'Non defini'",
              (aErr) => {
                if (aErr)
                  console.error("Migration role column error:", aErr.message);
                else console.log("Colonne role ajoutee a api_routes.");
                syncRoutes(); // sync APRES que la colonne est creee
              },
            );
          } else {
            syncRoutes(); // colonne deja presente
          }
        },
      );
    },
  );
});
