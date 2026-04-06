# 📄 Guide Complet d'Hébergement - Projet PFE

Ce document explique comment le projet Medica-Sign est hébergé sur le VPS Ubuntu (`51.178.39.67`) et comment gérer l'hébergement de A à Z.

---

## 1. Architecture de l'Infrastructure
*   **Serveur (VPS)** : Ubuntu (IP: 51.178.39.67) - Hébergement chez OVH.
*   **Frontend (Web)** : Application React servie par **Nginx** via des fichiers statiques.
*   **Backend (API)** : Serveur Node.js géré par **PM2** (port 5000).
*   **Base de Données** : MySQL hébergée sur **OVH CloudDB** ( km813502-001.eu.clouddb.ovh.net).
*   **Domaine** : `medicasign.medicacom.tn` (Désormais le point d'entrée principal).

---

## 2. Emplacement des fichiers sur le VPS
Les fichiers du projet se trouvent dans le répertoire suivant sur le serveur :
`/var/www/medica_sign/`

*   `/var/www/medica_sign/clientweb/build/` : Contient les fichiers compilés du frontend (React).
*   `/var/www/medica_sign/server/` : Contient le code du backend Node.js.

---

## 3. Configuration de Nginx (Frontend)
Le Frontend est servi par Nginx. Sa configuration se trouve dans :
`/etc/nginx/sites-available/medica_sign`

**Points clés de la configuration :**
*   **Server Name** : `medicasign.medicacom.tn`.
*   **Root** : pointe vers `/var/www/medica_sign/clientweb/build`.
*   **Proxy Inverse** : Toutes les requêtes vers `/api` sont redirigées vers `localhost:5000` (le backend).

---

## 4. Gestion du Backend (PM2)
Le serveur Node.js est géré par **PM2** pour rester allumé 24h/24, même si vous fermez votre PC.

*   **Nom du processus** : `medica_sign`
*   **Commandes utiles (sur le VPS)** :
    *   `pm2 list` : Voir le statut du serveur.
    *   `pm2 restart medica_sign` : Redémarrer le serveur.
    *   `pm2 logs medica_sign` : Voir les erreurs en temps réel.

---

## 5. Gestion de Google OAuth
À cause des règles de sécurité de Google, une adresse IP brute n'est pas autorisée.
Nous utilisons désormais le domaine officiel : `http://medicasign.medicacom.tn`.

*   **URL de redirection (Google Console)** : `http://medicasign.medicacom.tn/api/auth/google/callback`

---

## 6. Procédure de Mise à jour (Local -> VPS)
Pour mettre à jour votre site, vous devez utiliser les scripts Python que j'ai créés dans votre dossier `web`.

### **Étape 1 : Préparation (Sur votre PC)**
Si vous avez modifié le code du Frontend dans `clientweb` :
1. Dans le terminal de VS Code, allez dans le dossier `clientweb`.
2. Lancez : `npm run build`.

### **Étape 2 : Déploiement (Automatique)**
Utilisez l'un des scripts suivants depuis votre dossier `web` :
*   `python update_vps_full.py` : Pousse votre code sur GitHub et synchronise le VPS (Frontend + Backend).

---

## 7. Commandes de Secours (Contrôle VPS)
Si vous voulez éteindre ou allumer le site à distance, utilisez :
*   `python control_vps.py` : Choisissez l'option 1 (Start), 2 (Stop) ou 3 (Status).

---

**Le projet est conçu pour être autonome. Le VPS s'occupe de tout une fois que vous avez lancé le script de mise à jour !**
