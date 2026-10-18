# milestone 7: the harbour grows. Run with BH_CHROMIUM=/opt/pw-browsers/chromium python3 test/m7grow.py [old.html]
# With an old build of the page (for example `git show 812ecfc:brasshaven/index.html > /tmp/old.html`),
# it also checks that towns coded by the old grid open cell-for-cell the same.
import os, sys, re
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+html+'</body></html>'
old_html=open(sys.argv[1]).read() if len(sys.argv) > 1 else None
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
fails=[]
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ')+name, info if not ok else '')
    if not ok: fails.append(name)
def serve(page, body):
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=body) if r.request.url.startswith('http://bh.test/') else r.abort()))
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    codes=None
    if old_html:
        op=br.new_context(viewport={'width':800,'height':600}).new_page(); serve(op, old_html)
        op.goto('http://bh.test/'); op.wait_for_timeout(2500)
        # the starter town, and a town with a block on every buildable cell of the old grid
        codes=op.evaluate("""(async () => { const b = window.__brasshaven; const out = { V: b.V, starter: await b.encodeTown(), cells: [] };
          const adds = []; for (let v = 0; v < b.V; v++) if (b.buildable[v] && !b.F(v, 0)) adds.push([v, 0, v % 6]);
          b.commit(adds, []); for (let v = 0; v < b.V; v++) out.cells.push(b.cols[v] ? v * 64 + b.M(v, 0) : -1);
          out.full = await b.encodeTown(); return out; })()""")
        op.close()
    page=br.new_context(viewport={'width':800,'height':600}).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    serve(page, page_html)
    page.goto('http://bh.test/'); page.wait_for_timeout(2500)
    ev=page.evaluate
    r=ev("(() => { const b = window.__brasshaven; let n = 0; for (let v = 0; v < b.V; v++) n += b.buildable[v]; return { reach: b.reach(), n, V: b.V }; })()")
    check('a new harbour starts at its first size', r['reach']==0 and r['n']==1191, r)
    if codes:
        r=ev("""(async (c) => { const b = window.__brasshaven; const bad = [];
          let { c: cs, mt } = await b.decodeTown(c.full);
          for (let v = 0; v < c.V; v++) { const want = c.cells[v], got = cs[v] ? v * 64 + mt[v * 16] : -1; if (want !== got) bad.push(v); }
          for (let v = c.V; v < b.V; v++) if (cs[v]) bad.push(v);
          const s = await b.decodeTown(c.starter); b.openCode(s.c, s.mt, s.name);
          return { bad: bad.length, reach: b.reach(), starter: b.cellCount() }; })""", codes)
        check('town codes from the old grid open cell for cell', r['bad']==0, r)
    # grow band by band: build on a cell beside one that is not open yet
    steps=ev("""(() => { const b = window.__brasshaven, out = [];
      for (let k = 0; k < 6; k++) {
        let pick = -1, best = -1;
        for (let v = 0; v < b.V; v++) if (b.buildable[v] && !b.cols[v] && b.reachOf[v] > b.reach()) { const d = Math.hypot(b.X[v] - 3, b.Z[v] - 1); if (best < 0 || d < best) { best = d; pick = v; } }
        if (pick < 0) break;
        b.userCommit([[pick, 0, 3]], []);
        let n = 0; for (let v = 0; v < b.V; v++) n += b.buildable[v];
        out.push({ v: pick, reach: b.reach(), n, radius: +b.radius().toFixed(1), hint: b.hintText() });
      }
      return out; })()""")
    print('  growth', [(s['reach'], s['n'], s['radius']) for s in steps])
    check('the harbour grows a band at a time to its largest', [s['reach'] for s in steps]==[1,2,3,4] and steps[-1]['n']>3.3*1191, steps)
    check('growing says so', all('grows' in s['hint'] or 'big as it gets' in s['hint'] for s in steps), [s['hint'] for s in steps])
    r=ev("(() => { const b = window.__brasshaven; const p = b.planAction({ type: 'water', x: 60, z: 0 }, 'build'); return p && p.msg; })()")
    check('past the largest harbour the edge says so', r and 'ends here' in r, r)
    # a block on a vertex numbered past 4095 can be picked and built on
    r=ev("""(() => { const b = window.__brasshaven; let v = -1; for (let i = b.V - 1; i >= 4096; i--) if (b.buildable[i]) { v = i; break; }
      b.userCommit([[v, 0, 0], [v, 1, 0]], []);
      Object.assign(b.goal, { tx: b.X[v], tz: b.Z[v], ty: 1, dist: 6, pitch: 0.9 }); b.syncCam();
      const p = new b.camera.position.constructor(b.X[v], 1.45, b.Z[v]).project(b.camera), cv = b.renderer.domElement.getBoundingClientRect();
      const hit = b.pickAt(cv.left + (p.x + 1) / 2 * cv.width, cv.top + (1 - p.y) / 2 * cv.height);
      const plan = hit && hit.type === 'cell' ? b.planAction(hit, 'build') : null;
      return { v, hit: hit && hit.type, planV: plan && plan.v, planY: plan && plan.y }; })()""")
    check('cells numbered past 4095 pick correctly', r['v']>4095 and r['hit']=='cell' and r['planV']==r['v'] and r['planY']==2, r)
    page.screenshot(path=f'{ROOT}/test/m7-edge.png')
    # saved and reloaded at its largest; clearing the outer blocks shrinks it again
    ev("() => window.__brasshaven.saveNow()")
    page.reload(); page.wait_for_timeout(2500)
    r=ev("(() => window.__brasshaven.reach())()")
    check('a grown harbour reloads at its size', r==4, r)
    r=ev("""(() => { const b = window.__brasshaven, rm = []; for (let v = 0; v < b.V; v++) if (b.cols[v] && b.reachOf[v] > 0) for (let y = 0; y <= 12; y++) if (b.F(v, y)) rm.push([v, y]);
      b.commit([], rm); return { reach: b.reach(), r: +b.radius().toFixed(1) }; })()""")
    check('clearing the outer blocks shrinks the harbour', r['reach']==0, r)
    check('no page errors', not errs, errs)
    br.close()
print('ALL PASSED' if not fails else 'FAILED: '+', '.join(fails), len(fails))
sys.exit(1 if fails else 0)
