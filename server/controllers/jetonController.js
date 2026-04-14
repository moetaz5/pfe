const db = require("../db");
const { notifyAdmins, createNotification } = require("../services/notificationService");
const {
  sendTokenRequestPaymentPendingEmail,
  sendTokenRequestDecisionEmail,
} = require("../services/emailService");

/**
 * Request a token pack
 */
const requestPack = async (req, res) => {
  const { packName, tokens, priceTnd, contactInfo, source } = req.body;

  if (!packName || !tokens) {
    return res.status(400).json({ message: "Données invalides" });
  }

  try {
    const [result] = await db.promise().query(
      `INSERT INTO jeton 
       (user_id, pack_name, tokens, price_tnd, contact_info, request_source, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user.id,
        packName,
        tokens,
        priceTnd || 0,
        contactInfo || "",
        source || "web",
      ],
    );

    res.status(201).json({
      message: "Demande envoyée. En attente de validation admin.",
      requestId: result.insertId,
    });

    notifyAdmins(
      "Nouvelle demande de jetons",
      `L'utilisateur ${req.user.name} demande le pack ${packName}.`,
      "warning",
    );
  } catch (err) {
    console.error("TOKEN REQUEST ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Upload payment proof
 */
const uploadPaymentProof = async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({
      message: "Preuve de virement obligatoire (PDF ou image)",
    });
  }

  const mime = String(req.file.mimetype || "").toLowerCase();
  const isAllowedProof = mime === "application/pdf" || mime.startsWith("image/");

  if (!isAllowedProof) {
    return res.status(400).json({
      message: "Format preuve invalide (PDF, JPG, PNG, WebP...)",
    });
  }

  try {
    const [rows] = await db.promise().query(
      `SELECT id, status FROM jeton WHERE id = ? AND user_id = ?`,
      [id, req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Demande introuvable" });
    }

    if (rows[0].status !== "payment_pending") {
      return res.status(409).json({
        message: "Preuve non autorisée pour ce statut",
      });
    }

    const [updateRes] = await db.promise().query(
      `UPDATE jeton 
       SET payment_proof = ?, 
           payment_proof_mime = ?, 
           payment_proof_name = ?, 
           payment_uploaded_at = NOW(), 
           status = 'payment_submitted' 
       WHERE id = ? AND user_id = ? AND status = 'payment_pending'`,
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
        message: "Statut modifié, veuillez actualiser la page",
      });
    }

    res.json({
      message: "Preuve envoyée. En attente de confirmation finale.",
    });

    notifyAdmins(
      "Preuve de paiement reçue",
      `Une preuve de paiement a été soumise pour la demande de jetons #${id}.`,
      "payment",
    );
  } catch (err) {
    console.error("TOKEN REQUEST UPLOAD PROOF ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * List user's token requests
 */
const listMyRequests = (req, res) => {
  const sql = `
    SELECT 
      id, pack_name, tokens, price_tnd, contact_info, request_source, 
      status, admin_note, created_at, decided_at, payment_uploaded_at, 
      payment_proof_name, payment_proof_mime, 
      CASE WHEN payment_proof IS NULL THEN 0 ELSE 1 END AS has_payment_proof 
    FROM jeton 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `;

  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.json(results || []);
  });
};

/**
 * Download payment proof (User)
 */
const downloadMyProof = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT payment_proof, payment_proof_mime, payment_proof_name 
    FROM jeton 
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [id, req.user.id], (err, results) => {
    if (err || !results.length || !results[0].payment_proof) {
      return res.status(404).json({ message: "Preuve introuvable" });
    }

    const row = results[0];
    res.setHeader("Content-Type", row.payment_proof_mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${row.payment_proof_name || `preuve_${id}`}"`);
    res.send(row.payment_proof);
  });
};

/**
 * Get total tokens
 */
const getTotalTokens = async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query("SELECT total_jetons FROM users WHERE id = ?", [req.user.id]);
    res.json({ total_jetons: rows[0]?.total_jetons || 0 });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  requestPack,
  uploadPaymentProof,
  listMyRequests,
  downloadMyProof,
  getTotalTokens,
};
