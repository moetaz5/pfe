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
/* ===================== EMAIL SIGNATURE ===================== */
const sendSignatureEmail = async (email, transactionId) => {
  const link = `http://localhost:3000/signature/${transactionId}`;

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

/* ===================== MIDDLEWARES ===================== */
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:3000",
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
  EMAIL_REGEX.test(String(value || "").trim().toLowerCase());

const sanitizeEmailHtml = (value) =>
  String(value || "").replace(/</g, "&lt;");

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
  const token = req.cookies.token;
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
    const apiToken = req.headers["x-api-key"];

    if (!apiToken) {
      return res.status(401).json({ message: "API token requis" });
    }

    const [rows] = await db
      .promise()
      .query("SELECT id, statut FROM users WHERE api_token = ?", [apiToken]);

    if (!rows.length) {
      return res.status(403).json({ message: "Token invalide" });
    }

    if (rows[0].statut === 0) {
      return res.status(403).json({ message: "Compte désactivé" });
    }

    req.apiUser = { id: rows[0].id };
    next();
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};
/* ===================== GENERATE API TOKEN ===================== */
app.post("/api/generate-api-token", verifyToken, async (req, res) => {
  try {
    const apiToken = crypto.randomBytes(40).toString("hex");

    await db
      .promise()
      .query("UPDATE users SET api_token = ? WHERE id = ?", [
        apiToken,
        req.user.id,
      ]);

    res.json({ apiToken });
  } catch (err) {
    res.status(500).json({ message: "Erreur génération token" });
  }
});

/* ===================== GOOGLE AUTH ===================== */
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:3000/login?error=google_failed",
  }),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.redirect("http://localhost:3000/login?error=auth_failed");
      }

      // 🔎 Vérifier le statut réel en base
      const [rows] = await db
        .promise()
        .query("SELECT id, role, statut FROM users WHERE id = ?", [
          req.user.id,
        ]);

      if (!rows.length) {
        return res.redirect("http://localhost:3000/login?error=user_not_found");
      }

      const user = rows[0];

      // ❌ Compte désactivé
      if (user.statut === 0) {
        return res.redirect("http://localhost:3000/login?error=disabled");
      }

      // 🔐 Génération JWT
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" },
      );

      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
      });

      return res.redirect("http://localhost:3000/dashboard");
    } catch (error) {
      console.error("GOOGLE CALLBACK ERROR:", error);
      return res.redirect("http://localhost:3000/login?error=server");
    }
  },
);

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
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err || results.length === 0)
      return res.status(401).json({ message: "Email invalide" });

    const user = results[0];

    // google users
    if (!user.password) {
      return res.status(401).json({
        message: "Ce compte utilise Google. Connectez-vous avec Google.",
      });
    }

    // ❌ Email non vérifié
    if (user.is_verified === 0) {
      return res.status(401).json({
        message: "Veuillez vérifier votre email avant de vous connecter.",
      });
    }

    // ❌ Compte désactivé
    if (user.statut === 0) {
      return res.status(403).json({
        message: "Votre compte est désactivé. Contactez l’administrateur.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: "Mot de passe incorrect" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
    });

    res.json({ message: "Connexion réussie" });
  });
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
  const sql =
    "SELECT id, name, email, role, phone, address, is_verified FROM users WHERE id = ?";
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
/*récupérer les factures utilisables*/
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
    res.json(results);
  });
});



/* ===================== FACTURES (UPLOAD PDF) ===================== */
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post(
  "/api/factures",
  verifyToken,
  upload.single("fichier_pdf"),
  (req, res) => {

    if (!req.file) {
      return res.status(400).json({ message: "Fichier PDF manquant" });
    }

    const fichierPdf = req.file.buffer;
    const originalName = req.file.originalname; // ✅ NOM RÉEL

    const sql = `
      INSERT INTO factures (user_id, statut, fichier_pdf, file_name)
      VALUES (?, ?, ?, ?)
    `;

    db.query(
      sql,
      [req.user.id, "en attente", fichierPdf, originalName],
      (err, result) => {
        if (err) {
          console.error("FACTURE INSERT ERROR:", err);
          return res.status(500).json({ message: "Erreur serveur" });
        }

        res.status(201).json({
          message: "Facture ajoutée avec succès",
          id: result.insertId,
        });
      }
    );
  }
);

app.get("/api/factures", verifyToken, (req, res) => {
  const sql = `
    SELECT id, statut, file_name
    FROM factures
    WHERE user_id = ?
    ORDER BY id DESC
  `;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});



app.get("/api/factures/:id", verifyToken, (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT fichier_pdf, file_name
    FROM factures
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [id, req.user.id], (err, results) => {
    if (err || results.length === 0)
      return res.status(404).json({ message: "Facture non trouvée" });

    const facture = results[0];

    res.setHeader("Content-Type", "application/pdf");

    // ✅ envoyer vrai nom
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${facture.file_name}"`
    );

    res.send(facture.fichier_pdf);
  });
});


/* ===================== TRANSACTIONS ===================== */
/* ===================== CRÉATION TRANSACTION ===================== */
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
        existing_facture_ids,
      } = req.body;

      if (!facture_number || !signataire_email || !client_email) {
        return res.status(400).json({ message: "Champs manquants" });
      }

      const pdfFiles = req.files?.pdf_files || [];
      const xmlFiles = req.files?.xml_files || [];

      let pairs = [];

      /* ===============================
         1️⃣ FACTURES EXISTANTES
      =============================== */

      if (existing_facture_ids) {
        const ids = Array.isArray(existing_facture_ids)
          ? existing_facture_ids
          : [existing_facture_ids];

        for (const id of ids) {
          const [rows] = await db
            .promise()
            .query(
              "SELECT id, fichier_pdf, file_name, statut FROM factures WHERE id = ? AND user_id = ?",
              [id, req.user.id]
            );

          if (!rows.length) {
            return res
              .status(404)
              .json({ message: `Facture ${id} introuvable` });
          }

          if (rows[0].statut !== "en attente") {
            return res.status(400).json({
              message: `Facture ${id} n'est pas disponible`,
            });
          }

          const baseName = rows[0].file_name
            ? path.parse(rows[0].file_name).name.trim().toLowerCase()
            : `facture_${id}`;

          pairs.push({
            filename: baseName,
            pdfBuffer: rows[0].fichier_pdf,
            xmlBuffer: null,
            factureId: id,
          });
        }
      }

      /* ===============================
         2️⃣ NOUVEAUX PDF
      =============================== */

      if (pdfFiles.length > 0) {
        if (xmlFiles.length === 0) {
          return res.status(400).json({ message: "Aucun XML importé" });
        }

        const xmlMap = {};
        xmlFiles.forEach((xml) => {
          const base = path
            .parse(xml.originalname)
            .name.trim()
            .toLowerCase();
          xmlMap[base] = xml;
        });

        for (const pdf of pdfFiles) {
          const base = path
            .parse(pdf.originalname)
            .name.trim()
            .toLowerCase();

          const xml = xmlMap[base];

          if (!xml) {
            return res.status(400).json({
              message: `XML introuvable pour ${pdf.originalname}`,
            });
          }

          pairs.push({
            filename: base,
            pdfBuffer: pdf.buffer,
            xmlBuffer: xml.buffer,
          });
        }
      }

      if (pairs.length === 0) {
        return res.status(400).json({
          message: "Aucune facture sélectionnée",
        });
      }

      /* ===============================
         3️⃣ MATCH XML POUR EXISTANT
      =============================== */

      if (existing_facture_ids && xmlFiles.length > 0) {
        const xmlMap = {};
        xmlFiles.forEach((xml) => {
          const base = path
            .parse(xml.originalname)
            .name.trim()
            .toLowerCase();
          xmlMap[base] = xml;
        });

        for (let p of pairs) {
          if (!p.xmlBuffer) {
            const xml = xmlMap[p.filename];
            if (!xml) {
              return res.status(400).json({
                message: `XML manquant pour ${p.filename}`,
              });
            }
            p.xmlBuffer = xml.buffer;
          }
        }
      }

      /* ===============================
         4️⃣ CREER TRANSACTION
      =============================== */

      const [txRes] = await db.promise().query(
        `
        INSERT INTO transactions
        (facture_number, signataire_email, client_email, user_id, statut)
        VALUES (?, ?, ?, ?, 'créé')
        `,
        [facture_number, signataire_email, client_email, req.user.id]
      );

      const transactionId = txRes.insertId;

      /* ===============================
         5️⃣ INSERER DOCUMENTS
      =============================== */

      for (const p of pairs) {
        await db.promise().query(
          `
          INSERT INTO transaction_documents
          (transaction_id, filename, pdf_file, xml_file, statut)
          VALUES (?, ?, ?, ?, 'créé')
          `,
          [transactionId, p.filename, p.pdfBuffer, p.xmlBuffer]
        );

        // 🔥 Mettre facture en_transaction
        if (p.factureId) {
          await db
            .promise()
            .query(
              "UPDATE factures SET statut = 'en_transaction' WHERE id = ?",
              [p.factureId]
            );
        }
      }

      await sendSignatureEmail(signataire_email, transactionId);

      res.status(201).json({
        message: "Transaction créée avec succès",
        transactionId,
      });
    } catch (e) {
      console.error("CREATE TX ERROR:", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);
/* ===================== EXTERNAL CREATE TRANSACTION ===================== */
app.post(
  "/api/external/transactions",
  verifyApiToken,
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
      } = req.body;

      if (!facture_number || !signataire_email || !client_email) {
        return res.status(400).json({ message: "Champs manquants" });
      }

      const pdfFiles = req.files?.pdf_files || [];
      const xmlFiles = req.files?.xml_files || [];

      if (!pdfFiles.length || !xmlFiles.length) {
        return res.status(400).json({ message: "PDF et XML requis" });
      }

      const xmlMap = {};
      xmlFiles.forEach((xml) => {
        const base = path.parse(xml.originalname).name.toLowerCase();
        xmlMap[base] = xml;
      });

      const pairs = [];

      for (const pdf of pdfFiles) {
        const base = path.parse(pdf.originalname).name.toLowerCase();
        const xml = xmlMap[base];

        if (!xml) {
          return res.status(400).json({
            message: `XML manquant pour ${pdf.originalname}`,
          });
        }

        pairs.push({
          filename: base,
          pdfBuffer: pdf.buffer,
          xmlBuffer: xml.buffer,
        });
      }

      const [txRes] = await db.promise().query(
        `
        INSERT INTO transactions
        (facture_number, signataire_email, client_email, user_id, statut)
        VALUES (?, ?, ?, ?, 'créé')
        `,
        [
          facture_number,
          signataire_email,
          client_email,
          req.apiUser.id,
        ]
      );

      const transactionId = txRes.insertId;

      for (const p of pairs) {
        await db.promise().query(
          `
          INSERT INTO transaction_documents
          (transaction_id, filename, pdf_file, xml_file, statut)
          VALUES (?, ?, ?, ?, 'créé')
          `,
          [transactionId, p.filename, p.pdfBuffer, p.xmlBuffer]
        );
      }

      res.status(201).json({
        message: "Transaction créée via API",
        transactionId,
      });
    } catch (e) {
      console.error("EXTERNAL TX ERROR:", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/* ===================== EXTERNAL DOWNLOAD ZIP ===================== */
app.get(
  "/api/external/transactions/:id/zip",
  verifyApiToken,
  async (req, res) => {
    const { id } = req.params;

    const [txRows] = await db
      .promise()
      .query(
        "SELECT id FROM transactions WHERE id = ? AND user_id = ?",
        [id, req.apiUser.id]
      );

    if (!txRows.length) {
      return res.status(404).json({ message: "Transaction introuvable" });
    }

    const [docs] = await db.promise().query(
      `
      SELECT filename, pdf_file, xml_file, xml_signed, statut
      FROM transaction_documents
      WHERE transaction_id = ?
      `,
      [id]
    );

    const zip = new JSZip();

    docs.forEach((d) => {
      zip.file(`${d.filename}.pdf`, d.pdf_file);
      const xmlToUse =
        d.statut === "signée" && d.xml_signed
          ? d.xml_signed
          : d.xml_file;
      zip.file(`${d.filename}.xml`, xmlToUse);
    });

    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transaction_${id}.zip`
    );

    res.send(content);
  }
);
/* ===================== EXTERNAL LIST FACTURES ===================== */
app.get("/api/external/factures", verifyApiToken, async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
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
        [req.apiUser.id]
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=${rows[0].filename}.pdf`,
    );
    res.send(rows[0].pdf_file);
  } catch (e) {
    console.error("PUBLIC PDF ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/transactions", verifyToken, (req, res) => {
  const { search } = req.query;

  let sql = `
    SELECT 
      t.id,
      t.facture_number,
      t.statut,
      t.date_creation,
      u.name AS user_name
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.user_id = ?
  `;

  let queryParams = [req.user.id];

  if (search) {
    sql += " AND (t.facture_number LIKE ? OR t.statut LIKE ?)";
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY t.date_creation DESC";

  db.query(sql, queryParams, (err, results) => {
    if (err) {
      console.log("TRANSACTION LIST ERROR:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    res.json(results);
  });
});

app.get("/api/transactions/:id/details", verifyToken, (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      t.id,
      t.facture_number,
      t.statut,
      t.date_creation,
      u.name AS user_name
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ? AND t.user_id = ?
  `;

  db.query(sql, [id, req.user.id], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }
    res.json(results[0]);
  });
});
//*telecharger le fichier xml selon le statut
app.get("/api/transactions/:id/download", verifyToken, (req, res) => {
  const { id } = req.params;
  const fileType = req.query.type || "pdf";

  const sql = `
    SELECT pdf_file, xml_file, xml_signed, statut
    FROM transactions
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [id, req.user.id], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }

    const tx = results[0];

    let fileBuffer;
    let contentType;
    let filename;

    if (fileType === "xml") {
      fileBuffer =
        tx.statut === "signée" && tx.xml_signed ? tx.xml_signed : tx.xml_file;

      contentType = "application/xml";
      filename = `facture_${id}.xml`;
    } else {
      fileBuffer = tx.pdf_file;
      contentType = "application/pdf";
      filename = `facture_${id}.pdf`;
    }

    if (!fileBuffer) {
      return res.status(404).json({ message: "Fichier non trouvé" });
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    res.send(fileBuffer);
  });
});

//*telecharger le fichier zip selon le statut
app.get("/api/transactions/:id/zip", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check ownership transaction
    const [txRows] = await db
      .promise()
      .query(`SELECT id, user_id FROM transactions WHERE id = ?`, [id]);
    if (!txRows.length || txRows[0].user_id !== req.user.id) {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }

    const [docs] = await db.promise().query(
      `
      SELECT filename, pdf_file, xml_file, xml_signed, statut
      FROM transaction_documents
      WHERE transaction_id = ?
      ORDER BY id ASC
      `,
      [id],
    );

    if (!docs.length) {
      return res.status(404).json({ message: "Aucun document" });
    }

    const zip = new JSZip();

    docs.forEach((d, idx) => {
      zip.file(`${d.filename}.pdf`, d.pdf_file);
      const xmlToUse =
        d.statut === "signée" && d.xml_signed ? d.xml_signed : d.xml_file;
      zip.file(`${d.filename}.xml`, xmlToUse);
    });

    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transaction_${id}.zip`,
    );
    res.send(content);
  } catch (e) {
    console.error("ZIP MULTI ERROR:", e);
    res.status(500).json({ message: "Erreur ZIP" });
  }
});
////////get plusieur document d une seul transaction
app.get("/api/transactions/:id/docs", verifyToken, async (req, res) => {
  const { id } = req.params;

  const [tx] = await db
    .promise()
    .query("SELECT id, user_id FROM transactions WHERE id = ?", [id]);

  if (!tx.length || tx[0].user_id !== req.user.id) {
    return res.status(404).json({ message: "Transaction introuvable" });
  }

  const [docs] = await db.promise().query(
    `
    SELECT id, filename, statut, signed_at, created_at
    FROM transaction_documents
    WHERE transaction_id = ?
    ORDER BY id ASC
    `,
    [id],
  );

  res.json(docs);
});
///Download PDF par document
app.get("/api/docs/:docId/download", verifyToken, async (req, res) => {
  const { docId } = req.params;
  const { type } = req.query;

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
    return res.status(404).json({ message: "Document introuvable" });
  }

  const doc = rows[0];

  if (type === "xml") {
    const xmlToUse =
      doc.statut === "signée" && doc.xml_signed ? doc.xml_signed : doc.xml_file;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${doc.filename}.xml`,
    );
    return res.send(xmlToUse);
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${doc.filename}.pdf`,
  );
  res.send(doc.pdf_file);
});

/* ===================== STATISTIQUES ===================== */
/* ===================== STATISTIQUE USER ===================== */
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
      factTotalResult,
      factByStatusResult,
      txByMonthResult,
    ] = await Promise.all([
      db
        .promise()
        .query("SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?", [
          userId,
        ]),
      db.promise().query(
        `
          SELECT statut, COUNT(*) AS total
          FROM transactions
          WHERE user_id = ?
          GROUP BY statut
        `,
        [userId],
      ),
      db
        .promise()
        .query("SELECT COUNT(*) AS total FROM factures WHERE user_id = ?", [
          userId,
        ]),
      db.promise().query(
        `
          SELECT statut, COUNT(*) AS total
          FROM factures
          WHERE user_id = ?
          GROUP BY statut
        `,
        [userId],
      ),
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

    const txTotal = txTotalResult[0];
    const txByStatus = txByStatusResult[0];
    const factTotal = factTotalResult[0];
    const factByStatus = factByStatusResult[0];
    const txByMonth = txByMonthResult[0];

    let transactionsCreees = 0;
    let transactionsSignees = 0;
    let transactionsSigneesTTN = 0;
    let transactionsAutres = 0;

    txByStatus.forEach((row) => {
      const status = normalizeStatus(row.statut);
      const total = Number(row.total || 0);

      if (!status) {
        transactionsAutres += total;
        return;
      }

      if (status.includes("ttn")) {
        transactionsSigneesTTN += total;
        return;
      }

      if (status.includes("sign")) {
        transactionsSignees += total;
        return;
      }

      if (status.includes("cree")) {
        transactionsCreees += total;
        return;
      }

      transactionsAutres += total;
    });

    let facturesEnAttente = 0;
    let facturesEnTransaction = 0;
    let facturesSignees = 0;
    let facturesAutres = 0;

    factByStatus.forEach((row) => {
      const status = normalizeStatus(row.statut);
      const total = Number(row.total || 0);

      if (!status) {
        facturesEnAttente += total;
        return;
      }

      if (status.includes("attente")) {
        facturesEnAttente += total;
        return;
      }

      if (status.includes("transaction")) {
        facturesEnTransaction += total;
        return;
      }

      if (status.includes("sign")) {
        facturesSignees += total;
        return;
      }

      facturesAutres += total;
    });

    const stats = {
      totalTransactions: txTotal[0]?.total || 0,
      transactionsCreees,
      transactionsSignees,
      transactionsSigneesTTN,
      transactionsValidees: transactionsSignees + transactionsSigneesTTN,
      transactionsEnAttente: transactionsCreees + transactionsAutres,
      totalFactures: factTotal[0]?.total || 0,
      facturesEnAttente: facturesEnAttente + facturesAutres,
      facturesEnTransaction,
      facturesSignees,
      facturesTerminees: facturesSignees,
      transactionsParMois: txByMonth.map((row) => ({
        mois: "M" + row.mois,
        total: Number(row.total || 0),
      })),
    };

    res.json(stats);
  } catch (err) {
    console.error("❌ Erreur stats:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
//*****************STATISTIQUE ADMIN****//////////////////////// */
app.get("/api/statistiqueadmin", verifyToken, async (req, res) => {
  try {
    const role = String(req.user?.role || "")
      .trim()
      .toLowerCase();

    if (role !== "admin" && role !== "superadmin" && role !== "1") {
      return res.status(403).json({ message: "Acces reserve a l'admin" });
    }

    const normalizeStatus = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const [
      usersCountResult,
      usersTypesResult,
      usersListResult,
      txRowsResult,
      factRowsResult,
      txByMonthResult,
    ] = await Promise.all([
      db.promise().query("SELECT COUNT(*) AS total FROM users"),
      db.promise().query(`
        SELECT
          SUM(CASE WHEN password IS NULL OR password = '' THEN 1 ELSE 0 END) AS google,
          SUM(CASE WHEN password IS NOT NULL AND password <> '' THEN 1 ELSE 0 END) AS simple
        FROM users
      `),
      db.promise().query(`
        SELECT
          id,
          name,
          email,
          role,
          CASE
            WHEN password IS NULL OR password = '' THEN 'google'
            ELSE 'simple'
          END AS inscription_type
        FROM users
        ORDER BY id DESC
      `),
      db.promise().query(`
        SELECT
          t.id,
          t.facture_number,
          t.statut,
          t.date_creation,
          t.user_id,
          u.name AS user_name,
          u.email AS user_email
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.date_creation DESC
      `),
      db.promise().query(`
        SELECT
          f.id,
          f.statut,
          f.date_facture,
          f.user_id,
          u.name AS user_name,
          u.email AS user_email
        FROM factures f
        JOIN users u ON u.id = f.user_id
        ORDER BY f.date_facture DESC
      `),
      db.promise().query(`
        SELECT MONTH(date_creation) AS mois, COUNT(*) AS total
        FROM transactions
        GROUP BY MONTH(date_creation)
        ORDER BY mois
      `),
    ]);

    const usersCount = usersCountResult[0];
    const usersTypes = usersTypesResult[0];
    const usersRows = usersListResult[0];
    const txRows = txRowsResult[0];
    const factRows = factRowsResult[0];
    const txByMonth = txByMonthResult[0];

    let transactionsCreees = 0;
    let transactionsSignees = 0;
    let transactionsSigneesTTN = 0;
    let transactionsAutres = 0;

    txRows.forEach((row) => {
      const status = normalizeStatus(row.statut);

      if (!status) {
        transactionsAutres += 1;
        return;
      }

      if (status.includes("ttn")) {
        transactionsSigneesTTN += 1;
        return;
      }

      if (status.includes("sign")) {
        transactionsSignees += 1;
        return;
      }

      if (status.includes("cree")) {
        transactionsCreees += 1;
        return;
      }

      transactionsAutres += 1;
    });

    let facturesEnAttente = 0;
    let facturesEnTransaction = 0;
    let facturesSignees = 0;
    let facturesAutres = 0;

    factRows.forEach((row) => {
      const status = normalizeStatus(row.statut);

      if (!status) {
        facturesEnAttente += 1;
        return;
      }

      if (status.includes("attente")) {
        facturesEnAttente += 1;
        return;
      }

      if (status.includes("transaction")) {
        facturesEnTransaction += 1;
        return;
      }

      if (status.includes("sign")) {
        facturesSignees += 1;
        return;
      }

      facturesAutres += 1;
    });

    const stats = {
      utilisateurs: Number(usersCount[0]?.total || 0),
      utilisateursGoogle: Number(usersTypes[0]?.google || 0),
      utilisateursSimples: Number(usersTypes[0]?.simple || 0),
      totalTransactions: txRows.length,
      transactionsCreees,
      transactionsSignees,
      transactionsSigneesTTN,
      transactionsValidees: transactionsSignees + transactionsSigneesTTN,
      transactionsEnAttente: transactionsCreees + transactionsAutres,
      totalFactures: factRows.length,
      facturesEnAttente: facturesEnAttente + facturesAutres,
      facturesEnTransaction,
      facturesSignees,
      facturesTerminees: facturesSignees,
      transactionsParMois: txByMonth.map((row) => ({
        mois: "M" + row.mois,
        total: Number(row.total || 0),
      })),
      transactionsListe: txRows,
      facturesListe: factRows,
      utilisateursListe: usersRows,
    };

    res.json(stats);
  } catch (err) {
    console.error("Erreur stats admin:", err);
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
// ✍️ Signature logique (SSCD - sans signature manuscrite)
// ✍️ Signature XML (publique)
// ✍️ Signature XML (publique)
app.post("/api/public/transactions/:id/sign", async (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: "PIN_REQUIRED" });
  }

  try {
    const [docs] = await db.promise().query(
      `
      SELECT id, xml_file, statut, transaction_id
      FROM transaction_documents
      WHERE transaction_id = ?
      `,
      [id]
    );

    if (!docs.length) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const remaining = docs.filter((d) => d.statut !== "signée");

    for (const doc of remaining) {
      const xmlBase64 = doc.xml_file.toString("base64");

      const javaRes = await axios.post(
        "http://127.0.0.1:9000/sign/xml",
        { pin, xmlBase64 },
        { headers: { "Content-Type": "application/json" } }
      );

      const signedXml = Buffer.from(
        javaRes.data.signedXmlBase64,
        "base64"
      );

      await db.promise().query(
        `
        UPDATE transaction_documents
        SET statut = 'signée',
            xml_signed = ?,
            signed_at = NOW()
        WHERE id = ?
        `,
        [signedXml, doc.id]
      );
    }

    // 🔥 Transaction signée
    await db.promise().query(
      `UPDATE transactions SET statut = 'signée', signed_at = NOW() WHERE id = ?`,
      [id]
    );

    // 🔥 Mettre factures liées en signée
    await db.promise().query(
      `
      UPDATE factures f
      JOIN transaction_documents td 
        ON LOWER(td.filename) = LOWER(SUBSTRING_INDEX(f.file_name,'.',1))
      SET f.statut = 'signée'
      WHERE td.transaction_id = ?
      `,
      [id]
    );

    res.json({ success: true });
  } catch (e) {
    console.error("SIGN ERROR:", e);
    res.status(500).json({ error: "SIGN_FAILED" });
  }
});


app.get("/api/transactions/:id/xml", verifyToken, async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.promise().query(
    `
      SELECT statut, xml_file, xml_signed
      FROM transactions
      WHERE id = ? AND user_id = ?
      `,
    [id, req.user.id],
  );

  if (!rows.length) {
    return res.status(404).json({
      message: "Transaction introuvable",
    });
  }

  const tx = rows[0];

  const xml =
    tx.statut === "terminee" && tx.xml_signed ? tx.xml_signed : tx.xml_file;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Content-Disposition", `inline; filename=facture_${id}.xml`);

  res.send(xml);
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
app.get(
  "/api/admin/jeton",
  verifyToken,
  verifyRole(["ADMIN"]),
  (req, res) => {
    const status = String(req.query.status || "").toLowerCase().trim();
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
  },
);

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

    const nextStatus = String(decision || "").toLowerCase().trim();
    if (!["payment_pending", "approved", "rejected"].includes(nextStatus)) {
      return res.status(400).json({ message: "Decision invalide" });
    }

    try {
      const [rows] = await db.promise().query(
        `
          SELECT
            tr.id,
            tr.pack_name,
            tr.tokens,
            tr.price_tnd,
            tr.contact_info,
            tr.status,
            CASE WHEN tr.payment_proof IS NULL THEN 0 ELSE 1 END AS has_payment_proof,
            u.email AS user_email
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

      let allowedCurrentStatuses = [];
      if (nextStatus === "payment_pending") {
        allowedCurrentStatuses = ["pending"];
      } else if (nextStatus === "approved") {
        allowedCurrentStatuses = ["payment_submitted"];
      } else if (nextStatus === "rejected") {
        allowedCurrentStatuses = ["pending", "payment_pending", "payment_submitted"];
      }

      if (!allowedCurrentStatuses.includes(tokenRequest.status)) {
        return res.status(409).json({
          message: "Transition de statut non autorisee",
        });
      }

      if (nextStatus === "approved" && Number(tokenRequest.has_payment_proof) !== 1) {
        return res.status(409).json({
          message: "Impossible de confirmer sans preuve de paiement",
        });
      }

      const placeholders = allowedCurrentStatuses.map(() => "?").join(", ");
      const [updateRes] = await db.promise().query(
        `
          UPDATE jeton
          SET status = ?,
              admin_note = ?,
              decided_by = ?,
              decided_at = NOW()
          WHERE id = ? AND status IN (${placeholders})
        `,
        [
          nextStatus,
          admin_note ? String(admin_note).trim() : null,
          req.user.id,
          id,
          ...allowedCurrentStatuses,
        ],
      );

      if (!updateRes.affectedRows) {
        return res.status(409).json({
          message: "Statut modifie, veuillez actualiser la page",
        });
      }

      const contactEmail = String(tokenRequest.contact_info || "")
        .trim()
        .toLowerCase();
      const fallbackUserEmail = String(tokenRequest.user_email || "")
        .trim()
        .toLowerCase();
      const recipientEmail = isValidEmail(contactEmail)
        ? contactEmail
        : isValidEmail(fallbackUserEmail)
          ? fallbackUserEmail
          : "";

      if (!recipientEmail) {
        return res.json({
          message: "Decision enregistree, email non envoye (adresse invalide)",
          emailSent: false,
        });
      }

      try {
        if (nextStatus === "payment_pending") {
          await sendTokenRequestPaymentPendingEmail({
            toEmail: recipientEmail,
            packName: tokenRequest.pack_name,
            tokens: tokenRequest.tokens,
            priceTnd: tokenRequest.price_tnd,
            adminNote: admin_note ? String(admin_note).trim() : null,
          });
        } else {
          await sendTokenRequestDecisionEmail({
            toEmail: recipientEmail,
            packName: tokenRequest.pack_name,
            tokens: tokenRequest.tokens,
            priceTnd: tokenRequest.price_tnd,
            decision: nextStatus,
            adminNote: admin_note ? String(admin_note).trim() : null,
          });
        }
      } catch (mailError) {
        console.error("TOKEN REQUEST EMAIL ERROR:", mailError);
        return res.json({
          message: "Decision enregistree, email non envoye",
          emailSent: false,
        });
      }

      res.json({
        message:
          nextStatus === "payment_pending"
            ? "Premiere confirmation enregistree et email envoye"
            : "Decision finale enregistree et email envoye",
        emailSent: true,
      });
    } catch (err) {
      console.error("TOKEN REQUEST DECISION ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);




/* ===================== SERVER ===================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
/******position QR */
app.get("/api/transactions/:id/position", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.promise().query(
      "SELECT position FROM transactions WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Transaction introuvable" });
    }

    res.json({
      position: rows[0].position ? JSON.parse(rows[0].position) : null,
    });

  } catch (err) {
    console.error("GET POSITION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
app.put("/api/transactions/:id/position", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const payload =
      req.body && typeof req.body === "object"
        ? JSON.stringify(req.body)
        : null;

    const [result] = await db.promise().query(
      "UPDATE transactions SET position = ? WHERE id = ? AND user_id = ?",
      [payload, id, req.user.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Transaction introuvable" });
    }

    res.json({
      message: "Position enregistrée avec succès",
      position: req.body || null,
    });

  } catch (err) {
    console.error("SAVE POSITION ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "../style/posSignature.css";

const PosSignature = ({ transactionId, onClose }) => {
  const API_URL = "http://localhost:5000";
  const MIN_SIZE = 24;
  const DEFAULT_QR_WIDTH = 120;
  const DEFAULT_QR_HEIGHT = 120;
  const DEFAULT_REF_WIDTH = 360;
  const DEFAULT_REF_HEIGHT = 56;
  const REFERENCE_TEXT =
    "Copie de la facture electronique enregistree aupres de TTN sous la reference unique n";
  const REFERENCE_SAMPLE = "000000000000000000000000000";
  const sheetRef = useRef(null);

  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [step, setStep] = useState("qr");
  const [qrZone, setQrZone] = useState(null);
  const [refZone, setRefZone] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pointFromEvent(event) {
    if (!sheetRef.current) return null;
    const bounds = sheetRef.current.getBoundingClientRect();
    return {
      x: clamp(Math.round(event.clientX - bounds.left), 0, Math.round(bounds.width)),
      y: clamp(Math.round(event.clientY - bounds.top), 0, Math.round(bounds.height)),
    };
  }

  function rectFromPoints(start, end) {
    return {
      x: Math.round(Math.min(start.x, end.x)),
      y: Math.round(Math.min(start.y, end.y)),
      width: Math.round(Math.abs(end.x - start.x)),
      height: Math.round(Math.abs(end.y - start.y)),
      page: 1,
      unit: "px",
    };
  }

  function parseStoredRect(raw, type) {
    if (!raw) return null;

    let value = raw;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch (e) {
        return null;
      }
    }

    if (!value || typeof value !== "object") return null;

    if (value.configuration && typeof value.configuration === "object") {
      const c = value.configuration;
      if (type === "qr") {
        const x = Number(c.qrPositionX);
        const y = Number(c.qrPositionY);
        const page = Number(c.qrPositionP || 1);
        const width = Number(c.qrWidth || DEFAULT_QR_WIDTH);
        const height = Number(c.qrHeight || DEFAULT_QR_HEIGHT);

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(page)) return null;
        return {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.max(MIN_SIZE, Math.round(width)),
          height: Math.max(MIN_SIZE, Math.round(height)),
          page: Math.max(1, Math.floor(page)),
          unit: "px",
        };
      }

      const x = Number(c.labelPositionX);
      const y = Number(c.labelPositionY);
      const page = Number(c.labelPositionP || 1);
      const width = Number(c.labelWidth || DEFAULT_REF_WIDTH);
      const height = Number(c.labelHeight || DEFAULT_REF_HEIGHT);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(page)) return null;
      return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.max(MIN_SIZE, Math.round(width)),
        height: Math.max(MIN_SIZE, Math.round(height)),
        page: Math.max(1, Math.floor(page)),
        unit: "px",
      };
    }

    const page = Number(value.page || 1);
    const x = Number(value.x);
    const y = Number(value.y);
    const width = Number(value.width || (type === "qr" ? DEFAULT_QR_WIDTH : DEFAULT_REF_WIDTH));
    const height = Number(value.height || (type === "qr" ? DEFAULT_QR_HEIGHT : DEFAULT_REF_HEIGHT));

    if (
      !Number.isFinite(page) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return null;
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.max(MIN_SIZE, Math.round(width)),
      height: Math.max(MIN_SIZE, Math.round(height)),
      page: Math.max(1, Math.floor(page)),
      unit: "px",
    };
  }

  function toQrPayload(rect) {
    if (!rect) return null;
    return {
      configuration: {
        qrPositionX: rect.x,
        qrPositionY: rect.y,
        qrPositionP: rect.page || 1,
        qrWidth: rect.width,
        qrHeight: rect.height,
      },
    };
  }

  function toRefPayload(rect) {
    if (!rect) return null;
    return {
      configuration: {
        labelPositionX: rect.x,
        labelPositionY: rect.y,
        labelPositionP: rect.page || 1,
        labelWidth: rect.width,
        labelHeight: rect.height,
        referenceText: REFERENCE_TEXT,
      },
    };
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [qrRes, refRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/auth/position`, { withCredentials: true }),
        axios.get(`${API_URL}/api/auth/posref`, { withCredentials: true }),
      ]);
      const qrFailed = qrRes.status !== "fulfilled";

      if (!qrFailed) {
        setQrZone(parseStoredRect(qrRes.value?.data?.position, "qr"));
      } else {
        setMessage({
          type: "error",
          text:
            qrRes.reason?.response?.data?.message ||
            "Erreur chargement position QR.",
        });
      }

      if (refRes.status === "fulfilled") {
        setRefZone(parseStoredRect(refRes.value?.data?.posref, "ref"));
      } else if (!qrFailed) {
        setMessage({
          type: "info",
          text:
            refRes.reason?.response?.data?.message ||
            "API posref non disponible pour le moment.",
        });
      }

      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const onChoosePdf = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf =
      String(file.type || "").toLowerCase() === "application/pdf" ||
      /\.pdf$/i.test(file.name || "");
    if (!isPdf) {
      setMessage({ type: "error", text: "Veuillez importer un fichier PDF." });
      return;
    }

    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(file));
    setPdfName(file.name || "document.pdf");
    setMessage({
      type: "success",
      text:
        step === "qr"
          ? "PDF charge. Etape 1: selectionnez la zone QR."
          : "PDF charge. Etape 2: selectionnez la zone de reference.",
    });
  };

  const onMouseDown = (event) => {
    if (!pdfUrl) {
      setMessage({ type: "error", text: "Importez un PDF avant de selectionner." });
      return;
    }
    const start = pointFromEvent(event);
    if (!start) return;
    setDraft({ start, end: start, type: step });
  };

  const onMouseMove = (event) => {
    if (!draft?.start) return;
    const end = pointFromEvent(event);
    if (!end) return;
    setDraft((prev) => (prev ? { ...prev, end } : prev));
  };

  const onMouseUp = (event) => {
    if (!draft?.start) return;
    const end = pointFromEvent(event) || draft.end || draft.start;
    const rect = rectFromPoints(draft.start, end);
    const captureType = draft.type || step;
    setDraft(null);

    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      setMessage({
        type: "error",
        text: "Zone trop petite. Selectionnez une zone plus grande.",
      });
      return;
    }

    if (captureType === "qr") {
      setQrZone(rect);
      setMessage({
        type: "success",
        text: "Zone QR selectionnee. Cliquez sur Envoyer QR.",
      });
      return;
    }

    setRefZone(rect);
    setMessage({
      type: "success",
      text: "Zone reference selectionnee. Cliquez sur Envoyer reference.",
    });
  };

  const onResetStep = () => {
    setDraft(null);
    if (step === "qr") {
      setQrZone(null);
    } else {
      setRefZone(null);
    }
    setMessage({ type: "", text: "" });
  };

  const onSaveQr = async () => {
    const payload = toQrPayload(qrZone);
    if (!payload) {
      setMessage({ type: "error", text: "Selectionnez la zone QR avant envoi." });
      return;
    }

    try {
      setSavingType("qr");
      await axios.put(`${API_URL}/api/auth/position`, payload, {
        withCredentials: true,
      });
      setStep("ref");
      setMessage({
        type: "success",
        text: "Etape 1 validee. Passez a l'etape 2 pour la zone reference.",
      });
    } catch (e) {
      setMessage({
        type: "error",
        text: e?.response?.data?.message || "Erreur enregistrement zone QR.",
      });
    } finally {
      setSavingType("");
    }
  };

  const onSaveRef = async () => {
    const payload = toRefPayload(refZone);
    if (!payload) {
      setMessage({
        type: "error",
        text: "Selectionnez la zone reference avant envoi.",
      });
      return;
    }

    try {
      setSavingType("ref");
      await axios.put(`${API_URL}/api/auth/posref`, payload, {
        withCredentials: true,
      });
      setMessage({
        type: "success",
        text: "Etape 2 validee. Les deux positions sont enregistrees.",
      });
      // Save positions in the transaction when both are set
      await axios.put(`${API_URL}/api/transactions/${transactionId}/update-position`, {
        qrPosition: qrZone,
        refPosition: refZone,
      });
      onClose(); // Close the modal after saving positions
    } catch (e) {
      setMessage({
        type: "error",
        text:
          e?.response?.data?.message ||
          "Erreur enregistrement zone reference.",
      });
    } finally {
      setSavingType("");
    }
  };

  const draftRect =
    draft?.start && draft?.end ? rectFromPoints(draft.start, draft.end) : null;
  const viewerUrl = pdfUrl
    ? `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH`
    : "";

  return (
    <div className="possig-scope">
      <div className="possig-page">
        <header className="possig-head">
          <h2>Position signature TTN</h2>
          <p>
            Etape 1: choisir et envoyer la zone QR. Etape 2: choisir et envoyer
            la zone reference.
          </p>
        </header>

        <section className="possig-card">
          <div className="possig-tools">
            <label className="possig-file-btn">
              Choisir un PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={onChoosePdf}
              />
            </label>
            <span className="possig-file-name">{pdfName || "Aucun fichier selectionne"}</span>
            <span className={`possig-pill ${qrZone ? "ok" : ""}`}>
              QR: {qrZone ? "Pret" : "Non defini"}
            </span>
            <span className={`possig-pill ${refZone ? "ok" : ""}`}>
              Reference: {refZone ? "Pret" : "Non definie"}
            </span>
          </div>

          <div className="possig-stepper">
            <button
              type="button"
              className={`possig-step-btn ${step === "qr" ? "active" : ""}`}
              onClick={() => setStep("qr")}
            >
              <span>1</span>
              Zone QR
            </button>
            <button
              type="button"
              className={`possig-step-btn ${step === "ref" ? "active" : ""}`}
              onClick={() => setStep("ref")}
            >
              <span>2</span>
              Zone reference
            </button>
          </div>

          <div className="possig-instruction">
            {step === "qr"
              ? "Tracez la zone du QR sur la feuille, puis cliquez sur Envoyer QR."
              : "Tracez la zone du paragraphe de reference, puis cliquez sur Envoyer reference."}
          </div>

          <div className="possig-sheet-wrap">
            <div className="possig-sheet" ref={sheetRef}>
              {viewerUrl ? (
                <iframe
                  title="Apercu PDF"
                  src={viewerUrl}
                  className="possig-pdf-frame"
                />
              ) : (
                <div className="possig-empty">
                  <strong>Apercu PDF</strong>
                  <span>Importez un fichier PDF pour commencer.</span>
                </div>
              )}

              <div
                className="possig-capture"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={() => setDraft(null)}
              >
                {draftRect && (
                  <div
                    className={`possig-zone possig-zone-draft ${draft?.type === "ref" ? "ref" : "qr"}`}
                    style={{
                      left: `${draftRect.x}px`,
                      top: `${draftRect.y}px`,
                      width: `${draftRect.width}px`,
                      height: `${draftRect.height}px`,
                    }}
                  />
                )}

                {qrZone && (
                  <div
                    className="possig-zone qr"
                    style={{
                      left: `${qrZone.x}px`,
                      top: `${qrZone.y}px`,
                      width: `${qrZone.width}px`,
                      height: `${qrZone.height}px`,

                    }}
                  >
                    <span className="possig-zone-label">Zone QR</span>
                  </div>
                )}

                {refZone && (
                  <div
                    className="possig-zone ref"
                    style={{
                      left: `${refZone.x}px`,
                      top: `${refZone.y}px`,
                      width: `${refZone.width}px`,
                      height: `${refZone.height}px`,
                    }}
                  >
                    <span className="possig-zone-label">Zone reference</span>
                    <div className="possig-reference">
                      <p>{REFERENCE_TEXT}</p>
                      <strong>{REFERENCE_SAMPLE}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="possig-bottom">
            <div className="possig-meta">
              {loading ? (
                <span>Chargement...</span>
              ) : (
                <>
                  <span>qrPositionX: {qrZone?.x ?? "-"}</span>
                  <span>qrPositionY: {qrZone?.y ?? "-"}</span>
                  <span>qrPositionP: {qrZone?.page ?? "-"}</span>
                  <span>labelPositionX: {refZone?.x ?? "-"}</span>
                  <span>labelPositionY: {refZone?.y ?? "-"}</span>
                  <span>labelPositionP: {refZone?.page ?? "-"}</span>
                </>
              )}
            </div>

            <div className="possig-actions">
              <button
                type="button"
                className="possig-btn ghost"
                onClick={onResetStep}
                disabled={savingType !== ""}
              >
                Reinitialiser etape
              </button>

              {step === "qr" ? (
                <button
                  type="button"
                  className="possig-btn primary"
                  onClick={onSaveQr}
                  disabled={savingType !== "" || !qrZone}
                >
                  {savingType === "qr" ? "Envoi QR..." : "Envoyer QR"}
                </button>
              ) : (
                <button
                  type="button"
                  className="possig-btn primary"
                  onClick={onSaveRef}
                  disabled={savingType !== "" || !refZone}
                >
                  {savingType === "ref" ? "Envoi reference..." : "Envoyer reference"}
                </button>
              )}
            </div>
          </div>

          {message.text && (
            <p className={`possig-alert ${message.type || "info"}`}>
              {message.text}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default PosSignature;
