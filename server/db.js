const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const dbName = process.env.DB_NAME || "facturation";

// 1. Initialiser une connexion temporaire pour s'assurer que la BDD existe
const tempDb = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

tempDb.connect((err) => {
  if (err) {
    console.error("❌ Erreur de connexion root:", err);
    return;
  }
  tempDb.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`, (err) => {
    if (err) console.error("❌ Erreur création BDD:", err);
    tempDb.end(); // Fermer la temp
  });
});

// 2. Créer le POOL de connexions robuste pour toute l'app
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: dbName, // Permet aux connexions du pool d'aller bdd
  timezone: "+01:00",
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

db.on("connection", (connection) => {
  connection.query("SET time_zone = '+01:00';");
});

// 3. Vérifier que la connexion marche et initialiser les tables
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ MySQL Pool error:", err);
    return;
  }
  console.log("✅ MySQL connecté au serveur (via Pool)");
  
  const schemaPath = path.join(__dirname, "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf8");
    connection.query(schema, (err2) => {
      if (err2) console.error("❌ Erreur de création des tables:", err2);
      else console.log("✅ Tables et base de données initialisées avec succès");
      connection.release();
    });
  } else {
    connection.release();
  }
});

module.exports = db;
