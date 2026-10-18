import os
import json, os, base64
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for (w,h,tag) in ((390,844,'port'),(844,390,'land')):
        ctx=b.new_context(viewport={'width':w,'height':h}, is_mobile=True, has_touch=True, device_scale_factor=2)
        page=ctx.new_page(); errs=[]
        page.on('pageerror', lambda e: errs.append(str(e)))
        def route(r):
            u=r.request.url
            if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
            elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
            else: r.abort()
        page.route('**/*', route)
        page.goto('http://bh.test/index.html'); page.wait_for_timeout(3000)
        page.screenshot(path=f'{ROOT}/test/m4-{tag}.png', timeout=120000)
        bb = page.locator('#pc-btn').bounding_box(); page.touchscreen.tap(bb['x']+25, bb['y']+25); page.wait_for_timeout(800)
        sb = page.locator('#pc-snap').bounding_box(); page.touchscreen.tap(sb['x']+29, sb['y']+29)
        page.wait_for_function("!document.getElementById('pc-sheet').hidden", timeout=90000); page.wait_for_timeout(800)
        page.screenshot(path=f'{ROOT}/test/m4-{tag}-sheet.png', timeout=120000)
        data = page.evaluate("""new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(window.__brasshaven.pcBlob()); })""")
        open(f'{ROOT}/test/m4-{tag}-card.jpg','wb').write(base64.b64decode(data.split(',')[1]))
        print(tag, 'size', page.evaluate("window.__brasshaven.pcBlob().size"), 'errors', errs)
        ctx.close()
    b.close()
