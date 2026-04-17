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

      // 🔔 Notification pour l'Admin
      notifyAdmins(
        "Nouvelle demande de jetons",
        `Un utilisateur a demandé un pack ${pack_name} (${parsedTokens} jetons).`,
        "info",
      );

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

      // 🔔 Notification pour l'Admin
      notifyAdmins(
        "Preuve de paiement reçue",
        `Une preuve de paiement a été soumise pour la demande de jetons #${id}.`,
        "payment",
      );
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

/* ===================== JETON - TOTAL UTILISATEUR ===================== */
app.get("/api/jeton/total", verifyToken, async (req, res) => {
  const [rows] = await db
    .promise()
    .query("SELECT total_jetons FROM users WHERE id = ?", [req.user.id]);

  res.json({
    total_jetons: rows[0]?.total_jetons || 0,
  });
});
};
