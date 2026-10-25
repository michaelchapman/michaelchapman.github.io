"""Builds the standalone page for michaelchapman.me/drone-season/ from the game source.

python3 _tools/drone-season/build/site.py [out_dir] [--images]

Writes index.html, icon.svg and manifest.webmanifest into drone-season/ at the top of the repo
(or out_dir). With --images it also renders icon-192.png, icon-512.png, apple-touch-icon.png and
the 1200x630 preview.jpg link image, using Playwright's Chromium. Those only need redoing when
the icon or the title screen changes.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build import ROOT, fragment  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith('--')]
IMAGES = '--images' in sys.argv
OUT = os.path.abspath(args[0] if args else os.path.join(ROOT, '..', '..', 'drone-season'))

TITLE = 'Drone Season'
URL = 'https://michaelchapman.me/drone-season/'
BG = '#06090c'
DESC = ('A real-time strategy game of drone war. Two machine hives fight over a valley where whatever is seen '
        'is killed: scout, hide under canopy, strike with cheap swarms, and hold the Crown bloom.')
FONTS = ('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700'
         '&family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap')

src = fragment()
body = src[src.index('<style>'):]          # the shell's own <title>, viewport hint and font links move into <head>
assert '<title>' not in body and 'claude:viewport' not in body and 'fonts.googleapis' not in body

head = f'''<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="{BG}">
<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<link rel="canonical" href="{URL}">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Michael Chapman">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{URL}">
<meta property="og:image" content="{URL}preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Drone Season title over a dark contour map of a valley, with amber and cobalt hives and glowing blooms">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>
/* Standalone page: keep the game clear of the notch and home bar (the artifact viewer did this for us). */
html{{box-sizing:border-box;height:100%;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);background:{BG}}}
</style>
</head>
<body>
'''
page = head + body.rstrip() + '\n</body>\n</html>\n'
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(page)

# icon: the hive hexagon with a Sting inside, amber on the night basin
ICON = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="{BG}"/>
<path d="M32 7l21.65 12.5v25L32 57 10.35 44.5v-25z" fill="none" stroke="#f5a524" stroke-width="4" stroke-linejoin="round"/>
<path d="M45.5 32L23.5 21.5l4.8 10.5-4.8 10.5z" fill="#f5a524"/>
</svg>
'''
with open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8') as f:
    f.write(ICON)

manifest = {
    'name': TITLE, 'short_name': TITLE, 'description': DESC,
    'start_url': './', 'scope': './', 'display': 'fullscreen', 'orientation': 'any',
    'background_color': BG, 'theme_color': BG,
    'icons': [
        {'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icon.svg', 'sizes': 'any', 'type': 'image/svg+xml'},
    ],
}
with open(os.path.join(OUT, 'manifest.webmanifest'), 'w', encoding='utf-8') as f:
    f.write(json.dumps(manifest, indent=2) + '\n')

if IMAGES:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, size, pad in (('icon-192.png', 192, 0), ('icon-512.png', 512, 0), ('apple-touch-icon.png', 180, 0)):
            pg = browser.new_page(viewport={'width': size, 'height': size})
            pg.set_content(f'<html><body style="margin:0;background:{BG}">{ICON.replace("<svg ", f"<svg width={size} height={size} ")}</body></html>')
            pg.screenshot(path=os.path.join(OUT, name))
            pg.close()
        # link preview: the title and the map at 1200x630, on a fixed map so it stays the same between builds
        pg = browser.new_page(viewport={'width': 1200, 'height': 630})
        pg.add_init_script("try{localStorage.setItem('ds1.seed','7729');localStorage.setItem('ds1.round','\"short\"')}catch(e){}")
        pg.goto('file://' + os.path.join(OUT, 'index.html'))
        css = '.rules,.win,.setup,.go,.keys{display:none!important}.title-panel{gap:26px}'
        # Google Fonts may be unreachable where this runs; DS_FONTSOURCE can point at node_modules/@fontsource
        # (npm install @fontsource/chakra-petch @fontsource/atkinson-hyperlegible @fontsource/ibm-plex-mono)
        fs = os.environ.get('DS_FONTSOURCE')
        if fs:
            for fam, folder, weights in (('Chakra Petch', 'chakra-petch', (500, 600, 700)), ('Atkinson Hyperlegible', 'atkinson-hyperlegible', (400, 700)), ('IBM Plex Mono', 'ibm-plex-mono', (400, 500, 600))):
                for w in weights:
                    css += f"@font-face{{font-family:'{fam}';font-weight:{w};src:url('file://{fs}/{folder}/files/{folder}-latin-{w}-normal.woff2') format('woff2')}}"
        pg.add_style_tag(content=css)
        pg.evaluate('document.fonts.ready')
        pg.wait_for_timeout(2500)
        pg.screenshot(path=os.path.join(OUT, 'preview.jpg'), type='jpeg', quality=86)
        browser.close()

print('built', OUT, len(page), 'bytes', '(with images)' if IMAGES else '')
