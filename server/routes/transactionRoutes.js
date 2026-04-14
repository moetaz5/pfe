const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const { verifyToken } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.post("/upload", verifyToken, upload.single("pdf"), transactionController.uploadPdf);
router.post("/advanced", verifyToken, transactionController.createTransaction);
router.get("/", verifyToken, transactionController.listTransactions);
router.get("/:id", verifyToken, transactionController.getTransactionDetails);
router.get("/:id/download", verifyToken, transactionController.downloadDocument);
router.get("/:id/zip", verifyToken, transactionController.downloadZip);

// Public signature routes (any)
router.get("/any/:id", transactionController.getPublicTransaction);
router.post("/any/:id/sign", transactionController.submitSignature);

module.exports = router;
