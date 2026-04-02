import paramiko

def check_vps():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect('51.178.39.67', username='ubuntu', password='M3dic0c0M24++')
        print("--- PM2 STATUS ---")
        _, o, _ = ssh.exec_command('pm2 status')
        print(o.read().decode())
        
        print("--- PM2 LOGS ---")
        _, o, _ = ssh.exec_command('pm2 logs pfe-backend --lines 20 --no-daemon')
        # We only read a bit to avoid hanging
        from select import select
        if select([o.channel], [], [], 2.0)[0]:
            print(o.channel.recv(4096).decode())
            
        print("--- PROCESS CHECK ---")
        _, o, _ = ssh.exec_command('ps aux | grep node')
        print(o.read().decode())
        
        print("--- LOCAL PORT CHECK ---")
        _, o, _ = ssh.exec_command('nc -zv localhost 5000')
        print(o.read().decode())
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    check_vps()
