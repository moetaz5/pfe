import urllib.request
import urllib.error

urls = [
    "https://medicasign.medicacom.tn/",
    "https://medicasign.medicacom.tn/api/auth/me",
    "https://medicasign.medicacom.tn/api/auth/google"
]

for url in urls:
    print(f"Checking {url}...")
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=10) as response:
            print(f"  Status: {response.getcode()}")
    except urllib.error.HTTPError as e:
        print(f"  Status: {e.code} (Expected if unauthorized)")
    except Exception as e:
        print(f"  Error: {e}")
