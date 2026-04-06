import paramiko

def update_remote_env():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    with open('server/.env', 'r') as f:
        env_content = f.read()

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password)
        sftp = ssh.open_sftp()
        with sftp.file('/var/www/medica_sign/server/.env', 'w') as f:
            f.write(env_content)
        sftp.close()
        ssh.exec_command('pm2 restart medica_sign')
        print("✅ VPS .env updated and server restarted.")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    update_remote_env()
