import os
import json, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    page=ctx.new_page(); logs=[]
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}')); page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    def route(r):
        u=r.request.url
        if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
        else: r.abort()
    page.route('**/*', route)
    page.goto('http://bh.test/index.html'); page.wait_for_timeout(2500)
    E=lambda js: page.evaluate(js)
    page.locator('#gear').click(); page.wait_for_timeout(300)
    page.locator('#m-amb').fill('25'); page.wait_for_timeout(200)
    print('stored ambience', E("localStorage.getItem(Object.keys(localStorage).find(k => k.includes('ambience')) || 'x')"), 'api', E("window.__brasshaven.life().ambience"))
    page.screenshot(path=f'{ROOT}/test/m5-menu.png')
    # sound off silences the master; back on restores it
    print('amb test', E("window.__brasshaven.ambTest()"))
    page.locator('#m-sound').click(); page.wait_for_timeout(300)
    print('after off: sound pressed', E("document.getElementById('m-sound').getAttribute('aria-pressed')"))
    page.locator('#m-sound').click(); page.wait_for_timeout(300)
    print('after on:', E("document.getElementById('m-sound').getAttribute('aria-pressed')"))
    # reload keeps the setting
    page.reload(); page.wait_for_timeout(2500)
    print('after reload', E("window.__brasshaven.life().ambience"), E("document.getElementById('m-amb').value"))
    for l in logs[:20]: print(l)
    b.close()
