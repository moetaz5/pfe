import paramiko
import time
import sys

def stream_logs():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connexion au serveur {hostname} pour LIRE LES LOGS EN TEMPS RÉEL (PM2)...\n")
        print("Appuyez sur Ctrl+C pour arrêter le flux.\n")
        
        ssh.connect(hostname, username=username, password=password)
        
        # On lance pm2 logs sans "--nostream" pour avoir le temps réel
        stdin, stdout, stderr = ssh.exec_command('pm2 logs medica_sign')
        
        for line in iter(stdout.readline, ""):
            print(line, end="")
            sys.stdout.flush()
            
    except KeyboardInterrupt:
        print("\nArrêt du flux de logs.")
    except Exception as e:
        print(f"\n❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    stream_logs()
