import os
import json, math
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    page=ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    def route(r):
        u=r.request.url
        if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
        else: r.abort()
    page.route('**/*', route)
    page.goto('http://bh.test/index.html'); page.wait_for_timeout(2600)
    E = page.evaluate
    cdp = ctx.new_cdp_session(page)
    E("""(() => { window.__ev = []; const c = document.getElementById('scene'); for (const t of ['pointerdown','pointerup','pointercancel']) c.addEventListener(t, (e) => window.__ev.push(t + ':' + e.pointerId)); })()""")
    def touch(kind, pts): cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in pts]})
    y0 = E('window.__brasshaven.goal.yaw')
    touch('touchStart', [(0, (150, 420)), (1, (240, 420))])
    for k in range(1, 6): touch('touchMove', [(0, (150 - 4 * k, 420)), (1, (240 + 4 * k, 420))])
    touch('touchMove', [(0, (130, 420))])
    for k in range(1, 8): touch('touchMove', [(0, (130 + 15 * k, 420 + 5 * k))])
    touch('touchEnd', [])
    page.wait_for_timeout(1500)
    print('events', E('window.__ev'), 'dyaw', E('window.__brasshaven.goal.yaw') - y0)
    # synthetic, precisely timed pointer events for the hold logic (independent of slow frames)
    res = E("""new Promise((done) => {
      const b = window.__brasshaven, c = document.getElementById('scene');
      b.goal.dist = 14; b.goal.pitch = 0.7; b.syncCam();
      let pt = null;
      for (let v = 0; v < b.V && !pt; v++) { if (!b.F(v, 1) || b.F(v, 2)) continue; const P = new (b.camera.position.constructor)(b.X[v], 0.42 + 0.98 + 0.05, b.Z[v]).project(b.camera); const x = (P.x + 1) / 2 * 390, y = (1 - P.y) / 2 * 844; const h = b.pickAt(x, y); if (x > 30 && x < 360 && y > 120 && y < 640 && h && h.type === 'cell' && (h.tag & 4095) === v) pt = [x, y]; }
      const ev = (type, id) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: pt[0], clientY: pt[1], isPrimary: true, bubbles: true }));
      const out = { pt };
      const n = () => b.cellCount();
      out.n0 = n();
      ev('pointerdown', 11); setTimeout(() => { out.ringAt500 = document.getElementById('hold').classList.contains('on'); }, 500);
      setTimeout(() => { ev('pointerup', 11); out.n1 = n(); }, 600);
      setTimeout(() => { out.afterCancel = n(); ev('pointerdown', 12); }, 1000);
      setTimeout(() => { out.afterHold = n(); ev('pointerup', 12); }, 2000);
      setTimeout(() => { ev('pointerdown', 13); setTimeout(() => { ev('pointerup', 13); setTimeout(() => { out.afterTap = n(); done(out); }, 200); }, 120); }, 2400);
    })""")
    print('hold test', res)
    # lost and found
    E("(() => { const b = window.__brasshaven; b.goal.tx += 12; b.goal.tz += 10; b.goal.dist = 6; b.goal.pitch = 0.3; b.syncCam(); })()"); page.wait_for_timeout(3500)
    print('lost pill shown', E('window.__brasshaven.lost()'), E("getComputedStyle(document.getElementById('home-pill')).visibility"))
    page.screenshot(path=f'{ROOT}/test/fx-lost.png')
    page.locator('#home-pill').tap(); page.wait_for_timeout(3500)
    print('after home: lost', E('window.__brasshaven.lost()'))
    print('errors', errs)
    b.close()
