const nodemailer = require("nodemailer");
require("dotenv").config();

/* ===================== EMAIL SIGNATURE ===================== */
const sendSignatureEmail = async (
  email,
  transactionId,
  host = "medicasign.medicacom.tn",
) => {
  const link = `https://${host}/signature/${transactionId}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Signature de facture requise",
    html: `
      <h2>Signature requise</h2>
      <p>Veuillez signer le document en cliquant sur le bouton ci-dessous :</p>

      <a href="${link}"
         style="
           display:inline-block;
           padding:12px 20px;
           background:#0247AA;
           color:#fff;
           text-decoration:none;
           border-radius:6px;
         ">
        Signer le document
      </a>

      <p>Ou copiez ce lien :</p>
      <p>${link}</p>
    `,
  });
};

/* ===================== EMAIL CLIENT PDF ===================== */
const sendSignedPdfsToClient = async (clientEmail, transactionId, docs) => {
  try {
    const attachments = docs.map((doc) => ({
      filename: `${doc.filename}.pdf`,
      content: Buffer.from(doc.pdf_file, "base64"),
      contentType: "application/pdf",
    }));

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: clientEmail,
      subject: `Facture(s) signée(s) - Transaction #${transactionId}`,
      html: `
        <h2>Vos factures ont été signées avec succès</h2>
        <p>La transaction <strong>#${transactionId}</strong> a été validée par TTN.</p>
        <p>Vous trouverez les factures signées en pièces jointes.</p>
        <br/>
        <p>Cordialement,<br/>Equipe Signature</p>
      `,
      attachments,
    });

    console.log("📧 PDF envoyés au client:", clientEmail);
  } catch (err) {
    console.error("SEND CLIENT PDF ERROR:", err);
  }
};

/* ===================== EMAIL REFUS CLIENT ===================== */
const sendRejectionEmailToClient = async (clientEmail, transactionId) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: clientEmail,
      subject: `Transaction Refusée - #${transactionId}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #d32f2f;">Transaction Refusée</h2>
          <p>Bonjour,</p>
          <p>Nous vous informons que votre transaction <strong>#${transactionId}</strong> a été refusée par les services officiels du réseau TTN.</p>
          <p>Cela peut être dû à un problème de format de fichier ou à une erreur de validation externe.</p>
          <p>Veuillez contacter notre support ou vérifier vos documents avant de tenter un nouvel envoi.</p>
          <br/>
          <p>Cordialement,<br/>L'équipe Medica-Sign</p>
        </div>
      `,
    });
    console.log("📧 Email de refus envoyé au client:", clientEmail);
  } catch (err) {
    console.error("SEND REJECTION EMAIL ERROR:", err);
  }
};

/* ===================== EMAIL TRANSPORT ===================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (toEmail, code) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "Code de confirmation",
    html: `
      <h2>Confirmation Email</h2>
      <p>Voici votre code :</p>
      <h1 style="letter-spacing:3px;">${code}</h1>
      <p>Ce code expire dans 10 minutes.</p>
    `,
  });
};

/* ===================== EMAIL confirm jeton ===================== */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (value) =>
  EMAIL_REGEX.test(
    String(value || "")
      .trim()
      .toLowerCase(),
  );

const sanitizeEmailHtml = (value) => String(value || "").replace(/</g, "&lt;");

const sendTokenRequestPaymentPendingEmail = async ({
  toEmail,
  packName,
  tokens,
  priceTnd,
  adminNote,
}) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "Demande jetons: premiere confirmation",
    html: `
      <h2>Votre demande de jetons est validee (etape 1)</h2>
      <p>Merci. Votre demande a passe la premiere confirmation admin.</p>
      <p><strong>Pack:</strong> ${packName}</p>
      <p><strong>Jetons:</strong> ${tokens}</p>
      <p><strong>Prix:</strong> ${priceTnd} TND</p>
      <p>Veuillez envoyer la preuve de virement (PDF/image) depuis votre espace client pour passer a la confirmation finale.</p>
      ${
        adminNote
          ? `<p><strong>Note admin:</strong> ${sanitizeEmailHtml(adminNote)}</p>`
          : ""
      }
    `,
  });
};

const sendTokenRequestDecisionEmail = async ({
  toEmail,
  packName,
  tokens,
  priceTnd,
  decision,
  adminNote,
}) => {
  const isApproved = decision === "approved";
  const decisionLabel = isApproved ? "confirmee" : "refusee";
  const color = isApproved ? "#166534" : "#991b1b";

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: `Demande jetons ${decisionLabel}`,
    html: `
      <h2>Decision sur votre demande de jetons</h2>
      <p>Votre demande a ete <strong style="color:${color};">${decisionLabel}</strong>.</p>
      <p><strong>Pack:</strong> ${packName}</p>
      <p><strong>Jetons:</strong> ${tokens}</p>
      <p><strong>Prix:</strong> ${priceTnd} TND</p>
      ${
        adminNote
          ? `<p><strong>Note admin:</strong> ${sanitizeEmailHtml(adminNote)}</p>`
          : ""
      }
    `,
  });
};

module.exports = {
  transporter,
  sendSignatureEmail,
  sendSignedPdfsToClient,
  sendRejectionEmailToClient,
  sendVerificationEmail,
  EMAIL_REGEX,
  isValidEmail,
  sanitizeEmailHtml,
  sendTokenRequestPaymentPendingEmail,
  sendTokenRequestDecisionEmail
};
