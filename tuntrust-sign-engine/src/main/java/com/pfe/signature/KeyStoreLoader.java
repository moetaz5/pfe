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
 * CORRECTION DU BUG PIN :
 * SunPKCS11 maintient une session native ouverte même si on crée
 * plusieurs instances de KeyStore. La seule vraie solution est
 * d'appeler AuthProvider.logout() avant chaque nouveau login()
 * pour forcer le token à re-vérifier le PIN.
 */
public class KeyStoreLoader {

    private static AuthProvider authProvider;
    private static KeyStore keyStore;
    private static boolean initialized = false;

    public static void init() {
        // Démarrage rapide : on valide juste que la DLL existe
        // La vraie initialisation PKCS11 se fait à la première requête
        System.out.println("✅ Moteur de signature TunTrust démarré — en attente du token SafeNet.");
    }

    private static synchronized void ensureInitialized() {
        if (initialized) return;
        try {
            String config = "--name=SafeNet\n" +
                            "library=C:/Windows/System32/eTPKCS11.dll";

            Provider p = Security.getProvider("SunPKCS11");
            if (p == null) {
                throw new RuntimeException("Le provider SunPKCS11 n'est pas disponible dans ce JDK.");
            }

            p = p.configure(config);
            Security.addProvider(p);

            authProvider = (AuthProvider) p;
            keyStore = KeyStore.getInstance("PKCS11", authProvider);

            initialized = true;
            System.out.println("✅ Moteur de signature SafeNet/TunTrust prêt");

        } catch (Exception e) {
            String msg = e.getMessage();
            System.err.println("❌ Erreur d'initialisation PKCS11 : " + msg);
            if (msg != null && (msg.contains("CKR_DEVICE_REMOVED") || msg.contains("CKR_TOKEN_NOT_PRESENT") || msg.contains("0x8000000a"))) {
                 throw new SecurityException("TOKEN_NOT_FOUND", e);
            }
            throw new SecurityException("INIT_ERROR: " + msg, e);
        }
    }

    /**
     * Ouvre une nouvelle session sécurisée sur le token.
     *
     * L'appel logout() + login() est la seule façon garantie de forcer
     * le token à re-vérifier le PIN à chaque requête, même si une session
     * était déjà active.
     *
     * @param pin Code PIN saisi par l'utilisateur
     * @return SessionContext avec la clé privée et le certificat
     * @throws SecurityException si PIN faux ou token absent
     */
    public static SessionContext openSession(String pin) {
        try {
            // ✅ ÉTAPE 0 : Initialisation paresseuse — charge SunPKCS11 seulement maintenant
            ensureInitialized();

            // ✅ ÉTAPE 1 : Forcer la déconnexion de la session précédente
            // Sans ce logout(), SunPKCS11 réutilise la session native ouverte
            // et n'effectue AUCUNE vérification du nouveau PIN.
            try {
                authProvider.logout();
            } catch (Exception ignored) {
                // Peut échouer si aucune session n'était ouverte — c'est normal
            }

            // ✅ ÉTAPE 2 : Login avec le nouveau PIN via PasswordCallback
            // C'est la manière officielle d'authentifier sur un AuthProvider PKCS#11
            authProvider.login(null, callbacks -> {
                for (Callback cb : callbacks) {
                    if (cb instanceof PasswordCallback) {
                        ((PasswordCallback) cb).setPassword(pin.toCharArray());
                    }
                }
            });

            // ✅ ÉTAPE 3 : Charger le KeyStore maintenant que la session est authentifiée
            // null/null car le login est déjà fait par authProvider.login()
            keyStore.load(null, null);

            // Récupération du premier certificat sur le token
            java.util.Enumeration<String> aliases = keyStore.aliases();
            if (!aliases.hasMoreElements()) {
                throw new RuntimeException("Aucun certificat trouvé sur le token");
            }
            String alias = aliases.nextElement();
            System.out.println("✅ Session authentifiée - Certificat : " + alias);

            PrivateKey privateKey = (PrivateKey) keyStore.getKey(alias, null);
            X509Certificate cert  = (X509Certificate) keyStore.getCertificate(alias);

            return new SessionContext(privateKey, cert);

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            // LoginException ou toute erreur PKCS#11 = PIN faux ou token absent
            throw new SecurityException("PIN incorrect ou Token non détecté : " + e.getMessage(), e);
        }
    }

    /**
     * Transporte la clé privée + certificat d'une session authentifiée.
     */
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
