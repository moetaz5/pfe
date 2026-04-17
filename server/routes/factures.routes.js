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

/*récupérer les factures utilisables*/
// Récupérer les factures liées à l'utilisateur (en fonction des transactions associées)
app.get("/api/factures", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        td.id,
        td.filename,
        td.invoice_number,
        td.statut,
        td.created_at,
        td.signed_at,
        t.id AS transaction_id,
        t.facture_number
      FROM transaction_documents td
      JOIN transactions t ON t.id = td.transaction_id
      WHERE t.user_id = ?
      ORDER BY td.id DESC
      `,
      [req.user.id],
    );

    res.json(rows || []);
  } catch (err) {
    console.error("FACTURES ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* LIST factures disponibles (en attente) */
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
    res.json(results || []);
  });
});

// 3. Get Transaction Details (No token required since /any/)
app.get("/any/invoice/xml/:transaction_uid", async (req, res) => {
  try {
    const txId = req.params.transaction_uid;
    const [txs] = await db
      .promise()
      .query(
        "SELECT id, statut, date_creation FROM transactions WHERE id = ?",
        [txId],
      );
    if (!txs.length)
      return res
        .status(404)
        .json({ errorCode: 1, message: "Transaction not found" });

    const [docs] = await db
      .promise()
      .query(
        "SELECT id, statut, invoice_number FROM transaction_documents WHERE transaction_id = ?",
        [txId],
      );

    const invoices = docs.map((d) => ({
      status:
        d.statut === "signée_ttn"
          ? "TTN_SIGNED"
          : d.statut === "signée"
            ? "SIGNED"
            : "CREATED",
      uuid: String(d.id),
      invoiceNumber: d.invoice_number,
      ttnReference: "REF-TTN-" + d.id,
      twoDocImage:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // Mock 1x1
    }));

    res.status(200).json({
      object: {
        uuid: String(txs[0].id),
        status:
          txs[0].statut === "signée_ttn"
            ? "TTN_SIGNED"
            : txs[0].statut === "signée"
              ? "SIGNED"
              : "CREATED",
        invoices: invoices,
        creationDate: txs[0].date_creation,
      },
      errorCode: 0,
    });
  } catch (e) {
    res.status(500).json({ errorCode: 1 });
  }
});
};
