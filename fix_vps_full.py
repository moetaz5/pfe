import paramiko
import time

def apply_fixes():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password)
        print("--- Connected to VPS ---")
        
        # 1. Update Nginx Config - USE 'EOF' to avoid shell expansion of $uri
        nginx_conf = r"""
server {
    listen 80;
    server_name 51.178.39.67 51.178.39.67;

    # Serve React Frontend Build
    root /var/www/medica_sign/clientweb/build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # Proxy API requests to Node.js backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
"""
        # Save nginx config using <<'EOF' to avoid $ variable expansion
        stdin, stdout, stderr = ssh.exec_command("cat <<'EOF' > /tmp/medica_sign.conf\n" + nginx_conf + "\nEOF")
        print("Temporary Nginx config created.")
        
        # Move and activate Nginx config
        ssh.exec_command("sudo mv /tmp/medica_sign.conf /etc/nginx/sites-available/medica_sign")
        ssh.exec_command("sudo ln -sf /etc/nginx/sites-available/medica_sign /etc/nginx/sites-enabled/medica_sign")
        ssh.exec_command("sudo rm -f /etc/nginx/sites-enabled/default")
        
        stdin, stdout, stderr = ssh.exec_command("sudo nginx -t")
        t_out = stdout.read().decode()
        t_err = stderr.read().decode()
        if "syntax is ok" in t_err or "syntax is ok" in t_out:
            print("Nginx syntax OK, restarting...")
            ssh.exec_command("sudo systemctl restart nginx")
        else:
            print(f"Nginx syntax ERROR: {t_out} {t_err}")

        # 2. Update server/db.js to use connection pool
        # Fix JS/Python boolean inconsistency
        new_db_js = r"""
const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "medica_sign",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
});

const db = pool;

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Erreur de connexion MySQL Pool:", err.message);
  } else {
    console.log("✅ MySQL Pool connecté au serveur");
    connection.release();
  }
});

module.exports = db;
"""
        ssh.exec_command("cat <<'EOF' > /var/www/medica_sign/server/db.js\n" + new_db_js + "\nEOF")
        print("Updated db.js with correct JavaScript boolean values.")

        # 3. Handle PM2 restart correctly
        print("Restarting PM2 process...")
        ssh.exec_command("pm2 delete medica_sign") # Just delete and start clean
        ssh.exec_command("cd /var/www/medica_sign/server && pm2 start server.js --name medica_sign")
        ssh.exec_command("pm2 save")

        print("--- FIXES APPLIED SUCCESSFULLY ---")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    apply_fixes()
