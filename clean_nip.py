import paramiko

def remove_nip_io():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password)
        print("--- Connected to VPS ---")
        
        # 1. Update Nginx Config: Remove .nip.io from server_name
        nginx_fix = "sudo sed -i 's/51.178.39.67.nip.io//g' /etc/nginx/sites-available/medica_sign"
        ssh.exec_command(nginx_fix)
        print("Updated Nginx config (removed nip.io).")
        
        # 2. Global search and replace in the app directory
        # This covers server.js, react builds, etc.
        app_dir = "/var/www/medica_sign"
        # We escape the dots in 51.178.39.67.nip.io to match literally
        find_replace_cmd = f"find {app_dir} -type f -exec grep -l '51.178.39.67.nip.io' {{}} + | xargs -r sed -i 's/51.178.39.67.nip.io/51.178.39.67/g'"
        ssh.exec_command(find_replace_cmd)
        print("Global search and replace for nip.io completed in application directory.")
        
        # 3. Double check Nginx syntax and restart
        stdin, stdout, stderr = ssh.exec_command("sudo nginx -t")
        if "syntax is ok" in stderr.read().decode().lower():
            ssh.exec_command("sudo systemctl restart nginx")
            print("Nginx restarted successfully.")
        
        # 4. Restart PM2 for changes to take effect in Node server (if any)
        ssh.exec_command("pm2 restart medica_sign")
        print("PM2 (medica_sign) restarted.")
        
        print("--- ALL NIP.IO OCCURRENCES REMOVED ---")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    remove_nip_io()
