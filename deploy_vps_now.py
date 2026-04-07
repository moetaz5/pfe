import paramiko

VPS_IP = "51.178.39.67"
USER = "ubuntu"
PASS = "M3dic0c0M24++"

def run(ssh, cmd, show=True):
    print(f"\n$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    if out and show: print(out)
    if err and show: print("[STDERR]", err)
    return out, err

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_IP, username=USER, password=PASS, timeout=15)
print("✅ SSH connecté")

# Déployer depuis git
run(ssh, "cd /var/www/medica_sign && git fetch origin main && git reset --hard origin/main")

# Déployer le nouveau nginx
run(ssh, "sudo cp /var/www/medica_sign/nginx_medica_sign.conf /etc/nginx/sites-available/medica_sign")
run(ssh, "sudo nginx -t 2>&1")
run(ssh, "sudo systemctl reload nginx")
print("✅ Nginx rechargé")

# Restart PM2
run(ssh, "pm2 restart medica_sign")
print("✅ PM2 redémarré")

# Vérifications finales
print("\n=== VÉRIFICATIONS ===")
run(ssh, "systemctl is-active nginx")
run(ssh, "pm2 list --no-color | grep medica")
run(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/auth/me")

ssh.close()
print("\n✅ DÉPLOIEMENT COMPLET TERMINÉ")
