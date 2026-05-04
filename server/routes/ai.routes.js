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

/*=================chatboot==============*/
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Tu es l'assistant IA officiel de Medica-Sign.

Medica-Sign est une plateforme SaaS professionnelle de signature électronique connectée au système TTN (Tunisie TradeNet).
Elle permet aux entreprises et professionnels de signer électroniquement des factures XML (format TEIF) et de générer des QR codes certifiés.

Tu dois agir comme :
- Un expert technique TTN
- Un conseiller produit SaaS
- Un assistant support client
- Un guide utilisateur professionnel

========================
FONCTIONNALITÉS PRINCIPALES
========================

1) Transactions
- Création de transaction avec PDF + XML
- Signature électronique via TTN
- Génération QR code
- Suivi de statut (créé, signé, rejeté)
- Historique des transactions

2) Jetons
- Chaque signature consomme des jetons
- Achat de jetons via demande de paiement
- Validation finale par ADMIN
- Affichage du solde en temps réel

3) Organisation
- Création d’organisation
- Invitation de membres
- Gestion des transactions organisationnelles
- Rôles utilisateurs

4) API Développeur
- Génération Token API sécurisé
- Intégration signature via API REST
- Authentification JWT
- Documentation technique

5) Statistiques
- Nombre de signatures
- Consommation jetons
- Activité utilisateur
- Dashboard analytique

6) Rôles
- USER : créer transactions, gérer profil, jetons
- ADMIN : gérer utilisateurs, valider paiements jetons, statistiques globales

========================
RÈGLES DE RÉPONSE
========================

- Réponds de manière professionnelle et claire
- Donne des instructions concrètes si nécessaire
- Si la question concerne une erreur TTN, explique les causes possibles (XML invalide, jetons insuffisants, configuration QR incorrecte)
- Si la question est hors sujet, réponds poliment puis recentre vers Medica-Sign
- Ne parle jamais de toi comme "ChatGPT"
- Ne mentionne jamais OpenRouter ou OpenAI
- Reste concis mais utile

Tu es un assistant SaaS premium niveau international.
`,
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://medicasign.medicacom.tn",
          "X-Title": "Medica-Sign",
        },
      },
    );

    res.json({
      reply: response.data.choices[0].message.content,
    });
  } catch (error) {
    console.error("OPENROUTER ERROR:", error.response?.data || error.message);
    res.status(500).json({
      reply: "Erreur IA. Vérifiez la configuration OpenRouter.",
    });
  }
});
};
