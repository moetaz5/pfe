import paramiko

def check_vps_to_ovh_db():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('51.178.39.67', username='ubuntu', password='M3dic0c0M24++')
    
    # Script Node pour tester la DB directement
    content = """
const mysql = require("mysql2");
const conn = mysql.createConnection({
  host: "km813502-001.eu.clouddb.ovh.net",
  port: 35702,
  user: "medica_sign",
  password: "Medica123",
  database: "medica_sign"
});

conn.connect((err) => {
  if (err) {
    console.error("❌ ERREUR CONNEXION DB :", err.message);
  } else {
    console.log("✅ CONNEXION DB RÉUSSIE !");
  }
  process.exit();
});
"""
    ssh.exec_command(f"echo '{content}' > /var/www/medica_sign/server/db_test.js")
    stdin, stdout, stderr = ssh.exec_command("cd /var/www/medica_sign/server && node db_test.js")
    
    print("--- RÉSULTAT DU TEST DB SUR VPS ---")
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    ssh.close()

if __name__ == "__main__":
    check_vps_to_ovh_db()
