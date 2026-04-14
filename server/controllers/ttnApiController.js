const db = require("../db");
const { sendSignatureEmail } = require("../services/emailService");
const { cleanBase64, ensureBase64String } = require("../utils/helpers");

/**
 * 1. Create Advanced Transaction via API
 */
const createAdvancedTransaction = async (req, res) => {
  try {
    const { signer_email, clientEmail, invoices } = req.body;

    const [updateToken] = await db
      .promise()
      .query(
        "UPDATE users SET total_jetons = total_jetons - 1 WHERE id = ? AND total_jetons > 0",
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

    const firstInvoiceNumber = String(invoices[0]?.invoiceNumber || "").trim();

    const [txRes] = await db
      .promise()
      .query(
        `INSERT INTO transactions (facture_number, signataire_email, client_email, user_id, statut) 
         VALUES (?, ?, ?, ?, 'créé')`,
        [firstInvoiceNumber, signer_email, clientEmail || "", req.apiUser.id],
      );

    const transactionId = txRes.insertId;
    const createdInvoices = [];

    for (const inv of invoices) {
      const invoiceNumber = String(inv?.invoiceNumber || "").trim();
      const pdfB64 = String(inv?.invoiceFileB64 || "").trim();
      const xmlB64 = ensureBase64String(inv?.invoiceTIEF);

      const filename = invoiceNumber.toLowerCase().replace(/[^\w\-]+/g, "_").slice(0, 120);

      const [docRes] = await db.promise().query(
        `INSERT INTO transaction_documents (transaction_id, filename, invoice_number, pdf_file, xml_file, statut) 
         VALUES (?, ?, ?, ?, ?, 'créé')`,
        [transactionId, filename, invoiceNumber, pdfB64, xmlB64],
      );

      createdInvoices.push({
        status: "CREATED",
        uuid: String(docRes.insertId),
        invoiceNumber,
        invoiceDate: new Date().toISOString(),
        withPDF: !!pdfB64,
      });
    }

    await sendSignatureEmail(signer_email, transactionId);

    res.json({
      object: {
        uuid: String(transactionId),
        status: "CREATED",
        invoices: createdInvoices,
        creationDate: new Date().toISOString(),
      },
      errorCode: 0,
    });
  } catch (error) {
    console.error("API ADVANCED TX ERROR:", error);
    res.status(500).json({ errorCode: 1, message: "Erreur serveur" });
  }
};

/**
 * 2. Check Invoice Status via API
 */
const checkInvoiceStatus = async (req, res) => {
  try {
    const docId = req.params.invoice_uid;
    const [docs] = await db.promise().query(
      `SELECT d.id, d.statut, d.invoice_number, d.pdf_file, t.user_id 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?`,
      [docId, req.apiUser.id],
    );

    if (!docs.length)
      return res.status(404).json({ errorCode: 1, message: "Invoice not found" });

    const doc = docs[0];
    res.json({
      object: {
        status: doc.statut === "signée_ttn" ? "TTN_SIGNED" : doc.statut === "signée" ? "SIGNED" : "CREATED",
        uuid: String(doc.id),
        ttnReference: "REF-TTN-" + doc.id,
        invoiceNumber: doc.invoice_number,
        twoDocImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", 
        withPDF: !!doc.pdf_file,
      },
      errorCode: 0,
    });
  } catch (e) {
    res.status(500).json({ errorCode: 1 });
  }
};

/**
 * 3. Get Transaction Details (Anonymous access potentially allowed)
 */
const getTransactionDetailApi = async (req, res) => {
  try {
    const txId = req.params.transaction_uid;
    const [txs] = await db.promise().query("SELECT id, statut, date_creation FROM transactions WHERE id = ?", [txId]);
    if (!txs.length) return res.status(404).json({ errorCode: 1, message: "Not found" });

    const [docs] = await db.promise().query("SELECT id, statut, invoice_number FROM transaction_documents WHERE transaction_id = ?", [txId]);

    const invoices = docs.map((d) => ({
      status: d.statut === "signée_ttn" ? "TTN_SIGNED" : d.statut === "signée" ? "SIGNED" : "CREATED",
      uuid: String(d.id),
      invoiceNumber: d.invoice_number,
      ttnReference: "REF-TTN-" + d.id,
      twoDocImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    }));

    res.json({
      object: {
        uuid: String(txs[0].id),
        status: txs[0].statut === "signée_ttn" ? "TTN_SIGNED" : txs[0].statut === "signée" ? "SIGNED" : "CREATED",
        invoices,
        creationDate: txs[0].date_creation,
      },
      errorCode: 0,
    });
  } catch (e) {
    res.status(500).json({ errorCode: 1 });
  }
};

/**
 * 4. Download PDF via API
 */
const downloadPdfApi = async (req, res) => {
  try {
    const docId = req.params.invoice_uid;
    const [docs] = await db.promise().query(
      `SELECT d.pdf_file FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?`,
      [docId, req.apiUser.id],
    );

    if (!docs.length) return res.status(404).json({ errorCode: 1 });
    res.json({ object: docs[0].pdf_file, errorCode: 0 });
  } catch (e) {
    res.status(500).json({ errorCode: 1 });
  }
};

/**
 * 5. Download XML via API
 */
const downloadXmlApi = async (req, res) => {
  try {
    const docId = req.params.invoice_uid;
    const [docs] = await db.promise().query(
      `SELECT d.xml_file, d.xml_signed, d.xml_signed_ttn, d.statut 
       FROM transaction_documents d 
       JOIN transactions t ON t.id = d.transaction_id 
       WHERE d.id = ? AND t.user_id = ?`,
      [docId, req.apiUser.id],
    );

    if (!docs.length) return res.status(404).json({ errorCode: 1 });
    const doc = docs[0];
    let xml = doc.xml_file;
    if (doc.statut === "signée_ttn") xml = doc.xml_signed_ttn;
    else if (doc.xml_signed) xml = doc.xml_signed;

    res.json({ object: xml, errorCode: 0 });
  } catch (e) {
    res.status(500).json({ errorCode: 1 });
  }
};

module.exports = {
  createAdvancedTransaction,
  checkInvoiceStatus,
  getTransactionDetailApi,
  downloadPdfApi,
  downloadXmlApi,
};
