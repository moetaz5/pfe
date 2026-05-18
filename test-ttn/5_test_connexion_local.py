# -*- coding: utf-8 -*-
"""
Médica-Sign : Script de test de connectivité TTN local (depuis votre machine de dev)
Ce script valide la résolution DNS et teste la réponse HTTP directe vers test.elfatoora.tn 
depuis votre connexion Internet tunisienne.
"""

import subprocess
import sys
import socket

def tester_local():
    host = "test.elfatoora.tn"
    print(f"1. Test de la resolution DNS locale pour : {host}")
    try:
        ip = socket.gethostbyname(host)
        print(f"   -> DNS ok! L'hote {host} pointe vers l'adresse IP : {ip} (ATI Tunisie)")
    except Exception as e:
        print(f"   -> Erreur de resolution DNS : {e}")
        
    print(f"\n2. Envoi d'une requete HTTPS de test (Curl local) vers https://{host}:443/ElfatouraService")
    curl_cmd = ["curl", "-k", "-s", "-I", "--connect-timeout", "4", "--max-time", "6", f"https://{host}:443/ElfatouraService"]
    try:
        res = subprocess.run(curl_cmd, capture_output=True, text=True, timeout=10)
        
        if res.stdout.strip():
            print("   -> SUCCES! Le serveur TTN a repondu avec succes.")
            print("   En-tetes de reponse :")
            print(res.stdout)
        else:
            print("   -> ECHEC (Pas de reponse locale. Verifiez votre connexion internet.)")
            if res.stderr:
                print("   Logs d'erreur :")
                print(res.stderr)
    except Exception as e:
        print(f"   -> Erreur d'execution de curl local : {e}")

if __name__ == '__main__':
    tester_local()
