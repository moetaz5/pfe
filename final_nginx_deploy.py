import paramiko
import sys

def execute_command(ssh, cmd):
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print(f"OUT: {out}")
    if err: print(f"ERR: {err}")
    return out, err

def finalize():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password)
        execute_command(ssh, 'cd /var/www/medica_sign && git fetch origin && git reset --hard origin/main')
        execute_command(ssh, 'sudo cp /var/www/medica_sign/nginx_medica_sign.conf /etc/nginx/sites-available/medica_sign')
        execute_command(ssh, 'sudo ln -sf /etc/nginx/sites-available/medica_sign /etc/nginx/sites-enabled/medica_sign')
        execute_command(ssh, 'sudo rm -f /etc/nginx/sites-enabled/default')
        execute_command(ssh, 'sudo nginx -t')
        execute_command(ssh, 'sudo systemctl restart nginx') # Restart better than reload to clear all
        execute_command(ssh, 'pm2 restart medica_sign')
        print("--- VERIFICATION ---")
        execute_command(ssh, 'ls -l /etc/nginx/sites-enabled/')
        execute_command(ssh, 'cat /etc/nginx/sites-enabled/medica_sign')
        print("✅ DÉPLOIEMENT TERMINÉ !")
    except Exception as e:
        print(f"❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    finalize()
