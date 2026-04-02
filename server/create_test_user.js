const db = require("./db");
const bcrypt = require("bcryptjs");

async function createTestUser() {
  const email = "test@medica.tn";
  const password = "password123";
  const name = "Test User";
  
  const hashed = await bcrypt.hash(password, 10);
  
  // Supprimer si existant
  db.query("DELETE FROM users WHERE email = ?", [email], (err) => {
    // Insérer proprement
    const sql = "INSERT INTO users (name, email, password, role, is_verified, statut) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(sql, [name, email, hashed, "USER", 1, 1], (err2) => {
      if (err2) {
        console.error("❌ Erreur d'insertion :", err2);
      } else {
        console.log("✅ UTILISATEUR CRÉÉ AVEC SUCCÈS !");
        console.log("Email :", email);
        console.log("Mot de passe :", password);
      }
      process.exit();
    });
  });
}

createTestUser();
