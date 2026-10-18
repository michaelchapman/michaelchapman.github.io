# windows on an upper storey stay clear of a lower neighbour's roof leaning on the wall below them.
# Run with BH_CHROMIUM=/opt/pw-browsers/chromium python3 test/m9windows.py
import os, sys
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
towns={n: open(f'{ROOT}/test/{f}').read().strip() for n, f in [('Chimphaven', 'town-chimphaven.txt'), ("Michael's islands", 'town-michael-boats.txt')]}
fails=[]
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ')+name, info if not ok else '')
    if not ok: fails.append(name)
SCAN="""(async (code) => { const b = window.__brasshaven;
  if (code) { const t = await b.decodeTown(code); b.openCode(t.c, t.mt, t.name, t.world); await new Promise((r) => setTimeout(r, 50)); }
  let walls = 0, open = 0; const bad = [];
  for (let v = 0; v < b.V; v++) for (let y = 2; y <= 12; y++) {
    if (!b.F(v, y)) continue;
    b.ringW[v].forEach((w, i) => {
      const rh = b.roofBelow(v, y, w); if (!rh || b.M(v, y) === 4) return;
      walls++; const { type, holes } = b.openings(v, y, i);
      if (holes.length) open++;
      for (const h of holes) for (const q of h.pts) if (q[1] < rh) { bad.push([v, y, i, type, +q[1].toFixed(2), +rh.toFixed(2)]); return; }
    });
  }
  return { walls, open, bad: bad.slice(0, 5) }; })"""
# a tall house with a lower neighbour of each material on its sides
STEP="""(async () => { const b = window.__brasshaven; b.replaceTown(new Uint16Array(b.V), new Uint8Array(b.V * 16));
  const v = b.nearestVertex(0, 0), adds = [[v, 0, 0], [v, 1, 0], [v, 2, 0], [v, 3, 0]];
  b.ringW[v].forEach((w, j) => { const m = [0, 2, 4, 3, 1, 5][j % 6]; adds.push([w, 0, 0], [w, 1, m]); });
  b.commit(adds, []); await new Promise((r) => setTimeout(r, 50)); return 1; })()"""
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=br.new_context(viewport={'width':800,'height':600}).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(2500)
    page.evaluate(STEP)
    r=page.evaluate(SCAN, None)
    check('a tall house beside low ones keeps its windows above their roofs', r['walls']>0 and not r['bad'], r)
    for name, code in towns.items():
        r=page.evaluate(SCAN, code)
        print(name, r)
        check(f'{name}: no window dips below a lower roof', r['walls']>0 and not r['bad'], r['bad'])
        check(f'{name}: most walls over a lower roof still have a window', r['open'] > r['walls'] * 0.5, r)
    check('no page errors', not errs, errs)
    br.close()
print('ALL PASSED' if not fails else 'FAILED: '+', '.join(fails), len(fails))
sys.exit(1 if fails else 0)
