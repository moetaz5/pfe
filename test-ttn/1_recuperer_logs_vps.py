# -*- coding: utf-8 -*-
"""
Médica-Sign : Script de récupération des logs PM2 du VPS
Ce script se connecte en SSH au VPS et télécharge les dernières lignes de log (stdout/stderr)
pour analyser les interactions avec le serveur TTN.
"""

import paramiko
import sys
import os

def recuperer_logs():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connexion au VPS en cours ({hostname})...")
        ssh.connect(hostname, username=username, password=password)
        print("Connecte avec succes!")
        
        # Récupérer les 300 dernières lignes de logs standard
        print("\n--- Lecture du log de sortie (stdout) de medica_sign ---")
        stdin, stdout, stderr = ssh.exec_command('tail -n 300 /home/ubuntu/.pm2/logs/medica-sign-out.log')
        out_content = stdout.read().decode('utf-8', errors='ignore')
        
        # Récupérer les 300 dernières lignes de logs d'erreur
        print("--- Lecture du log d'erreur (stderr) de medica_sign ---")
        stdin, stdout, stderr = ssh.exec_command('tail -n 300 /home/ubuntu/.pm2/logs/medica-sign-error.log')
        err_content = stdout.read().decode('utf-8', errors='ignore')
        
        # Écriture dans un fichier de logs local
        dossier_actuel = os.path.dirname(os.path.abspath(__file__))
        log_filepath = os.path.join(dossier_actuel, "derniers_logs_vps.txt")
        
        with open(log_filepath, "w", encoding="utf-8") as f:
            f.write("=== LOGS STANDARDS DE MEDICA SIGN ===\n")
            f.write(out_content)
            f.write("\n\n=== LOGS D'ERREUR DE MEDICA SIGN ===\n")
            f.write(err_content)
            
        print(f"\nLes logs du VPS ont ete enregistres dans : {log_filepath}")
        
    except Exception as e:
        print(f"Erreur : {e}")
    finally:
        ssh.close()
        print("\nDeconnexion reussie.")

if __name__ == '__main__':
    recuperer_logs()
