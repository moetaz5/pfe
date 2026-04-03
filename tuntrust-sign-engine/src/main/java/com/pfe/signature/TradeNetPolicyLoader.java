package com.pfe.signature;

import java.io.InputStream;
import java.security.MessageDigest;

public class TradeNetPolicyLoader {

    public static byte[] loadPolicyPdfBytes() throws Exception {
        InputStream is = TradeNetPolicyLoader.class.getClassLoader()
                .getResourceAsStream("policy/Politique_de_Signature_de_la_facture_electronique.pdf");
        if (is == null) {
            throw new RuntimeException("policy PDF introuvable dans resources/policy/");
        }
        return is.readAllBytes();
    }

    public static byte[] sha256(byte[] data) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        return md.digest(data);
    }
}
