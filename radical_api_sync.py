import os

def total_api_sync():
    root_dir = r"c:\Users\LENOVO PRO\OneDrive\Bureau\projet pfe\web"
    vps_domain = "51.178.39.67.nip.io"
    
    # Liste des variations à remplacer
    to_replace = [
        "localhost:5000",
        "127.0.0.1:5000",
        "http://51.178.39.67/api", # IP seule sans port (Nginx)
        "http://51.178.39.67",      # IP seule
        "10.0.2.2:5000"            # Emulateur Android
    ]
    
    count = 0
    for root, dirs, files in os.walk(root_dir):
        # Exclure les dossiers inutiles
        if any(x in root for x in ["node_modules", "build", ".git", ".dart_tool", "ios", "android"]):
            continue
            
        for file in files:
            if file.endswith((".js", ".dart", ".ts", ".html", ".css")):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    
                    new_content = content
                    modified = False
                    
                    for old in to_replace:
                        if old in new_content:
                            # Cas spécial : ne pas doubler le .nip.io si déjà présent
                            if f"{old}.nip.io" not in new_content:
                                new_content = new_content.replace(old, vps_domain)
                                modified = True
                    
                    if modified:
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.write(new_content)
                        print(f"✅ Mis à jour : {file} ({file_path})")
                        count += 1
                except Exception as e:
                    print(f"⚠️ Erreur sur {file}: {e}")
    
    print(f"\n--- SYNCHRONISATION TERMINÉE : {count} fichiers mis à jour ---")

if __name__ == "__main__":
    total_api_sync()
