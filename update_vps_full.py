import paramiko
import subprocess

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
        print(f"\n--- 2. Connexion au serveur {hostname} ---")
        ssh.connect(hostname, username=username, password=password)
        
        # 3. Update Git VPS
        print("\n--- 3. Mise a jour du code (Git VPS) ---")
        cmd_git = '''
        cd /var/www/medica_sign &&
        git fetch origin &&
        git reset --hard origin/main
        '''
        stdin, stdout, stderr = ssh.exec_command(cmd_git)
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        # 4. Build React (TRES IMPORTANT)
        print("\n--- 4. Build React (clientweb) ---")
        cmd_build = '''
        cd /var/www/medica_sign/clientweb &&
        npm install &&
        npm run build
        '''
        stdin, stdout, stderr = ssh.exec_command(cmd_build)
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        # 5. Reload Nginx
        print("\n--- 5. Reload Nginx ---")
        cmd_nginx = '''
        sudo cp /var/www/medica_sign/nginx_medica_sign.conf /etc/nginx/sites-available/medica_sign &&
        sudo systemctl reload nginx
        '''
        stdin, stdout, stderr = ssh.exec_command(cmd_nginx)
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        # 6. Restart PM2
        print("\n--- 6. Restart Node (PM2) ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 restart medica_sign')
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        print("\nMISE A JOUR COMPLETE TERMINEE AVEC SUCCES !")
        
    except Exception as e:
        print(f"Erreur : {e}")
        
    finally:
        ssh.close()


if __name__ == '__main__':
    update_full()