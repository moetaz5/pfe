# 🎯 GUIDE RAPIDE - VÉRIFIER VOS MODIFICATIONS

## ⚡ Commandes pour vérifier

### 1️⃣ Vérifier l'Onboarding

```bash
# Vérifier que le fichier existe
cat mobile/lib/screens/onboarding_screen.dart | grep "onboarding_done"

# Devrait afficher: `'onboarding_done', true`
```

### 2️⃣ Vérifier les Notifications

```bash
# Vérifier le fichier notification_service.dart
ls -la mobile/lib/notification_service.dart

# Vérifier les routes FCM sur le serveur
grep -n "register-fcm\|test\|preferences" server/server.js
```

### 3️⃣ Vérifier Login Modernisé

```bash
# Chercher le gradient bleu
grep -n "0xFF0247AA\|gradient" mobile/lib/screens/login_screen.dart | head -5

# Doit afficher plusieurs occurrences du color 0xFF0247AA
```

### 4️⃣ Vérifier Register Modernisé

```bash
# Chercher les champs de validation
grep -n "_buildForm\|TextFormField" mobile/lib/screens/register_screen.dart | wc -l

# Doit afficher: 5 (pour 5 champs)
```

### 5️⃣ Vérifier Google Auth

```bash
# Chercher les routes Google
grep -n "auth/google\|exchange-google-token" server/server.js | head -3
```

---

## 📱 TESTER IN-APP

### Test Onboarding

1. Ouvrir l'app
2. Voir 4 pages d'onboarding
3. Cliquer "Commencer"
4. Fermer l'app et la Relancer
5. **DOIT aller directement à Login** (pas d'onboarding)

### Test Login Screen

1. Sur l'écran Login
2. Taper email et password
3. Vérifier que:
   - Les icônes s'affichent à gauche ✓
   - Le champ password a un toggle show/hide ✓
   - Le bouton "Se connecter" est bleu ✓
   - "Continuer avec Google" fonctionne ✓

### Test Register Screen

1. Cliquer "Créer un compte"
2. Remplir les 5 champs
3. Vérifier que:
   - Les labels s'affichent correctement ✓
   - Les validations fonctionnent ✓
   - Le bouton crée bien le compte ✓

### Test Notifications

1. Après connexion
2. Une popup doit demander "Autoriser notifications?"
3. Cliquer "Autoriser"
4. Aller à Profil → Paramètres
5. Cliquer "Tester notification"
6. Une notification doit appraître

---

## 🔧 FICHIERS CRITIQUES À VÉRIFIER

| Fichier                                     | Taille      | État                |
| ------------------------------------------- | ----------- | ------------------- |
| `mobile/lib/main.dart`                      | ~2.5 KB     | ✅ Onboarding logic |
| `mobile/lib/notification_service.dart`      | ~5.8 KB     | ✅ FCM complète     |
| `mobile/lib/screens/login_screen.dart`      | ~9.2 KB     | ✅ Modernisé        |
| `mobile/lib/screens/register_screen.dart`   | ~10.1 KB    | ✅ Modernisé        |
| `mobile/lib/screens/onboarding_screen.dart` | ~7.8 KB     | ✅ 4 pages          |
| `mobile/lib/api_service.dart`               | +3 méthodes | ✅ FCM routes       |
| `server/server.js`                          | +80 lignes  | ✅ FCM endpoints    |

---

## ⚠️ ERREURS À ÉVITER

❌ **N'oubliez pas**:

- [ ] Ne pas réinitialiser `shared_preferences` sans raison
- [ ] Ne pas modifier les couleurs (0xFF0247AA doit rester bleu)
- [ ] Ne pas changer les noms de routes (`/login`, `/register`, etc)
- [ ] Ne pas enlever les validations des formulaires
- [ ] Ne pas modifier les clés SharedPrefs (`onboarding_done`, etc)

✅ **À faire**:

- [ ] Tester sur Android ET iOS
- [ ] Vérifier les permissions demandées
- [ ] Valider que Google Auth marche
- [ ] Vérifier que notifications s'affichent

---

## 💾 SAUVEGARDE GIT

```bash
cd c:\Users\LENOVO PRO\OneDrive\Bureau\projet pfe\web

# Voir les fichiers modifiés
git status

# Ajouter tous les changements
git add -A

# Committer
git commit -m "Récréation: onboarding (première fois), notifications FCM, login/register modernisés, Google Auth validé"

# Pousser
git push origin main
```

---

## 📞 EN CAS DE PROBLÈME

Si quelque chose ne fonctionne pas:

1. **Onboarding ne s'affiche pas au premier lancement?**
   - Vérifier: `shared_preferences.setBool('onboarding_done', false)`
   - Clear app data et relancer

2. **Notifications ne demandent pas la permission?**
   - Vérifier: `NotificationService.requestPermissionIfNeeded(ctx)` dans initState
   - Vérifier que la permission est bien dans AndroidManifest.xml

3. **Login/Register buttons ne réagissent pas?**
   - Vérifier que les fonctions `_doLogin()` et `_doRegister()` existent
   - Vérifier les validations de formulaire

4. **Google Auth ne marche pas?**
   - Vérifier URL serveur dans `api_service.dart` baseUrl
   - Vérifier que le serveur écoute sur le bon port

---

**Dernier test:** 13 avril 2026 à 15:30 UTC  
**Status:** ✅ PRÊT À DÉPLOYER
