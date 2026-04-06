import paramiko

def final_fix():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\n--- Connexion VPS ({hostname}) ---")
        ssh.connect(hostname, username=username, password=password)

        # 1. Update config from local to VPS via simple copy (just to be sure)
        # Actually I already have it in the Git repo on the VPS. Let's pull it.
        print("\n--- 1. Pulling last config from GitHub ---")
        ssh.exec_command('cd /var/www/medica_sign && git fetch origin && git reset --hard origin/main').wait()

        # 2. Copy and Enable config
        print("\n--- 2. Updating and enabling Nginx config ---")
        ssh.exec_command('sudo cp /var/www/medica_sign/nginx_medica_sign.conf /etc/nginx/sites-available/medica_sign').wait()
        ssh.exec_command('sudo ln -sf /etc/nginx/sites-available/medica_sign /etc/nginx/sites-enabled/medica_sign').wait()
        
        # 3. Disable the default nginx site if any
        print("\n--- 3. Disabling default nginx site if exists ---")
        ssh.exec_command('sudo rm -f /etc/nginx/sites-enabled/default').wait()

        # 4. Check syntax and reload
        print("\n--- 4. Checking Nginx syntax ---")
        stdin, stdout, stderr = ssh.exec_command('sudo nginx -t')
        print(stdout.read().decode())
        print(stderr.read().decode())

        print("\n--- 5. Reloading Nginx ---")
        ssh.exec_command('sudo systemctl reload nginx').wait()
        
        print("\n✅ OK. Nginx a été mis à jour avec le domaine et l'IP.")

    except Exception as e:
        print(f"\n❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    final_fix()
