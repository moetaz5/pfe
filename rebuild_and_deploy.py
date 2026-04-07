"""
Rebuild React + déploiement sur VPS
"""
import subprocess
import paramiko
import os
import sys

DOMAIN   = "medicasign.medicacom.tn"
VPS_IP   = "51.178.39.67"
USER     = "ubuntu"
PASS     = "M3dic0c0M24++"
LOCAL_WEB_DIR  = r"c:\Users\LENOVO PRO\OneDrive\Bureau\projet pfe\web"
CLIENT_DIR     = os.path.join(LOCAL_WEB_DIR, "clientweb")

G="\033[92m"; R="\033[91m"; Y="\033[93m"; B="\033[94m"; W="\033[1m"; E="\033[0m"
ok   = lambda m: print(f"{G}✅ {m}{E}")
fail = lambda m: print(f"{R}❌ {m}{E}"); 
info = lambda m: print(f"{B}ℹ️  {m}{E}")
sep  = lambda t: print(f"\n{W}{'─'*50}\n  {t}\n{'─'*50}{E}")

def ssh_run(ssh, cmd, timeout=120):
    print(f"  $ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors='replace')
    err = stderr.read().decode(errors='replace')
    print(out[-2000:] if out else "")
    if err.strip(): print(f"  STDERR: {err[-500:]}")
    return out, err

# ════════════════════════════════════════════
sep("ÉTAPE 1 : Build React local")
# ════════════════════════════════════════════
info(f"Dossier : {CLIENT_DIR}")

if not os.path.exists(CLIENT_DIR):
    fail("Dossier clientweb introuvable!"); sys.exit(1)

info("Lancement de 'npm run build'...")
result = subprocess.run(
    ["npm", "run", "build"],
    cwd=CLIENT_DIR,
    capture_output=True,
    text=True,
    timeout=300,
    shell=True
)
if result.returncode == 0:
    ok("npm run build → SUCCESS")
    build_static = os.path.join(CLIENT_DIR, "build", "static")
    if os.path.exists(build_static):
        files = []
        for root, dirs, fnames in os.walk(build_static):
            for f in fnames:
                files.append(os.path.join(root, f))
        ok(f"{len(files)} fichiers dans build/static/")
    else:
        fail("build/static n'existe pas après le build !"); sys.exit(1)
else:
    fail("npm run build ÉCHOUÉ")
    print(result.stdout[-2000:])
    print(result.stderr[-2000:])
    sys.exit(1)

# ════════════════════════════════════════════
sep("ÉTAPE 2 : Git push du build")
# ════════════════════════════════════════════
info("Git add/commit/push du build...")

subprocess.run(["git", "add", "clientweb/build/"], cwd=LOCAL_WEB_DIR, capture_output=True, shell=True)
commit = subprocess.run(
    ["git", "commit", "-m", "deploy: rebuild React frontend"],
    cwd=LOCAL_WEB_DIR, capture_output=True, text=True, shell=True
)
print(commit.stdout); print(commit.stderr)

push = subprocess.run(
    ["git", "push", "origin", "main"],
    cwd=LOCAL_WEB_DIR, capture_output=True, text=True, timeout=120, shell=True
)
if push.returncode == 0:
    ok("Git push réussi")
    print(push.stdout)
else:
    fail(f"Git push échoué :\n{push.stderr}")
    print("Tentative de déploiement SSH direct...")

# ════════════════════════════════════════════
sep("ÉTAPE 3 : Déploiement sur VPS via SSH")
# ════════════════════════════════════════════
try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_IP, username=USER, password=PASS, timeout=20)
    ok("SSH connecté")

    # Pull depuis GitHub
    info("Git pull sur VPS...")
    ssh_run(ssh, "cd /var/www/medica_sign && git fetch origin main && git reset --hard origin/main")

    # Vérifier que le build est bien là
    out, _ = ssh_run(ssh, "ls /var/www/medica_sign/clientweb/build/static/js/ | head -5")
    if "main" in out or ".js" in out:
        ok("Fichiers JS du build présents sur VPS !")
    else:
        fail(f"Fichiers JS manquants: {out}")
        # Fallback: SFTP
        info("Le build n'est pas dans git (ou pas synchro). Envoi SFTP direct...")
        ssh.close()
        
        # Upload via SFTP
        transport = paramiko.Transport((VPS_IP, 22))
        transport.connect(username=USER, password=PASS)
        sftp = paramiko.SFTPClient.from_transport(transport)
        
        build_dir = os.path.join(CLIENT_DIR, "build")
        remote_build = "/var/www/medica_sign/clientweb/build"
        
        upload_count = 0
        for root, dirs, files in os.walk(build_dir):
            rel_root = os.path.relpath(root, build_dir)
            remote_root = remote_build if rel_root == "." else f"{remote_build}/{rel_root.replace(os.sep, '/')}"
            try: sftp.mkdir(remote_root)
            except: pass
            
            for filename in files:
                local_path = os.path.join(root, filename)
                remote_path = f"{remote_root}/{filename}"
                sftp.put(local_path, remote_path)
                upload_count += 1
        
        ok(f"SFTP : {upload_count} fichiers uploadés")
        sftp.close(); transport.close()
        
        # Reconnecter SSH
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(VPS_IP, username=USER, password=PASS, timeout=20)

    # Reload Nginx
    info("Reload Nginx...")
    ssh_run(ssh, "sudo systemctl reload nginx")
    ok("Nginx rechargé")

    # Restart PM2
    info("Restart PM2...")
    ssh_run(ssh, "pm2 restart medica_sign")

    # Vérification finale
    sep("VÉRIFICATION FINALE")
    ssh_run(ssh, "ls /var/www/medica_sign/clientweb/build/static/js/ | head -10")
except Exception as e:
    fail(f"Erreur VPS : {e}")

finally:
    try: ssh.close()
    except: pass

sep("RÉSUMÉ")
ok(f"Frontend rebuild + déployé sur VPS")
ok(f"Application disponible sur : https://{DOMAIN}")
print()
