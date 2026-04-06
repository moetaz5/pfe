import paramiko
import time

def direct_nginx_push():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    with open('nginx_medica_sign.conf', 'r') as f:
        config_content = f.read()

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password)
        
        # Write config to a temporary file on the VPS
        sftp = ssh.open_sftp()
        f = sftp.open('/tmp/nginx_medica_sign.conf', 'w')
        f.write(config_content)
        f.close()
        sftp.close()

        # Update Nginx on VPS
        print("Moving config and reloading Nginx...")
        ssh.exec_command('sudo cp /tmp/nginx_medica_sign.conf /etc/nginx/sites-available/medica_sign')
        ssh.exec_command('sudo ln -sf /etc/nginx/sites-available/medica_sign /etc/nginx/sites-enabled/medica_sign')
        ssh.exec_command('sudo rm -f /etc/nginx/sites-enabled/default')
        
        time.sleep(1)
        stdin, stdout, stderr = ssh.exec_command('sudo nginx -t')
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        ssh.exec_command('sudo systemctl restart nginx')
        ssh.exec_command('pm2 restart medica_sign')
        
        print("✅ DÉPLOIEMENT DIRECT NGINX TERMINÉ.")

    except Exception as e:
        print(f"❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    direct_nginx_push()
