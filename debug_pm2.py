import paramiko

def debug_pm2():
    hostname = 'medicasign.medicacom.tn'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connexion au serveur {hostname} pour le DEBUG PM2...\n")
        ssh.connect(hostname, username=username, password=password)
        
        print("--- PM2 LIST ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 list')
        print(stdout.read().decode())
        
        print("\n--- PM2 DESCRIBE medica_sign ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 describe medica_sign')
        print(stdout.read().decode())
        
        print("\n--- LISTENING PORTS (netstat) ---")
        stdin, stdout, stderr = ssh.exec_command('sudo netstat -tulpn | grep :5000')
        print(stdout.read().decode())

        print("\n--- NGINX STATUS ---")
        stdin, stdout, stderr = ssh.exec_command('sudo systemctl status nginx')
        print(stdout.read().decode())

    except Exception as e:
        print(f"❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    debug_pm2()
