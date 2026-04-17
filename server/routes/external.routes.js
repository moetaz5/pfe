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

/* ===================== EXTERNAL CREATE TRANSACTION ===================== */
/* ===================== EXTERNAL CREATE TRANSACTION (MULTIPART -> BASE64) ===================== */
/* ===================== EXTERNAL CREATE TRANSACTION (JSON MULTI) ===================== */
/*
POST /api/external/transactions
Authorization: Bearer <API_TOKEN>

Body example:
{
  "signer_email":"profiletestdigigo@yopmail.com",
  "clientEmail":"contact@ng-sign.com",
  "invoices":[
    {
      "invoiceNumber":"12345",
      "invoiceTIEF":"<TEIF>...</TEIF>" OR "BASE64....",
      "invoiceFileB64":"JVBERi0xLjQK..."  // PDF base64
    }
  ]
}
*/
app.post("/api/external/transactions", verifyApiToken, async (req, res) => {
  try {
    // 🔥 TOKEN SAFE
    const [updateToken] = await db.promise().query(
      `
  UPDATE users
  SET total_jetons = total_jetons - 1
  WHERE id = ? AND total_jetons > 0
  `,
      [req.apiUser.id],
    );

    if (!updateToken.affectedRows) {
      return res.status(402).json({
        message: "Jetons insuffisants",
      });
    }

    const { signer_email, clientEmail, invoices } = req.body;

    // ==============================
    // VALIDATION
    // ==============================
    if (!signer_email || !clientEmail) {
      return res
        .status(400)
        .json({ message: "Champs manquants: signer_email, clientEmail" });
    }

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ message: "invoices[] requis" });
    }

    // ==============================
    // CREER TRANSACTION (facture_number = 1er invoiceNumber)
    // ==============================
    const firstInvoiceNumber = String(invoices[0]?.invoiceNumber || "").trim();
    if (!firstInvoiceNumber) {
      return res.status(400).json({
        message: "invoiceNumber requis (au moins pour la 1ere facture)",
      });
    }

    const [txRes] = await db.promise().query(
      `
        INSERT INTO transactions
        (facture_number, signataire_email, client_email, user_id, statut)
        VALUES (?, ?, ?, ?, 'créé')
      `,
      [firstInvoiceNumber, signer_email, clientEmail, req.apiUser.id],
    );

    const transactionId = txRes.insertId;

    // ==============================
    // INSERER DOCUMENTS
    // ==============================
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];

      const invoiceNumber = String(inv?.invoiceNumber || "").trim();
      const pdfB64 = String(
        inv?.invoiceFileB64 || inv?.invoiceFileB64 || "",
      ).trim(); // accepte invoiceFileB64
      const xmlB64 = ensureBase64String(inv?.invoiceTIEF);

      if (!invoiceNumber || !pdfB64 || !xmlB64) {
        return res.status(400).json({
          message: `invoiceNumber, invoiceFileB64, invoiceTIEF requis (index ${i})`,
        });
      }

      // filename = invoiceNumber (safe)
      const filename = invoiceNumber
        .toLowerCase()
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 120);

      await db.promise().query(
        `
          INSERT INTO transaction_documents
          (transaction_id, filename, invoice_number, pdf_file, xml_file, statut)
          VALUES (?, ?, ?, ?, ?, 'créé')
        `,
        [transactionId, filename, invoiceNumber, pdfB64, xmlB64],
      );
    }

    // email signature
    await sendSignatureEmail(signer_email, transactionId);

    res.status(201).json({
      message: "Transaction créée via API (JSON)",
      transactionId,
      facture_number: firstInvoiceNumber,
      invoicesCount: invoices.length,
    });
  } catch (e) {
    console.error("EXTERNAL TX JSON ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ===================== EXTERNAL CREATE TRANSACTION (JSON BASE64) ===================== */
/*
POST /api/external/transactions/json
Headers:
  x-api-key: <TOKEN>

Body example:
{
  "facture_number":"TRX-1",
  "signer_email":"profiletestdigigo@yopmail.com",
  "clientEmail":"contact@ng-sign.com",
  "invoices":[
    {
      "invoiceNumber":"12345",
      "invoiceTIEF":"<TEIF>...</TEIF>" OR "BASE64....",
      "invoiceFileB64":"JVBERi0xLjQK..."
    }
  ]
}
*/
app.post(
  "/api/external/transactions/json",
  verifyApiToken,
  async (req, res) => {
    try {
      const { facture_number, signer_email, clientEmail, invoices } = req.body;

      if (!facture_number || !signer_email || !clientEmail)
        return res.status(400).json({ message: "Champs manquants" });

      if (!Array.isArray(invoices) || !invoices.length)
        return res.status(400).json({ message: "invoices[] requis" });

      const [txRes] = await db.promise().query(
        `
        INSERT INTO transactions
        (facture_number, signataire_email, client_email, user_id, statut)
        VALUES (?, ?, ?, ?, 'créé')
      `,
        [facture_number, signer_email, clientEmail, req.apiUser.id],
      );

      const transactionId = txRes.insertId;

      for (const inv of invoices) {
        const invoiceNumber = String(inv.invoiceNumber || "").trim();
        const pdfB64 = String(inv.invoiceFileB64 || "").trim();
        const xmlB64 = ensureBase64String(inv.invoiceTIEF);

        if (!invoiceNumber || !pdfB64 || !xmlB64)
          return res.status(400).json({
            message: "invoiceNumber, invoiceFileB64, invoiceTIEF requis",
          });

        const filename = invoiceNumber.toLowerCase();

        const invoiceUniqueNumber = `INV-${transactionId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        await db.promise().query(
          `
          INSERT INTO transaction_documents
          (transaction_id, filename, invoice_number, pdf_file, xml_file, statut)
          VALUES (?, ?, ?, ?, ?, 'créé')
        `,
          [transactionId, filename, invoiceUniqueNumber, pdfB64, xmlB64],
        );
      }

      res
        .status(201)
        .json({ message: "Transaction créée (JSON)", transactionId });
    } catch (e) {
      console.error("EXTERNAL JSON TX ERROR:", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  },
);

/* ===================== EXTERNAL DOWNLOAD ZIP (BASE64) ===================== */
app.get(
  "/api/external/transactions/:id/zip",
  verifyApiToken,
  async (req, res) => {
    const { id } = req.params;

    const [txRows] = await db
      .promise()
      .query("SELECT id FROM transactions WHERE id = ? AND user_id = ?", [
        id,
        req.apiUser.id,
      ]);

    if (!txRows.length)
      return res.status(404).json({ message: "Transaction introuvable" });

    // 🔥 IMPORTANT : AJOUT xml_signed_ttn
    const [docs] = await db.promise().query(
      `
    SELECT 
      filename, 
      pdf_file, 
      xml_file, 
      xml_signed, 
      xml_signed_ttn, 
      statut
    FROM transaction_documents
    WHERE transaction_id = ?
    `,
      [id],
    );

    const zip = new JSZip();

    docs.forEach((d) => {
      const pdfBuffer = Buffer.from(d.pdf_file, "base64");
      zip.file(`${d.filename}.pdf`, pdfBuffer);

      let xmlToUse;

      if (d.statut === "signée_ttn" && d.xml_signed_ttn) {
        xmlToUse = d.xml_signed_ttn;
        console.log("XML TTN utilisé:", d.filename);
      } else if (
        (d.statut === "signée" || d.statut === "refusée par TTN") &&
        d.xml_signed
      ) {
        xmlToUse = d.xml_signed;
      } else {
        xmlToUse = d.xml_file;
      }

      if (!xmlToUse) return;

      const xmlBuffer = Buffer.from(xmlToUse, "base64");
      zip.file(`${d.filename}.xml`, xmlBuffer);
    });

    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transaction_${id}.zip`,
    );

    res.send(content);
  },
);

/* ===================== EXTERNAL LIST FACTURES ===================== */
app.get("/api/external/factures", verifyApiToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
        SELECT 
          id,
          file_name,
          statut,
          date_facture
        FROM factures
        WHERE user_id = ?
        ORDER BY id DESC
        `,
      [req.apiUser.id],
    );

    res.json({
      total: rows.length,
      factures: rows,
    });
  } catch (err) {
    console.error("EXTERNAL LIST FACTURES ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
};
