import paramiko

def fix_nginx():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('51.178.39.67', username='ubuntu', password='M3dic0c0M24++')
    
    # 1. Update Nginx to use 127.0.0.1 (safer than localhost on IPv6 systems)
    ssh.exec_command('sudo sed -i "s/localhost:5000/127.0.0.1:5000/g" /etc/nginx/sites-available/pfe')
    ssh.exec_command('sudo systemctl restart nginx')
    
    # 2. Re-Check PM2 Logs and force restart
    stdin, stdout, stderr = ssh.exec_command('cd /var/www/pfe/web/server && pm2 restart pfe-backend')
    print("PM2 Restart:", stdout.read().decode())
    
    # 3. Check if server is listening locally on 5000
    stdin, stdout, stderr = ssh.exec_command('ss -lntp | grep 5000')
    print("Checking Listening Port 5000:", stdout.read().decode())
    
    ssh.close()

if __name__ == "__main__":
    fix_nginx()
