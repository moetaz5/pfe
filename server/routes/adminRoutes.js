const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, verifyRole } = require("../middleware/auth");

// All routes here are protected by ADMIN role
router.use(verifyToken, verifyRole(["ADMIN"]));

router.get("/users", adminController.listUsers);
router.put("/users/:id/status", adminController.updateUserStatus);
router.delete("/users/:id", adminController.deleteUser);
router.get("/stats", adminController.getStats);
router.get("/jeton", adminController.listTokenRequests);
router.get("/jeton/:id/proof", adminController.downloadProof);
router.put("/jeton/:id/decision", adminController.makeJetonDecision);
router.get("/routes", adminController.listRoutes);

module.exports = router;
