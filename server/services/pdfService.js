const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const QRCode = require("qrcode");

const safeJsonParse = (val) => {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
};

const resolveConfig = (config) => {
  if (!config) return null;

  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch {
      return null;
    }
  }

  return config.configuration || config;
};

const extractReferenceCEVFromXml = (xmlText) => {
  const m = String(xmlText || "").match(
    /<ReferenceCEV>([\s\S]*?)<\/ReferenceCEV>/i,
  );
  return m ? m[1].trim() : null; // base64 PNG
};

const extractReferenceTTNFromXml = (xmlText) => {
  const m = String(xmlText || "").match(
    /<ReferenceTTN[^>]*>([\s\S]*?)<\/ReferenceTTN>/i,
  );
  return m ? m[1].trim() : null;
};

// Génère un QR PNG base64 depuis une chaine (fallback)
const generateQrPngBase64 = async (text) => {
  const dataUrl = await QRCode.toDataURL(String(text || ""), {
    margin: 1,
    scale: 6,
  });
  // "data:image/png;base64,...."
  return dataUrl.split(",")[1];
};

const stampPdfWithTTN = async ({
  pdfB64,
  qrPngB64,
  ttnReference,
  qrConfig,
  refConfig,
}) => {
  const pdfBytes = Buffer.from(String(pdfB64), "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (!pages.length) throw new Error("PDF vide");

  const qrConf = resolveConfig(qrConfig) || {};
  const refConf = resolveConfig(refConfig) || {};

  const pageIndex = Math.max(
    0,
    (qrConf.qrPositionP || refConf.labelPositionP || 1) - 1,
  );

  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const { width, height } = page.getSize();

  // ================= QR =================
  if (qrPngB64) {
    const pngImage = await pdfDoc.embedPng(Buffer.from(qrPngB64, "base64"));

    const qrW = Number(qrConf.qrWidth || 120);
    const qrH = Number(qrConf.qrHeight || 120);

    // Frontend already converts to pdf-lib bottom-origin coordinates
    let x = Number(qrConf.qrPositionX || 0);
    let y = Number(qrConf.qrPositionY || 0);

    // Protection limites
    if (x + qrW > width) x = width - qrW - 5;
    if (x < 0) x = 5;
    if (y < 0) y = 5;
    if (y + qrH > height) y = height - qrH - 5;

    page.drawImage(pngImage, {
      x,
      y,
      width: qrW,
      height: qrH,
    });
  }

  // ================= REFERENCE =================
  if (ttnReference) {
    const labelText =
      (refConf.referenceText ||
        "Copie de la facture electronique enregistree aupres de TTN sous la reference unique n :") +
      " " +
      ttnReference;

    // Frontend already converts to pdf-lib bottom-origin coordinates
    let x = Number(refConf.labelPositionX || 0);
    let y = Number(refConf.labelPositionY || 0);

    if (x < 0) x = 5;
    if (y < 0) y = 5;

    page.drawText(labelText, {
      x,
      y,
      size: 9,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Number(refConf.labelWidth || 400),
    });
  }

  const outBytes = await pdfDoc.save();
  return Buffer.from(outBytes).toString("base64");
};

module.exports = {
  safeJsonParse,
  resolveConfig,
  extractReferenceCEVFromXml,
  extractReferenceTTNFromXml,
  generateQrPngBase64,
  stampPdfWithTTN
};
