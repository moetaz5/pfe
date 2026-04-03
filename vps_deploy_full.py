import paramiko

def build_and_restart():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password)
        print("--- Connected to VPS ---")
        
        # 1. Pulll latest code (for safety)
        print("Pulling latest code...")
        ssh.exec_command("cd /var/www/medica_sign && git pull origin main")
        
        # 2. REBUILD FRONTEND (Crucial step!)
        print("REBUILDING FRONTEND (npm run build)... This may take a minute.")
        # We use a combined command to ensure path is correct and it runs fully
        # We use '&&' to stop if npm install fails
        build_cmd = "cd /var/www/medica_sign/clientweb && npm install && npm run build"
        stdin, stdout, stderr = ssh.exec_command(build_cmd)
        
        # Print output to see progress
        # Note: stdout.read() is blocking until the command finishes
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        print("Frontend rebuilt.")
        
        # 3. RESTART BACKEND (PM2)
        print("Restarting server...")
        ssh.exec_command("cd /var/www/medica_sign/server && npm install")
        ssh.exec_command("pm2 restart medica_sign")
        
        print("--- DEPLOYMENT COMPLETE & REBUILT ---")
        
    except Exception as e:
        print(f"Error during deployment: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    build_and_restart()
