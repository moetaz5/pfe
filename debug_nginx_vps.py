import paramiko
import time

def final_nginx_fix_with_outputs():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password)
        
        # 1. Check all enabled sites
        print("\nChecking /etc/nginx/sites-enabled/ ...")
        stdin, stdout, stderr = ssh.exec_command('ls /etc/nginx/sites-enabled/')
        print(f"Enabled sites: {stdout.read().decode()}")

        # 2. Get the content of our site config
        print("\nChecking /etc/nginx/sites-enabled/medica_sign content...")
        stdin, stdout, stderr = ssh.exec_command('cat /etc/nginx/sites-enabled/medica_sign')
        print(f"Content: {stdout.read().decode()}")

        # 3. Force a reload with a debug message
        print("\nTesting and restarting nginx...")
        ssh.exec_command('sudo nginx -t')
        ssh.exec_command('sudo systemctl restart nginx')
        
        # 4. Test it from the server itself with the domain
        print("\nTesting LOCAL loopback with domain Host header...")
        stdin, stdout, stderr = ssh.exec_command('curl -I -H "Host: medicasign.medicacom.tn" http://localhost')
        print(f"Local test medicasign: {stdout.read().decode()}")

        stdin, stdout, stderr = ssh.exec_command('curl -I -H "Host: 51.178.39.67" http://localhost')
        print(f"Local test IP: {stdout.read().decode()}")

    except Exception as e:
        print(f"❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    final_nginx_fix_with_outputs()
