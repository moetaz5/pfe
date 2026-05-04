import paramiko
import subprocess

def run_local_git_push():
    try:
        print("\n--- 1. Mise a jour locale (Git Push) ---")
        subprocess.run(["git", "add", "."], check=True)
        # On ignore le message d'erreur si rien n'est à commit
        subprocess.run(["git", "commit", "-m", "Mise a jour automatique SERVEUR"], capture_output=True)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print("Push GitHub reussi !")
    except Exception as e:
        print(f"Erreur ou rien a pousser sur Git : {e}")

def update_server():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    # 1. Push local d'abord
    run_local_git_push()
    
    # 2. Update VPS ensuite
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"\n--- 2. Connexion au serveur {hostname} pour mise a jour SERVEUR ---")
        ssh.connect(hostname, username=username, password=password)
        
        print("\n--- 3. Recuperation du code sur le VPS ---")
        cmd = 'cd /var/www/medica_sign && git fetch origin && git reset --hard origin/main'
        ssh.exec_command(cmd)
        
        print("\n--- 4. Redemarrage du processus PM2 (medica_sign) ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 restart medica_sign')
        # On evite tout caractere non-ascii pour le print local
        out_str = stdout.read().decode('utf-8', errors='ignore')
        print(out_str.encode('ascii', 'ignore').decode('ascii'))
        
        print("MISE A JOUR SERVEUR TERMINEE !")
        
    except Exception as e:
        print(f"Erreur VPS : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    update_server()

