import os
import json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':1100,'height':760})
    page=ctx.new_page()
    def route(r):
        u=r.request.url
        if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
        else: r.abort()
    page.route('**/*', route)
    page.goto('http://bh.test/index.html'); page.wait_for_timeout(2500)
    page.evaluate("""() => { window.__ev = []; const k = document.getElementById('key-btn'); for (const t of ['pointerdown','pointerup','pointercancel','lostpointercapture','gotpointercapture','click','pointerleave']) k.addEventListener(t, (e) => window.__ev.push(t + ':' + (e.detail ?? '') + ':' + Math.round(performance.now()))); }""")
    kb = page.locator('#key-btn').bounding_box(); kx, ky = kb['x']+25, kb['y']+25
    page.mouse.move(kx, ky); page.mouse.down()
    for i in range(5):
        page.wait_for_timeout(500)
        print(page.evaluate("[window.__brasshaven.winding(), window.__brasshaven.tension(), performance.now()|0]"))
    page.mouse.up(); page.wait_for_timeout(300)
    print(page.evaluate("window.__ev"))
    b.close()
