import paramiko

def diagnose():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    commands = [
        "ls -la /var/www/",
        "ls -la /var/www/medica_sign",
        "ls -la /var/www/medica_sign/server",
        "ls -la /var/www/medica_sign/clientweb/build || echo 'No build folder'",
        "pm2 list",
        "pm2 logs medica_sign --lines 20 --nostream",
        "nginx -v",
        "sudo systemctl status nginx",
        "cat /etc/nginx/sites-enabled/*",
        "netstat -tuln"
    ]
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password)
        print(f"--- Connected to {hostname} ---")
        
        for cmd in commands:
            print(f"\n--- Executing: {cmd} ---")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            out = stdout.read().decode()
            err = stderr.read().decode()
            if out:
                print(out)
            if err:
                print(f"Error output:\n{err}")
    except Exception as e:
        print(f"Failed to connect or execute: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    diagnose()
