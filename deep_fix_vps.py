import os

def deep_fix_vps():
    target_dir = r"c:\Users\LENOVO PRO\OneDrive\Bureau\projet pfe\web"
    vps_ip = "51.178.39.67"
    patterns = ["localhost:5000", "127.0.0.1:5000", "10.0.2.2:5000"]
    
    count = 0
    for root, dirs, files in os.walk(target_dir):
        # On évite node_modules et build
        if "node_modules" in root or "build" in root or ".git" in root:
            continue
            
        for file in files:
            if file.endswith((".js", ".dart", ".ts", ".html")):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                
                modified = False
                new_content = content
                for p in patterns:
                    if p in new_content:
                        new_content = new_content.replace(p, vps_ip)
                        modified = True
                
                if modified:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    print(f"✅ Mis à jour : {file} ({file_path})")
                    count += 1
    
    print(f"\n--- TOTAL : {count} fichiers corrigés pour pointer vers {vps_ip} ---")

if __name__ == "__main__":
    deep_fix_vps()
