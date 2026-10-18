import os
import json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
HELP = """window.__t = (() => { const b = window.__brasshaven; const V3 = b.camera.position.constructor;
  const scr = (x,y,z) => { const p = new V3(x,y,z).project(b.camera); return [(p.x+1)/2*innerWidth, (1-p.y)/2*innerHeight]; };
  return { b, scr }; })();"""
with sync_playwright() as p:
    br=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    page=ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(2500)
    page.evaluate(HELP)
    count = lambda: page.evaluate("window.__brasshaven.cellCount()")
    hint = lambda: page.evaluate("document.getElementById('hint').textContent")
    # 1. distant lonely water: needs a second tap
    far = page.evaluate("""() => { const {b, scr} = window.__t;
      for (let v = 0; v < b.V; v++) { if (!b.buildable[v] || b.cols[v]) continue;
        if (b.ringW[v].some(w => b.cols[w])) continue;
        const d = Math.hypot(b.X[v]-b.goal.tx, b.Z[v]-b.goal.tz); if (d < 11 || d > 16) continue;
        const [x,y] = scr(b.X[v],0,b.Z[v]); if (x < 40 || x > 350 || y < 140 || y > 600) continue;
        const h = b.pickAt(x,y); if (!h || h.type !== 'water' || b.nearestVertex(h.x,h.z) !== v) continue;
        let clear = true; for (const r of [10,20,30,40]) for (let k=0;k<8;k++){ const hh=b.pickAt(x+Math.cos(k*0.785)*r, y+Math.sin(k*0.785)*r); if (hh && hh.type==='cell') clear=false; }
        if (clear) return {v, x, y}; } return null; }""")
    c0 = count(); page.touchscreen.tap(far['x'], far['y']); page.wait_for_timeout(400)
    r1 = (count() - c0, hint())
    page.touchscreen.tap(far['x'] + 3, far['y'] + 2); page.wait_for_timeout(400)
    r2 = count() - c0
    print('1 distant water: first tap adds', r1[0], '| hint:', r1[1], '| second tap adds', r2)
    page.evaluate("window.__brasshaven.undo()"); page.wait_for_timeout(300)
    # 2. finger slipping just above the tallest roof onto far water: should hit the building
    slip = page.evaluate("""() => { const {b, scr} = window.__t;
      let best = -1, hh = -1; for (let v = 0; v < b.V; v++) { let t = 0; for (let y = 0; y <= 12; y++) if (b.F(v,y)) t = y; if (t > hh) { hh = t; best = v; } }
      const top = 0.42 + hh*0.98 + 0.75; const [x,y] = scr(b.X[best], top + 0.35, b.Z[best]);
      const h = b.pickAt(x, y); return {v: best, h: hh, x, y, centre: h ? h.type : null}; }""")
    c0 = count(); page.touchscreen.tap(slip['x'], slip['y']); page.wait_for_timeout(400)
    after = page.evaluate(f"(() => {{ const b = window.__brasshaven; let t=0; for (let y=0;y<=12;y++) if (b.F({slip['v']},y)) t=y; return t; }})()")
    print('2 slip off roof (centre ray hit %s): blocks added %d, tower height %d -> %d' % (slip['centre'], count()-c0, slip['h'], after))
    page.evaluate("window.__brasshaven.undo()"); page.wait_for_timeout(300)
    # 3. water right beside the town builds at once
    near = page.evaluate("""() => { const {b, scr} = window.__t;
      for (let v = 0; v < b.V; v++) { if (!b.buildable[v] || b.cols[v] || !b.ringW[v].some(w => b.F(w,0))) continue;
        const [x,y] = scr(b.X[v],0,b.Z[v]); if (x<30||x>360||y<150||y>600) continue; const h=b.pickAt(x,y);
        if (h && h.type==='water' && b.nearestVertex(h.x,h.z)===v) return {v,x,y}; } return null; }""")
    c0 = count(); page.touchscreen.tap(near['x'], near['y']); page.wait_for_timeout(400)
    print('3 water beside town: blocks added', count()-c0)
    # 4. paint tool via the dock, copper coin, then tap that new house
    page.evaluate("document.getElementById('tool-paint').click(); document.querySelector('.coin.m2').click();")
    xy = page.evaluate(f"window.__t.scr(window.__brasshaven.X[{near['v']}], 0.42+0.98*0.5, window.__brasshaven.Z[{near['v']}])")
    page.touchscreen.tap(*xy); page.wait_for_timeout(400)
    print('4 paint: material of new house now', page.evaluate(f"window.__brasshaven.M({near['v']},1)"), '(2 = copper)')
    print('errors', errs)
    br.close()
