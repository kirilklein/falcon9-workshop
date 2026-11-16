# Serves this folder on http://localhost:8000 and tells the browser never to cache,
# so a plain reload always shows the newest files.
import http.server, os

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.ThreadingHTTPServer(('', 8000), Handler).serve_forever()
