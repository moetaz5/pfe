const multer = require("multer");

/* ===================== FACTURES (UPLOAD PDF) ===================== */
/* ===================== FACTURES (BASE64) ===================== */
const storage = multer.memoryStorage();

const upload = multer({ storage });

module.exports = {
  storage,
  upload
};
