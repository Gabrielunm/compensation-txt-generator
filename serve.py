"""
Development server for Compensation TXT Generator.

Serves the app over HTTP so ES modules work correctly (file:// blocks them).
Opens http://localhost:8000 automatically.

Usage:
    python serve.py
    python serve.py --port 3000
"""

import argparse
import http.server
import socketserver
import webbrowser
import sys

PORT = 8000

def main():
    parser = argparse.ArgumentParser(description="Compensation TXT Generator dev server")
    parser.add_argument("--port", "-p", type=int, default=PORT, help=f"Port (default: {PORT})")
    args = parser.parse_args()

    handler = http.server.SimpleHTTPRequestHandler

    with socketserver.TCPServer(("", args.port), handler) as httpd:
        url = f"http://localhost:{args.port}"
        print(f"\n  ✅ Servidor iniciado en {url}")
        print(f"  Presioná Ctrl+C para detenerlo.\n")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Servidor detenido.")
            sys.exit(0)

if __name__ == "__main__":
    main()
