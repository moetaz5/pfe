import paramiko

def fetch_errors():
    hostname = 'medicasign.medicacom.tn'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password, timeout=10)
        
        print("Checking PM2 Error logs...")
        stdin, stdout, stderr = ssh.exec_command('cat /home/ubuntu/.pm2/logs/medica-sign-error.log | tail -n 50')
        print(stdout.read().decode())
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    fetch_errors()
