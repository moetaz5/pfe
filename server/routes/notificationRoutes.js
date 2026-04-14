const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { verifyToken } = require("../middleware/auth");

router.get("/", verifyToken, notificationController.listNotifications);
router.put("/:id/read", verifyToken, notificationController.markAsRead);
router.post("/register-fcm", verifyToken, notificationController.registerFcm);
router.post("/test", verifyToken, notificationController.sendTestNotification);
router.put("/preferences", verifyToken, notificationController.updatePreferences);

module.exports = router;
