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

app.get("/api/my-transaction-factures", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        td.id,
        td.filename,
        td.invoice_number,
        td.statut,
        td.created_at,
        t.id AS transaction_id
      FROM transaction_documents td
      JOIN transactions t ON t.id = td.transaction_id
      WHERE t.user_id = ?
      ORDER BY td.id DESC
      `,
      [req.user.id],
    );

    res.json(rows || []);
  } catch (err) {
    console.error("MY TX FACTURES ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get(
  "/api/my-transaction-factures/:docId/pdf",
  verifyToken,
  async (req, res) => {
    try {
      const { docId } = req.params;

      const [rows] = await db.promise().query(
        `
      SELECT d.pdf_file, d.filename, t.user_id
      FROM transaction_documents d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.id = ?
      `,
        [docId],
      );

      if (!rows.length || rows[0].user_id !== req.user.id) {
        return res.status(404).json({ message: "Document introuvable" });
      }

      const pdfBuffer = Buffer.from(rows[0].pdf_file, "base64");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${rows[0].filename}.pdf"`,
      );

      res.send(pdfBuffer);
    } catch (err) {
      console.error("DOWNLOAD DOC ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* DOWNLOAD facture -> decode base64 */

/* ===================== TRANSACTIONS ===================== */
/* ===================== CRÉATION TRANSACTION ===================== */
/* ===================== TRANSACTIONS (BASE64) ===================== */
app.post(
  "/api/transactions",
  verifyToken,
  upload.fields([
    { name: "pdf_files", maxCount: 50 },
    { name: "xml_files", maxCount: 50 },
  ]),
  async (req, res) => {
    try {
      const {
        facture_number,
        signataire_email,
        client_email,
        qr_config,
        ref_config,
      } = req.body;

      if (!facture_number || !signataire_email || !client_email) {
        return res.status(400).json({ message: "Champs manquants" });
      }
      // 🔥 Vérifier certification
      const [userCheck] = await db
        .promise()
        .query("SELECT certified FROM users WHERE id = ?", [req.user.id]);

      if (!userCheck.length || userCheck[0].certified === 0) {
        return res.status(403).json({
          message:
            "Votre compte doit être certifié avant de créer une transaction",
        });
      }
      // 🔥 CONFIGURATION PROPRE
      const qrConfig =
        typeof qr_config === "string" ? JSON.parse(qr_config) : qr_config || {};

      const refConfig =
        typeof ref_config === "string"
          ? JSON.parse(ref_config)
          : ref_config || {};

      const [txRes] = await db.promise().query(
        `
        INSERT INTO transactions
        (facture_number, signataire_email, client_email, user_id, statut, qr_config, ref_config)
        VALUES (?, ?, ?, ?, 'créé', ?, ?)
        `,
        [
          facture_number,
          signataire_email,
          client_email,
          req.user.id,
          JSON.stringify(qrConfig),
          JSON.stringify(refConfig),
        ],
      );

      const transactionId = txRes.insertId;

      const pdfFiles = req.files?.pdf_files || [];
      const xmlFiles = req.files?.xml_files || [];

      if (pdfFiles.length !== xmlFiles.length) {
        return res.status(400).json({ message: "Mismatch PDF/XML" });
      }

      for (let i = 0; i < pdfFiles.length; i++) {
        await db.promise().query(
          `
          INSERT INTO transaction_documents
          (transaction_id, filename, invoice_number, pdf_file, xml_file, statut)
          VALUES (?, ?, ?, ?, ?, 'créé')
          `,
          [
            transactionId,
            path.parse(pdfFiles[i].originalname).name,
            facture_number,
            pdfFiles[i].buffer.toString("base64"),
            xmlFiles[i].buffer.toString("base64"),
          ],
        );
      }

      await sendSignatureEmail(signataire_email, transactionId);
      await createNotification(
        req.user.id,
        "Nouvelle transaction créée",
        `Transaction #${transactionId} créée avec succès`,
        "success",
      );
      res.status(201).json({
        message: "Transaction créée",
        transactionId,
      });
    } catch (err) {
      console.error("CREATE TX ERROR:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== DELETE TRANSACTION ===================== */
app.delete("/api/transactions/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 🔎 Vérifier transaction + propriétaire
    const [rows] = await db.promise().query(
      `
      SELECT id, user_id, statut
      FROM transactions
      WHERE id = ?
      `,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Transaction introuvable" });
    }

    const transaction = rows[0];

    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // ❌ Interdire suppression si signée
    if (
      transaction.statut === "signée" ||
      transaction.statut === "signée_ttn"
    ) {
      return res.status(400).json({
        message: "Impossible de supprimer une transaction signée",
      });
    }

    // 🗑 Soft delete transaction
    await db.promise().query(
      `
      UPDATE transactions
      SET statut = 'supprimée', date_suppression = NOW()
      WHERE id = ?
      `,
      [id],
    );

    // Mettre à jour aussi les documents
    await db.promise().query(
      `
      UPDATE transaction_documents
      SET statut = 'supprimée'
      WHERE transaction_id = ?
      `,
      [id],
    );

    await createNotification(
      req.user.id,
      "Transaction supprimée",
      `La transaction #${id} a été supprimée`,
      "info",
    );

    res.json({ message: "Transaction supprimée avec succès" });
  } catch (err) {
    console.error("DELETE TX ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/transactions", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        t.id,
        t.facture_number,
        t.statut,
        t.date_creation,
        t.date_suppression,
        u.name AS user_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.user_id = ?
      ORDER BY t.id DESC
      `,
      [req.user.id],
    );

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/transactions/:id/docs", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        id,
        filename,
        invoice_number,
        statut,
        created_at,
        signed_at
      FROM transaction_documents
      WHERE transaction_id = ?
      ORDER BY id DESC
      `,
      [req.params.id],
    );

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/transactions/:id/details", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        t.*,
        u.name AS user_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
      `,
      [req.params.id],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Transaction introuvable" });

    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

//*telecharger le fichier xml selon le statut
app.get("/api/transactions/:id/download", verifyToken, async (req, res) => {
  const { id } = req.params;
  const fileType = req.query.type || "pdf";

  try {
    const [docs] = await db.promise().query(
      `
      SELECT d.*, t.user_id
      FROM transaction_documents d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.transaction_id = ?
      `,
      [id],
    );

    if (!docs.length || docs[0].user_id !== req.user.id)
      return res.status(404).json({ message: "Transaction non trouvée" });

    const doc = docs[0];

    let fileBuffer;
    let contentType;
    let filename;

    if (fileType === "xml") {
      if (doc.statut === "signée_ttn" && doc.xml_signed_ttn)
        fileBuffer = doc.xml_signed_ttn;
      else if (
        (doc.statut === "signée" || doc.statut === "refusée par TTN") &&
        doc.xml_signed
      )
        fileBuffer = doc.xml_signed;
      else fileBuffer = doc.xml_file;

      contentType = "application/xml";
      filename = `${doc.filename}.xml`;
    } else {
      fileBuffer = doc.pdf_file;
      contentType = "application/pdf";
      filename = `${doc.filename}.pdf`;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    res.send(Buffer.from(fileBuffer, "base64"));
  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

//*telecharger le fichier zip selon le statut
app.get("/api/transactions/:id/zip", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [txRows] = await db
      .promise()
      .query("SELECT * FROM transactions WHERE id = ?", [id]);

    if (!txRows.length || txRows[0].user_id !== req.user.id)
      return res.status(404).json({ message: "Transaction non trouvée" });

    const [docs] = await db
      .promise()
      .query(`SELECT * FROM transaction_documents WHERE transaction_id = ?`, [
        id,
      ]);

    const zip = new JSZip();

    for (const d of docs) {
      let xmlToUse;

      if (d.statut === "signée_ttn" && d.xml_signed_ttn)
        xmlToUse = d.xml_signed_ttn;
      else if (
        (d.statut === "signée" || d.statut === "refusée par TTN") &&
        d.xml_signed
      )
        xmlToUse = d.xml_signed;
      else xmlToUse = d.xml_file;

      // ON PREND LE PDF TEL QUEL (déjà stampé à la signature)
      zip.file(`${d.filename}.pdf`, Buffer.from(d.pdf_file, "base64"));
      zip.file(`${d.filename}.xml`, Buffer.from(xmlToUse, "base64"));
    }

    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transaction_${id}.zip`,
    );

    res.send(content);
  } catch (err) {
    console.error("ZIP ERROR:", err);
    res.status(500).json({ message: "Erreur ZIP" });
  }
});

app.post("/api/resend-ttn", verifyToken, handleResendTTNCore);

app.post("/api/transactions/:id/resend-ttn", verifyToken, handleResendTTNCore);

app.get("/api/docs/:docId/download", verifyToken, async (req, res) => {
  const { docId } = req.params;
  const fileType = req.query.type || "pdf";

  try {
    const [rows] = await db.promise().query(
      `
      SELECT d.*, t.user_id
      FROM transaction_documents d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.id = ?
      `,
      [docId],
    );

    if (!rows.length || rows[0].user_id !== req.user.id) {
      return res.status(404).json({ message: "Document non trouvé" });
    }

    const doc = rows[0];

    let fileBuffer;
    let contentType;
    let filename;

    if (fileType === "xml") {
      if (doc.statut === "signée_ttn" && doc.xml_signed_ttn)
        fileBuffer = doc.xml_signed_ttn;
      else if (
        (doc.statut === "signée" || doc.statut === "refusée par TTN") &&
        doc.xml_signed
      )
        fileBuffer = doc.xml_signed;
      else fileBuffer = doc.xml_file;

      contentType = "application/xml";
      filename = `${doc.filename}.xml`;
    } else {
      fileBuffer = doc.pdf_file;
      contentType = "application/pdf";
      filename = `${doc.filename}.pdf`;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    res.send(Buffer.from(fileBuffer, "base64"));
  } catch (err) {
    console.error("DOC DOWNLOAD ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// 🚀 RENVOYER À LA TTN (MANUELLEMENT SI RÉFUSÉ OU OUBLIÉ)
app.post("/api/transactions/:id/resend-ttn", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [txRows] = await db
      .promise()
      .query(
        "SELECT id, user_id, statut, client_email, qr_config, ref_config FROM transactions WHERE id = ? AND user_id = ?",
        [id, req.user.id],
      );

    if (!txRows.length)
      return res.status(404).json({ message: "Transaction introuvable" });

    const transaction = txRows[0];

    // Ne renvoyer que si c'est 'signée' ou 'refusée par TTN'
    const allowed = ["signée", "refusée par TTN"];
    if (!allowed.includes(transaction.statut)) {
      return res.status(400).json({
        message: `Le statut '${transaction.statut}' ne permet pas le renvoi TTN.`,
      });
    }

    const [docs] = await db
      .promise()
      .query(
        "SELECT id, filename, xml_file, pdf_file, xml_signed FROM transaction_documents WHERE transaction_id = ?",
        [id],
      );

    if (!docs.length)
      return res.status(404).json({ message: "Documents introuvables" });

    // On prépare les docs "signés" pour la fonction de fond
    const signedDocs = docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      pdf_file: d.pdf_file,
      xml_signed: d.xml_signed,
    }));

    // On change le statut pour indiquer l'action
    await db
      .promise()
      .query(
        "UPDATE transactions SET statut='Renvoi TTN en cours...' WHERE id=?",
        [id],
      );

    res.json({ message: "Processus de renvoi TTN lancé avec succès." });

    // Lancer la tâche de fond
    processTTNSubmission(
      id,
      signedDocs,
      req.user.id,
      transaction.client_email,
      transaction.qr_config,
      transaction.ref_config,
    ).catch((e) => console.error("RESEND TTN BG ERROR:", e));
  } catch (err) {
    console.error("RESEND TTN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur lors du renvoi TTN" });
  }
});

app.get("/api/transactions/:id/xml", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [docs] = await db.promise().query(
      `
      SELECT d.*, t.user_id
      FROM transaction_documents d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.transaction_id = ?
      `,
      [id],
    );

    if (!docs.length || docs[0].user_id !== req.user.id)
      return res.status(404).json({ message: "Transaction introuvable" });

    const doc = docs[0];

    let xml;

    if (doc.statut === "signée_ttn" && doc.xml_signed_ttn)
      xml = doc.xml_signed_ttn;
    else if (
      (doc.statut === "signée" || doc.statut === "refusée par TTN") &&
      doc.xml_signed
    )
      xml = doc.xml_signed;
    else xml = doc.xml_file;

    res.setHeader("Content-Type", "application/xml");
    res.send(Buffer.from(xml, "base64"));
  } catch (err) {
    console.error("XML ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
};
