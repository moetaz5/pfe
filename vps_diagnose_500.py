import paramiko

def diagnose_500():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('51.178.39.67', username='ubuntu', password='M3dic0c0M24++')
    
    stdin, stdout, stderr = ssh.exec_command('pm2 logs medica_sign --lines 20 --no-daemon')
    # On capture 2 secondes de logs
    import time
    time.sleep(2)
    print(stdout.channel.recv(8192).decode())
    
    ssh.close()

if __name__ == "__main__":
    diagnose_500()
