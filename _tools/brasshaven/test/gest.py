import os
import json, math
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
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
    cdp = ctx.new_cdp_session(page)
    E = page.evaluate
    def touch(kind, pts):
        cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in pts]})
    def g(): return E("(() => { const g = window.__brasshaven.goal; return { yaw: +g.yaw.toFixed(4), pitch: +g.pitch.toFixed(4), dist: +g.dist.toFixed(3), tx: +g.tx.toFixed(3), tz: +g.tz.toFixed(3) }; })()")
    def drag1(x0, y0, x1, y1, n=12):
        touch('touchStart', [(0, (x0, y0))])
        for k in range(1, n + 1): touch('touchMove', [(0, (x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n))]); page.wait_for_timeout(16)
        page.wait_for_timeout(200)  # hold still before release: no flick
        touch('touchEnd', [])
    def sync(): E('window.__brasshaven.syncCam()')
    # 1. horizontal, vertical and diagonal one-finger drags (on open water at the top of the screen)
    a = g(); drag1(80, 150, 260, 156); b1 = g()
    print('horizontal: dyaw %.3f dpitch %.4f' % (b1['yaw'] - a['yaw'], b1['pitch'] - a['pitch']))
    sync(); a = g(); drag1(200, 120, 206, 300); b1 = g()
    print('vertical:   dyaw %.4f dpitch %.3f' % (b1['yaw'] - a['yaw'], b1['pitch'] - a['pitch']))
    sync(); a = g(); drag1(100, 120, 230, 250); b1 = g()
    print('diagonal:   dyaw %.3f dpitch %.3f' % (b1['yaw'] - a['yaw'], b1['pitch'] - a['pitch']))
    # 2. no drift: the view stays put after a slow release
    sync(); a = g(); page.wait_for_timeout(1200); b1 = g()
    print('drift after slow release: dyaw %.4f' % (b1['yaw'] - a['yaw']))
    # 3. two-finger pan: the ground under the fingers follows them
    sync(); g0 = E('window.__brasshaven.groundAt(195, 300)')
    touch('touchStart', [(0, (150, 300)), (1, (240, 300))])
    for k in range(1, 11): touch('touchMove', [(0, (150 + 6 * k, 300 + 9 * k)), (1, (240 + 6 * k, 300 + 9 * k))]); page.wait_for_timeout(16)
    page.wait_for_timeout(200); touch('touchEnd', [])
    sync(); g1 = E('window.__brasshaven.groundAt(255, 390)')
    print('pan: ground point moved by %.3f (should be ~0); dist change %.3f' % (math.dist(g0, g1), 0))
    # 4. pinch out with a slight twist: zoom follows, small twist ignored, centre point stays put
    sync(); a = g(); c0 = E('window.__brasshaven.groundAt(195, 420)')
    touch('touchStart', [(0, (160, 420)), (1, (230, 420))])
    for k in range(1, 13): touch('touchMove', [(0, (160 - 5 * k, 420 - 0.6 * k)), (1, (230 + 5 * k, 420 + 0.6 * k))]); page.wait_for_timeout(16)
    page.wait_for_timeout(150); touch('touchEnd', [])
    sync(); b1 = g(); c1 = E('window.__brasshaven.groundAt(195, 420)')
    print('pinch: dist %.2f -> %.2f, dyaw %.4f, centre moved %.3f' % (a['dist'], b1['dist'], b1['yaw'] - a['yaw'], math.dist(c0, c1)))
    # 5. a deliberate twist rotates
    sync(); a = g()
    touch('touchStart', [(0, (150, 420)), (1, (240, 420))])
    for k in range(1, 13):
        ang = 0.06 * k; cx, cy, r = 195, 420, 45
        touch('touchMove', [(0, (cx - r * math.cos(ang), cy - r * math.sin(ang))), (1, (cx + r * math.cos(ang), cy + r * math.sin(ang)))]); page.wait_for_timeout(16)
    touch('touchEnd', []); b1 = g()
    print('twist: dyaw %.3f (twist 0.72, first 0.24 is dead zone)' % (b1['yaw'] - a['yaw']))
    # 6. after a pinch, the finger left behind does not turn the view
    sync(); a = g()
    touch('touchStart', [(0, (150, 420)), (1, (240, 420))])
    for k in range(1, 6): touch('touchMove', [(0, (150 - 4 * k, 420)), (1, (240 + 4 * k, 420))]); page.wait_for_timeout(16)
    touch('touchMove', [(0, (130, 420))])  # second finger lifts; the first stays down
    for k in range(1, 8): touch('touchMove', [(0, (130 + 15 * k, 420 + 5 * k))]); page.wait_for_timeout(16)
    touch('touchEnd', []); b1 = g()
    print('left-behind finger: dyaw %.4f dpitch %.4f' % (b1['yaw'] - a['yaw'], b1['pitch'] - a['pitch']))
    # 7. hold to remove: ring at ~0.5s, removal at ~0.85s; releasing in between cancels
    page.reload(); page.wait_for_timeout(2600)
    cdp = ctx.new_cdp_session(page)
    E("(() => { const b = window.__brasshaven; b.goal.dist = 14; b.goal.pitch = 0.7; b.syncCam(); })()")
    page.wait_for_timeout(600)
    pt = E("""(() => { const b = window.__brasshaven; for (let v = 0; v < b.V; v++) { if (!b.F(v, 1) || b.F(v, 2)) continue; let t = 1; while (b.F(v, t + 1)) t++; const P = new (b.camera.position.constructor)(b.X[v], 0.42 + t * 0.98 + 0.05, b.Z[v]).project(b.camera); const x = (P.x + 1) / 2 * 390, y = (1 - P.y) / 2 * 844; if (x > 40 && x < 350 && y > 150 && y < 620) { const h = b.pickAt(x, y); if (h && h.type === 'cell' && (h.tag & 4095) === v) return [x, y, v]; } } return null; })()""")
    print('target', pt)
    n0 = E('window.__brasshaven.cellCount()')
    touch('touchStart', [(0, (pt[0], pt[1]))]); page.wait_for_timeout(560)
    ring = E("document.getElementById('hold').classList.contains('on')")
    touch('touchEnd', []); page.wait_for_timeout(400)
    print('hold 0.56s then release: ring shown', ring, 'blocks', n0, '->', E('window.__brasshaven.cellCount()'))
    touch('touchStart', [(0, (pt[0], pt[1]))]); page.wait_for_timeout(1100)
    print('hold 1.1s: blocks ->', E('window.__brasshaven.cellCount()'), 'ring off', not E("document.getElementById('hold').classList.contains('on')"))
    touch('touchEnd', []); page.wait_for_timeout(300)
    sel = E("String(document.getSelection())")
    print('selection after holds:', repr(sel))
    # 8. tap builds (quick)
    n1 = E('window.__brasshaven.cellCount()')
    touch('touchStart', [(0, (pt[0], pt[1]))]); page.wait_for_timeout(120); touch('touchEnd', []); page.wait_for_timeout(500)
    print('tap: blocks', n1, '->', E('window.__brasshaven.cellCount()'))
    # 9. explanations once
    for m in ('.coin.m1', '.coin.m2', '.coin.m1'):
        page.locator(m).tap(); page.wait_for_timeout(250)
        print('select', m, '->', repr(E('window.__brasshaven.hintText()')))
        page.wait_for_timeout(2800)
    # 10. lost and found
    E("(() => { const b = window.__brasshaven; b.goal.tx += 30; b.goal.tz += 25; b.syncCam(); })()"); page.wait_for_timeout(3500)
    print('lost pill shown', E('window.__brasshaven.lost()'))
    page.locator('#home-pill').tap(); page.wait_for_timeout(3500)
    print('after home: lost', E('window.__brasshaven.lost()'), g())
    print('errors', errs)
    b.close()
