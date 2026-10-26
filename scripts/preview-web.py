"""Serve only the exported web app on loopback, including Expo Router deep links."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[1] / 'mobile' / 'dist'
if not (root / 'index.html').is_file():
    raise SystemExit('Run npm run export:web in mobile first.')

class Preview(SimpleHTTPRequestHandler):
    def do_GET(self):
        requested = urlsplit(self.path).path
        translated = Path(self.translate_path(requested))
        if not translated.exists() and not Path(requested).suffix:
            self.path = '/index.html'
        return super().do_GET()

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8789), partial(Preview, directory=str(root)))
    print('Local preview: http://127.0.0.1:8789 · no public deployment', flush=True)
    server.serve_forever()
