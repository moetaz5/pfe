import re

filepath = r"server/services/pdfService.js"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# The new instructions block - replaces everything from "Consignes strictes" to the backtick-semicolon
new_instructions = r"""Consignes strictes :
1. Extrais TOUTES les informations du texte brut :
   - Numero de facture (Bgm/DocumentIdentifier)
   - Date formatee en ddMMyy (ex: "110526" pour le 11 mai 2026)
   - Emetteur (PartnerDetails functionCode="I-62") : Matricule Fiscal, Nom, Adresse, Rue, Ville, Code Postal, Email
   - Client (PartnerDetails functionCode="I-64") : Matricule Fiscal, Nom, Adresse, Ville, Code Postal

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

        DEUX EXEMPLES REELS (references absolues) :

        Exemple A : Bloc = "11000 JETONS1500.0001995.0000500.000595.000"
          Extraction : TTC=595.000 | HT=500.000 | Remise=0 | TVA=95.000 | Taux=19
          Reste gauche : "1500.000"
          Test Qte=1 x PU=500.000 = 500.000 [OK]
          => <Quantity>1</Quantity> | I-183=500.000 | I-171=500.000

        Exemple B : Bloc = "4350.00019266.00001 400.0001 666.000" (description sur ligne separee)
          Extraction : TTC=1666.000 | HT=1400.000 | Remise=0 | TVA=266.000 | Taux=19
          Reste gauche : "4350.000"
          Test Qte=4 x PU=350.000 = 1400.000 [OK]
          => <Quantity>4</Quantity> | I-183=1400.000 | I-171=350.000

      ETAPE 5 - Validation croisee finale (OBLIGATOIRE avant de generer le XML) :
        [OK] Quantite x I-171 = I-183
        [OK] I-183 x Taux / 100 = Montant TVA (a 0.001 pres)
        [OK] I-183 + Montant TVA + Timbre = Total TTC (a 0.001 pres)
        Si un test echoue : recommencer ETAPE 4 avec une autre coupure.

      Remplissage de <LinMoa> :
        - amountTypeCode="I-183" = Montant HT TOTAL de la ligne (Quantite x Prix Unitaire).
        - amountTypeCode="I-171" = Prix Unitaire NET. Differe de I-183 si Quantite > 1.
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
   Le premier caractere doit etre '<'.`;"""

# Use regex to replace from "Consignes strictes" to the closing backtick-semicolon
pattern = r'Consignes strictes :.*?^\d+\. Renvoie UNIQUEMENT.*?\.``;'
replacement_pattern = re.compile(
    r'Consignes strictes\s*:.*?Le premier caract[^\n]*\n',
    re.DOTALL
)

# Find the position manually
start_marker = 'Consignes strictes :'
end_marker = "Le premier caractère doit être '<'.`;"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1:
    print("ERROR: start marker not found!")
    exit(1)
if end_idx == -1:
    print("ERROR: end marker not found!")
    # Try alternate encoding
    end_marker2 = "Le premier caract"
    end_idx = content.rfind(end_marker2, start_idx)
    if end_idx == -1:
        print("ERROR: alternate end marker not found either!")
        exit(1)
    # Find end of line after end_marker2
    end_idx = content.find('\n', end_idx)

print(f"Found section from position {start_idx} to {end_idx}")

# Build new content
new_content = content[:start_idx] + new_instructions + '\n' + content[end_idx+len(end_marker):]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: pdfService.js updated correctly!")
print(f"File size: {len(new_content)} bytes")
