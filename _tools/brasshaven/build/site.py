import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # this _tools/brasshaven folder
# Builds the standalone page for michaelchapman.me/brasshaven/ from the artifact source.
import re, sys, json, math
SRC = os.path.join(ROOT, 'brasshaven.html')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', '..', 'brasshaven')
src = open(SRC).read()
i = src.index('<style>')
body = src[i:]
DESC = ('A steampunk harbour town to build. Tap the water to raise houses in brick, brass, copper, cast iron, glass and timber; '
        'engine houses power the clockwork, and airships moor at the tallest tower.')
head = f'''<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f1813">
<title>Brasshaven</title>
<meta name="description" content="{DESC}">
<link rel="canonical" href="https://michaelchapman.me/brasshaven/">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Michael Chapman">
<meta property="og:title" content="Brasshaven">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="https://michaelchapman.me/brasshaven/">
<meta property="og:image" content="https://michaelchapman.me/brasshaven/preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A steampunk harbour town of brick and brass houses, a copper clock tower with a mooring mast, and an airship overhead">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Alegreya+Sans:wght@500;700;800&display=swap">
</head>
<body>
'''
page = head + body.rstrip() + '\n</body>\n</html>\n'
assert '<title>' not in body and 'claude:viewport' not in body
import os
os.makedirs(OUT, exist_ok=True)
open(f'{OUT}/index.html', 'w').write(page)

# icon: a brass gear with a gabled house at its hub, on walnut
def gear(cx, cy, r1, r0, n):
    pts = []
    for k in range(n):
        c = k * 2 * math.pi / n; s = 2 * math.pi / n
        for (r, a) in ((r0, c - 0.3 * s), (r1, c - 0.15 * s), (r1, c + 0.15 * s), (r0, c + 0.3 * s)):
            pts.append(f'{cx + r * math.cos(a):.2f} {cy + r * math.sin(a):.2f}')
    return 'M' + ' L'.join(pts) + ' Z'
hole = 'M32 19.5 A12.5 12.5 0 1 0 32 44.5 A12.5 12.5 0 1 0 32 19.5 Z'
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#1f1813"/>
<path fill="#d4a656" fill-rule="evenodd" d="{gear(32, 32, 27, 21.5, 12)} {hole}"/>
<path fill="#efcf86" d="M32 23.5 L40 30.5 V40 H24 V30.5 Z"/>
<rect x="29.6" y="33.6" width="4.8" height="6.4" fill="#1f1813"/>
</svg>
'''
open(f'{OUT}/icon.svg', 'w').write(svg)
manifest = {
  'name': 'Brasshaven', 'short_name': 'Brasshaven', 'description': DESC,
  'start_url': './', 'scope': './', 'display': 'fullscreen', 'orientation': 'any',
  'background_color': '#1f1813', 'theme_color': '#1f1813',
  'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'}, {'src': 'icon.svg', 'sizes': 'any', 'type': 'image/svg+xml'}],
}
open(f'{OUT}/manifest.webmanifest', 'w').write(json.dumps(manifest, indent=2) + '\n')
print('built', OUT, len(page))
