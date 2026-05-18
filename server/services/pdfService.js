const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const QRCode = require("qrcode");
const pdfParse = require("pdf-parse");
const axios = require("axios");

const safeJsonParse = (val) => {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
};

const resolveConfig = (config) => {
  if (!config) return null;

  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch {
      return null;
    }
  }

  return config.configuration || config;
};

const extractReferenceCEVFromXml = (xmlText) => {
  const m = String(xmlText || "").match(
    /<ReferenceCEV>([\s\S]*?)<\/ReferenceCEV>/i,
  );
  return m ? m[1].trim() : null; // base64 PNG
};

const extractReferenceTTNFromXml = (xmlText) => {
  const m = String(xmlText || "").match(
    /<ReferenceTTN[^>]*>([\s\S]*?)<\/ReferenceTTN>/i,
  );
  return m ? m[1].trim() : null;
};

// Génère un QR PNG base64 depuis une chaine (fallback)
const generateQrPngBase64 = async (text) => {
  const dataUrl = await QRCode.toDataURL(String(text || ""), {
    margin: 1,
    scale: 6,
  });
  // "data:image/png;base64,...."
  return dataUrl.split(",")[1];
};

const stampPdfWithTTN = async ({
  pdfB64,
  qrPngB64,
  ttnReference,
  qrConfig,
  refConfig,
}) => {
  const pdfBytes = Buffer.from(String(pdfB64), "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (!pages.length) throw new Error("PDF vide");

  const qrConf = resolveConfig(qrConfig) || {};
  const refConf = resolveConfig(refConfig) || {};

  const pageIndex = Math.max(
    0,
    (qrConf.qrPositionP || refConf.labelPositionP || 1) - 1,
  );

  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const { width, height } = page.getSize();

  // ================= QR =================
  if (qrPngB64) {
    const pngImage = await pdfDoc.embedPng(Buffer.from(qrPngB64, "base64"));

    const qrW = Number(qrConf.qrWidth || 120);
    const qrH = Number(qrConf.qrHeight || 120);

    // Frontend already converts to pdf-lib bottom-origin coordinates
    let x = Number(qrConf.qrPositionX || 0);
    let y = Number(qrConf.qrPositionY || 0);

    // Protection limites
    if (x + qrW > width) x = width - qrW - 5;
    if (x < 0) x = 5;
    if (y < 0) y = 5;
    if (y + qrH > height) y = height - qrH - 5;

    page.drawImage(pngImage, {
      x,
      y,
      width: qrW,
      height: qrH,
    });
  }

  // ================= REFERENCE =================
  if (ttnReference) {
    const labelText =
      (refConf.referenceText ||
        "Copie de la facture electronique enregistree aupres de TTN sous la reference unique n :") +
      " " +
      ttnReference;

    // Frontend already converts to pdf-lib bottom-origin coordinates
    let x = Number(refConf.labelPositionX || 0);
    let y = Number(refConf.labelPositionY || 0);

    if (x < 0) x = 5;
    if (y < 0) y = 5;

    page.drawText(labelText, {
      x,
      y,
      size: 9,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Number(refConf.labelWidth || 400),
    });
  }

  const outBytes = await pdfDoc.save();
  return Buffer.from(outBytes).toString("base64");
};

const generateXmlFromPdf = async (pdfBuffer) => {
  try {
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text;

    if (!extractedText || !extractedText.trim()) {
      throw new Error("Impossible d'extraire le texte du PDF. Assurez-vous qu'il ne s'agit pas d'une image scannée sans texte.");
    }

    console.log("[AI] Texte extrait du PDF de taille :", extractedText.length);

    const systemPrompt = `Tu es un parseur d'intelligence artificielle de premier ordre, spécialisé dans la facturation et le format TEIF XML de Tunisie TradeNet (TTN).
Ton rôle est d'analyser le texte brut extrait d'une facture PDF et de générer un XML TEIF conforme à 100% au schéma standard TTN (Tunisie TradeNet).

Voici un exemple exact de structure TEIF XML attendue :
<?xml version="1.0" encoding="UTF-8"?>
<TEIF controlingAgency="TTN" version="1.8.9">
  <InvoiceHeader>
    <MessageSenderIdentifier type="I-01">1688843N</MessageSenderIdentifier>
    <MessageRecieverIdentifier type="I-01">1367438TAM000</MessageRecieverIdentifier>
  </InvoiceHeader>
  <InvoiceBody>
    <Bgm>
      <DocumentIdentifier>0009</DocumentIdentifier>
      <DocumentType code="I-11">Facture</DocumentType>
    </Bgm>
    <Dtm>
      <DateText format="ddMMyy" functionCode="I-31">160426</DateText>
    </Dtm>
    <PartnerSection>
      <PartnerDetails functionCode="I-62">
        <Nad>
          <PartnerIdentifier type="I-01">1688843N</PartnerIdentifier>
          <PartnerName nameType="Qualification">MEDICACOM</PartnerName>
          <PartnerAdresses lang="fr">
            <AdressDescription>Sfax ville</AdressDescription>
            <Street>SFAX</Street>
            <CityName>SFAX</CityName>
            <PostalCode>3000</PostalCode>
            <Country codeList="ISO_3166-1">TN</Country>
          </PartnerAdresses>
        </Nad>
        <RffSection>
          <Reference refID="I-815">B08260452020</Reference>
        </RffSection>
        <RffSection>
          <Reference refID="I-816">SARL</Reference>
        </RffSection>
        <CtaSection>
          <Contact functionCode="I-94">
            <ContactIdentifier>MEDICACOM</ContactIdentifier>
            <ContactName>MEDICACOM</ContactName>
          </Contact>
          <Communication>
            <ComMeansType>I-101</ComMeansType>
            <ComAdress>26411058</ComAdress>
          </Communication>
        </CtaSection>
        <CtaSection>
          <Contact functionCode="I-94">
            <ContactIdentifier>MEDICACOM</ContactIdentifier>
            <ContactName>MEDICACOM</ContactName>
          </Contact>
        </CtaSection>
        <CtaSection>
          <Contact functionCode="I-94">
            <ContactIdentifier>TTN</ContactIdentifier>
            <ContactName>MEDICACOM</ContactName>
          </Contact>
          <Communication>
            <ComMeansType>I-103</ComMeansType>
            <ComAdress>contact@medicacom.tn</ComAdress>
          </Communication>
        </CtaSection>
      </PartnerDetails>
      <PartnerDetails functionCode="I-64">
        <Nad>
          <PartnerIdentifier type="I-01">1367438TAM000</PartnerIdentifier>
          <PartnerName nameType="Qualification">MEDIPHARM</PartnerName>
          <PartnerAdresses lang="fr">
            <AdressDescription>Rue de Marseille Cité Merdesse</AdressDescription>
            <CityName>KELIBIA</CityName>
            <PostalCode>8090s</PostalCode>
            <Country codeList="ISO_3166-1">TN</Country>
          </PartnerAdresses>
        </Nad>
        <RffSection>
          <Reference refID="I-81">1367438TAM000</Reference>
        </RffSection>
      </PartnerDetails>
    </PartnerSection>
    <PytSection>
      <PytSectionDetails>
        <Pyt>
          <PaymentTearmsTypeCode>I-116</PaymentTearmsTypeCode>
          <PaymentTearmsDescription>Sans Paiement</PaymentTearmsDescription>
        </Pyt>
      </PytSectionDetails>
    </PytSection>
    <LinSection>
      <Lin>
        <ItemIdentifier>1</ItemIdentifier>
        <LinImd lang="fr">
          <ItemCode>1</ItemCode>
          <ItemDescription>1000 JETONS</ItemDescription>
        </LinImd>
        <LinQty>
          <Quantity measurementUnit="UNIT">1</Quantity>
        </LinQty>
        <LinTax>
          <TaxTypeName code="I-1602">TVA</TaxTypeName>
          <TaxDetails>
            <TaxRate>19</TaxRate>
          </TaxDetails>
        </LinTax>
        <LinMoa>
          <MoaDetails>
            <Moa amountTypeCode="I-183" currencyCodeList="ISO_4217">
              <Amount currencyIdentifier="TND">500.000</Amount>
            </Moa>
          </MoaDetails>
          <MoaDetails>
            <Moa amountTypeCode="I-171" currencyCodeList="ISO_4217">
              <Amount currencyIdentifier="TND">500.000</Amount>
            </Moa>
          </MoaDetails>
        </LinMoa>
      </Lin>
    </LinSection>
    <InvoiceMoa>
      <AmountDetails>
        <Moa amountTypeCode="I-180" currencyCodeList="ISO_4217">
          <Amount currencyIdentifier="TND">596.000</Amount>
          <AmountDescription lang="fr">cinq cent quatre-vingt-seize dinars</AmountDescription>
        </Moa>
      </AmountDetails>
      <AmountDetails>
        <Moa amountTypeCode="I-176" currencyCodeList="ISO_4217">
          <Amount currencyIdentifier="TND">500.000</Amount>
        </Moa>
      </AmountDetails>
      <AmountDetails>
        <Moa amountTypeCode="I-182" currencyCodeList="ISO_4217">
          <Amount currencyIdentifier="TND">500.000</Amount>
        </Moa>
      </AmountDetails>
      <AmountDetails>
        <Moa amountTypeCode="I-181" currencyCodeList="ISO_4217">
          <Amount currencyIdentifier="TND">95.000</Amount>
        </Moa>
      </AmountDetails>
    </InvoiceMoa>
    <InvoiceTax>
      <InvoiceTaxDetails>
        <Tax>
          <TaxTypeName code="I-1601">droit de timbre</TaxTypeName>
          <TaxDetails>
            <TaxRate>0</TaxRate>
          </TaxDetails>
        </Tax>
        <AmountDetails>
          <Moa amountTypeCode="I-178" currencyCodeList="ISO_4217">
            <Amount currencyIdentifier="TND">1.000</Amount>
          </Moa>
        </AmountDetails>
      </InvoiceTaxDetails>
      <InvoiceTaxDetails>
        <Tax>
          <TaxTypeName code="I-1602">TVA 19</TaxTypeName>
          <TaxDetails>
            <TaxRate>19</TaxRate>
          </TaxDetails>
        </Tax>
        <AmountDetails>
          <Moa amountTypeCode="I-177" currencyCodeList="ISO_4217">
            <Amount currencyIdentifier="TND">500.000</Amount>
          </Moa>
        </AmountDetails>
        <AmountDetails>
          <Moa amountTypeCode="I-178" currencyCodeList="ISO_4217">
            <Amount currencyIdentifier="TND">95.000</Amount>
          </Moa>
        </AmountDetails>
      </InvoiceTaxDetails>
    </InvoiceTax>
  </InvoiceBody>
</TEIF>

Consignes strictes :
1. Extrais TOUTES les informations du texte brut :
   - Numero de facture (Bgm/DocumentIdentifier)
   - Date formatee en ddMMyy (ex: "110526" pour le 11 mai 2026)
   - Emetteur (PartnerDetails functionCode="I-62") : Matricule Fiscal, Nom, Adresse, Rue, Ville, Code Postal, Email
     OBLIGATOIRE : Ajouter apres </Nad> les RffSection suivants pour l emetteur :
     <RffSection><Reference refID="I-815">[Numero Registre de Commerce]</Reference></RffSection>
     <RffSection><Reference refID="I-816">[Forme Juridique ex: SARL/SA]</Reference></RffSection>
   - Client (PartnerDetails functionCode="I-64") : Matricule Fiscal, Nom, Adresse, Ville, Code Postal
     OBLIGATOIRE : Ajouter apres </Nad> la RffSection suivante pour le client :
     <RffSection><Reference refID="I-81">[Matricule Fiscale du client]</Reference></RffSection>

   - Lignes de facture (LinSection/Lin) via ALGORITHME UNIVERSEL en 5 ETAPES :

      ETAPE 1 - Extraire les totaux fiables du bas du document :
        Localiser "Total HT", "TVA", "Timbre fiscal", "Total TTC".
        Ce sont les references absolues les plus fiables.

      ETAPE 2 - Localiser le bloc numerique de chaque ligne d article.
        Le parseur PDF colle souvent les colonnes sans espace.
        La description peut apparaitre sur une ligne separee avant le bloc numerique.
        Ordre des colonnes (gauche a droite) :
        [Quantite][Prix Unitaire][Taux TVA][Montant TVA][Remise][Total HT ligne][Total TTC ligne]

      ETAPE 3 - Decoder le bloc de DROITE a GAUCHE :
        a. Isoler le Total TTC ligne (dernier montant, format NNN.NNN ou N NNN.NNN).
        b. Isoler le Total HT ligne (avant-dernier). Confirmer avec Total HT global.
        c. Isoler la Remise (souvent 0).
        d. Isoler le Montant TVA ligne.
        e. Isoler le Taux TVA (entier, ex: 19).
        f. Ce qui reste a gauche = concatenation [Quantite][PrixUnitaire].

      ETAPE 4 - Determiner Quantite et Prix Unitaire par VALIDATION MATHEMATIQUE uniquement :
        Tester chaque coupure possible (Qte entiere >= 1) jusqu a trouver la paire unique
        ou : Quantite x Prix Unitaire = Total HT ligne (a 0.001 pres).
        INTERDICTION de presupposer la quantite avant le calcul.

        REGLE CRITIQUE - NE JAMAIS INFERER LA QUANTITE DEPUIS LA DESCRIPTION :
        La description textuelle de l article (ex: "abonnement... les mois fevrier-mars-avril-mai")
        ne determine JAMAIS la quantite. Meme si la description evoque plusieurs mois ou unites,
        la quantite DOIT etre extraite exclusivement du bloc numerique par validation mathematique.
        Exemple concret : "4350.00019266.00001 400.0001 666.000" => la description est sur une
        ligne separee, mais le "4" au debut du bloc numerique est la Quantite, et "350.000" est
        le Prix Unitaire, car 4 x 350.000 = 1400.000 = Total HT. Ne pas mettre Quantite=1.

        TROIS EXEMPLES REELS (references absolues) :

        DEFINITION ABSOLUE DES CODES LinMoa :
          I-183 = Montant HT TOTAL de la ligne (Quantite x Prix Unitaire)
          I-171 = Prix Unitaire HT NET (montant pour 1 unite)
          REGLES DE VALIDATION : Quantite x I-171 = I-183 (toujours)

        Exemple A : Qte=1, PU=500 DT HT, TVA 19%
          Total HT ligne = 1 x 500 = 500.000
          Total TTC ligne = 500 + 95 = 595.000
          => <Quantity>1</Quantity>
          => I-183 = 500.000  (Total HT ligne)
          => I-171 = 500.000  (Prix unitaire = HT total car Qte=1)

        Exemple B : Qte=4, PU=350 DT HT, TVA 19%
          Total HT ligne = 4 x 350 = 1400.000
          Total TTC ligne = 1400 + 266 = 1666.000
          => <Quantity>4</Quantity>
          => I-183 = 1400.000  (Total HT ligne = 4 x 350)
          => I-171 = 350.000   (Prix unitaire HT)
          VERIFICATION : 4 x 350 = 1400 [OK]

        Exemple C : Qte=1, PU=6000 DT HT, TVA 19%, Timbre=1 DT
          Total HT ligne = 1 x 6000 = 6000.000
          TVA = 6000 x 0.19 = 1140.000
          Total TTC = 6000 + 1140 + 1 = 7141.000
          => <Quantity>1</Quantity>
          => I-183 = 6000.000  (Total HT ligne)
          => I-171 = 6000.000  (Prix unitaire = HT total car Qte=1)
          => InvoiceMoa : I-176=6000 | I-182=6000 | I-181=1140 | I-180=7141

      ETAPE 5 - Validation croisee finale (OBLIGATOIRE avant de generer le XML) :
        [OK] Quantite x I-171 = I-183  (validation mathematique obligatoire)
        [OK] Somme(I-183 de toutes les lignes) = I-176 (Total HT global)
        [OK] I-176 x Taux / 100 = I-181 (Montant TVA global, a 0.001 pres)
        [OK] I-176 + I-181 + Timbre = I-180 (Total TTC, a 0.001 pres)
        Si un test echoue : recommencer ETAPE 4 avec une autre coupure.

      Remplissage de <LinMoa> :
        - amountTypeCode="I-183" = Montant HT TOTAL de la ligne (Quantite x Prix Unitaire HT).
        - amountTypeCode="I-171" = Prix Unitaire HT NET (= I-183 / Quantite). Egal a I-183 si Qte=1.
      Remplissage de <LinTax> : TaxRate = valeur isolee a l Etape 3e.

   - Totaux dans <InvoiceMoa> :
     * I-180 : Total TTC + enfant <AmountDescription lang="fr"> avec montant en toutes lettres.
     * I-176 : Total HT global.
     * I-182 : Base Imposable soumise a TVA (= Total HT). Ne jamais mettre la TVA ici.
     * I-181 : Montant TVA total. Ne jamais mettre le timbre ou le TTC ici.

   - Taxes dans <InvoiceTax> :
     * 1er <InvoiceTaxDetails> : droit de timbre (code I-1601), TaxRate=0,
       un seul <AmountDetails> I-178 = montant timbre fiscal.
     * 2e <InvoiceTaxDetails> : TVA (code I-1602), TaxRate selon la facture,
       DEUX <AmountDetails> consecutifs obligatoires :
       - I-177 = Base Imposable soumise a ce taux (= Total HT de la ligne).
       - I-178 = Montant TVA associe a ce taux.

2. Le XML doit etre parfaitement bien forme. Verifier toutes les balises fermantes,
   en particulier </LinMoa>, </Lin>, </LinSection>, </InvoiceMoa>, </InvoiceTax>, </InvoiceBody>, </TEIF>.
3. Renvoyer UNIQUEMENT le XML brut valide. Aucun texte, commentaire ou bloc markdown.
   Le premier caractere doit etre '<'.`;


    const openRouterResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Voici le texte brut extrait du PDF de la facture :\n\n${extractedText}` }
        ],
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://medicasign.medicacom.tn",
          "X-Title": "Medica-Sign AI XML Generator",
        }
      }
    );

    let xml = openRouterResponse.data.choices[0].message.content.trim();
    if (xml.startsWith("```")) {
      xml = xml.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    }
    return xml.trim();
  } catch (err) {
    console.error("[AI PDF parser error]:", err.message);
    throw err;
  }
};

module.exports = {
  safeJsonParse,
  resolveConfig,
  extractReferenceCEVFromXml,
  extractReferenceTTNFromXml,
  generateQrPngBase64,
  stampPdfWithTTN,
  generateXmlFromPdf
};
