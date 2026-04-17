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

////Lister les docs d’une transaction (PUBLIC pour page signature)
app.get("/api/public/transactions/:id/docs", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.promise().query(
      `
      SELECT id, filename, statut
      FROM transaction_documents
      WHERE transaction_id = ?
      ORDER BY id ASC
      `,
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Transaction introuvable" });
    }

    res.json(rows);
  } catch (e) {
    console.error("PUBLIC DOCS ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

///////Afficher PDF d’un doc (PUBLIC)
app.get("/api/public/docs/:docId/pdf", async (req, res) => {
  const { docId } = req.params;

  try {
    const [rows] = await db
      .promise()
      .query(
        `SELECT pdf_file, filename FROM transaction_documents WHERE id = ?`,
        [docId],
      );

    if (!rows.length)
      return res.status(404).json({ message: "Doc non trouvé" });

    const pdfBuffer = Buffer.from(rows[0].pdf_file, "base64");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=${rows[0].filename}.pdf`,
    );
    res.send(pdfBuffer);
  } catch (e) {
    console.error("PUBLIC PDF ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// 📄 Affichage PDF pour le signataire (PUBLIC)
app.get("/api/public/transactions/:id/pdf", (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT pdf_file FROM transactions WHERE id = ?",
    [id],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ message: "Document non trouvé" });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=document.pdf");
      res.send(results[0].pdf_file);
    },
  );
});

// ✍️ Signature logique (SSCD - sans signature manuscrite)
// ✍️ Signature XML (publique)
// ✍️ Signature XML (publique)
// ✍️ ÉTAPE 1 : Préparer la signature (Vérifier jetons et envoyer les XML au frontend)
app.get("/api/public/transactions/:id/prepare-signature", async (req, res) => {
  const { id } = req.params;

  try {
    const [txRows] = await db
      .promise()
      .query("SELECT id, user_id, statut FROM transactions WHERE id = ?", [id]);

    if (!txRows.length)
      return res.status(404).json({ message: "Transaction introuvable" });
    const transaction = txRows[0];

    // Vérifier les jetons
    const [userRows] = await db
      .promise()
      .query("SELECT total_jetons FROM users WHERE id = ?", [
        transaction.user_id,
      ]);
    if (!userRows.length || userRows[0].total_jetons <= 0) {
      return res
        .status(402)
        .json({ message: "Jetons insuffisants pour signer" });
    }

    const [docs] = await db
      .promise()
      .query(
        "SELECT id, filename, xml_file FROM transaction_documents WHERE transaction_id = ?",
        [id],
      );

    const docsToSign = docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      xmlBase64: d.xml_file,
    }));

    res.json({ docsToSign });
  } catch (err) {
    console.error("PREPARE SIGNATURE ERROR:", err);
    res
      .status(500)
      .json({ message: "Erreur lors de la préparation de la signature" });
  }
});

// ✍️ ÉTAPE 2 : Finaliser la signature (Recevoir les XML signés du local et enregistrer)
app.post(
  "/api/public/transactions/:id/finalize-signature",
  async (req, res) => {
    const { id } = req.params;
    const { signedResults } = req.body; // Array de {id: docId, xmlSigned: base64}

    if (!signedResults || !signedResults.length) {
      return res.status(400).json({ message: "Données signées manquantes" });
    }

    try {
      const [txRows] = await db
        .promise()
        .query(
          "SELECT id, user_id, qr_config, ref_config, client_email FROM transactions WHERE id = ?",
          [id],
        );
      const transaction = txRows[0];

      // Déduire 1 jeton
      const [tokenUpdate] = await db
        .promise()
        .query(
          "UPDATE users SET total_jetons = total_jetons - 1 WHERE id = ? AND total_jetons > 0",
          [transaction.user_id],
        );

      if (!tokenUpdate.affectedRows) {
        return res.status(402).json({
          message: "Erreur jeton (insuffisant ou utilisateur non trouvé)",
        });
      }

      const finalDocs = [];

      // Enregistrer chaque document signé
      for (const result of signedResults) {
        const [docRows] = await db
          .promise()
          .query(
            "SELECT filename, pdf_file FROM transaction_documents WHERE id = ?",
            [result.id],
          );
        const doc = docRows[0];

        await db
          .promise()
          .query(
            "UPDATE transaction_documents SET statut='signée', xml_signed=?, signed_at=NOW() WHERE id=?",
            [result.xmlSigned, result.id],
          );

        finalDocs.push({
          id: result.id,
          filename: doc.filename,
          pdf_file: doc.pdf_file,
          xml_signed: result.xmlSigned,
        });
      }

      // Update statut transaction
      await db
        .promise()
        .query(
          "UPDATE transactions SET statut='signée', signed_at=NOW() WHERE id=?",
          [id],
        );

      res.json({
        success: true,
        message: "Signature enregistrée avec succès.",
      });

      // Lancer TTN en arrière-plan
      processTTNSubmission(
        id,
        finalDocs,
        transaction.user_id,
        transaction.client_email,
        transaction.qr_config,
        transaction.ref_config,
      ).catch((e) => console.error("TTN BACKGROUND ERROR:", e));
    } catch (err) {
      console.error("FINALIZE SIGNATURE ERROR:", err);
      res
        .status(500)
        .json({ message: "Erreur serveur lors de la finalisation" });
    }
  },
);

// 🔐 Vérification du PIN (sans signer)
app.post("/api/public/transactions/:id/check-pin", async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ message: "PIN requis" });
  }

  try {
    await axios.post(
      "http://127.0.0.1:9000/sign/xml",
      {
        pin,
        checkOnly: true,
      },
      { headers: { "Content-Type": "application/json" } },
    );

    res.json({ valid: true });
  } catch (e) {
    if (e.response?.status === 401) {
      return res.status(401).json({ valid: false });
    }
    res.status(500).json({ message: "Erreur moteur signature" });
  }
});
};
