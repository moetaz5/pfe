# -*- coding: utf-8 -*-
"""
Médica-Sign : Script de simulation d'appel SOAP TTN réel depuis le VPS
Ce script envoie un message SOAP réel contenant un document de test encodé en Base64
pour vérifier la réponse de l'API Elfatoura de pré-production TTN.
"""

import paramiko
import sys

def simuler_appel():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connexion au VPS en cours ({hostname})...")
        ssh.connect(hostname, username=username, password=password)
        print("Connecte avec succes!")
        
        print("\n--- Preparation du message XML SOAP de test ---")
        soap_body = """<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <saveEfact xmlns="http://services.elfatoura.tradenet.com.tn/">
      <login>MEDICACOFE</login>
      <password>,fJKtg0@p8Rs</password>
      <matricule>1234567ABC</matricule>
      <documentEfact>PHRlc3Q+dGVzdDwvdGVzdD4=</documentEfact>
    </saveEfact>
  </soap:Body>
</soap:Envelope>"""
        
        # Copie temporaire sur le serveur distant
        sftp = ssh.open_sftp()
        with sftp.file('/tmp/test_soap.xml', 'w') as f:
            f.write(soap_body)
        sftp.close()
        
        # Envoi via curl avec un timeout sécurisé
        print("Envoi de la requete SOAP reelle depuis le VPS vers TTN (Timeout: 10s)...")
        curl_cmd = 'curl -k -s --connect-timeout 5 --max-time 10 -X POST -H "Content-Type: text/xml; charset=utf-8" -d @/tmp/test_soap.xml https://test.elfatoora.tn:443/ElfatouraServices/EfactService'
        stdin, stdout, stderr = ssh.exec_command(curl_cmd)
        
        res = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        
        print("\n--- Reponse obtenue de TTN ---")
        if res.strip():
            print(res)
        else:
            print("[AUCUNE REPONSE - Connexion bloquee par le pare-feu TTN (Timeout)]")
            
        if err:
            print("\nLogs d'erreurs reseau (curl) :")
            print(err)
            
    except Exception as e:
        print(f"Erreur : {e}")
    finally:
        ssh.close()
        print("\nDeconnexion reussie.")

if __name__ == '__main__':
    simuler_appel()
