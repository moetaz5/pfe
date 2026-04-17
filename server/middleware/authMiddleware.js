const jwt = require("jsonwebtoken");
const db = require("../db");
require("dotenv").config();

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

module.exports = {
  googleExchangeTokens,
  verifyToken,
  verifyRole,
  verifyApiToken
};
