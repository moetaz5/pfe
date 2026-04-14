const express = require("express");
const router = express.Router();
const supportController = require("../controllers/supportController");
const { verifyToken } = require("../middleware/auth");

router.post("/ai/chat", supportController.chat);
router.post("/contact", verifyToken, supportController.contactSupport);

module.exports = router;
