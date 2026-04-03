import paramiko

def view_logs():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connexion au serveur {hostname} pour lire les LOGS...\n")
        ssh.connect(hostname, username=username, password=password)
        
        print("--- Affichage des 50 dernières lignes de logs (PM2) ---\n")
        # On demande les logs de medica_sign sans stream (une seule fois)
        stdin, stdout, stderr = ssh.exec_command('pm2 logs medica_sign --lines 50 --nostream')
        
        print(stdout.read().decode())
        
    except Exception as e:
        print(f"❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    view_logs()
