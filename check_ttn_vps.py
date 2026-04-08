import paramiko

def check_ttn_mock_status():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password)
        
        print("\n--- Processus PM2 ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 list')
        print(stdout.read().decode())
        
        print("\n--- Ports en ecoute (5001?) ---")
        stdin, stdout, stderr = ssh.exec_command('sudo netstat -tulpn | grep 5001')
        print(stdout.read().decode())
        
        print("\n--- Dernieres lignes des logs ttn_mock ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 logs ttn_mock --lines 20 --nostream')
        print(stdout.read().decode())
        
    except Exception as e:
        print(f"❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    check_ttn_mock_status()
