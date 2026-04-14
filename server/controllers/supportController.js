const axios = require("axios");
const db = require("../db");
const { createNotification } = require("../services/notificationService");
const { sendSupportEmail } = require("../services/emailService");
const { sanitizeEmailHtml } = require("../utils/helpers");

/**
 * AI Chatbot
 */
const chat = async (req, res) => {
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
          { role: "user", content: message },
        ],
        temperature: 0.4,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://51.178.39.67",
          "X-Title": "Medica-Sign",
        },
      },
    );

    res.json({ reply: response.data.choices[0].message.content });
  } catch (error) {
    console.error("OPENROUTER ERROR:", error.response?.data || error.message);
    res.status(500).json({ reply: "Erreur IA. Vérifiez la configuration OpenRouter." });
  }
};

/**
 * Contact support
 */
const contactSupport = async (req, res) => {
  try {
    const SUPPORT_EMAIL = "kobbi.moetez@medicacom.tn";
    const { type, message } = req.body;

    const cleanType = String(type || "").trim().toLowerCase();
    const cleanMessage = String(message || "").trim();

    const allowedTypes = ["signature", "facture", "compte", "facturation", "autre"];
    if (!allowedTypes.includes(cleanType)) return res.status(400).json({ message: "Type de demande invalide" });
    if (!cleanMessage || cleanMessage.length < 10) return res.status(400).json({ message: "Message trop court" });

    const [rows] = await db.promise().query("SELECT id, name, email, phone FROM users WHERE id = ?", [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: "Utilisateur introuvable" });

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
        <p><strong>Utilisateur:</strong> ${sanitizeEmailHtml(user.name || "—")}</p>
        <p><strong>Email:</strong> ${sanitizeEmailHtml(user.email || "—")}</p>
        <p><strong>Téléphone:</strong> ${sanitizeEmailHtml(user.phone || "—")}</p>
        <p><strong>User ID:</strong> ${user.id}</p>
        <hr />
        <h3>Message</h3>
        <pre style="white-space: pre-wrap; background:#f6f6f6; padding:12px; border-radius:8px;">${sanitizeEmailHtml(cleanMessage)}</pre>
        <p style="color:#666; font-size: 12px;">Envoyé depuis Medica-Sign.</p>
      </div>
    `;

    await sendSupportEmail({ to: SUPPORT_EMAIL, subject, html, replyTo: user.email });
    await createNotification(req.user.id, "Support", "Votre demande a été envoyée au support.", "success");

    return res.json({ message: "Demande envoyée au support avec succès." });
  } catch (err) {
    console.error("SUPPORT CONTACT ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  chat,
  contactSupport,
};
