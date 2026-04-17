
const cleanBase64 = (value) => String(value || "").replace(/\s+/g, "");

// xmlSignedTTN est base64 => decode en utf8
const decodeXmlB64 = (xmlB64) => {
  try {
    return Buffer.from(String(xmlB64 || ""), "base64").toString("utf8");
  } catch {
    return "";
  }
};

// ===================== BASE64 HELPERS =====================
const bufferToB64 = (buf) => {
  if (!buf) return null;
  if (Buffer.isBuffer(buf)) return buf.toString("base64");
  return null;
};

const b64ToBuffer = (b64) => {
  if (!b64) return null;
  return Buffer.from(String(b64), "base64");
};

// accepte: base64 direct OU xml string => on convertit en base64
const ensureBase64String = (value) => {
  if (!value) return null;
  const v = String(value);

  // Si ça ressemble à du XML, on encode en base64
  if (v.trim().startsWith("<")) {
    return Buffer.from(v, "utf8").toString("base64");
  }

  // Sinon on considère que c'est déjà base64
  return v;
};

module.exports = {
  bufferToB64,
  b64ToBuffer,
  ensureBase64String,
  cleanBase64,
  decodeXmlB64
};
