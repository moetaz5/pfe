const express = require("express");
const router = express.Router();
const ttnApiController = require("../controllers/ttnApiController");
const { verifyApiToken } = require("../middleware/auth");

// Standard TTN API endpoints
router.post("/invoice/xml/transaction/advanced", verifyApiToken, ttnApiController.createAdvancedTransaction);
router.post("/invoice/xml/check/:invoice_uid", verifyApiToken, ttnApiController.checkInvoiceStatus);
router.get("/invoice/xml/pdf/:invoice_uid", verifyApiToken, ttnApiController.downloadPdfApi);
router.get("/invoice/xml/xml/:invoice_uid", verifyApiToken, ttnApiController.downloadXmlApi);

// Public transaction detail (No token required as per original server.js)
router.get("/invoice/xml/:transaction_uid", ttnApiController.getTransactionDetailApi);

module.exports = router;
