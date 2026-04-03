import paramiko

def finalize_full_deployment():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('51.178.39.67', username='ubuntu', password='M3dic0c0M24++')
    
    # 🆕 Nouvelle configuration Nginx complète (Site + API)
    # On ajoute la gestion de l'historique React (try_files)
    final_nginx = """server {
    listen 80;
    server_name 51.178.39.67 51.178.39.67.nip.io;

    # 1. Dossier du site Web (React Build)
    root /var/www/medica_sign/clientweb/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        
        # Autorisations CORS globales
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' '*' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # 2. Dossier des images/assets statiques
    location /static/ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # 3. L'API (Node.js) sur /api
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout plus long pour l'AI/TTN si nécessaire
        proxy_connect_timeout 60s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}"""
    
    print("Mise à jour de la configuration Nginx sur le VPS...")
    ssh.exec_command(f"echo '{final_nginx}' | sudo tee /etc/nginx/sites-available/default")
    ssh.exec_command("sudo systemctl restart nginx")
    
    ssh.close()
    print("✅ Configuration Nginx terminée !")

if __name__ == "__main__":
    finalize_full_deployment()
