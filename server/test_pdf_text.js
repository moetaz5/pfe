const mysql = require("mysql2/promise");
const pdfParse = require("pdf-parse");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await connection.query(
      "SELECT pdf_file FROM transaction_documents WHERE filename LIKE '%Facture_FC-2026-0010%' ORDER BY id DESC LIMIT 1"
    );

    if (!rows.length) {
      fs.writeFileSync("output_utf8.txt", "Facture #10 non trouvée dans la base de données.", "utf-8");
      return;
    }

    const base64Data = rows[0].pdf_file.toString("utf-8");
    const pdfBuffer = Buffer.from(base64Data, "base64");
    console.log("Buffer PDF décodé avec succès, taille :", pdfBuffer.length);

    const data = await pdfParse(pdfBuffer);
    
    fs.writeFileSync("output_utf8.txt", data.text, "utf-8");
    console.log("Texte écrit avec succès dans output_utf8.txt");

  } catch (err) {
    fs.writeFileSync("output_utf8.txt", "Erreur: " + err.message, "utf-8");
  } finally {
    await connection.end();
  }
}

main();
