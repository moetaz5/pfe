import paramiko
import time

def run_command(ssh, command):
    print(f"Running: {command}")
    stdin, stdout, stderr = ssh.exec_command(command)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out: print(f"OUT: {out}")
    if err: print(f"ERR: {err}")
    return exit_status, out, err

hostname = "51.178.39.67"
username = "ubuntu"
password = "M3dic0c0M24++"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {hostname}...")
    ssh.connect(hostname, username=username, password=password)
    print("Connected!")

    # 1. Update and install basic tools
    run_command(ssh, "sudo apt update -y")
    run_command(ssh, "sudo apt install -y git curl nginx")

    # 2. Install Node.js (v20)
    run_command(ssh, "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -")
    run_command(ssh, "sudo apt install -y nodejs")
    
    # 3. Install PM2
    run_command(ssh, "sudo npm install -g pm2")

    # 4. Prepare directory and clone
    run_command(ssh, "sudo mkdir -p /var/www/pfe")
    run_command(ssh, "sudo chown -R ubuntu:ubuntu /var/www/pfe")
    
    # Check if folder exists and has contents, otherwise clone
    exit_code, out, _ = run_command(ssh, "ls -A /var/www/pfe")
    if not out:
        run_command(ssh, "git clone https://github.com/moetaz5/pfe.git /var/www/pfe")
    else:
        run_command(ssh, "cd /var/www/pfe && git pull origin main")

    # 5. Setup Server
    run_command(ssh, "cd /var/www/pfe/web/server && npm install")
    
    # 6. Create .env on server
    env_content = """PORT=5000
DB_HOST=km813502-001.eu.clouddb.ovh.net
DB_PORT=35702
DB_USER=ayoub
DB_PASSWORD=Ayoub123
DB_NAME=managment
JWT_SECRET=super_secret_key
"""
    run_command(ssh, f"echo '{env_content}' > /var/www/pfe/web/server/.env")

    # 7. Start with PM2
    run_command(ssh, "pm2 delete pfe-backend || true")
    run_command(ssh, "cd /var/www/pfe/web/server && pm2 start server.js --name 'pfe-backend'")
    run_command(ssh, "pm2 save")

    # 8. Configure Nginx
    nginx_config = """
server {
    listen 80;
    server_name 51.178.39.67;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
"""
    run_command(ssh, f"echo '{nginx_config}' | sudo tee /etc/nginx/sites-available/pfe")
    run_command(ssh, "sudo ln -sf /etc/nginx/sites-available/pfe /etc/nginx/sites-enabled/")
    run_command(ssh, "sudo rm -f /etc/nginx/sites-enabled/default")
    run_command(ssh, "sudo systemctl restart nginx")

    print("\n--- DEPLOYMENT SUCCESSFUL ---")
    print(f"API available at: http://{hostname}")

finally:
    ssh.close()
