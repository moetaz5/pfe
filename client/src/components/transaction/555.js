


Vous avez dit :
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

const app = express();
/* ===================== EMAIL SIGNATURE ===================== */
const sendSignatureEmail = async (email, transactionId) => {
  const link = http://localhost:3000/signature/${transactionId};

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Signature de facture requise",
    html: 
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
    ,
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
    html: 
      <h2>Confirmation Email</h2>
      <p>Voici votre code :</p>
      <h1 style="letter-spacing:3px;">${code}</h1>
      <p>Ce code expire dans 10 minutes.</p>
    ,
  });
};

/* ===================== JWT VERIFY ===================== */
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Non autorisé" });

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: "Token invalide" });

    const [rows] = await db.promise().query(
      "SELECT statut FROM users WHERE id = ?",
      [decoded.id]
    );

    if (!rows.length || rows[0].statut === 0) {
      return res.status(403).json({
        message: "Compte désactivé"
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
        return res.redirect(
          "http://localhost:3000/login?error=auth_failed"
        );
      }

      // 🔎 Vérifier le statut réel en base
      const [rows] = await db.promise().query(
        "SELECT id, role, statut FROM users WHERE id = ?",
        [req.user.id]
      );

      if (!rows.length) {
        return res.redirect(
          "http://localhost:3000/login?error=user_not_found"
        );
      }

      const user = rows[0];

      // ❌ Compte désactivé
      if (user.statut === 0) {
        return res.redirect(
          "http://localhost:3000/login?error=disabled"
        );
      }

      // 🔐 Génération JWT
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
      });

      return res.redirect("http://localhost:3000/dashboard");

    } catch (error) {
      console.error("GOOGLE CALLBACK ERROR:", error);
      return res.redirect(
        "http://localhost:3000/login?error=server"
      );
    }
  }
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

    const sql = 
      INSERT INTO users 
      (name, email, password, phone, address, is_verified, email_verification_code, email_verification_expires)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    ;

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

  const sql = 
    SELECT id, is_verified, email_verification_code, email_verification_expires
    FROM users
    WHERE email = ?
  ;

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

    const updateSql = 
      UPDATE users 
      SET is_verified = 1,
          email_verification_code = NULL,
          email_verification_expires = NULL
      WHERE email = ?
    ;

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
          html: 
            <h2>Réinitialisation du mot de passe</h2>
            <p>Votre code est :</p>
            <h1 style="letter-spacing:3px;">${code}</h1>
            <p>Ce code expire dans 10 minutes.</p>
          ,
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
          html: 
            <h2>Réinitialisation du mot de passe</h2>
            <p>Voici votre nouveau code :</p>
            <h1 style="letter-spacing:3px;">${code}</h1>
            <p>Ce code expire dans 10 minutes.</p>
          ,
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
  const sql = 
    SELECT id, date_facture
    FROM factures
    WHERE user_id = ?
      AND (statut = 'en attente' OR statut IS NULL)
    ORDER BY date_facture DESC
  ;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) {
      console.error("FACTURES AVAILABLE ERROR:", err);
      return res.json([]); // ⚠️ TOUJOURS un tableau
    }
    res.json(results || []);
  });
});

/* ===================== FACTURES (UPLOAD PDF) ===================== */
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post(
  "/api/factures",
  verifyToken,
  upload.single("fichier_pdf"),
  (req, res) => {
    const { statut } = req.body;
    const userId = req.user.id;

    // ❌ plus de montant
    if (!req.file) {
      return res.status(400).json({ message: "Fichier PDF manquant" });
    }

    const fichierPdf = req.file.buffer;

    const sql = 
      INSERT INTO factures (user_id, statut, fichier_pdf)
      VALUES (?, ?, ?)
    ;

    db.query(
      sql,
      [userId, statut || "en attente", fichierPdf],
      (err, result) => {
        if (err) {
          console.error("FACTURE INSERT ERROR:", err);
          return res.status(500).json({ message: "Erreur serveur" });
        }

        res.status(201).json({
          message: "Facture ajoutée avec succès",
          id: result.insertId,
        });
      },
    );
  },
);

app.get("/api/factures", verifyToken, (req, res) => {
  const sql = 
    SELECT id, date_facture, statut
    FROM factures
    WHERE user_id = ?
    ORDER BY date_facture DESC
  ;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) {
      console.error("FACTURE LIST ERROR:", err);
      return res.json([]);
    }
    res.json(results || []);
  });
});

app.get("/api/factures/:id", verifyToken, (req, res) => {
  const { id } = req.params;

  const sql = "SELECT fichier_pdf FROM factures WHERE id = ? AND user_id = ?";

  db.query(sql, [id, req.user.id], (err, results) => {
    if (err || results.length === 0)
      return res.status(404).json({ message: "Facture non trouvée" });

    const facture = results[0];

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      attachment; filename=facture_${id}.pdf,
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
    { name: "pdf_file", maxCount: 1 },
    { name: "xml_file", maxCount: 1 },
  ]),
  async (req, res) => {
    const { facture_number, signataire_email, client_email, facture_id } =
      req.body;

    if (!facture_number || !signataire_email || !client_email) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    if (!req.files?.xml_file) {
      return res.status(400).json({ message: "Fichier XML manquant" });
    }

    let pdfBuffer;
    let finalFactureId = facture_id;

    try {
      // 🔹 FACTURE EXISTANTE
      if (facture_id) {
        const [rows] = await db
          .promise()
          .query(
            "SELECT fichier_pdf FROM factures WHERE id = ? AND user_id = ?",
            [facture_id, req.user.id],
          );

        if (rows.length === 0) {
          return res.status(404).json({ message: "Facture introuvable" });
        }

        pdfBuffer = rows[0].fichier_pdf;
      }
      // 🔹 NOUVELLE FACTURE
      else {
        if (!req.files?.pdf_file) {
          return res.status(400).json({ message: "PDF manquant" });
        }

        pdfBuffer = req.files.pdf_file[0].buffer;

        const [factureRes] = await db.promise().query(
          
          INSERT INTO factures (user_id, statut, fichier_pdf, source)
          VALUES (?, 'en_transaction', ?, 'transaction')
          ,
          [req.user.id, pdfBuffer],
        );

        finalFactureId = factureRes.insertId;
      }

      // 🔹 CRÉER TRANSACTION
      const [tx] = await db.promise().query(
        
        INSERT INTO transactions
        (facture_number, pdf_file, xml_file, signataire_email, client_email, user_id, statut, facture_id)
        VALUES (?, ?, ?, ?, ?, ?, 'créé', ?)
        ,
        [
          facture_number,
          pdfBuffer,
          req.files.xml_file[0].buffer,
          signataire_email,
          client_email,
          req.user.id,
          finalFactureId,
        ],
      );

      // 🔹 LIER FACTURE
      await db.promise().query(
        
        UPDATE factures
        SET statut='en_transaction', transaction_id=?
        WHERE id=?
        ,
        [tx.insertId, finalFactureId],
      );

      // 🔹 EMAIL
      await sendSignatureEmail(signataire_email, tx.insertId);

      res.status(201).json({
        message: "Transaction créée avec succès",
        transactionId: tx.insertId,
      });
    } catch (e) {
      console.error("CREATE TRANSACTION ERROR:", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

app.get("/api/transactions", verifyToken, (req, res) => {
  const { search } = req.query;

  let sql = 
    SELECT 
      t.id,
      t.facture_number,
      t.statut,
      t.date_creation,
      u.name AS user_name
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.user_id = ?
  ;

  let queryParams = [req.user.id];

  if (search) {
    sql += " AND (t.facture_number LIKE ? OR t.statut LIKE ?)";
    queryParams.push(%${search}%, %${search}%);
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

  const sql = 
    SELECT 
      t.id,
      t.facture_number,
      t.statut,
      t.date_creation,
      u.name AS user_name
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ? AND t.user_id = ?
  ;

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

  const sql = 
    SELECT pdf_file, xml_file, xml_signed, statut
    FROM transactions
    WHERE id = ? AND user_id = ?
  ;

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
      filename = facture_${id}.xml;
    } else {
      fileBuffer = tx.pdf_file;
      contentType = "application/pdf";
      filename = facture_${id}.pdf;
    }

    if (!fileBuffer) {
      return res.status(404).json({ message: "Fichier non trouvé" });
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", attachment; filename=${filename});

    res.send(fileBuffer);
  });
});

//*telecharger le fichier zip selon le statut
app.get("/api/transactions/:id/zip", verifyToken, (req, res) => {
  const { id } = req.params;

  const sql = 
    SELECT pdf_file, xml_file, xml_signed, statut
    FROM transactions
    WHERE id = ? AND user_id = ?
  ;

  db.query(sql, [id, req.user.id], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }

    const tx = results[0];

    try {
      const zip = new JSZip();

      // PDF toujours le même
      zip.file("facture.pdf", tx.pdf_file);

      // ✅ XML : signé ou original
      const xmlToUse =
        tx.statut === "signée" && tx.xml_signed ? tx.xml_signed : tx.xml_file;

      zip.file("facture.xml", xmlToUse);

      const content = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        attachment; filename=transaction_${id}.zip,
      );

      res.send(content);
    } catch (e) {
      console.error("ZIP ERROR:", e);
      res.status(500).json({ message: "Erreur ZIP" });
    }
  });
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
        
          SELECT statut, COUNT(*) AS total
          FROM transactions
          WHERE user_id = ?
          GROUP BY statut
        ,
        [userId],
      ),
      db
        .promise()
        .query("SELECT COUNT(*) AS total FROM factures WHERE user_id = ?", [
          userId,
        ]),
      db.promise().query(
        
          SELECT statut, COUNT(*) AS total
          FROM factures
          WHERE user_id = ?
          GROUP BY statut
        ,
        [userId],
      ),
      db.promise().query(
        
          SELECT MONTH(date_creation) AS mois, COUNT(*) AS total
          FROM transactions
          WHERE user_id = ?
          GROUP BY MONTH(date_creation)
          ORDER BY mois
        ,
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
      db.promise().query(
        SELECT
          SUM(CASE WHEN password IS NULL OR password = '' THEN 1 ELSE 0 END) AS google,
          SUM(CASE WHEN password IS NOT NULL AND password <> '' THEN 1 ELSE 0 END) AS simple
        FROM users
      ),
      db.promise().query(
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
      ),
      db.promise().query(
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
      ),
      db.promise().query(
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
      ),
      db.promise().query(
        SELECT MONTH(date_creation) AS mois, COUNT(*) AS total
        FROM transactions
        GROUP BY MONTH(date_creation)
        ORDER BY mois
      ),
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
    // 🔹 Récupérer transaction
    const [rows] = await db.promise().query(
      
      SELECT xml_file, statut, facture_id
      FROM transactions
      WHERE id = ?
      ,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const transaction = rows[0];

    // 🔒 Déjà signée
    if (transaction.statut === "signée") {
      return res.status(400).json({ error: "ALREADY_SIGNED" });
    }

    // 🔹 Signature via moteur Java
    const xmlBase64 = transaction.xml_file.toString("base64");

    const javaRes = await axios.post(
      "http://127.0.0.1:9000/sign/xml",
      { pin, xmlBase64 },
      { headers: { "Content-Type": "application/json" } },
    );

    const signedXml = Buffer.from(javaRes.data.signedXmlBase64, "base64");

    // 🔹 Mise à jour TRANSACTION
    await db.promise().query(
      
      UPDATE transactions
      SET statut = 'signée',
          xml_signed = ?,
          signed_at = NOW()
      WHERE id = ?
      ,
      [signedXml, id],
    );

    // 🔹 Mise à jour FACTURE si existante
    if (transaction.facture_id) {
      await db.promise().query(
        
        UPDATE factures
        SET statut = 'signéé'
        WHERE id = ?
        ,
        [transaction.facture_id],
      );
    }

    res.json({ success: true });
  } catch (e) {
    console.error("JAVA SIGN ERROR:", e.response?.data || e);
    res.status(500).json({ error: "SIGN_FAILED" });
  }
});

app.get("/api/transactions/:id/xml", verifyToken, async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.promise().query(
    
      SELECT statut, xml_file, xml_signed
      FROM transactions
      WHERE id = ? AND user_id = ?
      ,
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
  res.setHeader("Content-Disposition", inline; filename=facture_${id}.xml);

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

  const sql = 
    SELECT id, name, email, role, phone, address, is_verified, statut
    FROM users
    WHERE (? = '' OR name LIKE ?)
      AND (? = '' OR email LIKE ?)
      AND (? = '' OR phone LIKE ?)
    ORDER BY id DESC
  ;

  const params = [name, %${name}%, email, %${email}%, phone, %${phone}%];

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

/* ===================== SERVER ===================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(🚀 Server running on port ${PORT});
});import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaHome } from "react-icons/fa";
import "../style/SignatureSignataire.css";

const SignatureSignataire = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pin, setPin] = useState("");
  const [pinValid, setPinValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);

  const pdfUrl = http://localhost:5000/api/public/transactions/${id}/pdf;

  /* 🔐 Vérification du PIN */
  const checkPin = async () => {
    setError("");
    setPinValid(false);

    try {
      const res = await fetch(
        http://localhost:5000/api/public/transactions/${id}/check-pin,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );
      if (!res.ok) throw new Error();
      setPinValid(true);
    } catch {
      setError("❌ Code PIN incorrect");
    }
  };

  /* ✍️ Signature */
  const handleSign = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        http://localhost:5000/api/public/transactions/${id}/sign,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur de signature");
      }

      setSigned(true);
    } catch (e) {
      setError("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* =================== SUCCÈS =================== */
  if (signed) {
    return (
      <div className="signature-success-page">
        <div className="success-icon">✓</div>

        <h2>Facture signée avec succès</h2>
        <p>
          Votre facture a été signée électroniquement et sécurisée.
          <br />
          Vous pouvez retourner au tableau de bord.
        </p>

        {/* 🔵 Home Icon Button */}
        <button
          className="home-btn"
          onClick={() => navigate("/dashboard")}
          title="Retour au tableau de bord"
        >
          <FaHome />
        </button>
      </div>
    );
  }

  /* =================== PAGE SIGNATURE =================== */
  return (
    <div className="signature-page">
      <div className="signature-layout">

        {/* GAUCHE : PDF (sans cadre) */}
        <div className="signature-left">
          <iframe
            src={pdfUrl}
            title="Facture PDF"
            className="signature-pdf-iframe"
          />
        </div>

        {/* DROITE : ACTIONS */}
        <div className="signature-right">
          <div className="signature-card">
            <header className="signature-header">
              <h2>Signature électronique</h2>
              <p>Veuillez vérifier la facture avant de signer</p>
            </header>

            <div className="signature-form">
              <input
                type="password"
                placeholder="Entrer votre code PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />

              <button
                className="btn ghost"
                onClick={checkPin}
                disabled={!pin}
              >
                Vérifier le PIN
              </button>

              <button
                className="btn primary"
                onClick={handleSign}
                disabled={!pinValid || loading}
              >
                {loading ? "Signature en cours..." : "Signer la facture"}
              </button>

              {error && <p className="error">{error}</p>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SignatureSignataire;import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../style/createTransaction.css";
import {
  Save,
  FileText,
  FileUp,
  ArrowLeft,
  Mail,
  Hash,
  Search,
  X,
} from "lucide-react";

const CreateTransaction = () => {
  const navigate = useNavigate();

  const [useExistingPdf, setUseExistingPdf] = useState(true);

  const [factures, setFactures] = useState([]);
  const [filteredFactures, setFilteredFactures] = useState([]);
  const [selectedFacture, setSelectedFacture] = useState(null);

  const [showFactureModal, setShowFactureModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [factureNumber, setFactureNumber] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [xmlFile, setXmlFile] = useState(null);

  const [signataireEmail, setSignataireEmail] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pdfInputRef = useRef(null);
  const xmlInputRef = useRef(null);

  /* ================= FETCH FACTURES ================= */
  useEffect(() => {
    if (!useExistingPdf) return;

    fetch("http://localhost:5000/api/factures/available", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFactures(data);
          setFilteredFactures(data);
        } else {
          setFactures([]);
          setFilteredFactures([]);
        }
      })
      .catch(() => {
        setFactures([]);
        setFilteredFactures([]);
      });
  }, [useExistingPdf]);

  /* ================= SEARCH ================= */
  useEffect(() => {
    if (!Array.isArray(factures)) {
      setFilteredFactures([]);
      return;
    }

    setFilteredFactures(
      factures.filter((f) =>
        f.id.toString().includes(searchTerm.trim())
      )
    );
  }, [searchTerm, factures]);

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (
      !signataireEmail ||
      !clientEmail ||
      !factureNumber ||
      !xmlFile ||
      (useExistingPdf && !selectedFacture) ||
      (!useExistingPdf && !pdfFile)
    ) {
      alert("Veuillez remplir tous les champs obligatoires.");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("facture_number", factureNumber);
    formData.append("signataire_email", signataireEmail);
    formData.append("client_email", clientEmail);
    formData.append("xml_file", xmlFile);

    if (useExistingPdf) {
      formData.append("facture_id", selectedFacture.id);
    } else {
      formData.append("pdf_file", pdfFile);
    }

    try {
      const res = await fetch("http://localhost:5000/api/transactions", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);

        // ⏱️ REDIRECTION AUTO APRÈS 3s
        setTimeout(() => {
          navigate("/dashboard/MyTransactions", { replace: true });
        }, 3000);
      } else {
        alert(data.message || "Erreur lors de la création");
      }
    } catch {
      alert("Erreur serveur");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="full-width-container">
        <div className="page-head">
          <div>
            <h2>Créer une transaction</h2>
            <p>Configurer une facture pour signature électronique</p>
          </div>
          <Link to="/dashboard/MyTransactions" className="btn btn-outline">
            <ArrowLeft size={18} /> Retour
          </Link>
        </div>

        <div className="create-card">
          <div className="create-card-title">
            <Save size={18} color="#0247AA" />
            Nouvelle transaction
          </div>

          {/* ✅ MESSAGE SUCCÈS */}
          {success && (
            <div className="success-box">
              ✅ Transaction créée avec succès.<br />
              Redirection automatique en cours...
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              {/* EMAILS */}
              <div className="form-grid">
                <div className="field">
                  <label><Mail size={16}/> Email signataire *</label>
                  <input
                    className="input"
                    type="email"
                    value={signataireEmail}
                    onChange={(e)=>setSignataireEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label><Mail size={16}/> Email client *</label>
                  <input
                    className="input"
                    type="email"
                    value={clientEmail}
                    onChange={(e)=>setClientEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* NUM FACTURE */}
              <div className="field full">
                <label><Hash size={16}/> Numéro de facture *</label>
                <input
                  className="input"
                  value={factureNumber}
                  onChange={(e)=>setFactureNumber(e.target.value)}
                />
              </div>

              {/* SWITCH */}
              <div className="field full">
                <label>Source du PDF</label>
                <label>
                  <input
                    type="radio"
                    checked={useExistingPdf}
                    onChange={()=>setUseExistingPdf(true)}
                  /> PDF existant
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!useExistingPdf}
                    onChange={()=>setUseExistingPdf(false)}
                  /> Nouveau PDF
                </label>
              </div>

              {/* SELECT FACTURE */}
              {useExistingPdf && (
                <div className="upload-box" onClick={()=>setShowFactureModal(true)}>
                  <Search size={18}/> {selectedFacture ? Facture #${selectedFacture.id} : "Sélectionner une facture"}
                </div>
              )}

              {/* PDF UPLOAD */}
              {!useExistingPdf && (
                <div className="upload-box" onClick={()=>pdfInputRef.current.click()}>
                  <FileUp size={18}/> {pdfFile ? pdfFile.name : "Importer PDF"}
                  <input
                    ref={pdfInputRef}
                    hidden
                    type="file"
                    accept="application/pdf"
                    onChange={(e)=>setPdfFile(e.target.files[0])}
                  />
                </div>
              )}

              {/* XML */}
              <div className="upload-box" onClick={()=>xmlInputRef.current.click()}>
                <FileText size={18}/> {xmlFile ? xmlFile.name : "Importer XML"}
                <input
                  ref={xmlInputRef}
                  hidden
                  type="file"
                  accept="application/xml"
                  onChange={(e)=>setXmlFile(e.target.files[0])}
                />
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" disabled={isSubmitting}>
                  <Save size={18}/> {isSubmitting ? "Création..." : "Créer"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showFactureModal && (
        <div className="modal">
          <div className="modal-content">
            <X onClick={()=>setShowFactureModal(false)} />
            <input
              className="input"
              placeholder="Rechercher par numéro"
              value={searchTerm}
              onChange={(e)=>setSearchTerm(e.target.value)}
            />
            {filteredFactures.map(f=>(
              <div
                key={f.id}
                className="upload-box"
                onClick={()=>{
                  setSelectedFacture(f);
                  setShowFactureModal(false);
                }}
              >
                📄 Facture #{f.id}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateTransaction; et voila mon tableau 
#	Nom	Type	Interclassement	Attributs	Null	Valeur par défaut	Commentaires	Extra	Action
	1	id Primaire	int			Non	Aucun(e)		AUTO_INCREMENT	Modifier Modifier	Supprimer Supprimer	
	2	facture_number	varchar(255)	utf8mb4_0900_ai_ci		Non	Aucun(e)			Modifier Modifier	Supprimer Supprimer	
	3	pdf_file	longblob			Non	Aucun(e)			Modifier Modifier	Supprimer Supprimer	
	4	xml_file	longblob			Non	Aucun(e)			Modifier Modifier	Supprimer Supprimer	
	5	signataire_email	varchar(255)	utf8mb4_0900_ai_ci		Non	Aucun(e)			Modifier Modifier	Supprimer Supprimer	
	6	client_email	varchar(255)	utf8mb4_0900_ai_ci		Non	Aucun(e)			Modifier Modifier	Supprimer Supprimer	
	7	user_id Index	int			Non	Aucun(e)			Modifier Modifier	Supprimer Supprimer	
	8	date_created	timestamp			Oui	CURRENT_TIMESTAMP		DEFAULT_GENERATED	Modifier Modifier	Supprimer Supprimer	
	9	statut	varchar(50)	utf8mb4_0900_ai_ci		Oui	NULL			Modifier Modifier	Supprimer Supprimer	
	10	date_creation	timestamp			Oui	CURRENT_TIMESTAMP		DEFAULT_GENERATED	Modifier Modifier	Supprimer Supprimer	
	11	signature	longtext	utf8mb4_0900_ai_ci		Oui	NULL			Modifier Modifier	Supprimer Supprimer	
	12	signed_at	datetime			Oui	NULL			Modifier Modifier	Supprimer Supprimer	
	13	facture_id	int			Oui	NULL			Modifier Modifier	Supprimer Supprimer	
	14	xml_signed	longblob			Oui	NULL			Modifier Modifier	Supprimer Supprimer	

 VOILA  mon server et les deux pages de creation une transaction et de faire une signature alors ; je veut faire une modification de lorsque je fait une transaction je peu importer un nombre de facture et lorsque je faire la signature il faire la signature sur toute les facture dans une seul signature alors que tu peut faire un boucle a l api pour signer toute les facture de transaction d uneseul clic ....aussi ; a l ajoute des facture au transiction il faut que chaque facture pdf a sa facture xml comptatible a elle ,alors je pense que il faut verifier les nom (exemple :facture1.pdf,facture2.pdf,facture3.pdf:facture1.xml,facture3.xml,factyre2.xml::::resulte = inesrt(facture1.pdf,facture1.xml),insert(facture2.pdf,facture2.xml),insert(facture3.pdf,facture3.xml)


ChatGPT a dit :
Parfait 👌 Moetaz, ton architecture est déjà solide.
On va faire une évolution propre et scalable pour :

✅ Permettre d’ajouter plusieurs factures dans une seule transaction

✅ Associer automatiquement chaque PDF avec son XML compatible (même nom)

✅ Signer toutes les factures d’une transaction avec un seul clic + un seul PIN

✅ Faire la signature en boucle côté API proprement

🎯 Nouvelle Architecture Recommandée (PROPRE)
Actuellement ta table transactions contient :

pdf_file

xml_file

xml_signed

👉 Ça ne permet qu’UNE seule facture par transaction.

✅ Solution Professionnelle : Nouvelle table
On garde transactions comme "transaction globale",
et on crée une table :

CREATE TABLE transaction_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    pdf_file LONGBLOB NOT NULL,
    xml_file LONGBLOB NOT NULL,
    xml_signed LONGBLOB NULL,
    filename VARCHAR(255) NOT NULL,
    statut VARCHAR(50) DEFAULT 'créé',
    signed_at DATETIME NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
🧠 Logique finale
🔹 1️⃣ Création transaction
User upload plusieurs PDF

User upload plusieurs XML

On vérifie que :

facture1.pdf correspond à facture1.xml

facture2.pdf correspond à facture2.xml

On insère :

1 ligne dans transactions

N lignes dans transaction_documents

🧪 Vérification correspondance PDF/XML
Exemple de logique backend :
const pdfFiles = req.files.pdf_files;
const xmlFiles = req.files.xml_files;

if (pdfFiles.length !== xmlFiles.length) {
  return res.status(400).json({ message: "Nombre PDF et XML différent" });
}

const xmlMap = {};

xmlFiles.forEach(xml => {
  const baseName = xml.originalname.replace(".xml", "");
  xmlMap[baseName] = xml;
});

for (let pdf of pdfFiles) {
  const baseName = pdf.originalname.replace(".pdf", "");

  if (!xmlMap[baseName]) {
    return res.status(400).json({
      message: `XML correspondant à ${pdf.originalname} introuvable`
    });
  }

  await db.promise().query(`
    INSERT INTO transaction_documents
    (transaction_id, pdf_file, xml_file, filename)
    VALUES (?, ?, ?, ?)
  `, [
    transactionId,
    pdf.buffer,
    xmlMap[baseName].buffer,
    baseName
  ]);
}
✍️ Signature en boucle (LE PLUS IMPORTANT)
🎯 Objectif :
Quand le signataire clique "Signer"

👉 Une seule requête
👉 Un seul PIN
👉 Toutes les factures signées

✅ Nouveau endpoint de signature
app.post("/api/public/transactions/:id/sign", async (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: "PIN_REQUIRED" });
  }

  try {
    const [docs] = await db.promise().query(
      `SELECT id, xml_file FROM transaction_documents 
       WHERE transaction_id = ? AND statut != 'signée'`,
      [id]
    );

    if (!docs.length) {
      return res.status(400).json({ error: "ALREADY_SIGNED" });
    }

    for (let doc of docs) {
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

      await db.promise().query(`
        UPDATE transaction_documents
        SET xml_signed = ?, 
            statut = 'signée',
            signed_at = NOW()
        WHERE id = ?
      `, [signedXml, doc.id]);
    }

    await db.promise().query(`
      UPDATE transactions 
      SET statut = 'signée'
      WHERE id = ?
    `, [id]);

    res.json({ success: true });

  } catch (e) {
    console.error("SIGN ERROR:", e);
    res.status(500).json({ error: "SIGN_FAILED" });
  }
});
🔥 Résultat
Quand tu cliques :

"Signer la transaction"

👉 Le moteur Java va signer :

facture1.xml

facture2.xml

facture3.xml

facture4.xml

etc

Automatiquement.

⚡ Frontend : aucune modification majeure
Ton composant SignatureSignataire reste presque identique.

Il envoie :

await fetch(`/api/public/transactions/${id}/sign`, {
  method: "POST",
  body: JSON.stringify({ pin })
})
Et c’est tout.

📦 BONUS : ZIP après signature
Pour télécharger tout :

const [docs] = await db.promise().query(
  "SELECT pdf_file, xml_signed FROM transaction_documents WHERE transaction_id = ?",
  [id]
);

const zip = new JSZip();

docs.forEach((doc, index) => {
  zip.file(`facture_${index}.pdf`, doc.pdf_file);
  zip.file(`facture_${index}.xml`, doc.xml_signed);
});
🧠 Pourquoi cette solution est meilleure ?
Ancien système	Nouveau système
1 facture = 1 transaction	N factures = 1 transaction
1 XML signé	N XML signés
Pas scalable	Architecture entreprise
Complexe à gérer	Logique propre
🎯 Résumé
Tu dois :

1️⃣ Créer transaction_documents
2️⃣ Modifier création transaction
3️⃣ Ajouter boucle signature
4️⃣ Adapter ZIP

🚀 Si tu veux
Je peux te donner :

✅ Code complet prêt à copier-coller

✅ Nouvelle structure SQL complète

✅ Version optimisée professionnelle

✅ Version avec barre de progression signature

Dis-moi 👇
Tu veux que je te donne :

A) Version simple
B) Version professionnelle entreprise (comme DocuSign)


Vous avez dit :
donner toute les page les code a modifier complet

ChatGPT a dit :
D’accord. Je te donne tout le code complet à modifier (backend + pages React) pour que :

✅ 1 transaction = plusieurs factures (plusieurs PDF + plusieurs XML)
✅ chaque PDF est lié au XML qui a le même nom (facture1.pdf ↔ facture1.xml)
✅ 1 seul clic “Signer” + 1 seul PIN = signature de tous les XML de la transaction
✅ téléchargement ZIP = tous les fichiers (PDF + XML signé)

Je te donne :

✅ SQL (nouvelle table)

✅ Backend server.js (les routes modifiées complètes)

✅ React CreateTransaction.jsx (upload multiple + matching)

✅ React SignatureSignataire.jsx (signature en boucle côté serveur + afficher liste des docs)

✅ (optionnel) endpoints pour PDF list / download doc

⚠️ Important : on n’efface pas ta table transactions, mais on ne stocke plus pdf_file/xml_file/xml_signed dedans. On stocke tout dans une nouvelle table transaction_documents.

1) ✅ SQL : nouvelle table (OBLIGATOIRE)
Exécute ça dans ta base :

CREATE TABLE transaction_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  pdf_file LONGBLOB NOT NULL,
  xml_file LONGBLOB NOT NULL,
  xml_signed LONGBLOB NULL,
  statut VARCHAR(50) DEFAULT 'créé',
  signed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (transaction_id),
  CONSTRAINT fk_tx_docs_tx
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    ON DELETE CASCADE
);
2) ✅ BACKEND : server.js (MODIFS COMPLÈTES)
A) Multer : accepter plusieurs PDF/XML
Remplace ton upload transaction par :

const storage = multer.memoryStorage();
const upload = multer({ storage });
Et pour la création transaction on va utiliser :

pdf_files (multiple)

xml_files (multiple)

B) ✅ ROUTE : Créer Transaction MULTI-FICHIERS
👉 Remplace ton endpoint /api/transactions par celui-ci (complet) :

app.post(
  "/api/transactions",
  verifyToken,
  upload.fields([
    { name: "pdf_files", maxCount: 50 },
    { name: "xml_files", maxCount: 50 },
  ]),
  async (req, res) => {
    try {
      const { facture_number, signataire_email, client_email } = req.body;

      if (!facture_number || !signataire_email || !client_email) {
        return res.status(400).json({ message: "Champs manquants" });
      }

      const pdfFiles = req.files?.pdf_files || [];
      const xmlFiles = req.files?.xml_files || [];

      if (pdfFiles.length === 0) {
        return res.status(400).json({ message: "Aucun PDF importé" });
      }
      if (xmlFiles.length === 0) {
        return res.status(400).json({ message: "Aucun XML importé" });
      }

      // ✅ Map XML par nom de base (sans extension)
      const xmlMap = {};
      xmlFiles.forEach((xml) => {
        const base = path.parse(xml.originalname).name.trim();
        xmlMap[base] = xml;
      });

      // ✅ Vérifier que chaque PDF a un XML correspondant
      const pairs = [];
      for (const pdf of pdfFiles) {
        const base = path.parse(pdf.originalname).name.trim();
        const xml = xmlMap[base];

        if (!xml) {
          return res.status(400).json({
            message: `XML correspondant introuvable pour: ${pdf.originalname}`,
          });
        }

        pairs.push({
          filename: base,
          pdfBuffer: pdf.buffer,
          xmlBuffer: xml.buffer,
        });
      }

      // ✅ Créer la transaction (sans pdf/xml dedans)
      const [txRes] = await db.promise().query(
        `
          INSERT INTO transactions
          (facture_number, signataire_email, client_email, user_id, statut)
          VALUES (?, ?, ?, ?, 'créé')
        `,
        [facture_number, signataire_email, client_email, req.user.id]
      );

      const transactionId = txRes.insertId;

      // ✅ Insérer les documents dans transaction_documents
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

      // ✅ Envoyer email signature (un seul lien)
      await sendSignatureEmail(signataire_email, transactionId);

      res.status(201).json({
        message: "Transaction créée avec succès",
        transactionId,
        docsCount: pairs.length,
      });
    } catch (e) {
      console.error("CREATE MULTI TX ERROR:", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);
C) ✅ ROUTE : Lister les docs d’une transaction (PUBLIC pour page signature)
Ajoute ceci :

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
      [id]
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
D) ✅ ROUTE : Afficher PDF d’un doc (PUBLIC)
On va afficher le premier PDF par défaut si tu veux un preview.

Ajoute :

app.get("/api/public/docs/:docId/pdf", async (req, res) => {
  const { docId } = req.params;

  try {
    const [rows] = await db.promise().query(
      `SELECT pdf_file, filename FROM transaction_documents WHERE id = ?`,
      [docId]
    );

    if (!rows.length) return res.status(404).json({ message: "Doc non trouvé" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=${rows[0].filename}.pdf`);
    res.send(rows[0].pdf_file);
  } catch (e) {
    console.error("PUBLIC PDF ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
E) ✅ ROUTE : SIGNER TOUTE LA TRANSACTION (PUBLIC) — 1 clic
👉 Remplace ton endpoint /api/public/transactions/:id/sign par celui-ci :

app.post("/api/public/transactions/:id/sign", async (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ error: "PIN_REQUIRED" });
  }

  try {
    const [docs] = await db.promise().query(
      `
      SELECT id, xml_file, statut
      FROM transaction_documents
      WHERE transaction_id = ?
      `,
      [id]
    );

    if (!docs.length) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Déjà tout signé ?
    const remaining = docs.filter((d) => d.statut !== "signée");
    if (remaining.length === 0) {
      return res.status(400).json({ error: "ALREADY_SIGNED" });
    }

    // ✅ Boucle signature
    for (const doc of remaining) {
      const xmlBase64 = doc.xml_file.toString("base64");

      const javaRes = await axios.post(
        "http://127.0.0.1:9000/sign/xml",
        { pin, xmlBase64 },
        { headers: { "Content-Type": "application/json" } }
      );

      const signedXml = Buffer.from(javaRes.data.signedXmlBase64, "base64");

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

    // ✅ Marquer transaction signée
    await db.promise().query(
      `UPDATE transactions SET statut = 'signée', signed_at = NOW() WHERE id = ?`,
      [id]
    );

    res.json({ success: true, signedCount: remaining.length });
  } catch (e) {
    console.error("SIGN MULTI ERROR:", e.response?.data || e);
    res.status(500).json({ error: "SIGN_FAILED" });
  }
});
F) ✅ ROUTE : Vérifier PIN (PUBLIC) (inchangé, mais ok)
Tu peux garder ton /check-pin tel quel.

G) ✅ ROUTE : ZIP (tous les docs)
👉 Remplace ton endpoint ZIP par :

app.get("/api/transactions/:id/zip", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check ownership transaction
    const [txRows] = await db.promise().query(
      `SELECT id, user_id FROM transactions WHERE id = ?`,
      [id]
    );
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
      [id]
    );

    if (!docs.length) {
      return res.status(404).json({ message: "Aucun document" });
    }

    const zip = new JSZip();

    docs.forEach((d, idx) => {
      zip.file(`${d.filename}.pdf`, d.pdf_file);
      const xmlToUse = d.statut === "signée" && d.xml_signed ? d.xml_signed : d.xml_file;
      zip.file(`${d.filename}.xml`, xmlToUse);
    });

    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=transaction_${id}.zip`);
    res.send(content);
  } catch (e) {
    console.error("ZIP MULTI ERROR:", e);
    res.status(500).json({ message: "Erreur ZIP" });
  }
});
3) ✅ React : CreateTransaction.jsx (UPLOAD MULTIPLE + matching)
👉 Voici version complète de ta page (tu peux remplacer ton fichier).

On simplifie : plus de “facture existante” ici.
Tu importes plusieurs PDF + plusieurs XML et le backend fait le matching.

import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../style/createTransaction.css";
import { Save, FileText, FileUp, ArrowLeft, Mail, Hash } from "lucide-react";

const CreateTransaction = () => {
  const navigate = useNavigate();

  const [factureNumber, setFactureNumber] = useState("");

  const [pdfFiles, setPdfFiles] = useState([]);
  const [xmlFiles, setXmlFiles] = useState([]);

  const [signataireEmail, setSignataireEmail] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pdfInputRef = useRef(null);
  const xmlInputRef = useRef(null);

  const onPickPdf = (e) => {
    const files = Array.from(e.target.files || []);
    setPdfFiles(files);
  };

  const onPickXml = (e) => {
    const files = Array.from(e.target.files || []);
    setXmlFiles(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!signataireEmail || !clientEmail || !factureNumber) {
      alert("Veuillez remplir les champs obligatoires.");
      return;
    }
    if (pdfFiles.length === 0) {
      alert("Importez au moins un PDF.");
      return;
    }
    if (xmlFiles.length === 0) {
      alert("Importez au moins un XML.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("facture_number", factureNumber);
    formData.append("signataire_email", signataireEmail);
    formData.append("client_email", clientEmail);

    pdfFiles.forEach((f) => formData.append("pdf_files", f));
    xmlFiles.forEach((f) => formData.append("xml_files", f));

    try {
      const res = await fetch("http://localhost:5000/api/transactions", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/dashboard/MyTransactions", { replace: true });
        }, 2500);
      } else {
        alert(data.message || "Erreur lors de la création");
      }
    } catch {
      alert("Erreur serveur");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="full-width-container">
        <div className="page-head">
          <div>
            <h2>Créer une transaction</h2>
            <p>Importer plusieurs factures (PDF + XML) et signer en une seule fois</p>
          </div>

          <Link to="/dashboard/MyTransactions" className="btn btn-outline">
            <ArrowLeft size={18} /> Retour
          </Link>
        </div>

        <div className="create-card">
          <div className="create-card-title">
            <Save size={18} color="#0247AA" />
            Nouvelle transaction (multi-factures)
          </div>

          {success && (
            <div className="success-box">
              ✅ Transaction créée avec succès.<br />
              Redirection automatique...
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label>
                    <Mail size={16} /> Email signataire *
                  </label>
                  <input
                    className="input"
                    type="email"
                    value={signataireEmail}
                    onChange={(e) => setSignataireEmail(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>
                    <Mail size={16} /> Email client *
                  </label>
                  <input
                    className="input"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="field full">
                <label>
                  <Hash size={16} /> Numéro de transaction/facture *
                </label>
                <input
                  className="input"
                  value={factureNumber}
                  onChange={(e) => setFactureNumber(e.target.value)}
                />
              </div>

              {/* PDF MULTI */}
              <div
                className="upload-box"
                onClick={() => pdfInputRef.current.click()}
              >
                <FileUp size={18} />
                {pdfFiles.length
                  ? `${pdfFiles.length} PDF sélectionnés`
                  : "Importer plusieurs PDF"}
                <input
                  ref={pdfInputRef}
                  hidden
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={onPickPdf}
                />
              </div>

              {pdfFiles.length > 0 && (
                <div className="mini-list">
                  {pdfFiles.map((f) => (
                    <div key={f.name} className="mini-item">
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}

              {/* XML MULTI */}
              <div
                className="upload-box"
                onClick={() => xmlInputRef.current.click()}
              >
                <FileText size={18} />
                {xmlFiles.length
                  ? `${xmlFiles.length} XML sélectionnés`
                  : "Importer plusieurs XML"}
                <input
                  ref={xmlInputRef}
                  hidden
                  type="file"
                  accept="application/xml"
                  multiple
                  onChange={onPickXml}
                />
              </div>

              {xmlFiles.length > 0 && (
                <div className="mini-list">
                  {xmlFiles.map((f) => (
                    <div key={f.name} className="mini-item">
                      🧾 {f.name}
                    </div>
                  ))}
                </div>
              )}

              <div className="form-actions">
                <button className="btn btn-primary" disabled={isSubmitting}>
                  <Save size={18} />
                  {isSubmitting ? "Création..." : "Créer"}
                </button>
              </div>

              <p style={{ marginTop: 10, color: "#64748b", fontSize: 13 }}>
                ⚠️ Les noms doivent correspondre : <b>facture1.pdf</b> ↔ <b>facture1.xml</b>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTransaction;
4) ✅ React : SignatureSignataire.jsx (SIGNER TOUT)
👉 Version complète (remplace ton fichier).
✅ Il charge la liste des docs
✅ Il preview le premier PDF
✅ Clique “Signer” => signe toute la transaction (boucle server)

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaHome } from "react-icons/fa";
import "../style/SignatureSignataire.css";

const SignatureSignataire = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pin, setPin] = useState("");
  const [pinValid, setPinValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);

  const [docs, setDocs] = useState([]);

  // Load docs list
  useEffect(() => {
    const load = async () => {
      setLoadingDocs(true);
      try {
        const res = await fetch(
          `http://localhost:5000/api/public/transactions/${id}/docs`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erreur chargement docs");
        setDocs(Array.isArray(data) ? data : []);
      } catch (e) {
        setError("❌ " + e.message);
      } finally {
        setLoadingDocs(false);
      }
    };
    load();
  }, [id]);

  const firstDocId = docs?.[0]?.id;
  const pdfUrl = firstDocId
    ? `http://localhost:5000/api/public/docs/${firstDocId}/pdf`
    : "";

  /* 🔐 Vérification du PIN */
  const checkPin = async () => {
    setError("");
    setPinValid(false);

    try {
      const res = await fetch(
        `http://localhost:5000/api/public/transactions/${id}/check-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );
      if (!res.ok) throw new Error();
      setPinValid(true);
    } catch {
      setError("❌ Code PIN incorrect");
    }
  };

  /* ✍️ Signature (toute la transaction) */
  const handleSign = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `http://localhost:5000/api/public/transactions/${id}/sign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Erreur de signature");
      }

      setSigned(true);
    } catch (e) {
      setError("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* =================== SUCCÈS =================== */
  if (signed) {
    return (
      <div className="signature-success-page">
        <div className="success-icon">✓</div>

        <h2>Transaction signée avec succès</h2>
        <p>
          Toutes les factures de cette transaction ont été signées.
          <br />
          Vous pouvez retourner au tableau de bord.
        </p>

        <button
          className="home-btn"
          onClick={() => navigate("/dashboard")}
          title="Retour au tableau de bord"
        >
          <FaHome />
        </button>
      </div>
    );
  }

  /* =================== PAGE SIGNATURE =================== */
  return (
    <div className="signature-page">
      <div className="signature-layout">
        {/* GAUCHE : PDF preview (premier doc) */}
        <div className="signature-left">
          {loadingDocs ? (
            <div style={{ padding: 20 }}>Chargement PDF...</div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Facture PDF"
              className="signature-pdf-iframe"
            />
          ) : (
            <div style={{ padding: 20 }}>Aucun document</div>
          )}
        </div>

        {/* DROITE : ACTIONS */}
        <div className="signature-right">
          <div className="signature-card">
            <header className="signature-header">
              <h2>Signature électronique</h2>
              <p>Un seul PIN signera toutes les factures de la transaction</p>
            </header>

            {/* Liste docs */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "10px 0", fontWeight: 700 }}>
                Factures dans cette transaction :
              </p>
              {loadingDocs ? (
                <p>Chargement...</p>
              ) : docs.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        padding: "8px 10px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        background: "#fff",
                        fontSize: 13,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>📄 {d.filename}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: d.statut === "signée" ? "#16a34a" : "#64748b",
                        }}
                      >
                        {d.statut}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Aucun document.</p>
              )}
            </div>

            <div className="signature-form">
              <input
                type="password"
                placeholder="Entrer votre code PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />

              <button className="btn ghost" onClick={checkPin} disabled={!pin}>
                Vérifier le PIN
              </button>

              <button
                className="btn primary"
                onClick={handleSign}
                disabled={!pinValid || loading || docs.length === 0}
              >
                {loading ? "Signature en cours..." : "Signer toute la transaction"}
              </button>

              {error && <p className="error">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureSignataire;
5) ✅ Ce que tu dois modifier côté formData (important)
Avant tu envoyais pdf_file + xml_file (single).
Maintenant tu envoies :

pdf_files (multiple)

xml_files (multiple)

Le backend fait le matching par nom.

Notes très importantes (pour éviter bugs)
✅ Les noms doivent correspondre EXACTEMENT (sans espace / majuscules)

Exemple correct :

facture1.pdf ↔ facture1.xml

facture_2026-01.pdf ↔ facture_2026-01.xml

Si un PDF n’a pas de XML avec le même nom → erreur claire renvoyée.

Si tu veux aussi (recommandé)
Je peux te donner aussi le code complet modifié de :

✅ /api/transactions GET pour afficher docsCount dans MyTransactions
✅ /api/transactions/:id/details avec la liste docs
✅ téléchargement d’un XML signé par doc

Mais avec ce que je t’ai donné ici, tu peux déjà tout faire.

Si tu me colles ton fichier MyTransactions (la page liste transactions), je te le modifie aussi pour afficher :

Nombre de factures dans la transaction

Bouton ZIP

Statut global (créé/signée)


Vous avez dit :
l email d envoi le lien de signature n envoie pas et dans l encien code il marche correctement

ChatGPT a dit :
Parfait 👍 on va régler ça proprement.

Si avant ça marchait et que maintenant l’email ne part plus, ça veut dire que le problème est presque sûrement ici :

await sendSignatureEmail(signataire_email, transactionId);
Donc soit :

❌ sendSignatureEmail n’est plus appelé

❌ transactionId est undefined

❌ le transporter Gmail bloque

❌ une erreur est silencieuse (non affichée)

❌ la route ne va pas jusqu’au bout (erreur avant l’email)

🔍 ÉTAPE 1 — Vérifier si la fonction est appelée
Dans ton endpoint /api/transactions, ajoute un log AVANT l’email :

console.log("EMAIL DEBUG →", signataire_email, transactionId);
Et aussi modifie sendSignatureEmail temporairement comme ça :

const sendSignatureEmail = async (email, transactionId) => {
  console.log("📧 Tentative envoi email à:", email);

  const link = `http://localhost:3000/signature/${transactionId}`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Signature de facture requise",
      html: `
        <h2>Signature requise</h2>
        <a href="${link}"
           style="display:inline-block;padding:12px 20px;background:#0247AA;color:#fff;text-decoration:none;border-radius:6px;">
          Signer le document
        </a>
        <p>${link}</p>
      `,
    });

    console.log("✅ Email envoyé avec succès");
  } catch (err) {
    console.error("❌ ERREUR ENVOI EMAIL:", err);
    throw err;
  }
};
👉 Lance le serveur et regarde la console.

🔥 Problème le plus probable
Dans ton nouveau code multi-doc, tu as probablement ça :

const [txRes] = await db.promise().query(...)
const transactionId = txRes.insertId;
⚠️ Mais txRes.insertId n’existe pas toujours selon la version mysql2.

Fais un log :

console.log(txRes);
Si tu vois :

OkPacket { insertId: 12, ... }
Alors c’est bon.

Mais si insertId est undefined → l’email reçoit un lien :

http://localhost:3000/signature/undefined
Et ça peut bloquer.

🧠 AUTRE CAUSE POSSIBLE
Si une erreur se produit AVANT l’email dans la boucle d’insertion documents :

for (const p of pairs) {
  await db.promise().query(...)
}
Alors l’email ne sera jamais exécuté.

Donc vérifie que :

console.log("Insertion documents OK");
est affiché.

⚡ SOLUTION SÉCURISÉE (RECOMMANDÉE)
Pour éviter que l’email bloque la création transaction, fais ceci :

// Après création docs
setImmediate(() => {
  sendSignatureEmail(signataire_email, transactionId)
    .then(() => console.log("📧 Email envoyé"))
    .catch((err) => console.error("EMAIL ERROR:", err));
});
👉 Comme ça même si Gmail bug, la transaction est créée.

🔎 VÉRIFICATION GMAIL (important)
Si tu utilises Gmail :

1️⃣ Vérifie .env
EMAIL_USER=tonemail@gmail.com
EMAIL_PASS=motdepasseapplication
⚠️ Ce doit être un mot de passe d'application Gmail
PAS ton mot de passe normal.

2️⃣ Active "App password" Google
Si tu as modifié quelque chose récemment dans ton compte Google, il bloque peut-être Nodemailer.

🧪 TEST RAPIDE
Ajoute cette route temporaire :

app.get("/test-email", async (req, res) => {
  try {
    await sendSignatureEmail("tonemail@gmail.com", 999);
    res.send("Email test envoyé");
  } catch (e) {
    res.status(500).send("Erreur email");
  }
});
Puis va sur :

http://localhost:5000/test-email
Si ça ne marche pas → problème transporter
Si ça marche → problème logique dans /api/transactions

🎯 90% DU TEMPS LE PROBLÈME EST :
✔️ transactionId undefined
✔️ erreur silencieuse dans boucle insertion
✔️ Gmail bloque (nouvelle sécurité)
✔️ erreur non catchée avant l’email

📌 Dis-moi :
Dans la console tu vois quoi ?

Rien du tout ?

Erreur nodemailer ?

Pas de log “Tentative envoi email” ?

Copie-moi le log console exact et je te corrige immédiatement.




