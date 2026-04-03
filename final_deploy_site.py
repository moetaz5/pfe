import os
import subprocess
import paramiko

def run_local_command(cmd, cwd=None):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"Error executing: {cmd}")
        return False
    return True

def deploy():
    # 1. Build React App locally
    client_dir = r"c:\Users\LENOVO PRO\OneDrive\Bureau\projet pfe\web\clientweb"
    print("\n--- 1. UN RÉ-ASSEMBLAGE DU SITE (BUILD) ---")
    if not run_local_command("npm run build", cwd=client_dir):
        return

    # 2. Push to Git
    print("\n--- 2. ENVOI DES FICHIERS SUR GITHUB ---")
    run_local_command("git add .")
    run_local_command('git commit -m "Final build with corrected Google OAuth links"')
    run_local_command("git push origin main")

    # 3. Update VPS
    print("\n--- 3. MISE À JOUR DU SERVEUR VPS ---")
    vps_script = r"c:\Users\LENOVO PRO\OneDrive\Bureau\projet pfe\web\update_vps.py"
    run_local_command(f"python \"{vps_script}\"")

    print("\n✅ DÉPLOIEMENT TERMINÉ ! Le bouton Google devrait maintenant fonctionner.")

if __name__ == "__main__":
    deploy()
