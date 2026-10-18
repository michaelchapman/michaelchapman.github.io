# walled squares of bare island grass become gardens and market halls, as stone ones do.
# Run with BH_CHROMIUM=/opt/pw-browsers/chromium python3 test/m9yards.py
import os, sys
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
fails=[]
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ')+name, info if not ok else '')
    if not ok: fails.append(name)
# wall in a patch of island grass: n=1 for a garden, n=3 for a market (glasshouses round it)
YARD="""(async ([n, glass]) => { const b = window.__brasshaven;
  b.replaceTown(new Uint16Array(b.V), new Uint8Array(b.V * 16)); b.setWorld(true);
  b.land.fill(0); for (let v = 0; v < b.V; v++) if (b.ringW[v].length && Math.hypot(b.X[v], b.Z[v]) < 4) b.land[v] = 1;
  b.commit([], []); await new Promise((r) => setTimeout(r, 50));
  const v0 = b.nearestVertex(0, 0), patch = [v0];
  while (patch.length < n) { const w = b.ringW[patch[patch.length - 1]].find((u) => !patch.includes(u)); patch.push(w); }
  const walls = new Set(); for (const u of patch) for (const w of b.ringW[u]) if (!patch.includes(w)) walls.add(w);
  const adds = []; let k = 0; for (const w of walls) { const m = glass && k++ < 3 ? 4 : 0; adds.push([w, 0, m], [w, 1, m]); }
  b.commit(adds, []); await new Promise((r) => setTimeout(r, 50));
  const lm = b.landmarks().map((l) => l.id);
  const floor = b.fineNear(b.X[v0], b.Z[v0], 0.3, 0.41, 0.6, true) + b.fineNear(b.X[v0], b.Z[v0], 0.3, 0.41, 0.6);
  return { bare: patch.every((u) => b.land[u] && !b.cols[u]), yards: b.yards(), lm, floor, walkers: b.walkers().length }; })"""
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=br.new_context(viewport={'width':800,'height':600}).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(2500)
    r=page.evaluate(YARD, [1, False])
    check('a walled patch of island grass becomes a garden', r['bare'] and r['yards']==1, r)
    check('the garden is laid at the level of the streets round it', r['floor']>0, r)
    r=page.evaluate(YARD, [3, True])
    check('three cells of island grass walled with glasshouses become a market hall', r['bare'] and 'market' in r['lm'], r)
    check('no page errors', not errs, errs)
    br.close()
print('ALL PASSED' if not fails else 'FAILED: '+', '.join(fails), len(fails))
sys.exit(1 if fails else 0)
