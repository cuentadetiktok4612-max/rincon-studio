#!/usr/bin/env python3
"""Obtiene el REFRESH TOKEN de YouTube (una sola vez). Solo usa la biblioteca estándar de Python.

Uso (Termux o cualquier PC):
    python automation/get-refresh-token.py CLIENT_ID CLIENT_SECRET

1) Abre el enlace que imprime, en el navegador del MISMO dispositivo.
2) Elige tu cuenta de Google / canal y acepta el permiso «Subir vídeos a YouTube».
3) Cuando el navegador vuelva a 127.0.0.1, este script imprime el refresh token.
El cliente OAuth debe ser de tipo «Aplicación de escritorio».
"""
import http.server
import json
import os
import sys
import urllib.parse
import urllib.request

TOKEN_URL = os.environ.get("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token")
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
SCOPE = "https://www.googleapis.com/auth/youtube.upload"
PORT = int(os.environ.get("PORT", "8085"))
REDIRECT = f"http://127.0.0.1:{PORT}"


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    client_id, client_secret = sys.argv[1], sys.argv[2]
    params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    }
    print("\nAbre este enlace en tu navegador:\n")
    print(AUTH_URL + "?" + urllib.parse.urlencode(params))
    print(f"\nEsperando la respuesta de Google en {REDIRECT} …\n")

    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            result["code"] = (q.get("code") or [None])[0]
            result["error"] = (q.get("error") or [None])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            msg = "Listo. Vuelve a la terminal." if result["code"] else "No se recibió el código."
            self.wfile.write(f"<h2>{msg}</h2>".encode())

        def log_message(self, *args):
            pass

    with http.server.HTTPServer(("127.0.0.1", PORT), Handler) as srv:
        while not (result.get("code") or result.get("error")):
            srv.handle_request()

    if not result.get("code"):
        sys.exit(f"Google devolvió un error: {result.get('error')}")

    data = urllib.parse.urlencode({
        "code": result["code"],
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": REDIRECT,
        "grant_type": "authorization_code",
    }).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=data)) as r:
            tok = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Error al canjear el código: {e.read().decode()[:400]}")

    if not tok.get("refresh_token"):
        sys.exit("Google no devolvió refresh_token. Quita el acceso de la app en myaccount.google.com/permissions y repite.")
    print("REFRESH TOKEN (guárdalo como secret YT_REFRESH_TOKEN; no lo compartas):\n")
    print(tok["refresh_token"])


if __name__ == "__main__":
    main()
