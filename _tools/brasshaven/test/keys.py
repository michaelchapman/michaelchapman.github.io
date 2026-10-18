import os
import json, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for mobile in (False, True):
        ctx=b.new_context(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 760}, is_mobile=mobile, has_touch=mobile)
        page=ctx.new_page(); errs=[]
        page.on('pageerror', lambda e: errs.append(str(e)))
        def route(r):
            u=r.request.url
            if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
            elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
            else: r.abort()
        page.route('**/*', route)
        page.goto('http://bh.test/index.html'); page.wait_for_timeout(2500)
        T = lambda: page.evaluate('window.__brasshaven.tension()')
        kb = page.locator('#key-btn').bounding_box(); tb = page.locator('#time-btn').bounding_box()
        kx, ky = kb['x'] + kb['width']/2, kb['y'] + kb['height']/2
        res = {}
        if mobile:
            page.touchscreen.tap(kx, ky); page.wait_for_timeout(300)
            res['tap'] = round(T(), 3)
            # long hold via CDP touch events
            cdp = ctx.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': kx, 'y': ky}]})
            page.wait_for_timeout(2500)
            res['holding'] = round(T(), 3)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            page.wait_for_timeout(200)
            res['released'] = round(T(), 3)
            page.touchscreen.tap(tb['x'] + 25, tb['y'] + 25); page.wait_for_timeout(400)
        else:
            page.mouse.click(kx, ky); page.wait_for_timeout(300)
            res['tap'] = round(T(), 3)
            page.mouse.move(kx, ky); page.mouse.down(); page.wait_for_timeout(2500)
            res['holding'] = round(T(), 3)
            page.mouse.up(); page.wait_for_timeout(200)
            res['released'] = round(T(), 3)
            page.keyboard.press('t'); page.wait_for_timeout(300)
            page.locator('#time-btn').click(); page.wait_for_timeout(300)
            page.keyboard.press('k'); page.wait_for_timeout(100)
            res['afterK'] = round(T(), 3)
        res['time'] = page.evaluate('window.__brasshaven.time()')
        res['hint'] = page.locator('#hint').text_content()
        res['label'] = page.locator('#key-btn').get_attribute('aria-label')
        res['timeLabel'] = page.locator('#time-btn').get_attribute('aria-label')
        res['stored'] = page.evaluate("localStorage.getItem('brasshaven:time')")
        print('mobile' if mobile else 'desktop', json.dumps(res), 'errors', errs)
        page.screenshot(path=f'{ROOT}/test/keys-{"m" if mobile else "d"}.png')
        ctx.close()
    b.close()
