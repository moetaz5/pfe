const express = require("express");
const router = express.Router();
const jetonController = require("../controllers/jetonController");
const { verifyToken } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.post("/request", verifyToken, jetonController.requestPack);
router.put("/:id/payment-proof", verifyToken, upload.single("payment_proof"), jetonController.uploadPaymentProof);
router.get("/mine", verifyToken, jetonController.listMyRequests);
router.get("/:id/proof", verifyToken, jetonController.downloadMyProof);
router.get("/total", verifyToken, jetonController.getTotalTokens);

module.exports = router;
