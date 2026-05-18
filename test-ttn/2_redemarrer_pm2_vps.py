# -*- coding: utf-8 -*-
"""
Médica-Sign : Script de redémarrage PM2 avec rechargement de l'environnement
Ce script force PM2 sur le VPS à recharger le fichier '.env' actuel grâce au flag '--update-env'.
"""

import paramiko
import sys

def redemarrer_pm2():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connexion au VPS en cours ({hostname})...")
        ssh.connect(hostname, username=username, password=password)
        print("Connecte avec succes!")
        
        print("\n--- Execution de : pm2 restart medica_sign --update-env ---")
        stdin, stdout, stderr = ssh.exec_command('pm2 restart medica_sign --update-env')
        
        # Encodage sécurisé pour la console Windows
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        
        print(out.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
        if err:
            print("Erreurs PM2 :")
            print(err.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
            
    except Exception as e:
        print(f"Erreur : {e}")
    finally:
        ssh.close()
        print("\nDeconnexion reussie.")

if __name__ == '__main__':
    redemarrer_pm2()
