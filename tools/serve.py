#!/usr/bin/env python3
"""Dev server for Moonfang Castle.

Plain http.server happily lets the browser cache js/*.js, which means a reload
can quietly run yesterday's game. This one forbids caching outright.
"""
import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8631
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass          # keep the console quiet; the game is the output


class ReusableServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with ReusableServer(('0.0.0.0', PORT), handler) as httpd:
        print(f'moonfang castle served from {ROOT} on http://localhost:{PORT} (no-cache)')
        httpd.serve_forever()
