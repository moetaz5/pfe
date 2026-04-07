import paramiko

VPS_IP = "51.178.39.67"
USER = "ubuntu"
PASS = "M3dic0c0M24++"
LOCAL_CONF = r"c:\Users\LENOVO PRO\OneDrive\Bureau\projet pfe\web\nginx_medica_sign.conf"
REMOTE_CONF = "/etc/nginx/sites-available/medica_sign"

def deploy():
    print("Uploading Nginx config...")
    transport = paramiko.Transport((VPS_IP, 22))
    transport.connect(username=USER, password=PASS)
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.put(LOCAL_CONF, "/tmp/nginx_medica_sign.conf")
    sftp.close()
    transport.close()
    
    print("Applying Nginx config and reloading...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_IP, username=USER, password=PASS, timeout=15)
    
    cmd = f"sudo cp /tmp/nginx_medica_sign.conf {REMOTE_CONF} && sudo nginx -t && sudo systemctl reload nginx"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("STDOUT:", stdout.read().decode())
    print("STDERR:", stderr.read().decode())
    ssh.close()
    print("Done!")

if __name__ == "__main__":
    deploy()
