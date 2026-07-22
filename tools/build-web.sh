#!/usr/bin/env bash
# Stage the browser-only files for static hosting (Cloudflare Pages, etc.).
# Electron shell (main.js) and node_modules are intentionally excluded.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf web-dist
mkdir -p web-dist
cp index.html web-dist/
cp -r js web-dist/
cp -r assets web-dist/

echo "web-dist ready: $(du -sh web-dist | cut -f1), $(find web-dist -type f | wc -l | tr -d ' ') files"
