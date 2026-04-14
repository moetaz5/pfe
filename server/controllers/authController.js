const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNewResetCodeEmail,
} = require("../services/emailService");

/**
 * Register a new user
 */
const register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Veuillez remplir tous les champs" });
  }

  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length > 0) {
      return res.status(400).json({ message: "Utilisateur existe déjà" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000);
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000);

    const [result] = await db.promise().query(
      `INSERT INTO users (name, email, phone, password, verification_code, code_expires, is_verified) 
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [name, email, phone || "", hashedPassword, verificationCode, codeExpires],
    );

    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({
      message: "Utilisateur créé. Veuillez vérifier votre email.",
      userId: result.insertId,
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Verify email with OTP
 */
const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  try {
    const [rows] = await db.promise().query(
      `SELECT * FROM users WHERE email = ? AND verification_code = ? AND code_expires > NOW()`,
      [email, code],
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Code invalide ou expiré" });
    }

    await db.promise().query(
      "UPDATE users SET is_verified = 1, verification_code = NULL, code_expires = NULL WHERE email = ?",
      [email],
    );

    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ message: "Email vérifié avec succès", token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    const user = rows[0];

    if (!user.is_verified) {
      return res.status(401).json({ message: "Email non vérifié", unverified: true });
    }

    if (user.statut === 0) {
      return res.status(403).json({ message: "Compte désactivé. Contactez l'admin." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Connexion réussie",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        total_jetons: user.total_jetons,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Logout user
 */
const logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Déconnexion réussie" });
};

/**
 * Get current user profile
 */
const getMe = async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT id, name, email, phone, role, total_jetons, created_at, last_activity FROM users WHERE id = ?",
        [req.user.id],
      );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Forgot password request
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db
      .promise()
      .query("SELECT id FROM users WHERE email = ?", [email]);
    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000);
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await db
      .promise()
      .query(
        "UPDATE users SET reset_code = ?, reset_expires = ? WHERE email = ?",
        [resetCode, expires, email],
      );

    await sendPasswordResetEmail(email, resetCode);
    res.json({ message: "Code de réinitialisation envoyé par email" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Reset password with code
 */
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT id FROM users WHERE email = ? AND reset_code = ? AND reset_expires > NOW()",
        [email, code],
      );

    if (!rows.length) {
      return res.status(400).json({ message: "Code invalide ou expiré" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.promise().query(
      `UPDATE users 
       SET password = ?, reset_code = NULL, reset_expires = NULL 
       WHERE email = ?`,
      [hashedPassword, email],
    );

    res.json({ message: "Mot de passe réinitialisé avec succès" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Resend reset code
 */
const resendResetCode = async (req, res) => {
  const { email } = req.body;
  try {
    const code = Math.floor(100000 + Math.random() * 900000);
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    const [result] = await db
      .promise()
      .query(
        "UPDATE users SET reset_code = ?, reset_expires = ? WHERE email = ?",
        [code, expires, email],
      );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Email non trouvé" });
    }

    await sendNewResetCodeEmail(email, code);
    res.json({ message: "Nouveau code envoyé" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  resendResetCode,
};
