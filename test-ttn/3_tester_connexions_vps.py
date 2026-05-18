# -*- coding: utf-8 -*-
"""
Médica-Sign : Script de diagnostic des combinaisons d'URL TTN depuis le VPS
Ce script teste le routage et la connectivité HTTPS vers toutes les versions de nom d'hôte 
et de chemins d'accès de pré-production TTN (Elfatoura).
"""

import paramiko
import sys

def tester_combinaisons():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connexion au VPS en cours ({hostname})...")
        ssh.connect(hostname, username=username, password=password)
        print("Connecte avec succes!\n")
        
        urls = [
            "https://test.elfatoora.tn:443/ElfatouraServices/EfactService",
            "https://test.elfatoora.tn:443/ElfatouraService",
            "https://test.elfatoura.tn:443/ElfatouraServices/EfactService",
            "https://test.elfatoura.tn:443/ElfatouraService"
        ]
        
        for url in urls:
            print(f"Test de l'URL : {url}")
            # curl avec timeout court de 4s pour éviter de bloquer la console
            curl_cmd = f'curl -k -s -I --connect-timeout 4 --max-time 6 {url}'
            stdin, stdout, stderr = ssh.exec_command(curl_cmd)
            res = stdout.read().decode('utf-8', errors='ignore')
            err = stderr.read().decode('utf-8', errors='ignore')
            
            if res.strip():
                print(f"-> SUCCES! En-tetes de reponse :\n{res.strip()}\n")
            else:
                print("-> ECHEC / TIMEOUT (Aucune reponse du pare-feu TTN)")
                if err:
                    print(f"   Details : {err.strip()}")
                print()
                    
    except Exception as e:
        print(f"Erreur : {e}")
    finally:
        ssh.close()
        print("Deconnexion reussie.")

if __name__ == '__main__':
    tester_combinaisons()
