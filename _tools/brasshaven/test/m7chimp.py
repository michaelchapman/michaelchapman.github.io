# milestone 7 fixes found on Michael's own harbour (test/town-chimphaven.txt). Run with BH_CHROMIUM=/opt/pw-browsers/chromium python3 test/m7chimp.py
import os, sys
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
code=open(f'{ROOT}/test/town-chimphaven.txt').read().strip()
fails=[]
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ')+name, info if not ok else '')
    if not ok: fails.append(name)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=br.new_context(viewport={'width':800,'height':600}).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(2500)
    ev=page.evaluate
    r=ev("""(async (code) => { const b = window.__brasshaven; const t = await b.decodeTown(code); b.openCode(t.c, t.mt, t.name); return { cells: b.cellCount(), name: b.harbourName(), mast: b.mastPos() }; })""", code)
    check('the town opens', r['cells']>100, r)
    # the shallows follow the quays: under every stone quay, and nowhere far from one
    r=ev("""(() => { const b = window.__brasshaven, quay = [];
      for (let v = 0; v < b.V; v++) if ((b.cols[v] & 1) && b.M(v, 0) !== 5) quay.push(v);
      let missing = 0, stray = 0;
      for (const v of quay) if (b.shoreAt(b.X[v], b.Z[v]) < 0.4) missing++;
      for (let v = 0; v < b.V; v++) { if (quay.some((q) => Math.hypot(b.X[q] - b.X[v], b.Z[q] - b.Z[v]) < 4)) continue; if (b.shoreAt(b.X[v], b.Z[v]) > 0.05) stray++; }
      return { quays: quay.length, missing, stray }; })()""")
    check('the shallows sit under the quays', r['quays']>50 and r['missing']==0 and r['stray']==0, r)
    # the airship mast keeps its lattice at a distance: none of it is in the far-detail layer
    r=ev("(() => { const b = window.__brasshaven, m = b.mastPos(); return m && { fine: b.fineNear(m[0], m[2], 0.25, m[1] - 1.5) }; })()")
    check('the airship mast is not distance detail', r is not None and r['fine']==0, r)
    # lampposts keep their poles at a distance, so the lamp never floats
    r=ev("""(() => { const b = window.__brasshaven, bad = [];
      // street lamps stand on quays and piers with the lamp 0.93 above the ground; other lamps hang or sit inside buildings
      const lamps = b.dyn().lamps.filter(([, y]) => Math.abs(y - 0.42 - 0.93) < 0.01);
      // the pole is 7 sides of 2 triangles, 42 corners, and all of them must be in the main layer
      for (const [x, y, z] of lamps) { const n = b.fineNear(x, z, 0.025, y - 0.9, y - 0.05, true); if (n < 42) bad.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), n]); }
      return { lamps: lamps.length, bad: bad.slice(0, 5), nbad: bad.length }; })()""")
    check('lampposts keep their poles at a distance', r['lamps']>5 and r['nbad']==0, r)
    page.screenshot(path=f'{ROOT}/test/m7-chimp.png')
    check('no page errors', not errs, errs)
    br.close()
print('ALL PASSED' if not fails else 'FAILED: '+', '.join(fails), len(fails))
sys.exit(1 if fails else 0)
