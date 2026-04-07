"""
===================================================
  TEST COMPLET VPS - medicasign.medicacom.tn
===================================================
Teste :
  1. DNS + HTTP/HTTPS
  2. SSL
  3. Nginx (config + logs)
  4. PM2 (statut + logs)
  5. Port 5000 (backend)
  6. Routes API critiques
  7. Variables .env sur VPS
===================================================
"""

import paramiko
import requests
import socket
import ssl
import datetime
import http.client
import urllib3
urllib3.disable_warnings()

# ─── CONFIG ───────────────────────────────────────────
DOMAIN   = "medicasign.medicacom.tn"
VPS_IP   = "51.178.39.67"
USER     = "ubuntu"
PASS     = "M3dic0c0M24++"
# ──────────────────────────────────────────────────────

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"
B = "\033[94m"; W = "\033[1m";  E = "\033[0m"

ok   = lambda m: print(f"  {G}✅ {m}{E}")
fail = lambda m: print(f"  {R}❌ {m}{E}")
warn = lambda m: print(f"  {Y}⚠️  {m}{E}")
info = lambda m: print(f"  {B}ℹ️  {m}{E}")
sep  = lambda t: print(f"\n{W}{B}{'─'*55}{E}\n{W}  {t}{E}\n{W}{B}{'─'*55}{E}")

errors = []

def ssh_cmd(ssh, cmd, timeout=15):
    try:
        _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode(errors='replace').strip()
        err = stderr.read().decode(errors='replace').strip()
        return out, err
    except Exception as e:
        return "", str(e)

def connect_ssh():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_IP, username=USER, password=PASS, timeout=15)
    return ssh

# ════════════════════════════════════════════════════
# 1. DNS
# ════════════════════════════════════════════════════
sep("1. DNS")
try:
    ips = socket.gethostbyname_ex(DOMAIN)[2]
    info(f"IPs résolues : {ips}")
    if VPS_IP in ips:
        ok(f"DNS → {VPS_IP}  ✔")
    else:
        fail(f"DNS ne pointe PAS vers {VPS_IP}"); errors.append("DNS")
    if len(ips) > 1:
        warn(f"Plusieurs enregistrements A : {ips}")
except Exception as e:
    fail(f"DNS échoué : {e}"); errors.append("DNS")

# ════════════════════════════════════════════════════
# 2. HTTP → HTTPS redirect
# ════════════════════════════════════════════════════
sep("2. Redirection HTTP → HTTPS")
try:
    r = requests.get(f"http://{DOMAIN}", timeout=8, allow_redirects=False)
    loc = r.headers.get("Location","")
    if r.status_code in (301,302) and "https" in loc:
        ok(f"Redirection 301 → {loc}")
    else:
        fail(f"Pas de redirection HTTPS  (code={r.status_code} loc={loc})")
        errors.append("HTTP-redirect")
except Exception as e:
    fail(f"HTTP inaccessible : {e}"); errors.append("HTTP-redirect")

# ════════════════════════════════════════════════════
# 3. HTTPS + contenu React
# ════════════════════════════════════════════════════
sep("3. Frontend HTTPS")
try:
    r = requests.get(f"https://{DOMAIN}", timeout=12, verify=True)
    if r.status_code == 200:
        ok(f"HTTPS 200 OK  ({len(r.content)} bytes)")
        if "<!DOCTYPE html>" in r.text or "<html" in r.text.lower():
            ok("Page HTML React reçue")
        else:
            warn("Contenu non-HTML reçu")
    else:
        fail(f"HTTPS code {r.status_code}"); errors.append("HTTPS")
except requests.exceptions.SSLError as e:
    fail(f"Erreur SSL : {e}"); errors.append("SSL")
except Exception as e:
    fail(f"HTTPS inaccessible : {e}"); errors.append("HTTPS")

# ════════════════════════════════════════════════════
# 4. Certificat SSL
# ════════════════════════════════════════════════════
sep("4. Certificat SSL")
try:
    ctx = ssl.create_default_context()
    conn = ctx.wrap_socket(socket.socket(), server_hostname=DOMAIN)
    conn.settimeout(8)
    conn.connect((DOMAIN, 443))
    cert = conn.getpeercert()
    conn.close()
    cn = dict(x[0] for x in cert["subject"]).get("commonName","?")
    issuer = dict(x[0] for x in cert["issuer"]).get("organizationName","?")
    exp = datetime.datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
    days = (exp - datetime.datetime.utcnow()).days
    alt_names = [v for _,v in cert.get("subjectAltName",[])]
    ok(f"CN : {cn}"); ok(f"Issuer : {issuer}")
    ok(f"SAN : {alt_names}")
    (ok if days>14 else fail)(f"Expire dans {days} jours ({exp.date()})")
    if days <= 14: errors.append("SSL-expire")
except Exception as e:
    fail(f"SSL check échoué : {e}"); errors.append("SSL")

# ════════════════════════════════════════════════════
# 5. Routes API
# ════════════════════════════════════════════════════
sep("5. Routes API backend")
api_routes = [
    ("GET", "/api/auth/me"),
    ("GET", "/api/auth/google"),
    ("POST","/api/auth/login"),
]
for method, path in api_routes:
    url = f"https://{DOMAIN}{path}"
    try:
        if method == "GET":
            r = requests.get(url, timeout=8, verify=True, allow_redirects=False)
        else:
            r = requests.post(url, json={}, timeout=8, verify=True)
        code = r.status_code
        # 401/403/302/404 all mean nginx reached the backend (not a 502)
        if code == 502:
            fail(f"{method} {path}  → 502 Bad Gateway (backend down!)")
            errors.append(f"API-502:{path}")
        elif code == 404 and path in ["/api/auth/me","/api/auth/login"]:
            warn(f"{method} {path}  → {code}  (route non trouvée côté Node ?)")
        else:
            ok(f"{method} {path}  → {code}  {'(backend vivant)' if code!=502 else ''}")
    except Exception as e:
        fail(f"{method} {path}  → Erreur : {e}"); errors.append(f"API:{path}")

# ════════════════════════════════════════════════════
# 6. Services VPS via SSH
# ════════════════════════════════════════════════════
sep("6. Services VPS (SSH)")
try:
    ssh = connect_ssh()
    ok("Connexion SSH OK")

    # Nginx status
    out,_ = ssh_cmd(ssh, "systemctl is-active nginx")
    (ok if out=="active" else fail)(f"Nginx : {out}")
    if out != "active": errors.append("nginx-down")

    # Nginx config test
    out,err = ssh_cmd(ssh, "sudo nginx -t 2>&1")
    combined = (out+err).lower()
    if "successful" in combined or "ok" in combined:
        ok("nginx -t : config valide")
    else:
        fail(f"nginx -t :\n    {out}\n    {err}"); errors.append("nginx-config")

    # PM2
    out,_ = ssh_cmd(ssh, "pm2 list --no-color")
    print()
    for line in out.splitlines():
        print(f"    {line}")
    print()
    if "online" in out:
        ok("PM2 : medica_sign ONLINE")
    elif "stopped" in out or "errored" in out:
        fail("PM2 : processus arrêté ou en erreur"); errors.append("pm2-down")
    else:
        warn("PM2 : statut inconnu")

    # Port 5000 ouvert
    out,_ = ssh_cmd(ssh, "ss -tlnp | grep ':5000'")
    if "5000" in out:
        ok(f"Port 5000 écoute : {out.split()[0] if out else 'oui'}")
    else:
        fail("Port 5000 N'écoute PAS (backend arrêté ?)"); errors.append("port-5000")

    # Test local backend
    out,_ = ssh_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/auth/me")
    info(f"curl localhost:5000/api/auth/me → HTTP {out}")
    if out in ["401","403","200"]:
        ok("Backend Node répond correctement en local")
    elif out == "000":
        fail("Backend ne répond pas (connexion refusée)"); errors.append("backend-local")
    else:
        warn(f"Backend répond avec code {out}")

    # Derniers logs PM2
    sep("7. Derniers logs PM2 (20 lignes)")
    out,_ = ssh_cmd(ssh, "pm2 logs medica_sign --lines 20 --nostream 2>&1 | tail -30")
    for line in out.splitlines()[-20:]:
        print(f"    {line}")

    # Variables .env
    sep("8. Variables .env sur VPS")
    out,_ = ssh_cmd(ssh, "cat /var/www/medica_sign/server/.env 2>/dev/null || echo 'FICHIER .env ABSENT'")
    if "ABSENT" in out:
        fail(".env introuvable sur le VPS !"); errors.append(".env-missing")
    else:
        # Afficher clés (pas les valeurs)
        for line in out.splitlines():
            if "=" in line:
                key = line.split("=")[0].strip()
                val_preview = line.split("=",1)[1][:6]+"..." if len(line.split("=",1)[1])>6 else "(vide)"
                info(f"{key} = {val_preview}")

    # Nginx error log (dernières erreurs)
    sep("9. Nginx error log (10 lignes)")
    out,_ = ssh_cmd(ssh, "sudo tail -10 /var/log/nginx/medica_sign.error.log 2>/dev/null || echo '(log vide ou absent)'")
    for line in out.splitlines():
        symbol = "⚠️ " if "error" in line.lower() or "crit" in line.lower() else "   "
        print(f"    {symbol}{line}")

    # Nginx site enabled config extract
    sep("10. Config Nginx active (server_name + proxy)")
    out,_ = ssh_cmd(ssh, "grep -E 'server_name|proxy_pass|listen|ssl_cert|root' /etc/nginx/sites-enabled/medica_sign 2>/dev/null")
    for line in out.splitlines():
        print(f"    {line.strip()}")
    if DOMAIN in out:
        ok(f"server_name contient '{DOMAIN}'")
    else:
        fail(f"server_name sans '{DOMAIN}'"); errors.append("nginx-domain")

    ssh.close()

except Exception as e:
    fail(f"SSH : {e}"); errors.append("SSH")

# ════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ════════════════════════════════════════════════════
sep("RÉSUMÉ FINAL")
if not errors:
    print(f"\n  {G}{W}🎉 TOUT EST OK — L'APPLICATION EST OPÉRATIONNELLE{E}")
    print(f"\n  → Accès : {W}https://{DOMAIN}{E}")
else:
    print(f"\n  {R}{W}⚠️  PROBLÈMES DÉTECTÉS ({len(errors)}) :{E}")
    for e in errors:
        print(f"  {R}  • {e}{E}")
    print(f"\n  {Y}Vérifiez les sections marquées ❌ ci-dessus.{E}")

print(f"\n{W}{B}{'═'*55}{E}\n")
