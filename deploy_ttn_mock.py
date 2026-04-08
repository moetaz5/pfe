import paramiko
import time

def deploy_ttn_mock():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"\n--- Connexion au serveur {hostname} pour deployer TTN Mock ---")
        ssh.connect(hostname, username=username, password=password)
        
        # 1. Install pip requirements for the python mock server
        print("\n--- Installation des dependances Python ---")
        # On utilise --break-system-packages car c'est une Ubuntu recente qui bloque le pip global par defaut
        pip_cmd = 'sudo apt-get update && sudo apt-get install -y python3-pip && pip3 install flask flasgger qrcode pillow --break-system-packages'
        stdin, stdout, stderr = ssh.exec_command(pip_cmd)
        print(stdout.read().decode())
        
        # 2. Start or restart the mock server with PM2
        print("\n--- Demarrage de TTN Mock Server avec PM2 ---")
        # On force l'interpreter et le nom
        cmd = 'cd /var/www/medica_sign && pm2 delete ttn_mock || true && pm2 start ttn_mock_server.py --name ttn_mock --interpreter python3'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode())
        
        # 3. Save PM2 list
        ssh.exec_command('pm2 save')
        
        print("✅ DEPLOIEMENT DE TTN MOCK TERMINE !")
        
    except Exception as e:
        print(f"❌ Erreur VPS : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    deploy_ttn_mock()
