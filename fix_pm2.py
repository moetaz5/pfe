import paramiko

def fix_server():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        
        print("Checking DB_HOST in .env...")
        stdin, stdout, stderr = ssh.exec_command('cat /var/www/medica_sign/server/.env | grep DB_HOST')
        print(stdout.read().decode())
        
        print("Stopping and removing existing pm2 processes...")
        ssh.exec_command('pm2 delete all')
        
        print("Starting medica_sign...")
        stdin, stdout, stderr = ssh.exec_command('cd /var/www/medica_sign/server && pm2 start server.js --name medica_sign')
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        print("Saving pm2 state...")
        ssh.exec_command('pm2 save')
        
        print("Configuring pm2 startup...")
        stdin, stdout, stderr = ssh.exec_command('pm2 startup ubuntu -u ubuntu --hp /home/ubuntu')
        print(stdout.read().decode())
        
        print("Checking open ports (netstat)...")
        stdin, stdout, stderr = ssh.exec_command('sudo netstat -tulpn | grep 5000')
        print(stdout.read().decode())
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    fix_server()
