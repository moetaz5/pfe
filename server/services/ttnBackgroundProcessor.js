const db = require("../db");
const { saveEfactTTN } = require("./ttnService");
const { stampPdfWithTTN } = require("./pdfService");
const { createNotification } = require("./notificationService");
const {
  sendSignedPdfsToClient,
  sendRejectionEmailToClient,
} = require("./emailService");
const { sleep, safeJsonParse, cleanBase64 } = require("../utils/helpers");

/**
 * Processes a transaction by sending its documents to TTN
 */
const processTTNSubmission = async (transactionId, userEmail) => {
  try {
    // 1. Fetch transaction and documents
    const [txRows] = await db
      .promise()
      .query("SELECT * FROM transactions WHERE id = ?", [transactionId]);
    if (!txRows.length) return;
    const transaction = txRows[0];

    const [docs] = await db
      .promise()
      .query(
        "SELECT * FROM transaction_documents WHERE transaction_id = ? AND statut != 'signée_ttn'",
        [transactionId],
      );

    if (!docs.length) return;

    const qrConfig = safeJsonParse(transaction.qr_config);
    const refConfig = safeJsonParse(transaction.ref_config);
    const signaturesConfig = safeJsonParse(transaction.signatures_config);

    const processedDocs = [];
    let hasFailed = false;

    // 2. Loop through documents
    for (const doc of docs) {
      await db.promise().query(
        "UPDATE transaction_documents SET statut = 'en_cours_ttn' WHERE id = ?",
        [doc.id],
      );

      // Clean base64 and ensure config is present
      const xmlB64 = cleanBase64(doc.xml_signed || doc.xml_file);

      // Call TTN Service
      const ttnResult = await saveEfactTTN(xmlB64, transaction.signatures_config);

      if (ttnResult.success) {
        // Stamp PDF if it exists
        let finalPdf = doc.pdf_file;
        if (doc.pdf_file) {
          try {
            finalPdf = await stampPdfWithTTN({
              pdfB64: doc.pdf_file,
              qrPngB64: ttnResult.qrPngB64,
              ttnReference: ttnResult.referenceTTN,
              qrConfig,
              refConfig,
            });
          } catch (stampErr) {
            console.error("PDF STAMPING ERROR (DOC ID:", doc.id, "):", stampErr);
          }
        }

        // Update document
        await db.promise().query(
          `UPDATE transaction_documents 
           SET statut = 'signée_ttn', 
               xml_signed_ttn = ?, 
               pdf_file = ?, 
               ttn_reference = ? 
           WHERE id = ?`,
          [ttnResult.xmlSigned, finalPdf, ttnResult.referenceTTN, doc.id],
        );

        processedDocs.push({
          ...doc,
          pdf_file: finalPdf,
          ttn_reference: ttnResult.referenceTTN,
        });

        // Small delay to prevent rate issues
        await sleep(1000);
      } else {
        hasFailed = true;
        await db.promise().query(
          "UPDATE transaction_documents SET statut = 'refusée_ttn', error_message = ? WHERE id = ?",
          [ttnResult.error || "Erreur inconnue TTN", doc.id],
        );
      }
    }

    // 3. Update Transaction Status
    const finalStatus = hasFailed ? "partiel_ttn" : "signée_ttn";
    await db.promise().query(
      "UPDATE transactions SET statut = ? WHERE id = ?",
      [finalStatus, transactionId],
    );

    // 4. Notifications & Emails
    if (finalStatus === "signée_ttn") {
      await createNotification(
        transaction.user_id,
        "Transaction Terminée",
        `La transaction #${transactionId} est signée par TTN.`,
        "success",
      );

      if (transaction.client_email) {
        await sendSignedPdfsToClient(
          transaction.client_email,
          transactionId,
          processedDocs,
        );
      }
    } else {
      await createNotification(
        transaction.user_id,
        "Erreur TTN",
        `La transaction #${transactionId} a rencontré des erreurs TTN.`,
        "error",
      );

      if (transaction.client_email) {
        await sendRejectionEmailToClient(transaction.client_email, transactionId);
      }
    }
  } catch (err) {
    console.error("BACKGROUND TTN PROCESS ERROR:", err);
  }
};

module.exports = {
  processTTNSubmission,
};
