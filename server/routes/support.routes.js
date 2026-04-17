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

/* ===================== SUPPORT CONTACT ===================== */
/*
POST /api/support/contact
Body: { type: "signature|facture|compte|facturation|autre", message: "..." }
Envoie email vers: amri.aymen@medicacom.tn
*/

app.post("/api/support/contact", verifyToken, async (req, res) => {
  try {
    const SUPPORT_EMAIL = "kobbi.moetez@medicacom.tn";

    const { type, message } = req.body;

    const cleanType = String(type || "")
      .trim()
      .toLowerCase();
    const cleanMessage = String(message || "").trim();

    const allowedTypes = [
      "signature",
      "facture",
      "compte",
      "facturation",
      "autre",
    ];
    if (!allowedTypes.includes(cleanType)) {
      return res.status(400).json({ message: "Type de demande invalide" });
    }
    if (!cleanMessage || cleanMessage.length < 10) {
      return res.status(400).json({ message: "Message trop court" });
    }

    // 🔎 Récupérer info user
    const [rows] = await db
      .promise()
      .query("SELECT id, name, email, phone FROM users WHERE id = ?", [
        req.user.id,
      ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const user = rows[0];
    const typeLabelMap = {
      signature: "Vérification de signature",
      facture: "Dépôt de facture",
      compte: "Accès au compte",
      facturation: "Facturation",
      autre: "Autre",
    };

    const subject = `[Support Medica-Sign] ${typeLabelMap[cleanType]} - ${user.email} (ID:${user.id})`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Nouvelle demande support</h2>

        <p><strong>Type:</strong> ${typeLabelMap[cleanType]}</p>
        <p><strong>Utilisateur:</strong> ${String(user.name || "—").replace(/</g, "&lt;")}</p>
        <p><strong>Email:</strong> ${String(user.email || "—").replace(/</g, "&lt;")}</p>
        <p><strong>Téléphone:</strong> ${String(user.phone || "—").replace(/</g, "&lt;")}</p>
        <p><strong>User ID:</strong> ${user.id}</p>

        <hr />
        <h3>Message</h3>
        <pre style="white-space: pre-wrap; background:#f6f6f6; padding:12px; border-radius:8px;">${cleanMessage
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre>

        <p style="color:#666; font-size: 12px;">
          Envoyé depuis Medica-Sign.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: SUPPORT_EMAIL,
      subject,
      html,
      replyTo: user.email, // 🔥 très utile: le support répond directement au client
    });

    // Optionnel: notification interne
    await createNotification(
      req.user.id,
      "Support",
      "Votre demande a été envoyée au support.",
      "success",
    );

    return res.json({ message: "Demande envoyée au support avec succès." });
  } catch (err) {
    console.error("SUPPORT CONTACT ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});
};
