import urllib.request
import urllib.error

try:
    # On va tester sans suivre la redirection pour attraper le code 302
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    
    opener = urllib.request.build_opener(NoRedirect)
    response = opener.open("https://medicasign.medicacom.tn/api/auth/google")
    print("Status:", response.getcode())
except urllib.error.HTTPError as e:
    print("Status:", e.code)
    print("Location:", e.headers.get("Location"))
except Exception as e:
    print("Erreur:", str(e))
