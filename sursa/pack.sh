#!/bin/bash
# Builds both versions and packs the website for Cloudflare Pages (index.html at the root of the zip).
set -e
cd "$(dirname "$0")"
python3 build.py
python3 - <<'PY'
import json; c = json.load(open('web.config.json'))
if not (c.get('supabaseUrl') and c.get('supabaseKey')): raise SystemExit('web.config.json: supabaseUrl/supabaseKey are not set yet')
PY
rm -f ecofin-site.zip
(cd web && zip -qr -X ../ecofin-site.zip . -x '.*')
unzip -l ecofin-site.zip | tail -n +1 | head -30
ls -la ecofin-site.zip
