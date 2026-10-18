# a two-finger slide that wobbles stays a slide; a clear pinch or twist still works. Run with BH_CHROMIUM=/opt/pw-browsers/chromium python3 test/touch3.py
import os, sys, json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
fails=[]
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ')+name, info if not ok else '')
    if not ok: fails.append(name)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(2600)
    GESTURE="""((g) => {
      const b = window.__brasshaven, c = document.getElementById('scene'), M = Math;
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1, bubbles: true }));
      b.syncCam(); const d0 = b.goal.dist, y0 = b.goal.yaw, tx = b.goal.tx, tz = b.goal.tz;
      const at = (k) => { const f = k / g.n, cx = 195 + g.dx * f, cy = 420 + g.dy * f, h = (90 * (1 + g.grow * f)) / 2, a = g.tilt * f;
        return [cx - h * M.cos(a), cy - h * M.sin(a), cx + h * M.cos(a), cy + h * M.sin(a)]; };
      let q = at(0); ev('pointerdown', 1, q[0], q[1]); ev('pointerdown', 2, q[2], q[3]);
      for (let k = 1; k <= g.n; k++) { q = at(k); ev('pointermove', 1, q[0], q[1]); ev('pointermove', 2, q[2], q[3]); }
      ev('pointerup', 1, q[0], q[1]); ev('pointerup', 2, q[2], q[3]); b.syncCam();
      return { zoom: b.goal.dist / d0, turn: b.goal.yaw - y0, moved: M.hypot(b.goal.tx - tx, b.goal.tz - tz) }; })"""
    r=page.evaluate(GESTURE, {'n':24,'dx':220,'dy':0,'grow':0.15,'tilt':0.3})
    check('a wobbly sideways slide moves the view', r['moved']>2, r)
    check('a wobbly sideways slide does not zoom', abs(r['zoom']-1)<0.01, r)
    check('a wobbly sideways slide does not turn', abs(r['turn'])<0.01, r)
    r=page.evaluate(GESTURE, {'n':24,'dx':0,'dy':180,'grow':0.12,'tilt':-0.28})
    check('a wobbly up-and-down slide does not zoom or turn', abs(r['zoom']-1)<0.01 and abs(r['turn'])<0.01 and r['moved']>1, r)
    r=page.evaluate(GESTURE, {'n':16,'dx':0,'dy':0,'grow':1.0,'tilt':0})
    check('a pinch still zooms', r['zoom']<0.7, r)
    r=page.evaluate(GESTURE, {'n':16,'dx':0,'dy':0,'grow':0,'tilt':0.8})
    check('a twist still turns', abs(r['turn'])>0.3, r)
    r=page.evaluate(GESTURE, {'n':24,'dx':160,'dy':0,'grow':1.0,'tilt':0})
    check('a pinch while sliding still zooms', r['zoom']<0.8, r)
    check('no page errors', not errs, errs)
    b.close()
print('ALL PASSED' if not fails else 'FAILED: '+', '.join(fails), len(fails))
sys.exit(1 if fails else 0)
