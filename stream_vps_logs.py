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
        print(f"Connexion au serveur {hostname} pour LIRE LES LOGS EN TEMPS REEL (PM2)...\n")
        print("Appuyez sur Ctrl+C pour arreter le flux.\n")
        
        ssh.connect(hostname, username=username, password=password)
        
        # On lance pm2 logs sans "--nostream" pour avoir le temps reel
        stdin, stdout, stderr = ssh.exec_command('pm2 logs medica_sign')
        
        encoding = sys.stdout.encoding or 'utf-8'
        for line in iter(stdout.readline, ""):
            safe_line = line.encode(encoding, errors='replace').decode(encoding)
            print(safe_line, end="")
            sys.stdout.flush()
            
    except KeyboardInterrupt:
        print("\nArret du flux de logs.")
    except Exception as e:
        print(f"\n[Error] : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    stream_logs()

