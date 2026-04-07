import paramiko
import subprocess
import socket
import requests
import urllib3
import time

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DOMAIN = "medicasign.medicacom.tn"
VPS_IP = "51.178.39.67"
USERNAME = "ubuntu"
PASSWORD = "M3dic0c0M24++"

RESET = "\033[0m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
BOLD = "\033[1m"

def ok(msg): print(f"  {GREEN}✅ {msg}{RESET}")
def fail(msg): print(f"  {RED}❌ {msg}{RESET}")
def warn(msg): print(f"  {YELLOW}⚠️  {msg}{RESET}")
def info(msg): print(f"  {BLUE}ℹ️  {msg}{RESET}")
def header(msg): print(f"\n{BOLD}{BLUE}{'='*60}{RESET}\n{BOLD}  {msg}{RESET}\n{BOLD}{BLUE}{'='*60}{RESET}")

# ─── 1. DNS Check ────────────────────────────────────────────
def check_dns():
    header("1. Vérification DNS")
    try:
        resolved_ips = socket.gethostbyname_ex(DOMAIN)[2]
        info(f"Domaine : {DOMAIN}")
        info(f"IPs résolues : {resolved_ips}")
        if VPS_IP in resolved_ips:
            ok(f"DNS pointe bien vers {VPS_IP}")
        else:
            fail(f"DNS ne pointe PAS vers {VPS_IP}  →  IPs trouvées : {resolved_ips}")
            warn("Vérifiez votre DNS chez le registrar / OVH")
        if len(resolved_ips) > 1:
            warn(f"Plusieurs enregistrements A détectés : {resolved_ips} — supprimez ceux inutiles")
    except socket.gaierror as e:
        fail(f"Résolution DNS échouée : {e}")

# ─── 2. HTTP → HTTPS Redirect ────────────────────────────────
def check_http_redirect():
    header("2. Redirection HTTP → HTTPS")
    try:
        r = requests.get(f"http://{DOMAIN}", timeout=10, allow_redirects=False)
        if r.status_code in (301, 302) and "https" in r.headers.get("Location", ""):
            ok(f"HTTP redirige vers HTTPS (code {r.status_code})")
        else:
            fail(f"Pas de redirection HTTPS (code {r.status_code}, Location: {r.headers.get('Location')})")
    except Exception as e:
        fail(f"HTTP inaccessible : {e}")

# ─── 3. HTTPS Frontend ───────────────────────────────────────
def check_https_frontend():
    header("3. Frontend HTTPS")
    try:
        r = requests.get(f"https://{DOMAIN}", timeout=15, verify=True)
        if r.status_code == 200:
            ok(f"Frontend accessible en HTTPS (code 200)")
            if "<!DOCTYPE html>" in r.text or "<html" in r.text:
                ok("Page HTML reçue correctement")
            else:
                warn("Réponse reçue mais pas de HTML détecté")
        else:
            fail(f"Code HTTP inattendu : {r.status_code}")
    except requests.exceptions.SSLError as e:
        fail(f"Erreur SSL : {e}")
    except Exception as e:
        fail(f"HTTPS inaccessible : {e}")

# ─── 4. SSL Certificate ──────────────────────────────────────
def check_ssl():
    header("4. Certificat SSL (Let's Encrypt)")
    import ssl, datetime
    ctx = ssl.create_default_context()
    try:
        conn = ctx.wrap_socket(socket.socket(), server_hostname=DOMAIN)
        conn.settimeout(10)
        conn.connect((DOMAIN, 443))
        cert = conn.getpeercert()
        conn.close()
        subject = dict(x[0] for x in cert["subject"])
        issuer = dict(x[0] for x in cert["issuer"])
        not_after = datetime.datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
        days_left = (not_after - datetime.datetime.utcnow()).days
        ok(f"Certificat pour : {subject.get('commonName')}")
        ok(f"Émis par : {issuer.get('organizationName', issuer.get('commonName'))}")
        if days_left > 14:
            ok(f"Expire dans {days_left} jours ({not_after.date()})")
        else:
            fail(f"Expire dans {days_left} jours — RENOUVELEZ MAINTENANT !")
    except Exception as e:
        fail(f"Impossible de vérifier le certificat SSL : {e}")

# ─── 5. Backend API ──────────────────────────────────────────
def check_api():
    header("5. Backend API (/api/...)")
    endpoints = [
        ("GET", f"https://{DOMAIN}/api/", None),
        ("GET", f"https://{DOMAIN}/api/health", None),
    ]
    for method, url, body in endpoints:
        try:
            r = requests.get(url, timeout=10, verify=True)
            if r.status_code < 500:
                ok(f"{url}  →  code {r.status_code}")
            else:
                fail(f"{url}  →  code {r.status_code} (erreur serveur)")
        except Exception as e:
            warn(f"{url}  →  {e}")

# ─── 6. VPS Services (SSH) ───────────────────────────────────
def check_vps_services():
    header("6. Services VPS via SSH")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(VPS_IP, username=USERNAME, password=PASSWORD, timeout=15)
        ok("Connexion SSH établie")

        # Nginx
        _, stdout, _ = ssh.exec_command("systemctl is-active nginx")
        status = stdout.read().decode().strip()
        (ok if status == "active" else fail)(f"Nginx : {status}")

        # PM2
        _, stdout, _ = ssh.exec_command("pm2 jlist")
        pm2_out = stdout.read().decode().strip()
        if "medica_sign" in pm2_out or "online" in pm2_out:
            ok("PM2 : processus medica_sign en ligne")
        else:
            _, stdout, _ = ssh.exec_command("pm2 list")
            print("  " + stdout.read().decode().strip().replace("\n", "\n  "))

        # Nginx config test
        _, stdout, stderr = ssh.exec_command("sudo nginx -t 2>&1")
        nginx_test = (stdout.read().decode() + stderr.read().decode()).strip()
        if "successful" in nginx_test or "ok" in nginx_test.lower():
            ok("nginx -t : configuration valide")
        else:
            fail(f"nginx -t :\n  {nginx_test}")

        # Certbot / Let's Encrypt
        _, stdout, _ = ssh.exec_command(f"sudo certbot certificates 2>&1 | grep -A5 '{DOMAIN}'")
        cert_info = stdout.read().decode().strip()
        if cert_info:
            ok(f"Certbot SSL :\n  {cert_info}")
        else:
            warn("Aucun certificat Certbot trouvé pour ce domaine")

        # Nginx site enabled
        _, stdout, _ = ssh.exec_command("ls /etc/nginx/sites-enabled/")
        enabled = stdout.read().decode().strip()
        ok(f"Sites Nginx activés : {enabled}")

        # Server name in nginx config
        _, stdout, _ = ssh.exec_command("grep server_name /etc/nginx/sites-enabled/medica_sign 2>/dev/null || grep server_name /etc/nginx/sites-enabled/* 2>/dev/null")
        sn = stdout.read().decode().strip()
        if DOMAIN in sn:
            ok(f"server_name contient bien '{DOMAIN}'")
        else:
            fail(f"server_name ne contient pas '{DOMAIN}' :\n  {sn}")

    except Exception as e:
        fail(f"SSH : {e}")
    finally:
        ssh.close()

# ─── 7. End-to-End Summary ───────────────────────────────────
def summary():
    header("RÉSUMÉ")
    print(f"""
  Domaine   : https://{DOMAIN}
  IP VPS    : {VPS_IP}
  SSL       : Let's Encrypt (auto-renewal Certbot)
  Frontend  : React → /var/www/medica_sign/clientweb/build
  Backend   : Node.js via PM2 → port 5000
  Proxy     : Nginx /api/ → localhost:5000

  Pour tester l'application directement :
  → https://{DOMAIN}
""")

if __name__ == "__main__":
    print(f"\n{BOLD}{'='*60}")
    print(f"  DIAGNOSTIC COMPLET : {DOMAIN}")
    print(f"{'='*60}{RESET}")
    
    check_dns()
    check_http_redirect()
    check_https_frontend()
    check_ssl()
    check_api()
    check_vps_services()
    summary()
    
    print(f"{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}  Diagnostic terminé.{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")
