const axios = require("axios");
const db = require("../db");
const { resolveConfig, extractReferenceCEVFromXml, generateQrPngBase64, stampPdfWithTTN } = require("./pdfService");
const { cleanBase64, decodeXmlB64 } = require("../utils/base64Utils");
const { createNotification } = require("./notificationService");
const { sendSignedPdfsToClient, sendRejectionEmailToClient } = require("./emailService");

// ==========================================================
//**TTN*================ */
const TTN_URL = "http://127.0.0.1:5001/ElfatouraServices/EfactService";

const TTN_LOGIN = "testuser";

const TTN_PASSWORD = "testpass";

const TTN_MATRICULE = "1234567ABC";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const extractSoapReturn = (xmlText) => {
  const match = String(xmlText || "").match(
    /<[^>]*return[^>]*>([\s\S]*?)<\/[^>]*return>/i,
  );
  return match ? match[1].trim() : null;
};

const extractSoapFault = (xmlText) => {
  const match = String(xmlText || "").match(
    /<[^>]*faultstring[^>]*>([\s\S]*?)<\/[^>]*faultstring>/i,
  );
  return match ? match[1].trim() : null;
};

const saveEfactTTN = async (xmlBase64) => {
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <saveEfact xmlns="http://services.elfatoura.tradenet.com.tn/">
      <login>${TTN_LOGIN}</login>
      <password>${TTN_PASSWORD}</password>
      <matricule>${TTN_MATRICULE}</matricule>
      <documentEfact>${cleanBase64(xmlBase64)}</documentEfact>
    </saveEfact>
  </soap:Body>
</soap:Envelope>`;

  const response = await axios.post(TTN_URL, soapBody, {
    timeout: 60000,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    validateStatus: () => true,
  });

  const raw = response.data;

  return {
    httpStatus: response.status,
    raw,
    returnText: extractSoapReturn(raw),
    fault: extractSoapFault(raw),
  };
};

const consultEfactTTN = async (idSaveEfact) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <consultEfact xmlns="http://services.elfatoura.tradenet.com.tn/">
      <login>${TTN_LOGIN}</login>
      <password>${TTN_PASSWORD}</password>
      <matricule>${TTN_MATRICULE}</matricule>
      <efactCriteria>
        <idSaveEfact>${idSaveEfact}</idSaveEfact>
      </efactCriteria>
    </consultEfact>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios.post(TTN_URL, soapBody, {
      timeout: 60000,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "",
      },
      validateStatus: () => true,
    });

    const raw = response.data;

    const xmlMatch = raw.match(
      /<[^>]*xmlContent[^>]*>([\s\S]*?)<\/[^>]*xmlContent>/i,
    );

    if (xmlMatch) {
      return xmlMatch[1].trim();
    }

    await sleep(3000);
  }

  throw new Error("TTN_CONSULT_FAILED");
};

/**
 * TÂCHE DE FOND : Envoi automatique TTN et tamponnage PDF
 */
const processTTNSubmission = async (
  transactionId,
  signedDocs,
  userId,
  clientEmail,
  originalQrConfig,
  originalRefConfig,
) => {
  console.log(
    `[TTN] Début de traitement en tâche de fond pour TX #${transactionId}`,
  );
  const qrConfig = resolveConfig(originalQrConfig);
  const refConfig = resolveConfig(originalRefConfig);

  try {
    for (const doc of signedDocs) {
      console.log(`[TTN] Traitement doc ${doc.id} (${doc.filename})`);

      try {
        // 📡 SAVE TTN
        const saveRes = await saveEfactTTN(doc.xml_signed);
        console.log(
          `[TTN] raw saveRes for doc ${doc.id}: HTTP ${saveRes.httpStatus}, RAW: ${saveRes.raw?.substring(0, 300)}...`,
        );
        console.log(
          `[TTN] returnText/fault for doc ${doc.id}: returnText: ${saveRes.returnText}, fault: ${saveRes.fault}`,
        );

        const idMatch = saveRes.returnText?.match(/idSaveEfact=(\d+)/i);
        const refMatch = saveRes.returnText?.match(
          /Reference TTN=([A-Z0-9]+)/i,
        );

        const idSaveEfact = idMatch ? idMatch[1] : null;
        const referenceTTN = refMatch ? refMatch[1] : null;

        if (!idSaveEfact) {
          throw new Error(
            `TTN_ID_NOT_FOUND (returnText was: ${saveRes.returnText})`,
          );
        }

        // 🔁 CONSULT TTN
        console.log(`[TTN] Consultation TTN avec idSaveEfact: ${idSaveEfact}`);
        const xmlSignedTTN = await consultEfactTTN(idSaveEfact);
        const xmlDecoded = decodeXmlB64(xmlSignedTTN);

        let qrPngB64 = extractReferenceCEVFromXml(xmlDecoded);
        if (!qrPngB64 && referenceTTN)
          qrPngB64 = await generateQrPngBase64(referenceTTN);

        // 🏷 STAMP PDF
        const pdfStampedB64 = await stampPdfWithTTN({
          pdfB64: doc.pdf_file,
          qrPngB64,
          ttnReference: referenceTTN,
          qrConfig,
          refConfig,
        });

        // 💾 UPDATE DOCUMENT to 'signée_ttn'
        await db.promise().query(
          `
          UPDATE transaction_documents
          SET statut='signée_ttn',
              xml_signed_ttn=?,
              ttn_reference=?,
              ttn_id_save=?,
              pdf_file=?,
              signed_ttn_at=NOW()
          WHERE id=?
          `,
          [xmlSignedTTN, referenceTTN, idSaveEfact, pdfStampedB64, doc.id],
        );
        console.log(
          `[TTN] Document ${doc.id} terminé avec succès (signée_ttn)`,
        );
      } catch (ttnErr) {
        console.error(`[TTN] Document ${doc.id} ÉCHEC:`, ttnErr.message);
        // 💾 UPDATE DOCUMENT to 'refusée par TTN'
        await db
          .promise()
          .query(
            "UPDATE transaction_documents SET statut='refusée par TTN' WHERE id=?",
            [doc.id],
          );
      }
    }

    // 🔄 UPDATE TRANSACTION status based on documents
    const [finalDocs] = await db
      .promise()
      .query(
        "SELECT statut FROM transaction_documents WHERE transaction_id = ?",
        [transactionId],
      );

    let finalTxStatut = "signée_ttn";
    if (finalDocs.some((d) => d.statut === "refusée par TTN")) {
      finalTxStatut = "refusée par TTN";
    }

    await db
      .promise()
      .query("UPDATE transactions SET statut=? WHERE id=?", [
        finalTxStatut,
        transactionId,
      ]);

    // Notifications
    if (finalTxStatut === "signée_ttn") {
      await createNotification(
        userId,
        "Transaction signée TTN",
        `La transaction #${transactionId} a été signée avec succès par TTN`,
        "success",
      );
      // 📧 ENVOI EMAIL CLIENT
      const [signedDocsForEmail] = await db
        .promise()
        .query(
          "SELECT filename, pdf_file FROM transaction_documents WHERE transaction_id = ? AND statut = 'signée_ttn'",
          [transactionId],
        );
      if (clientEmail && signedDocsForEmail.length) {
        await sendSignedPdfsToClient(
          clientEmail,
          transactionId,
          signedDocsForEmail,
        );
      }
    } else {
      await createNotification(
        userId,
        "Transaction refusée par TTN",
        `La transaction #${transactionId} a été refusée par les services TTN`,
        "error",
      );
      // 📧 ENVOI EMAIL REFUS CLIENT
      if (clientEmail) {
        await sendRejectionEmailToClient(clientEmail, transactionId);
      }
    }
  } catch (globalErr) {
    console.error(
      `[TTN] Global background error for TX #${transactionId}:`,
      globalErr,
    );
  }
};

/* ===================== STATISTIQUES ===================== */
/* ===================== STATISTIQUE USER ===================== */
/* ===================== RESEND TO TTN (Universal Route) ===================== */
// Supports:
// POST /api/resend-ttn (body: {transaction_id})
// POST /api/transactions/:id/resend-ttn
// POST /api/admin/transactions/:id/resend-ttn
const handleResendTTNCore = async (req, res) => {
  const transaction_id = req.params.id || req.body.transaction_id;

  if (!transaction_id)
    return res.status(400).json({ message: "ID transaction requis" });

  try {
    const [txRows] = await db
      .promise()
      .query(
        "SELECT id, user_id, client_email, qr_config, ref_config FROM transactions WHERE id = ?",
        [transaction_id],
      );

    if (!txRows.length)
      return res.status(404).json({ message: "Transaction non trouvée" });

    const tx = txRows[0];

    // Vérifier si l'utilisateur est propriétaire ou admin
    if (req.user.role !== "ADMIN" && tx.user_id !== req.user.id) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    // Récupérer les documents refusés OU signés (si on veut tout renvoyer)
    // Mais ici le besoin est spécifiquement pour les refusés par default
    const [docs] = await db
      .promise()
      .query(
        "SELECT * FROM transaction_documents WHERE transaction_id = ? AND (statut = 'refusée par TTN' OR statut = 'signée')",
        [transaction_id],
      );

    if (!docs.length) {
      return res.status(400).json({
        message:
          "La transaction n'est pas dans un état permettant le renvoi (doit être Signée ou Refusée par TTN)",
      });
    }

    // Réinitialiser le statut de la transaction
    await db
      .promise()
      .query("UPDATE transactions SET statut = 'en attente TTN' WHERE id = ?", [
        transaction_id,
      ]);

    // Réinitialiser le statut des documents pour qu'ils soient retraités
    await db
      .promise()
      .query(
        "UPDATE transaction_documents SET statut = 'signée' WHERE transaction_id = ? AND (statut = 'refusée par TTN' OR statut = 'signée')",
        [transaction_id],
      );

    // Lancer le traitement en tâche de fond
    processTTNSubmission(
      tx.id,
      docs,
      tx.user_id,
      tx.client_email,
      tx.qr_config,
      tx.ref_config,
    );

    res.json({ message: "La transaction a été relancée vers TTN" });
  } catch (err) {
    console.error("RESEND TTN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  TTN_URL,
  TTN_LOGIN,
  TTN_PASSWORD,
  TTN_MATRICULE,
  sleep,
  extractSoapReturn,
  extractSoapFault,
  saveEfactTTN,
  consultEfactTTN,
  processTTNSubmission,
  handleResendTTNCore
};
