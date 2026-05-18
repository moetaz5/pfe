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
   - Numéro de facture (ex: Bgm/DocumentIdentifier = "0009")
   - Date de facture formatée en ddMMyy (ex: DateText = "160426" pour le 16 avril 2026)
   - Émetteur (PartnerDetails functionCode="I-62") : Matricule Fiscal, Nom, Adresse, Rue, Ville, Code Postal, Téléphone, Email, Forme juridique (SARL, SA, etc.)
   - Client (PartnerDetails functionCode="I-64") : Matricule Fiscal, Nom, Adresse, Ville, Code Postal
   - Lignes de facture (LinSection/Lin) :
     * <Quantity> dans <LinQty> : DOIT être dynamique et correspondre à la quantité réelle indiquée sur la facture. Elle doit être validée comme [Montant HT de la ligne (I-183)] / [Prix Unitaire Net (I-171)]. Par exemple, si la facture contient un lot unique (ex: 1 lot de 1000 jetons pour 500.000 HT), la quantité est bien 1 et le prix unitaire est 500.000. Si la facture indique une quantité de 4 pour un total de 1400.000, la quantité doit être 4 et le prix unitaire 350.000. Ne force jamais une quantité artificielle (comme 3) si la facture indique clairement 1.
     * Dans <LinMoa> :
       - Le premier <MoaDetails> avec amountTypeCode="I-183" DOIT être le Montant HT total de la ligne (par exemple, 500.000).
       - Le second <MoaDetails> avec amountTypeCode="I-171" DOIT être le Prix Unitaire Net de la ligne (par exemple, 500.000). Ne mets JAMAIS le montant de la TVA ou autre chose ici.
     * RÈGLE D'OR ARITHMÉTIQUE INVIOLABLE : Fais obligatoirement une validation mathématique pour chaque ligne ! La formule [Quantité] x [Prix Unitaire Net (I-171)] DOIT être rigoureusement égale au [Montant HT de la ligne (I-183)]. 
        Ne devine jamais des valeurs qui ne figurent pas dans le texte brut.
      * COMMENT DÉCODER LES COLONNES CONCATÉNÉES (ex: "11000 JETONS1500.0001995.0000500.000595.000") :
        Le parseur PDF peut coller les chiffres des colonnes sans espace. Décode toujours en analysant les nombres de droite à gauche et en faisant des validations arithmétiques croisées :
        - L'ordre logique des colonnes de gauche à droite est toujours : [Quantité][Prix Unitaire][Taux TVA][Montant TVA][Remise][Total HT][Total TTC].
        - Repère le Total HT de la ligne (ex: "500.000") et le Total TTC de la ligne (ex: "595.000").
        - Repère le Taux TVA (ex: 19) et le Montant TVA (ex: 95.000), qui forment ensemble la chaîne "1995.000".
        - Isole ce qui se trouve avant la TVA (ex: "1500.000").
        - La formule [Quantité] x [Prix Unitaire] doit faire exactement le Total HT (500.000). Le seul découpage possible de "1500.000" qui satisfait [Quantité] x [Prix Unitaire] = 500.000 est Quantité = 1 et Prix Unitaire = 500.000.
        - Applique ce raisonnement logique rigoureux à chaque ligne fusionnée pour extraire la Quantité exacte et le Prix Unitaire exact.
     * Le taux de TVA (TaxRate) de la ligne dans <LinTax> (par exemple 19).
    - Totaux de facture dans <InvoiceMoa> :
      * Le premier <AmountDetails> avec <Moa amountTypeCode="I-180"> : DOIT être le Total TTC de la facture (ex: 1667.000). Il contient obligatoirement l'élément enfant <AmountDescription lang="fr"> avec le montant TTC écrit en toutes lettres en français (ex: 'mille six cent soixante-sept dinars').
      * Le second <AmountDetails> avec <Moa amountTypeCode="I-176"> : DOIT être le Total HT global de la facture (ex: 1400.000).
      * Le troisième <AmountDetails> avec <Moa amountTypeCode="I-182"> : DOIT être la Base Imposable Globale soumise à TVA (ex: 1400.000). Ne mets jamais le montant de la TVA ici.
      * Le quatrième <AmountDetails> avec <Moa amountTypeCode="I-181"> : DOIT être le Montant de TVA total de la facture (ex: 266.000). Ne mets jamais le timbre fiscal ou le TTC ici.
    - Taxes de facture dans <InvoiceTax> :
      * Le premier <InvoiceTaxDetails> pour le droit de timbre avec <TaxTypeName code="I-1601">droit de timbre</TaxTypeName> et TaxRate = 0 : DOIT contenir un unique <AmountDetails> avec <Moa amountTypeCode="I-178"> égal au montant du timbre fiscal (ex: 1.000).
      * Le second <InvoiceTaxDetails> pour chaque taux de TVA avec <TaxTypeName code="I-1602">TVA 19</TaxTypeName> (ou autre taux s'il y a lieu) : DOIT obligatoirement contenir deux blocs <AmountDetails> successifs :
        - Le premier <AmountDetails> avec <Moa amountTypeCode="I-177"> : DOIT être la Base Imposable soumise à ce taux (ex: 1400.000).
        - Le second <AmountDetails> avec <Moa amountTypeCode="I-178"> : DOIT être le Montant de TVA associé à ce taux (ex: 266.000).
2. Le XML DOIT être parfaitement bien formé et syntaxiquement valide. Révise attentivement toutes les balises fermantes (par exemple, la balise <InvoiceMoa> doit OBLIGATOIREMENT se fermer par </InvoiceMoa>, et <InvoiceTax> par </InvoiceTax>). Ne mélange jamais les balises fermantes et n'oublie aucune fermeture.
3. Renvoie UNIQUEMENT le code XML brut complet et valide. Aucun texte explicatif, aucun bloc markdown de code (ne commence pas par \`\`\`xml). Le premier caractère doit être '<'.`;

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
