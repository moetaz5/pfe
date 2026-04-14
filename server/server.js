require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const path = require("path");
const db = require("./db");
const { debugPrint } = require("./utils/helpers");

// Load Passport Configuration
require("./googleAuth");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const jetonRoutes = require("./routes/jetonRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const supportRoutes = require("./routes/supportRoutes");
const adminRoutes = require("./routes/adminRoutes");
const ttnApiRoutes = require("./routes/ttnApiRoutes");

const app = express();

// Global Middlewares
app.use(
  cors({
    origin: ["http://51.178.39.67", "http://localhost:3000", "http://localhost:5000", "https://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health Check
app.get("/health", (req, res) => res.json({ status: "OK", timestamp: new Date() }));

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/jeton", jetonRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api", supportRoutes); // /ai/chat and /contact
app.use("/api/admin", adminRoutes);
app.use("/", ttnApiRoutes); // Protected and public TTN endpoints

/* ===================== SERVER & DATABASE SYNC ===================== */
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
        console.error("⚠️ Erreur de création de la table api_routes:", err.message);
        return;
      }

      const getRouteRole = (p) => {
        const path = p.toLowerCase();
        if (path.includes("/api/auth/login")) return "Connexion utilisateur";
        if (path.includes("/api/auth/register")) return "Inscription nouvel utilisateur";
        if (path.includes("/api/auth/verify-email")) return "Verification OTP email";
        if (path.includes("/api/auth/me")) return "Infos profil connecte";
        if (path.includes("/api/auth/logout")) return "Deconnexion";
        if (path.includes("/api/auth/google")) return "Auth via Google";
        if (path.includes("/api/auth/forgot-password")) return "Demande reset mot de passe";
        if (path.includes("/api/auth/reset-password")) return "Reinitialisation mot de passe";
        if (path.includes("/api/admin/users")) return "Gestion des utilisateurs (Admin)";
        if (path.includes("/api/admin/routes")) return "Gestion des routes API (Admin)";
        if (path.includes("/api/transactions")) return "Gestion des transactions";
        if (path.includes("/api/factures")) return "Acces aux factures";
        if (path.includes("/api/notifications")) return "Gestion des notifications";
        if (path.includes("/api/generate-api-token")) return "Generer Cle API";
        if (path.includes("/api/my-api-token")) return "Recuperer Cle API";
        if (path.includes("/protected/invoice")) return "API Publique Export Documents";
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
            } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
              let newPrefix = prefix;
              if (layer.regexp && layer.regexp.source !== "^\\/?$") {
                const match = layer.regexp.source.match(/\\\/([^\\?]+)/);
                if (match && match[1]) newPrefix += "/" + match[1];
              }
              extractRoutes(layer.handle.stack, newPrefix);
            }
          });
        };

        const routerStack = (app.router && app.router.stack) || (app._router && app._router.stack);
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
          console.log(`OK Table api_routes synchronisee (${cleanRoutes.length} APIs).`);
        }, 1500);
      };

      db.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_routes' AND COLUMN_NAME = 'role'`,
        (mErr, mResults) => {
          if (!mErr && mResults[0].cnt === 0) {
            db.query("ALTER TABLE api_routes ADD COLUMN role VARCHAR(255) DEFAULT 'Non defini'", (aErr) => {
              if (aErr) console.error("Migration role column error:", aErr.message);
              syncRoutes();
            });
          } else {
            syncRoutes();
          }
        },
      );
    },
  );
});
