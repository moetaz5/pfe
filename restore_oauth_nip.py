import paramiko

def restore_nip_io_for_oauth():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password)
        print("--- Connected to VPS ---")
        
        # 1. Update Nginx Config: Allow both IP and nip.io
        # server_name 51.178.39.67 51.178.39.67.nip.io;
        nginx_conf = r"""
server {
    listen 80;
    server_name 51.178.39.67 51.178.39.67.nip.io;

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
        ssh.exec_command("cat <<'EOF' > /tmp/medica_sign.conf\n" + nginx_conf + "\nEOF")
        ssh.exec_command("sudo mv /tmp/medica_sign.conf /etc/nginx/sites-available/medica_sign")
        ssh.exec_command("sudo systemctl restart nginx")
        print("Updated Nginx config to allow nip.io for OAuth flow.")
        
        # 2. Update .env for GOOGLE_CALLBACK_URL
        # First ensure the variable exists in the file
        check_cmd = "grep -q 'GOOGLE_CALLBACK_URL' /var/www/medica_sign/server/.env"
        stdin, stdout, stderr = ssh.exec_command(check_cmd)
        if stdout.channel.recv_exit_status() != 0:
            # If not present, append it
            ssh.exec_command("echo '\nGOOGLE_CALLBACK_URL=http://51.178.39.67.nip.io/api/auth/google/callback' >> /var/www/medica_sign/server/.env")
        else:
            # If present, replace it
            ssh.exec_command("sed -i 's|GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=http://51.178.39.67.nip.io/api/auth/google/callback|g' /var/www/medica_sign/server/.env")
        print("Updated GOOGLE_CALLBACK_URL in .env.")
        
        # 3. Restart PM2
        ssh.exec_command("pm2 restart medica_sign")
        print("PM2 (medica_sign) restarted.")
        
        print("--- MIXED CONFIGURATION (IP + OAuth nip.io) READY ---")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    restore_nip_io_for_oauth()
