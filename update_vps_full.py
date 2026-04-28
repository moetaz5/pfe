import paramiko
import subprocess
import sys

def run_local_git_push():
    try:
        print("\n--- 1. Mise a jour locale (Git Push) ---")
        
        subprocess.run(["git", "add", "."], check=True)
        
        # Commit (ignore si rien a commit)
        subprocess.run(
            ["git", "commit", "-m", "Mise a jour automatique FULL"],
            capture_output=True
        )
        
        # Force push
        subprocess.run(["git", "push", "--force", "origin", "main"], check=True)
        
        print("Push GitHub reussi !")
        
    except Exception as e:
        print(f"Erreur ou rien a pousser sur Git : {e}")

def safe_print(text):
    """Prints text safely even if it contains emojis on a terminal that doesn't support them."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode('ascii', 'ignore').decode('ascii'))

def update_full():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    # 1. Push local
    run_local_git_push()
    
    # 2. Connexion SSH
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        safe_print(f"\n--- 2. Connexion au serveur {hostname} ---")
        ssh.connect(hostname, username=username, password=password)
        
        # 3. Update Git VPS
        safe_print("\n--- 3. Mise a jour du code (Git VPS) ---")
        cmd_git = '''
        cd /var/www/medica_sign &&
        git fetch origin &&
        git reset --hard origin/main
        '''
        stdin, stdout, stderr = ssh.exec_command(cmd_git)
        safe_print(stdout.read().decode('utf-8', 'ignore'))
        safe_print(stderr.read().decode('utf-8', 'ignore'))
        
        # 4. Build React (TRES IMPORTANT)
        safe_print("\n--- 4. Build React (clientweb) ---")
        cmd_build = '''
        cd /var/www/medica_sign/clientweb &&
        npm install &&
        npm run build
        '''
        stdin, stdout, stderr = ssh.exec_command(cmd_build)
        safe_print(stdout.read().decode('utf-8', 'ignore'))
        safe_print(stderr.read().decode('utf-8', 'ignore'))
        
        # 5. Reload Nginx
        safe_print("\n--- 5. Reload Nginx ---")
        cmd_nginx = '''
        sudo cp /var/www/medica_sign/nginx_medica_sign.conf /etc/nginx/sites-available/medica_sign &&
        sudo systemctl reload nginx
        '''
        stdin, stdout, stderr = ssh.exec_command(cmd_nginx)
        safe_print(stdout.read().decode('utf-8', 'ignore'))
        safe_print(stderr.read().decode('utf-8', 'ignore'))
        
        # 6. Restart PM2
        safe_print("\n--- 6. Restart Node (PM2) ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 restart medica_sign')
        safe_print(stdout.read().decode('utf-8', 'ignore'))
        safe_print(stderr.read().decode('utf-8', 'ignore'))
        
        safe_print("\nMISE A JOUR COMPLETE TERMINEE AVEC SUCCES !")
        
    except Exception as e:
        safe_print(f"Erreur : {e}")
        
    finally:
        ssh.close()


if __name__ == '__main__':
    update_full()