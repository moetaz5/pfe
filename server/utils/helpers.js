const crypto = require("crypto");

/**
 * Wait for a given number of milliseconds
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Clean Base64 string from whitespace
 */
const cleanBase64 = (value) => String(value || "").replace(/\s+/g, "");

/**
 * Extract return value from SOAP XML
 */
const extractSoapReturn = (xmlText) => {
  const match = String(xmlText || "").match(
    /<[^>]*return[^>]*>([\s\S]*?)<\/[^>]*return>/i,
  );
  return match ? match[1].trim() : null;
};

/**
 * Extract fault string from SOAP XML
 */
const extractSoapFault = (xmlText) => {
  const match = String(xmlText || "").match(
    /<[^>]*faultstring[^>]*>([\s\S]*?)<\/[^>]*faultstring>/i,
  );
  return match ? match[1].trim() : null;
};

/**
 * Decodes Base64 string to UTF-8 XML text
 */
const decodeXmlB64 = (xmlB64) => {
  try {
    return Buffer.from(String(xmlB64 || ""), "base64").toString("utf-8");
  } catch {
    return "";
  }
};

/**
 * Extracts ReferenceCEV (Base64 PNG) from XML
 */
const extractReferenceCEVFromXml = (xmlText) => {
  const m = String(xmlText || "").match(
    /<ReferenceCEV>([\s\S]*?)<\/ReferenceCEV>/i,
  );
  return m ? m[1].trim() : null;
};

/**
 * Extracts ReferenceTTN from XML
 */
const extractReferenceTTNFromXml = (xmlText) => {
  const m = String(xmlText || "").match(
    /<ReferenceTTN[^>]*>([\s\S]*?)<\/ReferenceTTN>/i,
  );
  return m ? m[1].trim() : null;
};

/**
 * Safely parse JSON
 */
const safeJsonParse = (val) => {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
};

/**
 * Resolves configuration object from JSON or nested structure
 */
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

/**
 * Converts Buffer to Base64
 */
const bufferToB64 = (buf) => {
  if (!buf) return null;
  if (Buffer.isBuffer(buf)) return buf.toString("base64");
  return null;
};

/**
 * Converts Base64 to Buffer
 */
const b64ToBuffer = (b64) => {
  if (!b64) return null;
  return Buffer.from(String(b64), "base64");
};

/**
 * Ensures a value is a Base64 string (converts XML strings)
 */
const ensureBase64String = (value) => {
  if (!value) return null;
  const v = String(value);

  if (v.trim().startsWith("<")) {
    return Buffer.from(v, "utf8").toString("base64");
  }

  return v;
};

/**
 * Validates email format
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (value) =>
  EMAIL_REGEX.test(
    String(value || "")
      .trim()
      .toLowerCase(),
  );

/**
 * Sanitizes HTML for emails
 */
const sanitizeEmailHtml = (value) => String(value || "").replace(/</g, "&lt;");

/**
 * Prints debug messages
 */
const debugPrint = (message) => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
};

module.exports = {
  sleep,
  cleanBase64,
  extractSoapReturn,
  extractSoapFault,
  decodeXmlB64,
  extractReferenceCEVFromXml,
  extractReferenceTTNFromXml,
  safeJsonParse,
  resolveConfig,
  bufferToB64,
  b64ToBuffer,
  ensureBase64String,
  isValidEmail,
  sanitizeEmailHtml,
  debugPrint,
};
