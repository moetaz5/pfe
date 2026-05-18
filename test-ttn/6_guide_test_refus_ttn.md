# ❌ Guide Pratique : Tester et Simuler un Refus TTN

Ce guide vous explique comment provoquer volontairement un refus de la part de **Tunisie TradeNet (TTN)** pour tester le comportement de l'application **Médica-Sign** et vérifier que les documents et transactions passent correctement au statut rouge **`"refusée par TTN"`**.

---

## ⚙️ Comment fonctionne le refus dans le code ?

Dans votre fichier [ttnService.js](file:///c:/Users/LENOVO%20PRO/OneDrive/Bureau/projet%20pfe/web/server/services/ttnService.js), l'application exécute la soumission de la facture dans un bloc `try / catch` :

1. L'application envoie la facture signée via `saveEfactTTN`.
2. Si le serveur renvoie une erreur (SOAP Fault, identifiants incorrects, XML non conforme), ou si le texte retourné ne contient pas de numéro d'enregistrement (`idSaveEfact`), le code lève une exception.
3. Le bloc `catch` intercepte cette exception et met à jour instantanément la base de données :
   ```javascript
   console.error(`[TTN] Document ${doc.id} ÉCHEC:`, ttnErr.message);
   // Mettre le document en statut 'refusée par TTN'
   await db.promise().query(
     "UPDATE transaction_documents SET statut='refusée par TTN' WHERE id=?",
     [doc.id]
   );
   ```
4. Enfin, le statut global de la transaction parent passe lui aussi à `"refusée par TTN"`.

---

## 🛠️ Méthodes pour simuler et tester un refus

Voici les deux manières simples de tester ce flux de refus :

### 🔹 Méthode 1 : Avec le serveur simulé (Mock) — Le plus simple et rapide
Le serveur simulé [ttn_mock_server.py](file:///c:/Users/LENOVO%20PRO/OneDrive/Bureau/projet%20pfe/web/ttn_mock_server.py) valide la structure du matricule fiscal. Si le matricule a une longueur **inférieure à 7 caractères**, le Mock rejette l'authentification.

1. Ouvrez votre fichier `.env` (local ou sur le VPS selon l'endroit où vous testez).
2. Modifiez le matricule fiscal pour qu'il soit invalide et trop court, par exemple :
   ```env
   TTN_MATRICULE=123
   ```
3. Redémarrez votre serveur d'application :
   * **En local** : Arrêtez et relancez votre terminal Node.js.
   * **Sur le VPS** : Lancez le script de redémarrage :
     ```powershell
     python 2_redemarrer_pm2_vps.py
     ```
4. Connectez-vous à l'application **Médica-Sign** et signez une facture.
5. **Résultat immédiat** : Le serveur simulé Mock renvoie `"Authentication failed: Invalid matricule fiscale format"`. L'application Node.js ne trouve aucun `idSaveEfact`, lève l'erreur et passe immédiatement le document et la transaction au statut **`"refusée par TTN"`**.

---

### 🔹 Méthode 2 : Avec le vrai serveur TTN (En Local)
Si vous testez en local connecté au vrai serveur de pré-production de TTN, vous pouvez provoquer un refus de deux manières :

#### Option A : Erreur d'authentification réelle
1. Dans votre fichier [server/.env](file:///c:/Users/LENOVO%20PRO/OneDrive/Bureau/projet%20pfe/web/server/.env), modifiez le mot de passe réel par un mot de passe incorrect :
   ```env
   TTN_PASSWORD=mauvais_mot_de_passe
   ```
2. Redémarrez le serveur local.
3. Signez une facture.
4. **Résultat** : Le serveur réel de TTN renvoie une erreur d'authentification SOAP. L'appel échoue, et le document passe au statut **`"refusée par TTN"`**.

#### Option B : Erreur de conformité XML (Rejet de structure)
Le vrai serveur de TTN valide le XML par rapport au schéma XSD officiel d'Elfatoura.
1. Si l'application génère ou envoie un XML incomplet, corrompu, ou si vous téléversez un fichier texte arbitraire à la place du XML de facture, le vrai serveur TTN renverra un code d'erreur SOAP indiquant une non-conformité structurelle.
2. L'application Node.js interceptera cette erreur et appliquera le statut **`"refusée par TTN"`**.

---

## 📈 Comment vérifier que le refus a fonctionné ?

Une fois le test de refus effectué, vous pouvez vérifier le résultat à 3 niveaux :

1. **Sur l'Interface Web (Client)** : 
   * Allez dans l'historique des transactions. La transaction apparaîtra avec un badge rouge marqué **"refusée par TTN"**.
2. **Dans la console de votre serveur Node.js / PM2 Logs** :
   * Vous verrez les logs suivants confirmant l'échec et la mise à jour :
     ```text
     [TTN] raw saveRes for doc 42: HTTP 200, RAW: ... Authentication failed ...
     [TTN] Document 42 ÉCHEC: TTN_ID_NOT_FOUND (returnText was: Authentication failed: Invalid matricule fiscale format)
     ```
3. **Dans la Base de Données** :
   * Exécutez cette requête SQL pour voir les statuts :
     ```sql
     SELECT id, filename, statut FROM transaction_documents WHERE statut = 'refusée par TTN';
     ```
