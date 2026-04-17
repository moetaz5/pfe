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

/* ===================== FACTURES (UPLOAD PDF) ===================== */
/* ===================== FACTURES (BASE64) ===================== */
const storage = multer.memoryStorage();
const upload = multer({ storage });

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

/* ===================== SERVER ===================== */
const PORT = process.env.PORT || 5000;


const locals = {
  db, jwt, bcrypt, multer, nodemailer, JSZip, axios, fs, path, crypto, express, googleExchangeTokens, TTN_URL, TTN_LOGIN, TTN_PASSWORD, TTN_MATRICULE, sleep, cleanBase64, extractSoapReturn, extractSoapFault, saveEfactTTN, consultEfactTTN, processTTNSubmission, QRCode, safeJsonParse, resolveConfig, decodeXmlB64, extractReferenceCEVFromXml, extractReferenceTTNFromXml, generateQrPngBase64, stampPdfWithTTN, bufferToB64, b64ToBuffer, ensureBase64String, createNotification, notifyAdmins, sendSignatureEmail, sendSignedPdfsToClient, sendRejectionEmailToClient, allowedOrigins, transporter, sendVerificationEmail, EMAIL_REGEX, isValidEmail, sanitizeEmailHtml, sendTokenRequestPaymentPendingEmail, sendTokenRequestDecisionEmail, verifyToken, verifyRole, verifyApiToken, storage, upload, handleResendTTNCore, passport
};

require('./routes/auth.routes.js')(app, locals);
require('./routes/transactions.routes.js')(app, locals);
require('./routes/factures.routes.js')(app, locals);
require('./routes/notifications.routes.js')(app, locals);
require('./routes/admin.routes.js')(app, locals);
require('./routes/jeton.routes.js')(app, locals);
require('./routes/organizations.routes.js')(app, locals);
require('./routes/public.routes.js')(app, locals);
require('./routes/statistiques.routes.js')(app, locals);
require('./routes/external.routes.js')(app, locals);
require('./routes/support.routes.js')(app, locals);
require('./routes/ai.routes.js')(app, locals);
require('./routes/misc.routes.js')(app, locals);

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
