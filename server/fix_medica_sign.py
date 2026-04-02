import paramiko

def fix_and_rename():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('51.178.39.67', username='ubuntu', password='M3dic0c0M24++')
    
    # 1. Stop old process
    ssh.exec_command('pm2 delete pfe-backend || true')
    ssh.exec_command('pm2 delete medica_sign || true')

    # 2. Find correct server directory and install dependencies
    # We check if server exists in /var/www/pfe/server (root clone)
    # or /var/www/pfe/web/server (nested clone)
    setup_cmd = """
    if [ -d "/var/www/pfe/server" ]; then
        cd /var/www/pfe/server
    elif [ -d "/var/www/pfe/web/server" ]; then
        cd /var/www/pfe/web/server
    else
        echo "Server directory not found"
        exit 1
    fi
    npm install
    # Re-create .env to be sure
    echo 'PORT=5000\nDB_HOST=km813502-001.eu.clouddb.ovh.net\nDB_PORT=35702\nDB_USER=ayoub\nDB_PASSWORD=Ayoub123\nDB_NAME=managment\nJWT_SECRET=super_secret_key' > .env
    pm2 start server.js --name "medica_sign"
    pm2 save
    """
    stdin, stdout, stderr = ssh.exec_command(setup_cmd)
    print("STDOUT:", stdout.read().decode())
    print("STDERR:", stderr.read().decode())
    
    ssh.close()

if __name__ == "__main__":
    fix_and_rename()
