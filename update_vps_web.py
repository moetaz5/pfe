import paramiko
import subprocess
import sys

def run_local_git_push():
    try:
        print("\n--- 1. Mise à jour locale (Git Push) ---")
        subprocess.run(["git", "add", "."], check=True)
        # On ignore le message d'erreur si rien n'est à commit
        subprocess.run(["git", "commit", "-m", "Mise à jour automatique WEB"], capture_output=True)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print("✅ Push GitHub réussi !")
    except Exception as e:
        print(f"⚠️ Erreur ou rien à pousser sur Git : {e}")

def update_web():
    hostname = 'medicasign.medicacom.tn'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    # 1. Push local d'abord
    run_local_git_push()
    
    # 2. Update VPS ensuite
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"\n--- 2. Connexion au serveur {hostname} pour mise à jour WEB ---")
        ssh.connect(hostname, username=username, password=password)
        
        print("\n--- 3. Récupération des fichiers sur le VPS (Git Pull) ---")
        cmd = 'cd /var/www/medica_sign && git fetch origin && git reset --hard origin/main'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode())
        
        print("✅ MISE À JOUR WEB TERMINÉE !")
        
    except Exception as e:
        print(f"❌ Erreur VPS : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    update_web()
