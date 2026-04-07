import paramiko

def check_files():
    hostname = '51.178.39.67'
    username = 'ubuntu'
    password = 'M3dic0c0M24++'
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, username=username, password=password)
        
        # Check files in build/static/media
        cmd = 'ls -R /var/www/medica_sign/clientweb/build/static/media'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print("Build Static Media Contents:")
        print(stdout.read().decode())
        
        # Check if the build folder itself is fresh
        cmd = 'ls -lt /var/www/medica_sign/clientweb/build | head'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print("Build Folder Recent Files:")
        print(stdout.read().decode())

    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    check_files()
