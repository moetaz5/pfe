const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const dbName = process.env.DB_NAME || "facturation";

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL connecté au serveur");
});

db.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
db.query(`USE \`${dbName}\`;`);

const schemaPath = path.join(__dirname, "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.query(schema, (err) => {
    if (err) console.error("❌ Erreur de création des tables:", err);
    else console.log("✅ Tables et base de données initialisées avec succès");
  });
}

module.exports = db;
