import paramiko

def deploy():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\n--- Connexion au VPS ({hostname}) ---")
        ssh.connect(hostname, username=username, password=password)

        # 1. Pull du code depuis GitHub
        print("\n--- 1. Pull du code depuis GitHub ---")
        stdin, stdout, stderr = ssh.exec_command('cd /var/www/medica_sign && git fetch origin && git reset --hard origin/main')
        print(stdout.read().decode())
        err = stderr.read().decode()
        if err: print("STDERR:", err)

        # 2. Copier la config Nginx
        print("\n--- 2. Mise à jour config Nginx ---")
        stdin, stdout, stderr = ssh.exec_command('sudo cp /var/www/medica_sign/nginx_medica_sign.conf /etc/nginx/sites-available/medica_sign')
        stdout.read()
        err = stderr.read().decode()
        if err: print("STDERR:", err)

        # 3. Créer le lien symbolique si nécessaire
        print("\n--- 3. Vérification du lien symbolique Nginx ---")
        stdin, stdout, stderr = ssh.exec_command('sudo ln -sf /etc/nginx/sites-available/medica_sign /etc/nginx/sites-enabled/medica_sign')
        stdout.read()

        # 4. Test de la configuration Nginx
        print("\n--- 4. Test config Nginx ---")
        stdin, stdout, stderr = ssh.exec_command('sudo nginx -t')
        print(stdout.read().decode())
        print(stderr.read().decode())

        # 5. Reload Nginx
        print("\n--- 5. Reload Nginx ---")
        stdin, stdout, stderr = ssh.exec_command('sudo systemctl reload nginx')
        stdout.read()
        print("Nginx rechargé.")

        # 6. Restart PM2
        print("\n--- 6. Redémarrage PM2 ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 restart medica_sign')
        print(stdout.read().decode())

        # 7. Vérification statut Nginx
        print("\n--- 7. Statut Nginx ---")
        stdin, stdout, stderr = ssh.exec_command('sudo systemctl status nginx --no-pager | head -5')
        print(stdout.read().decode())

        print("\n✅ DÉPLOIEMENT TERMINÉ ! Testez : https://medicasign.medicacom.tn")

    except Exception as e:
        print(f"\n❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    deploy()
