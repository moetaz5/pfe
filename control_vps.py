import paramiko

def control_vps(action):
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"\nConnexion au serveur {hostname} pour l'action : {action.upper()}...")
        ssh.connect(hostname, username=username, password=password)
        
        if action == "stop":
            print("\nArrêt du Serveur (PM2)...")
            ssh.exec_command('pm2 stop medica_sign')
            print("Arrêt du Web (Nginx)...")
            ssh.exec_command('sudo systemctl stop nginx')
            print("❌ TOUT EST ARRÊTÉ.")
            
        elif action == "start":
            print("\nDémarrage du Web (Nginx)...")
            ssh.exec_command('sudo systemctl start nginx')
            print("Démarrage du Serveur (PM2)...")
            ssh.exec_command('pm2 start medica_sign') # ou restart
            print("✅ TOUT EST DÉMARRÉ.")
            
        elif action == "status":
            print("\nStatut du SERVEUR (PM2) :")
            stdin, stdout, stderr = ssh.exec_command('pm2 list')
            print(stdout.read().decode())
            
    except Exception as e:
        print(f"❌ Erreur : {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    print("--- CONTRÔLE DU VPS ---")
    print("1. Démarrer tout (Start)")
    print("2. Arrêter tout (Stop)")
    print("3. Voir le statut (Status)")
    
    choix = input("\nVotre choix (1/2/3) : ")
    
    if choix == "1":
        control_vps("start")
    elif choix == "2":
        control_vps("stop")
    elif choix == "3":
        control_vps("status")
    else:
        print("Choix invalide.")
