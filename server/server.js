require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const JSZip = require("jszip");

const db = require("./db");
const passport = require("./googleAuth");

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
  })
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

/* ===================== JWT VERIFY ===================== */
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Non autorisé" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Token invalide" });
    req.user = decoded;
    next();
  });
};

/* ===================== GOOGLE AUTH ===================== */
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:3000/login",
  }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
    });

    res.redirect("http://localhost:3000/dashboard");
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

    const sql = `
      INSERT INTO users 
      (name, email, password, phone, address, is_verified, email_verification_code, email_verification_expires)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `;

    db.query(
      sql,
      [name, email, hashedPassword, phone || null, address || null, code, expires],
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
      }
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

    // block login if not verified
    if (user.is_verified === 0) {
      return res.status(401).json({
        message: "Veuillez vérifier votre email avant de vous connecter.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: "Mot de passe incorrect" });

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
    if (err) return res.json({ message: "Si l'email existe, un code a été envoyé." });
    if (results.length === 0) return res.json({ message: "Si l'email existe, un code a été envoyé." });

    const user = results[0];

    // si user Google (password vide)
    if (!user.password) {
      return res.status(400).json({
        message: "Ce compte utilise Google. Connectez-vous avec Google.",
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const updateSql = "UPDATE users SET reset_code = ?, reset_expires = ? WHERE email = ?";
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

  if (!name)
    return res.status(400).json({ message: "Le nom est obligatoire" });

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
    SELECT id, date_facture
    FROM factures
    WHERE user_id = ?
      AND (statut = 'en attente' OR statut IS NULL)
    ORDER BY date_facture DESC
  `;

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

    const sql = `
      INSERT INTO factures (user_id, statut, fichier_pdf)
      VALUES (?, ?, ?)
    `;

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
      }
    );
  }
);


app.get("/api/factures", verifyToken, (req, res) => {
  const sql = `
    SELECT id, date_facture, statut
    FROM factures
    WHERE user_id = ?
    ORDER BY date_facture DESC
  `;

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
      `attachment; filename=facture_${id}.pdf`
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
    const {
      facture_number,
      signataire_email,
      client_email,
      facture_id,
    } = req.body;

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
            [facture_id, req.user.id]
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
          `
          INSERT INTO factures (user_id, statut, fichier_pdf, source)
          VALUES (?, 'en_transaction', ?, 'transaction')
          `,
          [req.user.id, pdfBuffer]
        );

        finalFactureId = factureRes.insertId;
      }

      // 🔹 CRÉER TRANSACTION
      const [tx] = await db.promise().query(
        `
        INSERT INTO transactions
        (facture_number, pdf_file, xml_file, signataire_email, client_email, user_id, statut, facture_id)
        VALUES (?, ?, ?, ?, ?, ?, 'créé', ?)
        `,
        [
          facture_number,
          pdfBuffer,
          req.files.xml_file[0].buffer,
          signataire_email,
          client_email,
          req.user.id,
          finalFactureId,
        ]
      );

      // 🔹 LIER FACTURE
      await db.promise().query(
        `
        UPDATE factures
        SET statut='en_transaction', transaction_id=?
        WHERE id=?
        `,
        [tx.insertId, finalFactureId]
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
  }
);


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

app.get("/api/transactions/:id/download", verifyToken, (req, res) => {
  const { id } = req.params;

  const sql =
    "SELECT pdf_file, xml_file FROM transactions WHERE id = ? AND user_id = ?";

  db.query(sql, [id, req.user.id], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }

    const transaction = results[0];
    const fileType = req.query.type || "pdf";

    const fileBuffer =
      fileType === "xml" ? transaction.xml_file : transaction.pdf_file;

    if (!fileBuffer) {
      return res.status(404).json({ message: "Fichier non trouvé" });
    }

    res.setHeader(
      "Content-Type",
      fileType === "xml" ? "application/xml" : "application/pdf"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=facture_${id}.${fileType}`
    );

    res.send(fileBuffer);
  });
});

app.get("/api/transactions/:id/zip", verifyToken, (req, res) => {
  const { id } = req.params;

  const sql =
    "SELECT pdf_file, xml_file FROM transactions WHERE id = ? AND user_id = ?";

  db.query(sql, [id, req.user.id], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: "Transaction non trouvée" });
    }

    const transaction = results[0];

    if (!transaction.pdf_file || !transaction.xml_file) {
      return res.status(404).json({ message: "Fichiers non trouvés" });
    }

    try {
      const zip = new JSZip();
      zip.file("facture.pdf", transaction.pdf_file);
      zip.file("facture.xml", transaction.xml_file);

      const content = await zip.generateAsync({ type: "nodebuffer" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transaction_${id}.zip`
      );
      res.send(content);
    } catch (error) {
      console.log("ZIP ERROR:", error);
      res.status(500).json({ message: "Erreur lors de la création du ZIP" });
    }
  });
});
/* ===================== STATISTIQUES ===================== */
app.get("/api/statistiques", verifyToken, (req, res) => {
  const stats = {};

  // 1️⃣ Utilisateurs
  db.query("SELECT COUNT(*) AS total FROM users", (err, r1) => {
    if (err) {
      console.error("❌ Erreur stats utilisateurs:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    stats.utilisateurs = r1[0]?.total || 0;

    // 2️⃣ Transactions totales
    db.query("SELECT COUNT(*) AS total FROM transactions", (err, r2) => {
      if (err) {
        console.error("❌ Erreur stats transactions:", err);
        return res.status(500).json({ message: "Erreur serveur" });
      }
      stats.totalTransactions = r2[0]?.total || 0;

      // 3️⃣ Transactions validées
      db.query(
        "SELECT COUNT(*) AS total FROM transactions WHERE statut = 'terminee'",
        (err, r3) => {
          if (err) {
            console.error("❌ Erreur transactions validées:", err);
            return res.status(500).json({ message: "Erreur serveur" });
          }
          stats.transactionsValidees = r3[0]?.total || 0;

          // 4️⃣ Transactions en attente
          db.query(
            "SELECT COUNT(*) AS total FROM transactions WHERE statut != 'terminee'",
            (err, r4) => {
              if (err) {
                console.error("❌ Erreur transactions en attente:", err);
                return res.status(500).json({ message: "Erreur serveur" });
              }
              stats.transactionsEnAttente = r4[0]?.total || 0;

              // 5️⃣ Factures totales (sans montant)
db.query(
  "SELECT COUNT(*) AS total FROM factures",
  (err, r5) => {
    if (err) {
      console.error("❌ Erreur factures:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }
    stats.totalFactures = r5[0]?.total || 0;


                  // 6️⃣ Factures terminées
                  db.query(
                    "SELECT COUNT(*) AS total FROM factures WHERE statut = 'terminee'",
                    (err, r6) => {
                      if (err) {
                        console.error("❌ Erreur factures terminées:", err);
                        return res.status(500).json({ message: "Erreur serveur" });
                      }
                      stats.facturesTerminees = r6[0]?.total || 0;

                      // 7️⃣ Transactions par mois
                      db.query(
                        `
                        SELECT MONTH(date_creation) AS mois, COUNT(*) AS total
                        FROM transactions
                        GROUP BY MONTH(date_creation)
                        ORDER BY mois
                        `,
                        (err, r7) => {
                          if (err) {
                            console.error("❌ Erreur transactions par mois:", err);
                            return res.status(500).json({ message: "Erreur serveur" });
                          }

                          stats.transactionsParMois = r7.map(row => ({
                            mois: "M" + row.mois,
                            total: row.total || 0
                          }));

                          // ❌ PAS DE console.log
                          res.json(stats);
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
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
    }
  );
});
// ✍️ Signature logique (SSCD - sans signature manuscrite)
app.post("/api/public/transactions/:id/sign", async (req, res) => {
  const { id } = req.params;

  try {
    await db.promise().query(
      "UPDATE transactions SET statut='signée', signed_at=NOW() WHERE id=?",
      [id]
    );

    await db.promise().query(
      "UPDATE factures SET statut='signée' WHERE transaction_id=?",
      [id]
    );

    res.json({ message: "Document signé" });
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== SERVER ===================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
