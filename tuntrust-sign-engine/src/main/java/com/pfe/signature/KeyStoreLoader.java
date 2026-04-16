package com.pfe.signature;

import javax.security.auth.callback.Callback;
import javax.security.auth.callback.PasswordCallback;
import java.security.AuthProvider;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Provider;
import java.security.Security;
import java.security.cert.X509Certificate;

/**
 * Gestion du token PKCS#11 SafeNet/TunTrust.
 *
 * CORRECTION DU BUG "PIN incorrect à la 2ème signature" :
 * SunPKCS11 maintient un état interne après la 1ère session.
 * La solution : supprimer et re-créer entièrement le provider
 * à chaque openSession() pour repartir d'un état propre.
 */
public class KeyStoreLoader {

    private static final String PKCS11_CONFIG =
        "--name=SafeNet\n" +
        "library=C:/Windows/System32/eTPKCS11.dll";

    public static void init() {
        System.out.println("✅ Moteur de signature TunTrust démarré — en attente du token SafeNet.");
    }

    /**
     * Ouvre une nouvelle session sécurisée — entièrement réinitialisée à chaque appel.
     * Cela garantit que le PIN est toujours re-vérifié, même après plusieurs signatures.
     */
    public static synchronized SessionContext openSession(String pin) {
        try {
            // ✅ ÉTAPE 1 : Supprimer l'ancien provider SafeNet s'il existe
            // Ceci force SunPKCS11 à repartir d'un état propre à chaque requête
            Provider existing = Security.getProvider("SunPKCS11-SafeNet");
            if (existing != null) {
                try {
                    ((AuthProvider) existing).logout();
                } catch (Exception ignored) {}
                Security.removeProvider("SunPKCS11-SafeNet");
            }

            // ✅ ÉTAPE 2 : Créer un nouveau provider SunPKCS11 propre
            Provider base = Security.getProvider("SunPKCS11");
            if (base == null) {
                throw new RuntimeException("Le provider SunPKCS11 n'est pas disponible dans ce JDK.");
            }
            Provider p = base.configure(PKCS11_CONFIG);
            Security.addProvider(p);
            AuthProvider authProvider = (AuthProvider) p;

            // ✅ ÉTAPE 3 : Login avec le PIN via PasswordCallback
            authProvider.login(null, callbacks -> {
                for (Callback cb : callbacks) {
                    if (cb instanceof PasswordCallback) {
                        ((PasswordCallback) cb).setPassword(pin.toCharArray());
                    }
                }
            });

            // ✅ ÉTAPE 4 : Charger le KeyStore (session fraîche = succès garanti)
            KeyStore ks = KeyStore.getInstance("PKCS11", authProvider);
            ks.load(null, null);

            // Récupération du premier certificat sur le token
            java.util.Enumeration<String> aliases = ks.aliases();
            if (!aliases.hasMoreElements()) {
                throw new RuntimeException("Aucun certificat trouvé sur le token");
            }
            String alias = aliases.nextElement();
            System.out.println("✅ Session authentifiée - Certificat : " + alias);

            PrivateKey privateKey = (PrivateKey) ks.getKey(alias, null);
            X509Certificate cert  = (X509Certificate) ks.getCertificate(alias);

            return new SessionContext(privateKey, cert);

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            String msg = e.getMessage();
            System.err.println("X Erreur session PKCS11 : " + msg);
            if (msg != null && (
                msg.contains("CKR_DEVICE_REMOVED") ||
                msg.contains("CKR_TOKEN_NOT_PRESENT") ||
                msg.contains("0x8000000a") ||
                msg.contains("No token present")
            )) {
                throw new SecurityException("TOKEN_NOT_FOUND", e);
            }
            throw new SecurityException("PIN_INCORRECT", e);
        }
    }

    public static class SessionContext {
        private final PrivateKey privateKey;
        private final X509Certificate certificate;

        public SessionContext(PrivateKey privateKey, X509Certificate certificate) {
            this.privateKey  = privateKey;
            this.certificate = certificate;
        }

        public PrivateKey getPrivateKey()       { return privateKey; }
        public X509Certificate getCertificate() { return certificate; }
    }
}
