import paramiko

def update_server():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    try:
        print(f"Connexion au serveur {hostname}...")
        ssh.connect(hostname, username=username, password=password)
        
        print("\n--- 1. Récupération du nouveau code (Git Pull) ---")
        # On utilise 'git reset --hard' avant pour s'assurer que le pull passe sans conflit
        stdin, stdout, stderr = ssh.exec_command('cd /var/www/medica_sign && git fetch origin && git reset --hard origin/main')
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        print("\n--- 2. Redémarrage du serveur Node (PM2) ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 restart medica_sign')
        print(stdout.read().decode())
        
        print("\n✅ MISE À JOUR TERMINÉE AVEC SUCCÈS !")
        print(f"Votre serveur est maintenant synchronisé avec GitHub.")
        
    except Exception as e:
        print(f"❌ Erreur lors de la mise à jour : {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    update_server()
