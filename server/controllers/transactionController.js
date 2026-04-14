const JSZip = require("jszip");
const db = require("../db");
const { processTTNSubmission } = require("../services/ttnBackgroundProcessor");
const { sendSignatureEmail } = require("../services/emailService");
const { createNotification } = require("../services/notificationService");
const {
  cleanBase64,
  ensureBase64String,
  bufferToB64,
} = require("../utils/helpers");

/**
 * Handle direct PDF upload and signing (deprecated but preserved)
 */
const uploadPdf = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Veuillez télécharger un fichier PDF" });
  }

  const { signataire_email, facture_number, client_email } = req.body;
  if (!signataire_email || !facture_number) {
    return res.status(400).json({
      message: "signataire_email et facture_number sont obligatoires.",
    });
  }

  const sql =
    "INSERT INTO transactions (pdf_file, signataire_email, facture_number, client_email, user_id) VALUES (?, ?, ?, ?, ?)";
  db.query(
    sql,
    [
      req.file.buffer.toString("base64"),
      signataire_email,
      facture_number,
      client_email || "",
      req.user.id,
    ],
    (err, result) => {
      if (err) {
        console.error("DB INSERT ERROR:", err);
        return res.status(500).json({ message: "Erreur lors de l'insertion" });
      }

      const transactionId = result.insertId;
      sendSignatureEmail(signataire_email, transactionId);

      res.status(200).json({
        message: "PDF reçu. Email de signature envoyé.",
        transactionId: transactionId,
      });
    },
  );
};

/**
 * Advanced transaction creation (XML + PDF)
 */
const createTransaction = async (req, res) => {
  try {
    const {
      signataire_email,
      facture_number,
      client_email,
      documents, // array of { filename, invoice_number, pdf_file (b64), xml_file (b64) }
      qr_config,
      ref_config,
      signatures_config,
    } = req.body;

    if (!signataire_email || !facture_number || !documents || !documents.length) {
      return res.status(400).json({ message: "Données manquantes" });
    }

    // Spend token
    const [updateRes] = await db
      .promise()
      .query(
        "UPDATE users SET total_jetons = total_jetons - 1 WHERE id = ? AND total_jetons > 0",
        [req.user.id],
      );

    if (!updateRes.affectedRows) {
      return res.status(402).json({
        message: "Jetons insuffisants. Veuillez en acheter pour continuer.",
      });
    }

    const [txResult] = await db.promise().query(
      `INSERT INTO transactions 
       (facture_number, signataire_email, client_email, user_id, qr_config, ref_config, signatures_config) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        facture_number,
        signataire_email,
        client_email || "",
        req.user.id,
        JSON.stringify(qr_config || {}),
        JSON.stringify(ref_config || {}),
        JSON.stringify(signatures_config || {}),
      ],
    );

    const transactionId = txResult.insertId;

    for (const doc of documents) {
      await db.promise().query(
        `INSERT INTO transaction_documents 
         (transaction_id, filename, invoice_number, pdf_file, xml_file) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          transactionId,
          doc.filename,
          doc.invoice_number,
          cleanBase64(doc.pdf_file),
          ensureBase64String(doc.xml_file),
        ],
      );
    }

    // Async notify sub-apps
    sendSignatureEmail(signataire_email, transactionId);

    res.json({
      message: "Transaction créée avec succès. Email envoyé.",
      transactionId,
    });
  } catch (err) {
    console.error("CREATE TX ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * List user transactions
 */
const listTransactions = (req, res) => {
  const sql = `
    SELECT id, facture_number, signataire_email, client_email, statut, date_creation 
    FROM transactions 
    WHERE user_id = ? 
    ORDER BY date_creation DESC
  `;
  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    res.json(results);
  });
};

/**
 * Get transaction details
 */
const getTransactionDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const [transactions] = await db
      .promise()
      .query("SELECT * FROM transactions WHERE id = ? AND user_id = ?", [
        id,
        req.user.id,
      ]);
    if (!transactions.length)
      return res.status(404).json({ message: "Transaction introuvable" });

    const [documents] = await db
      .promise()
      .query(
        "SELECT id, filename, invoice_number, statut, error_message, ttn_reference FROM transaction_documents WHERE transaction_id = ?",
        [id],
      );

    res.json({ transaction: transactions[0], documents });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Download a specific document PDF
 */
const downloadDocument = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT d.pdf_file, d.filename, t.user_id 
    FROM transaction_documents d 
    JOIN transactions t ON t.id = d.transaction_id 
    WHERE d.id = ? AND t.user_id = ?
  `;
  db.query(sql, [id, req.user.id], (err, results) => {
    if (err || !results.length)
      return res.status(404).json({ message: "Fichier introuvable" });

    const doc = results[0];
    const pdfBuffer = Buffer.from(doc.pdf_file, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${doc.filename || "document"}.pdf"`,
    );
    res.send(pdfBuffer);
  });
};

/**
 * Download all documents in a ZIP
 */
const downloadZip = async (req, res) => {
  const { id } = req.params;
  try {
    const [docs] = await db.promise().query(
      `SELECT d.pdf_file, d.filename 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE t.id = ? AND t.user_id = ?`,
      [id, req.user.id],
    );

    if (!docs.length) return res.status(404).json({ message: "Aucun fichier" });

    const zip = new JSZip();
    docs.forEach((doc) => {
      if (doc.pdf_file) {
        zip.file(`${doc.filename || "document"}.pdf`, Buffer.from(doc.pdf_file, "base64"));
      }
    });

    const content = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="transaction_${id}.zip"`);
    res.send(content);
  } catch (err) {
    console.error("ZIP ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Public route: Get transaction for signing
 */
const getPublicTransaction = (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT id, facture_number, signataire_email, statut, date_creation 
    FROM transactions 
    WHERE id = ?
  `;
  db.query(sql, [id], async (err, results) => {
    if (err || !results.length)
      return res.status(404).json({ message: "Transaction introuvable" });

    const transaction = results[0];
    const [docs] = await db
      .promise()
      .query(
        "SELECT id, filename, invoice_number, statut, pdf_file, xml_file FROM transaction_documents WHERE transaction_id = ?",
        [id],
      );

    res.json({ transaction, documents: docs });
  });
};

/**
 * Public route: Submit signature (from client)
 */
const submitSignature = async (req, res) => {
  const { id } = req.params;
  const { documents } = req.body; // Array of { id, xml_signed }

  if (!documents || !documents.length) {
    return res.status(400).json({ message: "Données de signature manquantes" });
  }

  try {
    for (const doc of documents) {
      await db.promise().query(
        "UPDATE transaction_documents SET xml_signed = ?, statut = 'signée' WHERE id = ? AND transaction_id = ?",
        [cleanBase64(doc.xml_signed), doc.id, id],
      );
    }

    const [txRows] = await db
      .promise()
      .query("SELECT user_id, signataire_email FROM transactions WHERE id = ?", [id]);

    await db
      .promise()
      .query("UPDATE transactions SET statut = 'signée' WHERE id = ?", [id]);

    if (txRows.length > 0) {
      createNotification(
        txRows[0].user_id,
        "Nouveaux documents signés",
        `Le client ${txRows[0].signataire_email} a signé les documents de la transaction #${id}.`,
        "success",
      );

      // Start background TTN submission automatically
      processTTNSubmission(id, txRows[0].signataire_email);
    }

    res.json({ message: "Signatures enregistrées. Envoi TTN en cours." });
  } catch (err) {
    console.error("SUBMIT SIGNATURE ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  uploadPdf,
  createTransaction,
  listTransactions,
  getTransactionDetails,
  downloadDocument,
  downloadZip,
  getPublicTransaction,
  submitSignature,
};
