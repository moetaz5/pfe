module.exports = function(app, locals) {
  const {
    db, jwt, bcrypt, multer, nodemailer, JSZip, axios, fs, path, crypto, express,
  googleExchangeTokens, TTN_URL, TTN_LOGIN, TTN_PASSWORD, TTN_MATRICULE,
  sleep, cleanBase64, extractSoapReturn, extractSoapFault, saveEfactTTN, consultEfactTTN,
  processTTNSubmission, QRCode, safeJsonParse, resolveConfig, decodeXmlB64, extractReferenceCEVFromXml, extractReferenceTTNFromXml,
  generateQrPngBase64, stampPdfWithTTN, bufferToB64, b64ToBuffer, ensureBase64String,
  createNotification, notifyAdmins, sendSignatureEmail, sendSignedPdfsToClient,
  sendRejectionEmailToClient, allowedOrigins, transporter, sendVerificationEmail,
  EMAIL_REGEX, isValidEmail, sanitizeEmailHtml, sendTokenRequestPaymentPendingEmail, sendTokenRequestDecisionEmail,
  verifyToken, verifyRole, verifyApiToken, storage, upload, handleResendTTNCore, passport
  } = locals;

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

        // ✅ FIX: Rediriger vers l'application mobile via Deep Link pour retour automatique
        return res.redirect(
          `medicasign://auth-callback?token=${token}&session_id=${sessionId}`,
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
};
