filepath = r"server/services/pdfService.js"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Upgrade model from gpt-4o-mini to gpt-4o
content = content.replace('"openai/gpt-4o-mini"', '"openai/gpt-4o"')
print("Model fix applied:", '"openai/gpt-4o-mini"' in content == False)

# Fix 2: Add critical interdiction after ETAPE 4 prohibition line
old_rule = "        INTERDICTION de presupposer la quantite avant le calcul."
new_rule = """        INTERDICTION de presupposer la quantite avant le calcul.

        REGLE CRITIQUE - NE JAMAIS INFERER LA QUANTITE DEPUIS LA DESCRIPTION :
        La description textuelle de l article (ex: "abonnement... les mois fevrier-mars-avril-mai")
        ne determine JAMAIS la quantite. Meme si la description evoque plusieurs mois ou unites,
        la quantite DOIT etre extraite exclusivement du bloc numerique par validation mathematique.
        Exemple concret : "4350.00019266.00001 400.0001 666.000" => la description est sur une
        ligne separee, mais le "4" au debut du bloc numerique est la Quantite, et "350.000" est
        le Prix Unitaire, car 4 x 350.000 = 1400.000 = Total HT. Ne pas mettre Quantite=1."""

if old_rule in content:
    content = content.replace(old_rule, new_rule)
    print("Prompt fix applied successfully")
else:
    print("ERROR: old_rule not found in file!")
    # Print context around the area
    idx = content.find("INTERDICTION")
    print("Context:", repr(content[idx:idx+200]))

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("File saved successfully")
print("File size:", len(content), "bytes")
