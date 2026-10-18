import os
import sys, time, json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
out=sys.argv[1] if len(sys.argv)>1 else 'shot'
w=int(sys.argv[2]) if len(sys.argv)>2 else 1280
h=int(sys.argv[3]) if len(sys.argv)>3 else 800
mobile = w < 700
actions = sys.argv[4] if len(sys.argv)>4 else ''
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    page=ctx.new_page()
    logs=[]
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    def route(r):
        u=r.request.url
        if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
        else: r.abort()
    page.route('**/*', route)
    t0=time.time()
    page.goto('http://bh.test/index.html')
    page.wait_for_timeout(2500)
    if actions:
        res = page.evaluate(actions)
        print('actions:', json.dumps(res)[:800])
        page.wait_for_timeout(1500)
    page.screenshot(path=f'{ROOT}/test/{out}.png')
    info = page.evaluate("() => { const b = window.__brasshaven; if(!b) return null; return {tris: b.renderer.info.render.triangles, calls: b.renderer.info.render.calls, blocks: b.cellCount(), V: b.V}; }")
    print('info', info, 'elapsed', round(time.time()-t0,1))
    for l in logs[:40]: print(l)
    b.close()
