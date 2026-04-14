const db = require("../db");
const { createNotification } = require("../services/notificationService");
const {
  sendTokenRequestPaymentPendingEmail,
  sendTokenRequestDecisionEmail,
} = require("../services/emailService");

/**
 * List all users (Admin only)
 */
const listUsers = (req, res) => {
  db.query(
    "SELECT id, name, email, phone, role, created_at, statut, total_jetons, cert_uid FROM users",
    (err, results) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      res.json(results);
    },
  );
};

/**
 * Update user status (Admin only)
 */
const updateUserStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const statutValue = status ? 1 : 0;

  db.query(
    "UPDATE users SET statut = ? WHERE id = ?",
    [statutValue, id],
    (err) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      res.json({ message: "Statut mis à jour" });
    },
  );
};

/**
 * Delete a user (Admin only)
 */
const deleteUser = (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM users WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.json({ message: "Utilisateur supprimé" });
  });
};

/**
 * Get overall statistics (Admin only)
 */
const getStats = async (req, res) => {
  try {
    const [userCount] = await db.promise().query("SELECT COUNT(*) AS total FROM users");
    const [txCount] = await db.promise().query("SELECT COUNT(*) AS total FROM transactions");
    const [signedCount] = await db
      .promise()
      .query("SELECT COUNT(*) AS total FROM transactions WHERE statut = 'signée_ttn'");
    const [pendingJetons] = await db
      .promise()
      .query("SELECT COUNT(*) AS total FROM jeton WHERE status IN ('pending', 'payment_submitted')");

    res.json({
      totalUsers: userCount[0].total,
      totalTransactions: txCount[0].total,
      totalSigned: signedCount[0].total,
      pendingJetonRequests: pendingJetons[0].total,
    });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * List all token requests for admin
 */
const listTokenRequests = (req, res) => {
  const status = String(req.query.status || "").toLowerCase().trim();
  const validStatuses = ["payment_pending", "payment_submitted", "pending", "approved", "rejected"];
  const hasFilter = validStatuses.includes(status);

  const sql = `
    SELECT 
      tr.id, tr.user_id, tr.pack_name, tr.tokens, tr.price_tnd, tr.contact_info, 
      tr.request_source, tr.status, tr.admin_note, tr.created_at, tr.payment_uploaded_at, 
      tr.decided_at, tr.decided_by, tr.payment_proof_name, tr.payment_proof_mime, 
      CASE WHEN tr.payment_proof IS NULL THEN 0 ELSE 1 END AS has_payment_proof, 
      u.name AS user_name, u.email AS user_email 
    FROM jeton tr 
    JOIN users u ON u.id = tr.user_id 
    ${hasFilter ? "WHERE tr.status = ?" : ""} 
    ORDER BY tr.created_at DESC
  `;

  const params = hasFilter ? [status] : [];
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.json(results || []);
  });
};

/**
 * Download payment proof for admin
 */
const downloadProof = (req, res) => {
  const { id } = req.params;
  const sql = "SELECT payment_proof, payment_proof_mime, payment_proof_name FROM jeton WHERE id = ?";
  db.query(sql, [id], (err, results) => {
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
 * Make a decision on a token request
 */
const makeJetonDecision = async (req, res) => {
  const { id } = req.params;
  const { decision, admin_note } = req.body;
  const nextStatus = String(decision || "").toLowerCase().trim();

  if (!["payment_pending", "approved", "rejected"].includes(nextStatus)) {
    return res.status(400).json({ message: "Décision invalide" });
  }

  try {
    const [rows] = await db.promise().query(
      `SELECT tr.*, u.email AS user_email FROM jeton tr 
       JOIN users u ON u.id = tr.user_id WHERE tr.id = ?`,
      [id],
    );

    if (!rows.length) return res.status(404).json({ message: "Demande introuvable" });
    const tokenRequest = rows[0];

    await db.promise().query(
      `UPDATE jeton SET status = ?, admin_note = ?, decided_by = ?, decided_at = NOW() 
       WHERE id = ?`,
      [nextStatus, admin_note || null, req.user.id, id],
    );

    // Notifications and emails
    if (nextStatus === "payment_pending") {
      await createNotification(tokenRequest.user_id, "Paiement requis", `Votre demande #${id} nécessite un paiement.`, "warning");
      await sendTokenRequestPaymentPendingEmail({
        toEmail: tokenRequest.user_email,
        packName: tokenRequest.pack_name,
        tokens: tokenRequest.tokens,
        priceTnd: tokenRequest.price_tnd,
        adminNote: admin_note,
      });
    } else if (nextStatus === "approved") {
      await db.promise().query("UPDATE users SET total_jetons = total_jetons + ? WHERE id = ?", [tokenRequest.tokens, tokenRequest.user_id]);
      await createNotification(tokenRequest.user_id, "Jetons approuvés", `${tokenRequest.tokens} jetons ajoutés.`, "success");
      await sendTokenRequestDecisionEmail({
        toEmail: tokenRequest.user_email,
        packName: tokenRequest.pack_name,
        tokens: tokenRequest.tokens,
        priceTnd: tokenRequest.price_tnd,
        decision: "approved",
        adminNote: admin_note,
      });
    } else if (nextStatus === "rejected") {
      await createNotification(tokenRequest.user_id, "Demande refusée", `Votre demande #${id} a été rejetée.`, "error");
      await sendTokenRequestDecisionEmail({
        toEmail: tokenRequest.user_email,
        packName: tokenRequest.pack_name,
        tokens: tokenRequest.tokens,
        priceTnd: tokenRequest.price_tnd,
        decision: "rejected",
        adminNote: admin_note,
      });
    }

    res.json({ message: "Décision enregistrée" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * List all API routes from DB
 */
const listRoutes = (req, res) => {
  db.query("SELECT * FROM api_routes ORDER BY path ASC", (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur lecture routes" });

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

    res.json({ routes });
  });
};

module.exports = {
  listUsers,
  updateUserStatus,
  deleteUser,
  getStats,
  listTokenRequests,
  downloadProof,
  makeJetonDecision,
  listRoutes,
};
