import os
import json, os, base64, io, sys
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SITE=f'{ROOT}/site'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
def route_files(r):
    u=r.request.url
    if 'three.module' in u: return r.fulfill(status=200, content_type='application/javascript', body=three)
    if u.startswith('http://site.test/'):
        path = u[len('http://site.test/'):].split('#')[0].split('?')[0]
        if path.endswith('/') or path == '': path += 'index.html'
        fp = os.path.join(SITE, path)
        if os.path.isfile(fp):
            ct = {'html':'text/html','svg':'image/svg+xml','png':'image/png','jpg':'image/jpeg','webmanifest':'application/manifest+json'}[fp.rsplit('.',1)[1]]
            return r.fulfill(status=200, content_type=ct, body=open(fp,'rb').read())
        return r.fulfill(status=404, body='nope')
    return r.abort()
mode = sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    if mode == 'icons':
        ctx=b.new_context(viewport={'width':512,'height':512}); page=ctx.new_page(); page.route('**/*', route_files)
        svg = open(f'{SITE}/brasshaven/icon.svg').read()
        page.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", "<svg width=512 height=512 ")}</body></html>')
        page.screenshot(path=f'{SITE}/icon-512-raw.png', omit_background=True, clip={'x':0,'y':0,'width':512,'height':512})
        im = Image.open(f'{SITE}/icon-512-raw.png').convert('RGBA')
        im.save(f'{SITE}/brasshaven/icon-512.png', optimize=True)
        im.resize((192,192), Image.LANCZOS).save(f'{SITE}/brasshaven/icon-192.png', optimize=True)
        # apple icons are drawn square without transparency
        bg = Image.new('RGBA', im.size, (31,24,19,255)); bg.alpha_composite(im)
        bg.convert('RGB').resize((180,180), Image.LANCZOS).save(f'{SITE}/brasshaven/apple-touch-icon.png', optimize=True)
        os.remove(f'{SITE}/icon-512-raw.png'); print('icons ok')
    else:
        ctx=b.new_context(viewport={'width':1200,'height':630}, device_scale_factor=2); page=ctx.new_page(); errs=[]
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.route('**/*', route_files)
        page.goto('http://site.test/brasshaven/'); page.wait_for_timeout(4000)
        info = page.evaluate("""() => ({ title: document.title, framed: window.self !== window.top, claude: typeof window.claude, og: document.querySelector('meta[property="og:image"]').content, icon: document.querySelector('link[rel=icon]').href })""")
        print('page', info, 'errors', errs)
        print('showcase', page.evaluate(open(f'{ROOT}/test/showcase.js').read()))
        shots = json.loads(sys.argv[2])
        for k, s in enumerate(shots):
            data = page.evaluate(f"""(() => {{ const b = window.__brasshaven; const g = b.goal; g.dist = {s['dist']}; g.pitch = {s['pitch']}; g.yaw = -1.85 + {s['dyaw']}; g.ty = {s['ty']}; Object.assign(b.view, g);
              const ships = b.shipsRaw; const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
              // park the airships behind the town, off to the sides, so they frame it rather than hide it
              ships.forEach((sh, i) => {{ const side = i % 2 ? -1 : 1; sh.grp.position.set(g.tx - fx * (5 + i * 2) + fz * side * (6 + i), 6.2 + i * 0.9, g.tz - fz * (5 + i * 2) - fx * side * (6 + i)); sh.yaw = Math.atan2(fx * side, fz * side) ; sh.grp.rotation.set(0, sh.yaw + 1.2 * side, 0); sh.hull.position.y = 0; }});
              b.sim(0.05); ships.forEach((sh, i) => {{ const side = i % 2 ? -1 : 1; const far = i >= 2 ? 60 : 0; sh.grp.position.set(g.tx - fx * (5 + i * 2 + far) + fz * side * (6 + i), 6.2 + i * 0.9, g.tz - fz * (5 + i * 2 + far) - fx * side * (6 + i)); }});
              return b.cleanShot(); }})()""")
            im = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGB').resize((1200,630), Image.LANCZOS)
            im.save(f'{ROOT}/test/preview-{k}.jpg', quality=88)
        print('previews', len(shots))
    b.close()
