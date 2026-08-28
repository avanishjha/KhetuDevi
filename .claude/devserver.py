"""Static dev server for the Khetu Devi Memorial Trust site.

Plain `python -m http.server` lets the browser heuristically cache assets, so
edits to CSS/JS do not show up on reload. This sends no-store on everything.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    root = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(NoCacheHandler, directory=root)
    print("serving %s on http://localhost:%d" % (root, port), flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
