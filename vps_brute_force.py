import paramiko

def final_vps_brute_force():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('51.178.39.67', username='ubuntu', password='M3dic0c0M24++')
    
    # 1. Création de l'user proprement
    print("--- 1. Création de l'utilisateur de test ---")
    content = """
const db = require("./db");
const bcrypt = require("bcryptjs");
(async () => {
  const hashed = await bcrypt.hash("password123", 10);
  db.query("DELETE FROM users WHERE email = 'test@medica.tn'", () => {
    db.query("INSERT INTO users (name, email, password, role, is_verified, statut) VALUES ('Test', 'test@medica.tn', ?, 'USER', 1, 1)", [hashed], (e) => {
      console.log(e ? "Erreur : " + e : "✅ OK : User test@medica.tn créé avec 'password123'");
      process.exit();
    });
  });
})();
"""
    ssh.exec_command(f"echo '{content}' > /var/www/medica_sign/server/test_user.js")
    stdin, stdout, stderr = ssh.exec_command("cd /var/www/medica_sign/server && node test_user.js")
    print(stdout.read().decode())
    
    # 2. Mise à jour Nginx (Ultra-permissif)
    print("--- 2. Ouverture totale de Nginx (CORS) ---")
    nginx_conf = """server {
    listen 80;
    server_name 51.178.39.67 51.178.39.67.nip.io;

    location / {
        # Config CORS Ultra-permissive au niveau Nginx
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' '*' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' '*' always;

        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}"""
    ssh.exec_command(f"echo '{nginx_conf}' | sudo tee /etc/nginx/sites-available/default")
    ssh.exec_command("sudo systemctl restart nginx")
    
    ssh.close()
    print("✅ VPS configuré (Nginx + User) !")

if __name__ == "__main__":
    final_vps_brute_force()
