const jwt = require("jsonwebtoken");
const db = require("../db");

/**
 * Update user certification info
 */
const updateCertification = async (req, res) => {
  const { cert_uid, cert_not_after, cert_not_before, cert_subject, cert_issuer } =
    req.body;

  try {
    await db.promise().query(
      `UPDATE users SET 
        cert_uid = ?, 
        cert_not_after = ?, 
        cert_not_before = ?, 
        cert_subject = ?, 
        cert_issuer = ? 
      WHERE id = ?`,
      [
        cert_uid || null,
        cert_not_after || null,
        cert_not_before || null,
        cert_subject || null,
        cert_issuer || null,
        req.user.id,
      ],
    );
    res.json({ message: "Certification mise à jour" });
  } catch (err) {
    console.error("CERT UPDATE ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Generate an API token
 */
const generateApiToken = async (req, res) => {
  try {
    const apiToken = jwt.sign(
      { id: req.user.id, type: "api" },
      process.env.JWT_SECRET,
    );

    await db
      .promise()
      .query("UPDATE users SET api_token = ? WHERE id = ?", [
        apiToken,
        req.user.id,
      ]);

    res.json({ apiToken });
  } catch (err) {
    console.error("GENERATE API TOKEN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Get current user's API token
 */
const getMyApiToken = async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query("SELECT api_token FROM users WHERE id = ?", [req.user.id]);
    res.json({ apiToken: rows[0]?.api_token || null });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  updateCertification,
  generateApiToken,
  getMyApiToken,
};
