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

/* =========================================================
   NEW INVOICE & TRANSACTION MANAGEMENT API (TTN STANDARD)
========================================================= */

// 1. Create Advanced Transaction
app.post(
  "/protected/invoice/xml/transaction/advanced",
  verifyApiToken,
  async (req, res) => {
    try {
      const { signer_email, clientEmail, invoices } = req.body;

      // Check tokens
      const [updateToken] = await db
        .promise()
        .query(
          `UPDATE users SET total_jetons = total_jetons - 1 WHERE id = ? AND total_jetons > 0`,
          [req.apiUser.id],
        );

      if (!updateToken.affectedRows) {
        return res.status(402).json({
          object: null,
          errorCode: 1,
          message: "Jetons insuffisants",
        });
      }

      if (!signer_email || !invoices || !invoices.length) {
        return res.status(400).json({
          errorCode: 1,
          message: "signer_email constraints and invoices required.",
        });
      }

      const firstInvoiceNumber = String(
        invoices[0]?.invoiceNumber || "",
      ).trim();

      const [txRes] = await db
        .promise()
        .query(
          `INSERT INTO transactions (facture_number, signataire_email, client_email, user_id, statut) VALUES (?, ?, ?, ?, 'créé')`,
          [firstInvoiceNumber, signer_email, clientEmail || "", req.apiUser.id],
        );

      const transactionId = txRes.insertId;
      const createdInvoices = [];

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const invoiceNumber = String(inv?.invoiceNumber || "").trim();
        const pdfB64 = String(inv?.invoiceFileB64 || "").trim();
        const xmlB64 = ensureBase64String(inv?.invoiceTIEF);

        const filename = invoiceNumber
          .toLowerCase()
          .replace(/[^\w\-]+/g, "_")
          .slice(0, 120);

        const [docRes] = await db
          .promise()
          .query(
            `INSERT INTO transaction_documents (transaction_id, filename, invoice_number, pdf_file, xml_file, statut) VALUES (?, ?, ?, ?, ?, 'créé')`,
            [transactionId, filename, invoiceNumber, pdfB64, xmlB64],
          );

        createdInvoices.push({
          status: "CREATED",
          uuid: String(docRes.insertId),
          invoiceNumber: invoiceNumber,
          invoiceDate: new Date().toISOString(),
          withPDF: !!pdfB64,
        });
      }

      // Send signature email
      await sendSignatureEmail(signer_email, transactionId);

      res.status(200).json({
        object: {
          uuid: String(transactionId),
          status: "CREATED",
          invoices: createdInvoices,
          creationDate: new Date().toISOString(),
        },
        errorCode: 0,
      });
    } catch (error) {
      console.error("ADVANCED TX ERROR:", error);
      res.status(500).json({ errorCode: 1, message: "Erreur serveur" });
    }
  },
);

// 2. Check Invoice Status
app.post(
  "/protected/invoice/xml/check/:invoice_uid",
  verifyApiToken,
  async (req, res) => {
    try {
      const docId = req.params.invoice_uid;
      // Verify ownership via transaction
      const [docs] = await db.promise().query(
        `
       SELECT d.id, d.statut, d.invoice_number, d.pdf_file, t.user_id 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?
     `,
        [docId, req.apiUser.id],
      );

      if (!docs.length)
        return res.status(404).json({
          errorCode: 1,
          message: "Invoice not found or access denied",
        });

      const doc = docs[0];

      res.status(200).json({
        object: {
          status:
            doc.statut === "signée_ttn"
              ? "TTN_SIGNED"
              : doc.statut === "signée"
                ? "SIGNED"
                : "CREATED",
          uuid: String(doc.id),
          ttnReference: "REF-TTN-" + doc.id,
          invoiceNumber: doc.invoice_number,
          twoDocImage:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // Mocked 1x1 transparent PNG Base64 for seal
          withPDF: !!doc.pdf_file,
        },
        errorCode: 0,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ errorCode: 1 });
    }
  },
);

// 4. Download Invoice PDF
app.get(
  "/protected/invoice/xml/pdf/:invoice_uid",
  verifyApiToken,
  async (req, res) => {
    try {
      const docId = req.params.invoice_uid;
      const [docs] = await db.promise().query(
        `
       SELECT d.pdf_file 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?
     `,
        [docId, req.apiUser.id],
      );

      if (!docs.length)
        return res.status(404).json({
          errorCode: 1,
          message: "Invoice not found or access denied",
        });

      res.status(200).json({
        object: docs[0].pdf_file,
        errorCode: 0,
      });
    } catch (e) {
      res.status(500).json({ errorCode: 1 });
    }
  },
);

// 5. Download Invoice XML
app.get(
  "/protected/invoice/xml/xml/:invoice_uid",
  verifyApiToken,
  async (req, res) => {
    try {
      const docId = req.params.invoice_uid;
      const [docs] = await db.promise().query(
        `
       SELECT d.xml_file, d.xml_signed, d.xml_signed_ttn, d.statut 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?
     `,
        [docId, req.apiUser.id],
      );

      if (!docs.length)
        return res.status(404).json({
          errorCode: 1,
          message: "Invoice not found or access denied",
        });

      const doc = docs[0];
      let xml = doc.xml_file;
      if (doc.statut === "signée_ttn" && doc.xml_signed_ttn)
        xml = doc.xml_signed_ttn;
      else if (
        (doc.statut === "signée" || doc.statut === "refusée par TTN") &&
        doc.xml_signed
      )
        xml = doc.xml_signed;

      res.status(200).json({
        object: xml,
        errorCode: 0,
      });
    } catch (e) {
      res.status(500).json({ errorCode: 1 });
    }
  },
);
};
