require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const JSZip = require("jszip");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("./db");
const passport = require("./googleAuth");

// ===================== MODULES EXTRAITS =====================
const { bufferToB64, b64ToBuffer, ensureBase64String, cleanBase64, decodeXmlB64 } = require('./utils/base64Utils');
const { createNotification, notifyAdmins } = require('./services/notificationService');
const { safeJsonParse, resolveConfig, extractReferenceCEVFromXml, extractReferenceTTNFromXml, generateQrPngBase64, stampPdfWithTTN } = require('./services/pdfService');
const { transporter, sendSignatureEmail, sendSignedPdfsToClient, sendRejectionEmailToClient, sendVerificationEmail, EMAIL_REGEX, isValidEmail, sanitizeEmailHtml, sendTokenRequestPaymentPendingEmail, sendTokenRequestDecisionEmail } = require('./services/emailService');
const { TTN_URL, TTN_LOGIN, TTN_PASSWORD, TTN_MATRICULE, sleep, extractSoapReturn, extractSoapFault, saveEfactTTN, consultEfactTTN, processTTNSubmission, handleResendTTNCore } = require('./services/ttnService');
const { googleExchangeTokens, verifyToken, verifyRole, verifyApiToken } = require('./middleware/authMiddleware');
const { storage, upload } = require('./middleware/uploadMiddleware');

const app = express();

// ===================== AUTO-MIGRATION =====================
// Ajoute la colonne date_suppression si elle n'existe pas encore (compatible toutes versions MySQL)
db.query(
  `SELECT COUNT(*) AS cnt
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'transactions'
     AND COLUMN_NAME  = 'date_suppression'`,
  (err, results) => {
    if (err) {
      console.warn("⚠️ Migration check error:", err.message);
      return;
    }
    if (results[0].cnt === 0) {
      db.query(
        `ALTER TABLE transactions ADD COLUMN date_suppression DATETIME DEFAULT NULL`,
        (err2) => {
          if (err2)
            console.warn("⚠️ Migration date_suppression:", err2.message);
          else console.log("✅ Colonne date_suppression ajoutée avec succès");
        },
      );
    }
  },
);

// Ajoute la colonne last_activity si elle n'existe pas encore
db.query(
  `SELECT COUNT(*) AS cnt
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'users'
     AND COLUMN_NAME  = 'last_activity'`,
  (err, results) => {
    if (err) {
      console.warn("⚠️ Migration check error (last_activity):", err.message);
      return;
    }
    if (results[0].cnt === 0) {
      db.query(
        `ALTER TABLE users ADD COLUMN last_activity DATETIME DEFAULT NULL`,
        (err2) => {
          if (err2) console.warn("⚠️ Migration last_activity:", err2.message);
          else console.log("✅ Colonne last_activity ajoutée avec succès");
        },
      );
    }
  },
);

// Auto-création de la table notifications si elle n'existe pas
db.query(
  `
  CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  (err) => {
    if (err)
      console.warn("⚠️Table notifications auto-creation error:", err.message);
    else console.log("Table notifications prête");
  },
);

// ===================== MIDDLEWARES GLOBAUX =====================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  "https://medicasign.medicacom.tn",
  "http://localhost:52001",
  "http://127.0.0.1:52001",
  "http://10.0.2.2:52001",
  "http://localhost:52622",
  "http://127.0.0.1:52622",
];

app.use(
  cors({
    origin: true, // Accepte toutes les origines pour le test
    credentials: true,
  }),
);

app.use(passport.initialize());

// ===================== INJECTION DES DÉPENDANCES =====================
const locals = {
  db,
  jwt,
  bcrypt,
  multer,
  nodemailer,
  JSZip,
  axios,
  fs,
  path,
  crypto,
  express,
  googleExchangeTokens,
  TTN_URL,
  TTN_LOGIN,
  TTN_PASSWORD,
  TTN_MATRICULE,
  sleep,
  cleanBase64,
  extractSoapReturn,
  extractSoapFault,
  saveEfactTTN,
  consultEfactTTN,
  processTTNSubmission,
  safeJsonParse,
  resolveConfig,
  decodeXmlB64,
  extractReferenceCEVFromXml,
  extractReferenceTTNFromXml,
  generateQrPngBase64,
  stampPdfWithTTN,
  bufferToB64,
  b64ToBuffer,
  ensureBase64String,
  createNotification,
  notifyAdmins,
  sendSignatureEmail,
  sendSignedPdfsToClient,
  sendRejectionEmailToClient,
  allowedOrigins,
  transporter,
  sendVerificationEmail,
  EMAIL_REGEX,
  isValidEmail,
  sanitizeEmailHtml,
  sendTokenRequestPaymentPendingEmail,
  sendTokenRequestDecisionEmail,
  verifyToken,
  verifyRole,
  verifyApiToken,
  storage,
  upload,
  handleResendTTNCore,
  passport,
};

// ===================== CHARGEMENT DES ROUTES =====================
require('./routes/auth.routes.js')(app, locals);
require('./routes/transactions.routes.js')(app, locals);
require('./routes/factures.routes.js')(app, locals);
require('./routes/notifications.routes.js')(app, locals);
require('./routes/admin.routes.js')(app, locals);
require('./routes/jeton.routes.js')(app, locals);
require('./routes/organizations.routes.js')(app, locals);
require('./routes/public.routes.js')(app, locals);
require('./routes/statistiques.routes.js')(app, locals);
require('./routes/external.routes.js')(app, locals);
require('./routes/support.routes.js')(app, locals);
require('./routes/ai.routes.js')(app, locals);
require('./routes/misc.routes.js')(app, locals);

// ===================== SERVER =====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // SYNC ROUTES TO DATABASE AUTOMATICALLY
  db.query(
    `CREATE TABLE IF NOT EXISTS api_routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    path VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    role VARCHAR(255) DEFAULT 'Non défini',
    UNIQUE KEY unique_route (path, method)
  )`,
    (err) => {
      if (err) {
        console.error(
          "⚠️ Erreur de création de la table api_routes:",
          err.message,
        );
        return;
      }

      // Role mapping helper
      const getRouteRole = (p) => {
        const path = p.toLowerCase();
        if (path.includes("/api/auth/login")) return "Connexion utilisateur";
        if (path.includes("/api/auth/register"))
          return "Inscription nouvel utilisateur";
        if (path.includes("/api/auth/verify-email"))
          return "Verification OTP email";
        if (path.includes("/api/auth/me")) return "Infos profil connecte";
        if (path.includes("/api/auth/logout")) return "Deconnexion";
        if (path.includes("/api/auth/google")) return "Auth via Google";
        if (path.includes("/api/auth/forgot-password"))
          return "Demande reset mot de passe";
        if (path.includes("/api/auth/reset-password"))
          return "Reinitialisation mot de passe";
        if (path.includes("/api/admin/users"))
          return "Gestion des utilisateurs (Admin)";
        if (path.includes("/api/admin/routes"))
          return "Gestion des routes API (Admin)";
        if (path.includes("/api/transactions"))
          return "Gestion des transactions";
        if (path.includes("/api/factures")) return "Acces aux factures";
        if (path.includes("/api/notifications"))
          return "Gestion des notifications";
        if (path.includes("/api/generate-api-token")) return "Generer Cle API";
        if (path.includes("/api/my-api-token")) return "Recuperer Cle API";
        if (path.includes("/protected/invoice"))
          return "API Publique Export Documents";
        if (path.includes("/signature/")) return "Page de signature client";
        return "Route systeme ou utilitaire";
      };

      const syncRoutes = () => {
        const routesList = [];

        const extractRoutes = (stack, prefix = "") => {
          stack.forEach((layer) => {
            if (layer.route) {
              const p = layer.route.path;
              const fullPath = prefix + (p === "/" ? "" : p);
              Object.keys(layer.route.methods).forEach((method) => {
                if (layer.route.methods[method]) {
                  routesList.push({
                    path: fullPath || "/",
                    method: method.toUpperCase(),
                  });
                }
              });
            } else if (
              layer.name === "router" &&
              layer.handle &&
              layer.handle.stack
            ) {
              let newPrefix = prefix;
              if (layer.regexp && layer.regexp.source !== "^\\/?$") {
                const match = layer.regexp.source.match(/\\\/([^\\?]+)/);
                if (match && match[1]) newPrefix += "/" + match[1];
              }
              extractRoutes(layer.handle.stack, newPrefix);
            }
          });
        };

        const routerStack =
          (app.router && app.router.stack) ||
          (app._router && app._router.stack);
        if (routerStack) extractRoutes(routerStack);

        const uniqueMap = {};
        routesList.forEach((r) => {
          uniqueMap[r.path + r.method] = r;
        });
        const cleanRoutes = Object.values(uniqueMap);

        cleanRoutes.forEach((r) => {
          const role = getRouteRole(r.path);
          db.query(
            "INSERT INTO api_routes (path, method, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)",
            [String(r.path), String(r.method), role],
            (e) => {
              if (e) console.error("Sync error:", e.message);
            },
          );
        });

        setTimeout(() => {
          console.log(
            `OK Table api_routes synchronisee (${cleanRoutes.length} APIs).`,
          );
        }, 1500);
      };

      // MIGRATION: Ajoute la colonne role si absente, puis lance la sync
      db.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_routes' AND COLUMN_NAME = 'role'`,
        (mErr, mResults) => {
          if (!mErr && mResults[0].cnt === 0) {
            // Colonne manquante -> ALTER puis sync
            db.query(
              "ALTER TABLE api_routes ADD COLUMN role VARCHAR(255) DEFAULT 'Non defini'",
              (aErr) => {
                if (aErr)
                  console.error("Migration role column error:", aErr.message);
                else console.log("Colonne role ajoutee a api_routes.");
                syncRoutes(); // sync APRES que la colonne est creee
              },
            );
          } else {
            syncRoutes(); // colonne deja presente
          }
        },
      );
    },
  );
});
