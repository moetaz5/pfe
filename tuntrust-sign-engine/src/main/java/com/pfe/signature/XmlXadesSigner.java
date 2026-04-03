package com.pfe.signature;

import org.apache.xml.security.Init;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.w3c.dom.*;

import javax.xml.crypto.dsig.*;
import javax.xml.crypto.dsig.dom.DOMSignContext;
import javax.xml.crypto.dsig.keyinfo.*;
import javax.xml.crypto.dsig.spec.C14NMethodParameterSpec;
import javax.xml.crypto.dsig.spec.TransformParameterSpec;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.Security;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.*;

public class XmlXadesSigner {

    static {
        Init.init(); // Santuario
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    public static byte[] signTradeNetLike(byte[] xml, PrivateKey privateKey, X509Certificate cert) throws Exception {

        Document doc = XmlUtil.parse(xml);

        // ---- XMLDSig factory
        XMLSignatureFactory fac = XMLSignatureFactory.getInstance("DOM");

        Transform enveloped = fac.newTransform(Transform.ENVELOPED, (TransformParameterSpec) null);
        Transform excC14n = fac.newTransform(CanonicalizationMethod.EXCLUSIVE, (TransformParameterSpec) null);

        // Reference document entier
        Reference refDoc = fac.newReference(
                "",
                fac.newDigestMethod(DigestMethod.SHA256, null),
                Arrays.asList(enveloped, excC14n),
                null,
                "Env-Reference"
        );

        // ---- construire SignedProperties XAdES (DOM)
        Element xadesSignedProps = buildXadesSignedProperties(doc, cert);
        // IMPORTANT: marquer @Id comme ID pour que la référence fonctionne
        xadesSignedProps.setIdAttribute("Id", true);

        // Reference SignedProperties
        Reference refSignedProps = fac.newReference(
                "#xades-SigFrs",
                fac.newDigestMethod(DigestMethod.SHA256, null),
                Collections.singletonList(excC14n),
                "http://uri.etsi.org/01903#SignedProperties",
                null
        );

        SignedInfo si = fac.newSignedInfo(
                fac.newCanonicalizationMethod(CanonicalizationMethod.EXCLUSIVE, (C14NMethodParameterSpec) null),
                fac.newSignatureMethod(SignatureMethod.RSA_SHA256, null),
                Arrays.asList(refDoc, refSignedProps)
        );

        // KeyInfo (X509Certificate)
        KeyInfoFactory kif = fac.getKeyInfoFactory();
        X509Data xd = kif.newX509Data(Collections.singletonList(cert));
        KeyInfo ki = kif.newKeyInfo(Collections.singletonList(xd));

        // ds:Object contenant QualifyingProperties
        XMLObject xadesObject = fac.newXMLObject(
                Collections.singletonList(new javax.xml.crypto.dom.DOMStructure(buildQualifyingProperties(doc, xadesSignedProps))),
                null, null, null
        );

        // Signature: Id et SignatureValueId comme l’exemple
        XMLSignature signature = fac.newXMLSignature(
                si,
                ki,
                Collections.singletonList(xadesObject),
                "SigFrs",
                "value-SigFrs"
        );

        // signer
        DOMSignContext dsc = new DOMSignContext(privateKey, doc.getDocumentElement());
        dsc.setDefaultNamespacePrefix("ds");

        signature.sign(dsc);

        return XmlUtil.toBytes(doc);
    }

    private static Element buildXadesSignedProperties(Document doc, X509Certificate cert) throws Exception {
        Element signedProps = doc.createElementNS("http://uri.etsi.org/01903/v1.3.2#", "xades:SignedProperties");
        signedProps.setAttribute("Id", "xades-SigFrs");

        Element ssp = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SignedSignatureProperties");

        // SigningTime (UTC)
        Element signingTime = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SigningTime");
        signingTime.setTextContent(Instant.now().toString());
        ssp.appendChild(signingTime);

        // SigningCertificateV2
        Element signingCertV2 = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SigningCertificateV2");
        Element certEl = doc.createElementNS(signedProps.getNamespaceURI(), "xades:Cert");

        // CertDigest (SHA-512 du certificat)
        byte[] certDigest = MessageDigest.getInstance("SHA-512").digest(cert.getEncoded());
        Element certDigestEl = doc.createElementNS(signedProps.getNamespaceURI(), "xades:CertDigest");

        Element dm = doc.createElementNS("http://www.w3.org/2000/09/xmldsig#", "ds:DigestMethod");
        dm.setAttribute("Algorithm", "http://www.w3.org/2001/04/xmlenc#sha512");

        Element dv = doc.createElementNS("http://www.w3.org/2000/09/xmldsig#", "ds:DigestValue");
        dv.setTextContent(Base64.getEncoder().encodeToString(certDigest));

        certDigestEl.appendChild(dm);
        certDigestEl.appendChild(dv);
        certEl.appendChild(certDigestEl);

        // IssuerSerialV2 (format libre, TradeNet peut accepter, sinon adapte selon spec)
        Element issuerSerialV2 = doc.createElementNS(signedProps.getNamespaceURI(), "xades:IssuerSerialV2");
        issuerSerialV2.setTextContent(cert.getIssuerX500Principal().getName() + " | " + cert.getSerialNumber().toString());
        certEl.appendChild(issuerSerialV2);

        signingCertV2.appendChild(certEl);
        ssp.appendChild(signingCertV2);

        // SignaturePolicyIdentifier (EPES)
        Element spi = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SignaturePolicyIdentifier");
        Element spid = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SignaturePolicyId");
        Element sigPolicyId = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SigPolicyId");

        Element identifier = doc.createElementNS(signedProps.getNamespaceURI(), "xades:Identifier");
        identifier.setAttribute("Qualifier", "OIDasURN");
        identifier.setTextContent("urn:2.16.788.1.2.1");

        Element descr = doc.createElementNS(signedProps.getNamespaceURI(), "xades:Description");
        descr.setTextContent("Politique de signature de la facture electronique");

        sigPolicyId.appendChild(identifier);
        sigPolicyId.appendChild(descr);
        spid.appendChild(sigPolicyId);

        // Hash policy doc (SHA-256 du PDF)
        byte[] policyPdf = TradeNetPolicyLoader.loadPolicyPdfBytes();
        byte[] policyHash = MessageDigest.getInstance("SHA-256").digest(policyPdf);

        Element sph = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SigPolicyHash");
        Element dm2 = doc.createElementNS("http://www.w3.org/2000/09/xmldsig#", "ds:DigestMethod");
        dm2.setAttribute("Algorithm", "http://www.w3.org/2001/04/xmlenc#sha256");
        Element dv2 = doc.createElementNS("http://www.w3.org/2000/09/xmldsig#", "ds:DigestValue");
        dv2.setTextContent(Base64.getEncoder().encodeToString(policyHash));
        sph.appendChild(dm2);
        sph.appendChild(dv2);

        Element qualifiers = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SigPolicyQualifiers");
        Element qualifier = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SigPolicyQualifier");
        Element spuri = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SPURI");
        spuri.setTextContent("http://www.tradenet.com.tn/portal/telechargerTelechargement?lien=Politique_de_Signature_de_la_facture_electronique.pdf");
        qualifier.appendChild(spuri);
        qualifiers.appendChild(qualifier);

        spid.appendChild(sph);
        spid.appendChild(qualifiers);
        spi.appendChild(spid);

        ssp.appendChild(spi);

        signedProps.appendChild(ssp);

        // SignedDataObjectProperties : DataObjectFormat
        Element sdop = doc.createElementNS(signedProps.getNamespaceURI(), "xades:SignedDataObjectProperties");
        Element dof = doc.createElementNS(signedProps.getNamespaceURI(), "xades:DataObjectFormat");
        dof.setAttribute("ObjectReference", "#Env-Reference");
        Element mime = doc.createElementNS(signedProps.getNamespaceURI(), "xades:MimeType");
        mime.setTextContent("application/octet-stream");
        dof.appendChild(mime);
        sdop.appendChild(dof);
        signedProps.appendChild(sdop);

        return signedProps;
    }

    private static Element buildQualifyingProperties(Document doc, Element signedProps) {
        Element obj = doc.createElementNS("http://uri.etsi.org/01903/v1.3.2#", "xades:QualifyingProperties");
        obj.setAttribute("Target", "#SigFrs");

        // SignedProperties (avec ses enfants)
        obj.appendChild(signedProps);
        return obj;
    }
}
