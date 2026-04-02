import paramiko
import time

def run_vps_commands():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('51.178.39.67', username='ubuntu', password='M3dic0c0M24++')
    
    commands = [
        "ls -l /var/www/pfe/web/server",
        "cat /var/www/pfe/web/server/.env",
        "sudo systemctl status nginx",
        "sudo pm2 list || /usr/local/bin/pm2 list || /usr/bin/pm2 list",
        "sudo netstat -lntp | grep 5000"
    ]
    
    for cmd in commands:
        print(f"--- CMD: {cmd} ---")
        _, o, e = ssh.exec_command(cmd)
        print(o.read().decode())
        print(e.read().decode())
    
    ssh.close()

if __name__ == "__main__":
    run_vps_commands()
