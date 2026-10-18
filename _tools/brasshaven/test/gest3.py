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
    res = E("""(() => {
      const b = window.__brasshaven, c = document.getElementById('scene'), out = {};
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1, bubbles: true }));
      // pinch out about (195, 420): the ground point there must stay put
      b.syncCam(); const g0 = b.groundAt(195, 420), d0 = b.goal.dist;
      ev('pointerdown', 1, 160, 420); ev('pointerdown', 2, 230, 420);
      for (let k = 1; k <= 12; k++) { ev('pointermove', 1, 160 - 5 * k, 420); ev('pointermove', 2, 230 + 5 * k, 420); }
      ev('pointerup', 1, 100, 420); ev('pointerup', 2, 290, 420);
      b.syncCam(); const g1 = b.groundAt(195, 420);
      out.pinch = { d0, d1: b.goal.dist, centreMoved: Math.hypot(g1[0] - g0[0], g1[2] - g0[2]) };
      // after a pinch, the finger left behind must not turn or tilt the view
      const y0 = b.goal.yaw, p0 = b.goal.pitch;
      ev('pointerdown', 3, 150, 420); ev('pointerdown', 4, 240, 420);
      for (let k = 1; k <= 5; k++) { ev('pointermove', 3, 150 - 4 * k, 420); ev('pointermove', 4, 240 + 4 * k, 420); }
      ev('pointerup', 4, 260, 420);
      for (let k = 1; k <= 8; k++) ev('pointermove', 3, 130 + 15 * k, 420 + 5 * k);
      ev('pointerup', 3, 250, 460);
      out.leftBehind = { dyaw: b.goal.yaw - y0, dpitch: b.goal.pitch - p0 };
      // look away from the town, close up: the way back should appear
      const tx = b.goal.tx, tz = b.goal.tz;
      b.goal.tx = tx + 14; b.goal.tz = tz + 10; b.goal.dist = 7; b.goal.pitch = 0.35;
      b.goal.yaw = Math.atan2(-14, -10); b.syncCam();
      return out;
    })()""")
    print(json.dumps(res))
    page.wait_for_timeout(3000)
    print('lost pill shown', E('window.__brasshaven.lost()'))
    page.screenshot(path=f'{ROOT}/test/fx-lost.png')
    page.locator('#home-pill').tap(); page.wait_for_timeout(3000)
    print('after home: lost', E('window.__brasshaven.lost()'))
    page.screenshot(path=f'{ROOT}/test/fx-home.png')
    print('errors', errs)
    b.close()
