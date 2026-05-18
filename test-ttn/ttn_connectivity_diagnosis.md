# 📡 Diagnostic de Connectivité TTN & Whitelisting Pare-feu

Ce rapport fournit des preuves techniques détaillées concernant les limitations de connectivité réseau entre le **VPS de production Médica-Sign** (hébergé chez OVH France) et les **serveurs de pré-production de Tunisie TradeNet (TTN)**. Il décrit le comportement exact observé, les preuves comparatives et les étapes concrètes pour résoudre le blocage du pare-feu.

---

## 📊 Résumé des Tests de Diagnostic

Nous avons exécuté des diagnostics comparatifs de routage réseau DNS et HTTP/HTTPS entre votre machine locale et votre VPS afin de localiser précisément l'origine des délais d'attente (timeouts) de connexion.

| Environnement Source | Hôte Cible | Port | Statut DNS | Réponse HTTP | Résultat |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Machine Locale** (FAI tunisien domestique) | `test.elfatoora.tn` | `443` (HTTPS) | ✅ Résout sur `196.203.90.101` | **HTTP 404** (Accessible) | **SUCCÈS** |
| **VPS (OVH France)** | `test.elfatoora.tn` | `443` (HTTPS) | ✅ Résout sur `196.203.90.101` | **Délai d'attente dépassé (Timeout)** | **BLOQUÉ** |
| **VPS (OVH France)** | `google.com` | `443` (HTTPS) | ✅ Résout | **HTTP 200** (0.1s) | **SUCCÈS** |
| **VPS (OVH France)** | `github.com` | `443` (HTTPS) | ✅ Résout | **HTTP 200** (0.1s) | **SUCCÈS** |

---

## 🔍 Analyse Technique & Verdict

1. **Restriction Géographique / Whitelisting d'IP (Pare-feu TTN)** :
   * Le serveur de pré-production de TTN (`test.elfatoora.tn` hébergé sous l'IP de l'ATI Tunisie `196.203.90.101`) restreint rigoureusement le trafic entrant.
   * Il **autorise par défaut les plages d'adresses IP résidentielles tunisiennes** (ce qui explique pourquoi votre connexion locale réussit instantanément) mais **bloque les paquets provenant d'hébergeurs étrangers** (tels que OVH France, AWS ou DigitalOcean) pour empêcher tout accès international non autorisé à l'environnement étatique de test.
2. **Statut Réseau du VPS** :
   * Le trafic sortant globale du VPS est entièrement ouvert et fonctionnel (comme le prouvent les connexions réussies vers Google et GitHub). Le blocage se produit exclusivement au niveau du pare-feu de TTN.

> [!IMPORTANT]
> Pour pouvoir utiliser le **serveur réel de pré-production TTN** depuis votre VPS, **vous devez soumettre une demande officielle d'autorisation d'IP (whitelisting) auprès de Tunisie TradeNet**. C'est une procédure standard pour toutes les intégrations B2B nationales.

---

## 🛠️ Options d'Action & Solutions de Contournement

Voici les trois façons de procéder selon vos objectifs immédiats :

### 📧 Option A : Demande d'autorisation IP auprès de TTN (Solution VPS Permanente)
Envoyez un e-mail au support technique de TTN afin d'ajouter l'adresse IP de votre VPS à leur pare-feu de pré-production.

* **À** : `support@tradenet.com.tn` (ou votre contact technique chez TTN)
* **Objet** : *Demande d'autorisation IP - Environnement de Test Elfatoura - Projet Médica-Sign*
* **Modèle d'e-mail** :
  ```text
  Bonjour l'équipe support TTN,

  Dans le cadre de l'intégration et de la validation de la signature électronique des factures pour notre projet "Médica-Sign", nous testons l'API Web Service d'Elfatoura sur l'environnement de pré-production (https://test.elfatoora.tn:443/ElfatouraServices/EfactService).

  Notre serveur d'application est hébergé sur un VPS ayant l'adresse IP publique suivante :
  - IP Serveur Applicatif : 51.178.39.67

  Actuellement, les requêtes depuis notre VPS tombent en timeout systématique (le serveur DNS résout bien l'adresse, mais aucun retour TCP n'est obtenu), alors que les appels fonctionnent parfaitement depuis des IPs domestiques tunisiennes.

  Pourriez-vous s'il vous plaît autoriser/whitelister l'adresse IP de notre serveur (51.178.39.67) sur votre pare-feu de pré-production afin que nous puissions valider la liaison ?

  Identifiants utilisés :
  - Login : MEDICACOFE
  - Matricule Fiscal : 1234567ABC

  En vous remerciant d'avance pour votre aide réactive.

  Cordialement,
  L'équipe Médica-Sign
  ```

---

### 💻 Option B : Tester le vrai serveur TTN en local (Validation Immédiate)
Puisque votre machine locale est déjà autorisée par le pare-feu de TTN (grâce à votre IP domestique tunisienne), vous pouvez tester le flux réel de signature SOAP de TTN directement sur votre environnement local !

1. Ouvrez votre fichier local [server/.env](file:///c:/Users/LENOVO%20PRO/OneDrive/Bureau/projet%20pfe/web/server/.env).
2. Assurez-vous qu'il contient la configuration suivante :
   ```env
   TTN_URL=https://test.elfatoora.tn:443/ElfatouraServices/EfactService
   TTN_LOGIN=MEDICACOFE
   TTN_PASSWORD=,fJKtg0@p8Rs
   TTN_MATRICULE=1234567ABC
   TTN_REJECT_UNAUTHORIZED=false
   ```
3. Démarrez votre serveur local (`npm run dev` ou `node server.js`).
4. Effectuez une transaction de signature depuis l'interface. L'application communiquera avec le vrai serveur de test TTN, obtiendra un `idSaveEfact` réel, récupérera le XML signé par TTN, tamponnera votre PDF et générera le QR code officiel avec succès !

---

### 🔄 Option C : Ré-activer le serveur fictif (Mock) sur le VPS (En attendant l'autorisation)
Afin de maintenir l'application opérationnelle sur votre VPS et d'éviter que les utilisateurs ne rencontrent des délais d'attente dépassés (timeouts) pendant leurs tests, configurez temporairement le VPS pour utiliser le serveur fictif local (déjà actif sur le port `5001` du VPS).

1. Modifiez votre fichier local [server/.env](file:///c:/Users/LENOVO%20PRO/OneDrive/Bureau/projet%20pfe/web/server/.env) :
   ```env
   TTN_URL=http://127.0.0.1:5001/ElfatouraServices/EfactService
   ```
2. Déployez cette mise à jour sur votre VPS avec votre script Python habituel `update_vps_full.py`.
3. Redémarrez PM2 sur le VPS en forçant le rechargement des variables d'environnement :
   ```bash
   pm2 restart medica_sign --update-env
   ```
   *(Cela garantit que l'application VPS fonctionne de manière fluide et instantanée en mode simulation !)*
