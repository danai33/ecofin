"""Assemble EcoFin (v4 hero): src/*.html + src/*.js -> dist/index.html (published) and www/index.html (local test)."""
import os, re, shutil, subprocess, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src'); DIST = os.path.join(HERE, 'dist'); WWW = os.path.join(HERE, 'www')
SITE = os.path.join(HERE, '..', 'site')
os.makedirs(os.path.join(DIST, 'assets'), exist_ok=True)

head = open(os.path.join(SRC, '00-head.html'), encoding='utf-8').read()
body = open(os.path.join(SRC, '01-body.html'), encoding='utf-8').read()
js_files = sorted(f for f in os.listdir(SRC) if f.endswith('.js'))
# the supplied chrome hand (cut out of its white background, pixels unchanged): its fingertip anchor is inlined
HOUT = os.path.join(HERE, 'hand5', 'out')
hand = json.load(open(os.path.join(HOUT, 'hand-v5.json')))
WEB_ONLY = '115-web.js'   # accounts, legal texts, server assistant: only in the web build; the Claude page gets a stub
def bundle(web):
    parts = []
    for f in js_files:
        src = open(os.path.join(SRC, f), encoding='utf-8').read()
        if f == WEB_ONLY and not web:
            src = '/* the web-only module (accounts, server assistant) is left out of the page published in Claude */\nconst Web={on:false};'
        parts.append(src)
    j = '\n'.join(parts)
    assert 'const HAND_DEFAULT={ar:0,tip:[0,0],axis:[0,-1]};' in j
    j = j.replace('const HAND_DEFAULT={ar:0,tip:[0,0],axis:[0,-1]};', 'const HAND_DEFAULT=' + json.dumps(hand, separators=(',', ':')) + ';')
    assert '</script' not in j.lower(), 'a JS file contains </script'
    s = "(() => {\n'use strict';\n" + j + "\n})();\n"
    p = os.path.join(HERE, 'tests', 'bundle-web.js' if web else 'bundle.js')
    open(p, 'w', encoding='utf-8').write(s)
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    if r.returncode:
        print(r.stderr); sys.exit(1)
    return s
script = bundle(False)
web_script = bundle(True)
html = head.rstrip() + '\n' + body.strip() + '\n<script>\n' + script + '</script>\n'
open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8').write(html)

# assets
for a in ['coin-front.png', 'coin-back.png']:
    shutil.copyfile(os.path.join(SITE, 'assets', a), os.path.join(DIST, 'assets', a))
for old in ['hand.webp', 'hand.json', 'hand-v3.webp', 'hand-v3-sm.webp', 'hand-v3.json', 'hand-v4.webp', 'hand-v4-sm.webp', 'hand-v4.json']:
    if os.path.exists(os.path.join(DIST, 'assets', old)): os.remove(os.path.join(DIST, 'assets', old))
# on-device OCR (tesseract.js 5.1.1, LSTM cores, Romanian best_int data as base64 text)
import base64
OCRP = os.path.join(HERE, '..', 'ocrpkg', 'node_modules')
ocr_dir = os.path.join(DIST, 'assets', 'ocr'); os.makedirs(ocr_dir, exist_ok=True)
for src, dst in [('tesseract.js/dist/tesseract.min.js', 'tesseract.min.js'), ('tesseract.js/dist/worker.min.js', 'worker.min.js'),
                 ('tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'),
                 ('tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js')]:
    shutil.copyfile(os.path.join(OCRP, src), os.path.join(ocr_dir, dst))
b64 = os.path.join(ocr_dir, 'ron.b64.txt')
if not os.path.exists(b64):
    open(b64, 'w').write(base64.b64encode(open(os.path.join(OCRP, '@tesseract.js-data/ron/4.0.0_best_int/ron.traineddata.gz'), 'rb').read()).decode())
# hero hand (pre-rendered) and its anchor data
for a in ['hand-v5.webp', 'hand-v5.json']:
    p = os.path.join(HOUT, a)
    if os.path.exists(p): shutil.copyfile(p, os.path.join(DIST, 'assets', a))

# local test copy: same page, CDN files served locally
t = html
t = t.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', '/three/build/three.module.js')
t = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]*">', '<link rel="stylesheet" href="/fonts/comfortaa.css">', t)
t = t.replace('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', '/pdfjs/build/pdf.min.js')
t = t.replace('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', '/pdfjs/build/pdf.worker.min.js')
t = t.replace('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', '/mammoth/mammoth.browser.min.js')
skel = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n'
open(os.path.join(WWW, 'index.html'), 'w', encoding='utf-8').write(skel + t + '</body></html>\n')
for name, target in [('assets', os.path.join(DIST, 'assets')), ('fonts', os.path.join(SITE, 'fonts')),
                     ('pdfjs', os.path.join(HERE, 'node_modules', 'pdfjs-dist')), ('mammoth', os.path.join(HERE, 'node_modules', 'mammoth'))]:
    link = os.path.join(WWW, name)
    if not os.path.lexists(link):
        os.symlink(os.path.relpath(target, WWW), link)
print('built', len(html) // 1024, 'KB;', len(js_files), 'js files;', 'assets', sorted(os.listdir(os.path.join(DIST, 'assets'))))

# ---------------------------------------------------------------------------------------------
# WEB VERSION (its own website: real accounts, database, assistant through the server function)
#   web/      → upload this folder to Cloudflare Pages (or any static host)
#   webtest/  → the same site for local tests (CDN files served locally, fake server address)
# ---------------------------------------------------------------------------------------------
WEB = os.path.join(HERE, 'web'); WEBT = os.path.join(HERE, 'webtest')
cfg = json.load(open(os.path.join(HERE, 'web.config.json'), encoding='utf-8'))
SB_VER = '2.117.2'
SB_UMD = os.path.join(HERE, '..', 'webpkg', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js')
web_head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '').replace('<meta name="claude:viewport-fit-sides" content="cover">', '')
reset_css = skel.split('<style>', 1)[1].split('</style>', 1)[0]
def web_page(conf, supabase_src):
    return ('<!doctype html>\n<html lang="ro">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="description" content="EcoFin: compară creditele, ține-ți bugetul și economisește, cu un asistent AI. Sume în lei (MDL).">\n'
            '<meta name="theme-color" content="#6f62f0">\n<link rel="icon" href="favicon.svg" type="image/svg+xml">\n'
            '<style>' + reset_css + '</style>\n' + web_head.rstrip() + '\n</head>\n<body>\n' + body.strip() + '\n'
            '<script>window.ECOFIN_WEB=' + json.dumps(conf, ensure_ascii=False) + ';</script>\n'
            '<script src="' + supabase_src + '"></script>\n'
            '<script>\n' + web_script + '</script>\n</body>\n</html>\n')
FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
           '<stop offset="0" stop-color="#ff8fc8"/><stop offset="1" stop-color="#6a5cf6"/></linearGradient></defs>'
           '<rect width="64" height="64" rx="16" fill="url(#g)"/>'
           '<path d="M20 32h24a12 12 0 1 0-3.5 8.5" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>\n')
HEADERS = ('/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n'
           '  Permissions-Policy: geolocation=(), microphone=(), payment=()\n'
           '/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n'
           '/assets/*\n  Cache-Control: public, max-age=604800\n')
for d in (WEB, WEBT):
    if os.path.isdir(d): shutil.rmtree(d)
    os.makedirs(os.path.join(d, 'vendor'))
sb_name = 'vendor/supabase-' + SB_VER + '.js'
shutil.copyfile(SB_UMD, os.path.join(WEB, sb_name))
shutil.copytree(os.path.join(DIST, 'assets'), os.path.join(WEB, 'assets'))
open(os.path.join(WEB, 'index.html'), 'w', encoding='utf-8').write(web_page(cfg, sb_name))
open(os.path.join(WEB, 'favicon.svg'), 'w').write(FAVICON)
open(os.path.join(WEB, '_headers'), 'w').write(HEADERS)
open(os.path.join(WEB, 'robots.txt'), 'w').write('User-agent: *\nAllow: /\n')
# local test copy: CDN files served locally, a fake server address the browser tests intercept
tconf = dict(cfg, supabaseUrl='https://ecofin-test.supabase.co', supabaseKey='sb_publishable_test', google=True,
             legal=dict(cfg.get('legal', {}), email='contact@example.com'))
tt = web_page(tconf, sb_name)
tt = tt.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', '/three/build/three.module.js')
tt = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]*">', '<link rel="stylesheet" href="/fonts/comfortaa.css">', tt)
tt = tt.replace('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', '/pdfjs/build/pdf.min.js')
tt = tt.replace('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', '/pdfjs/build/pdf.worker.min.js')
tt = tt.replace('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', '/mammoth/mammoth.browser.min.js')
open(os.path.join(WEBT, 'index.html'), 'w', encoding='utf-8').write(tt)
shutil.copyfile(SB_UMD, os.path.join(WEBT, sb_name))
open(os.path.join(WEBT, 'favicon.svg'), 'w').write(FAVICON)
for name, target in [('assets', os.path.join(DIST, 'assets')), ('fonts', os.path.join(SITE, 'fonts')), ('three', os.path.join(WWW, 'three')),
                     ('pdfjs', os.path.join(HERE, 'node_modules', 'pdfjs-dist')), ('mammoth', os.path.join(HERE, 'node_modules', 'mammoth'))]:
    os.symlink(os.path.relpath(os.path.realpath(target), WEBT), os.path.join(WEBT, name))
print('web build:', sorted(os.listdir(WEB)), 'configured' if cfg.get('supabaseUrl') else '(server address not set yet)')
