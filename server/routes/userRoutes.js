const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyToken } = require("../middleware/auth");

router.put("/certification", verifyToken, userController.updateCertification);
router.post("/generate-api-token", verifyToken, userController.generateApiToken);
router.get("/my-api-token", verifyToken, userController.getMyApiToken);

module.exports = router;
