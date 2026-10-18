# milestone 9: boats. Run with BH_CHROMIUM=/opt/pw-browsers/chromium python3 test/m9boats.py
import os, sys, json
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
# helpers: which cell a point is in, and whether a boat's outline touches a block, a wheel or another boat
HELP = """const b = window.__brasshaven;
const inCell = (v, x, z) => { const Q = b.ringQ[v], k = Q.length; let ins = false;
  for (let a = 0, c = k - 1; a < k; c = a++) { const xa = b.CX[Q[a]], za = b.CZ[Q[a]], xc = b.CX[Q[c]], zc = b.CZ[Q[c]]; if (za > z !== zc > z && x < ((xc - xa) * (z - za)) / (zc - za) + xa) ins = !ins; }
  return ins; };
const cellAt = (x, z) => { const v = b.nearestVertex(x, z); if (v < 0) return -1; if (b.ringQ[v].length && inCell(v, x, z)) return v; for (const w of b.ringW[v]) if (b.ringQ[w].length && inCell(w, x, z)) return w; return v; };
const hullW = (u) => (u > 0 ? Math.sqrt(Math.max(0, 1 - Math.pow(u, 2.4))) : 1 - 0.38 * Math.pow(-u, 3));
const width = (K, x) => (K.box && Math.abs(x) < 0.36 ? 0.63 : K.hb * hullW(x / (K.L / 2)) + 0.012);
const outline = (o) => { const K = b.BOAT[o.kind], c = Math.cos(o.h), s = -Math.sin(o.h), pts = [];
  for (let i = 0; i <= 40; i++) { const x = -K.L / 2 + (K.L * i) / 40, w = width(K, x); for (const sd of [-1, 0, 1]) pts.push([o.x + c * x - s * w * sd, o.z + s * x + c * w * sd]); }
  return pts; };
const inside = (o, x, z) => { const K = b.BOAT[o.kind], c = Math.cos(o.h), s = -Math.sin(o.h), dx = x - o.x, dz = z - o.z, lx = dx * c + dz * s, lz = -dx * s + dz * c;
  return Math.abs(lx) < K.L / 2 && Math.abs(lz) < width(K, lx); };
function touches() {
  const bad = [], wheels = b.dyn().wheels, list = b.boats().filter((o) => o.state !== 'slip');
  for (const o of list) {
    const K = b.BOAT[o.kind];
    for (const [x, z] of outline(o)) {
      const v = cellAt(x, z);
      if (v >= 0 && b.headroom(v) < K.air + 0.05) { bad.push([o.kind, o.state, 'cell', v, +x.toFixed(2), +z.toFixed(2)]); break; }
      if (wheels.some((w) => Math.hypot(w.c[0] - x, w.c[2] - z) < 0.3)) { bad.push([o.kind, 'wheel']); break; }
      if (list.some((p) => p !== o && inside(p, x, z))) { bad.push([o.kind, 'boat']); break; }
    }
  }
  return bad;
}"""
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=br.new_context(viewport={'width':800,'height':600}).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(2500)
    ev=page.evaluate
    starter=ev("window.__brasshaven.encodeTown()")
    # an empty harbour has no boats
    r=ev("(() => { const b = window.__brasshaven; b.replaceTown(new Uint16Array(b.V), new Uint8Array(b.V * 16)); b.sim(30, 0.1); return b.boats().length; })()")
    check('an empty harbour has no boats', r==0, r)
    # scale: a launch's wheelhouse canopy stands above a person, and a person is smaller than the launch
    r=ev("(() => { const b = window.__brasshaven, L = b.BOAT.launch; return { L: L.L, person: 0.3 * b.person, ratio: L.L / (0.3 * b.person) }; })()")
    check('a launch is about three people long', 2.6 < r['ratio'] < 4, r)
    # a pool walled in by houses, whose one way out passes under a bridge
    POOL="""(async ([lvl, gap]) => { const b = window.__brasshaven, adds = [];
      b.replaceTown(new Uint16Array(b.V), new Uint8Array(b.V * 16));
      const ring = [], hole = [];
      // the wall: every cell just outside a round pool
      const pool = (v) => Math.hypot(b.X[v], b.Z[v]) < 2.9;
      for (let v = 0; v < b.V; v++) if (!pool(v) && b.ringW[v].length && b.ringW[v].some(pool)) ring.push(v);
      // two cells thick, so a bridge across the way out has towers on both sides
      for (const v of [...ring]) for (const w of b.ringW[v]) if (!pool(w) && b.ringW[w].length && !ring.includes(w)) ring.push(w);
      for (const v of ring) if (b.X[v] > 0 && Math.abs(b.Z[v]) < gap) hole.push(v);
      for (const v of ring) { if (hole.includes(v)) continue; for (let y = 0; y <= lvl; y++) adds.push([v, y, 0]); }
      for (const v of hole) adds.push([v, lvl, 0]);
      b.commit(adds, []); await new Promise((r) => setTimeout(r, 50));
      const probe = (kind) => ({ kind, K: b.BOAT[kind] });
      const go = (kind) => { const p = b.route(probe(kind), 0, 0, { x: 6.5, z: 0 }); if (!p) return null;
        // the route goes out through the gap in the wall
        for (let i = 1; i < p.length; i++) for (let k = 0; k <= 20; k++) { const x = p[i - 1][0] + ((p[i][0] - p[i - 1][0]) * k) / 20, z = p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * k) / 20; if (Math.hypot(x, z) > 3.4 && Math.hypot(x, z) < 4.2) return Math.abs(Math.atan2(z, x)) < 0.45; }
        return false; };
      return { hole: hole.length, head: Math.min(...hole.map((v) => b.headroom(v))), bridges: b.bridges(), launch: go('launch'), skiff: go('skiff'), steamer: go('steamer') }; })"""
    r=ev(POOL, [2, 1.0])
    check('a low bridge is a bridge', r['bridges']>0 and 1.0 < r['head'] < 1.2, r)
    check('a launch and a skiff pass under a bridge two storeys up', r['launch'] and r['skiff'], r)
    check('the steamer does not fit under it', not r['steamer'], r)
    r=ev(POOL, [1, 1.0])
    check('nothing passes under a block one storey up', r['head']==0 and not r['launch'] and not r['skiff'], r)
    r=ev(POOL, [2, 1.3])
    check('a wide bridge two storeys up still stops the steamer, not the launch', r['launch'] and not r['steamer'], r)
    r=ev(POOL, [3, 1.3])
    check('the steamer passes under a high, wide bridge', r['bridges']>0 and r['head'] > 1.9 and r['steamer'], r)
    # a shipyard: an iron house on the quay, a timber slipway of three cells straight out into the water
    r=ev("""(async () => { const b = window.__brasshaven; b.replaceTown(new Uint16Array(b.V), new Uint8Array(b.V * 16));
      const s0 = b.nearestVertex(0, 0), adds = [[s0, 0, 0], [s0, 1, 3]];
      for (const w of b.ringW[s0]) if (b.X[w] < b.X[s0] - 0.3) adds.push([w, 0, 0], [w, 1, 0]);
      let prev = s0, cur = b.ringW[s0].reduce((a, w) => (b.X[w] > b.X[a] ? w : a));
      const slip = [];
      for (let k = 0; k < 3; k++) { slip.push(cur); adds.push([cur, 0, 5]); const dx = b.X[cur] - b.X[prev], dz = b.Z[cur] - b.Z[prev]; const nx = b.ringW[cur].filter((w) => w !== prev).reduce((a, w) => ((b.X[w] - b.X[cur]) * dx + (b.Z[w] - b.Z[cur]) * dz > (b.X[a] - b.X[cur]) * dx + (b.Z[a] - b.Z[cur]) * dz ? w : a)); prev = cur; cur = nx; }
      for (let k = 0; k < 40; k++) { const v = b.nearestVertex(-3 - (k % 8) * 0.9, -3 + Math.floor(k / 8) * 1.2); adds.push([v, 0, 1], [v, 1, 1]); }
      b.commit(adds, []); await new Promise((r) => setTimeout(r, 50));
      const yard = b.landmarks().find((l) => l.id === 'shipyard');
      let fromSlip = false;
      for (let i = 0; i < 1500 && !fromSlip; i++) { b.sim(0.1, 0.1); fromSlip = b.boats().some((o) => o.state === 'slip'); }
      return { yard: !!yard, slip: slip.map((v) => b.lmAt(v) && b.lmAt(v).role), fromSlip, found: b.found().includes('shipyard') }; })()""")
    check('a slipway from an iron house is a shipyard', r['yard'] and r['slip']==['slip']*3, r)
    check('new launches come down the slip', r['fromSlip'], r)
    # Michael's harbour: a long run with every hull checked against every block, wheel and boat at every step
    r=ev("""(async (code) => { const b = window.__brasshaven; const t = await b.decodeTown(code); b.openCode(t.c, t.mt, t.name, t.world); await new Promise((r) => setTimeout(r, 50));
      const br = b.berths(); return { cells: b.cellCount(), launch: br.launch.length, skiff: br.skiff.length, steamer: br.steamer.length }; })""", code)
    check('the harbour has berths for launches', r['launch']>3, r)
    print('berths', r)
    RUN=HELP+"""
    ((steps) => { const kinds = new Set(), states = new Set(); let bad = [], most = 0, moored = 0, t0 = performance.now();
      for (let i = 0; i < steps && bad.length < 3; i++) { b.sim(0.1, 0.1); for (const o of b.boats()) { kinds.add(o.kind); states.add(o.state); if (o.state === 'moored') moored++; } most = Math.max(most, b.boats().length); bad = bad.concat(touches()); }
      return { bad: bad.slice(0, 3), kinds: [...kinds], states: [...states], most, moored, ms: Math.round(performance.now() - t0) }; })"""
    r=ev(RUN+"(3000)")
    print('run', r)
    check('no boat touches a block, a mill wheel or another boat', not r['bad'], r['bad'])
    check('launches and the steamer come to the harbour', 'launch' in r['kinds'] and 'steamer' in r['kinds'], r)
    check('boats tie up and leave again', r['moored']>0 and 'off' in r['states'], r)
    # more towns: the starter harbour, and a dense made-up one with houses on most cells and arches over some streets
    OPEN="""(async (code) => { const b = window.__brasshaven; const t = await b.decodeTown(code); b.openCode(t.c, t.mt, t.name, t.world); await new Promise((r) => setTimeout(r, 50)); return b.cellCount(); })"""
    ev(OPEN, starter)
    r=ev(RUN+"(1500)")
    print('starter run', r)
    check('no boat touches anything in the starter harbour', not r['bad'], r['bad'])
    r=ev("""(async () => { const b = window.__brasshaven; b.replaceTown(new Uint16Array(b.V), new Uint8Array(b.V * 16));
      const h = (a, c) => { const x = Math.sin(a * 127.1 + c * 311.7) * 43758.5453; return x - Math.floor(x); };
      for (let k = 0; k < 6; k++) { const adds = []; for (let v = 0; v < b.V; v++) if (b.buildable[v] && !b.cols[v] && b.edgeBand[v] <= 1 && h(v, 1) > 0.3) adds.push([v, 0, h(v, 5) < 0.15 ? 5 : 0]); if (!adds.length) break; b.commit(adds, []); }
      const adds = [];
      for (let v = 0; v < b.V; v++) { if (!b.F(v, 0) || b.M(v, 0) === 5 || h(v, 2) < 0.25) continue; const n = 1 + Math.floor(h(v, 3) * 3); for (let y = 1; y <= n; y++) adds.push([v, y, h(v, 7) < 0.15 ? 3 : 0]); }
      // arches: a house two storeys up over open water next to the quay
      for (let v = 0; v < b.V; v++) if (!b.cols[v] && b.ringW[v].length && h(v, 9) < 0.08 && b.ringW[v].filter((w) => b.F(w, 0)).length >= 2) adds.push([v, 2, 0]);
      b.commit(adds, []); await new Promise((r) => setTimeout(r, 50)); return { cells: b.cellCount(), bridges: b.bridges() }; })()""")
    print('made-up town', r)
    r=ev(RUN+"(1500)")
    print('made-up run', r)
    check('no boat touches anything in a dense made-up harbour', not r['bad'], r['bad'])
    check('no page errors', not errs, errs)
    br.close()
print('ALL PASSED' if not fails else 'FAILED: '+', '.join(fails), len(fails))
sys.exit(1 if fails else 0)
