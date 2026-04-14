const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");
const passport = require("passport");

router.post("/register", authController.register);
router.post("/verify-email", authController.verifyEmail);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", verifyToken, authController.getMe);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/resend-reset-code", authController.resendResetCode);

// Google Auth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login", session: false }), (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, email: req.user.email, role: req.user.role, name: req.user.name },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
  res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 24 * 60 * 60 * 1000 });
  res.redirect(`medicasign://auth-callback?token=${token}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
});

module.exports = router;
