# milestone 8: islands. Run with BH_CHROMIUM=/opt/pw-browsers/chromium python3 test/m8islands.py
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
SNAP="""(() => { const b = window.__brasshaven; let h = 0; for (let v = 0; v < b.V; v++) { h = (h * 31 + b.cols[v]) | 0; for (let y = 0; y < 16; y++) h = (h * 7 + b.mats[v * 16 + y]) | 0; }
  let n = 0; for (let v = 0; v < b.V; v++) n += b.land[v]; return { cells: b.cellCount(), hash: h, land: n, ...b.world() }; })()"""
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=br.new_context(viewport={'width':800,'height':600}).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(2500)
    ev=page.evaluate
    # a fresh archipelago leaves room between islands and a home island in the middle
    r=ev("""(() => { const b = window.__brasshaven, g = b.genIslands(7); let n = 0; for (let v = 0; v < b.V; v++) n += g[v];
      return { n, V: b.V, mid: g[b.nearestVertex(0, 0)] }; })()""")
    check('the generator makes islands with sea between them', r['mid']==1 and 0.15*r['V'] < r['n'] < 0.7*r['V'], r)
    # an old code opens as open ground
    ev("""(async (code) => { const b = window.__brasshaven; const t = await b.decodeTown(code); b.openCode(t.c, t.mt, t.name, t.world); })""", code)
    page.wait_for_timeout(300)
    open0=ev(SNAP)
    check('an old town code opens as open ground', open0['cells']>100 and not open0['islands'] and open0['land']==0, open0)
    # open to islands fits land to the build and keeps every block
    ev("() => window.__brasshaven.setWorld(true, false)"); page.wait_for_timeout(300)
    isl=ev(SNAP)
    check('switching to islands keeps every block', isl['islands'] and isl['cells']==open0['cells'] and isl['hash']==open0['hash'], isl)
    r=ev("""(() => { const b = window.__brasshaven; let bare = 0, piers = 0, piersOnLand = 0;
      for (let v = 0; v < b.V; v++) { if (!b.F(v, 0)) continue; const m = b.M(v, 0);
        if (m !== 5 && !b.land[v]) bare++;
        if (m === 5 && !b.ringW[v].some((w) => b.F(w, 0) && b.M(w, 0) !== 5)) { piers++; if (b.land[v]) piersOnLand++; } }
      return { bare, piers, piersOnLand }; })()""")
    check('every stone footing sits on land', r['bare']==0, r)
    r=ev("""(() => { const b = window.__brasshaven; let wood = 0, core = 0, land = 0, extra = 0;
      for (let v = 0; v < b.V; v++) { if (b.F(v, 0) && b.M(v, 0) === 5 && b.land[v]) wood++; if (b.F(v, 0) && b.M(v, 0) !== 5) core++;
        if (b.land[v] && !b.F(v, 0) && b.ringW[v].some((w) => b.F(w, 0) && b.M(w, 0) !== 5)) extra++; }
      return { wood, core, extra }; })()""")
    check('timber piers all stay over the water', r['wood']==0, r)
    check('the land hugs the town', r['extra'] < r['core'] * 0.6, r)
    page.screenshot(path=f'{ROOT}/test/m8-islands.png')
    # building rules: stone one cell from the shore, timber three along its own jetty
    r=ev("""(() => { const b = window.__brasshaven, near = [], far = [];
      for (let v = 0; v < b.V; v++) { if (b.land[v] || b.F(v, 0) || !b.buildable[v]) continue;
        const n1 = b.ringW[v].some((w) => b.land[w]);
        const n2 = b.ringW[v].some((w) => b.ringW[w].some((x) => b.land[x]));
        if (n1) near.push(v); else if (!n2 && !b.ringW[v].some((w) => b.F(w, 0))) far.push(v); }
      return { near: near.length, far: far.length, stoneNear: near.every((v) => b.canGround(v, 1)), stoneFar: far.some((v) => b.canGround(v, 1)), timberFar: far.some((v) => b.canGround(v, 5)) }; })()""")
    check('stone quays reach one cell from the shore', r['near']>0 and r['far']>0 and r['stoneNear'] and not r['stoneFar'] and not r['timberFar'], r)
    r=ev("""(() => { const b = window.__brasshaven;
      // a straight jetty out from the shore: walk away from land through open water
      for (let v = 0; v < b.V; v++) { if (b.land[v] || b.F(v, 0) || !b.ringW[v].some((w) => b.land[w])) continue;
        const chain = [v]; let cur = v;
        while (chain.length < 4) { const nx = b.ringW[cur].find((w) => !b.land[w] && !b.F(w, 0) && !chain.includes(w) && !b.ringW[w].some((x) => b.land[x]) && chain.every((c) => c === cur || !b.ringW[c].includes(w)));
          if (nx === undefined) break; chain.push(nx); cur = nx; }
        if (chain.length < 4) continue;
        const ok = [];
        for (let i = 0; i < 4; i++) { ok.push(b.canGround(chain[i], 5)); b.commit([[chain[i], 0, 5]], []); }
        const stone = b.canGround(chain[3], 1);
        for (let i = 0; i < 4; i++) b.undo();
        return { ok, stone }; }
      return null; })()""")
    check('timber jetties reach three cells out', r is not None and r['ok'][:3]==[True,True,True] and not r['stone'], r)
    # the land survives a code and a reload
    r=ev("""(async () => { const b = window.__brasshaven, before = Array.from(b.land).join('');
      const code = await b.encodeTown(); const t = await b.decodeTown(code);
      b.openCode(t.c, t.mt, t.name, t.world); return { same: Array.from(b.land).join('') === before, w: b.world(), pre: code.slice(0, 3) }; })()""")
    check('a town code carries the islands', r['same'] and r['w']['islands'], r)
    ev("() => window.__brasshaven.saveNow()")
    page.reload(); page.wait_for_timeout(2500)
    r=ev(SNAP)
    check('the islands survive a reload', r['islands'] and r['land']==isl['land'] and r['hash']==isl['hash'], r)
    # back to open water keeps the town; undo brings the islands back, redo takes them away
    ev("() => window.__brasshaven.setWorld(false)"); page.wait_for_timeout(400)
    r=ev(SNAP)
    check('open water keeps every block', not r['islands'] and r['land']==0 and r['hash']==isl['hash'], r)
    page.screenshot(path=f'{ROOT}/test/m8-open.png')
    r=ev("(() => window.__brasshaven.dyn().wheels.length)()")
    check('the mill wheels turn on open water', r>0, r)
    # the sky setting is retired: codes carry only the islands
    r=ev("""(async () => { const b = window.__brasshaven; const t = await b.decodeTown(await b.encodeTown());
      return { keys: Object.keys(t.world).sort().join(','), sky: 'sky' in b.world() }; })()""")
    check('there is no sky setting any more', r['keys']=='islands,land' and not r['sky'], r)
    ev("() => window.__brasshaven.undo()"); r=ev(SNAP)
    check('undo brings back the islands', r['islands'] and r['land']==isl['land'], r)
    ev("() => window.__brasshaven.redo()"); r=ev(SNAP)
    check('redo takes them away again', not r['islands'] and r['land']==0 and r['hash']==isl['hash'], r)
    # the Harbours sheet shows the settings
    page.click('#gear'); page.click('#m-slots'); page.wait_for_timeout(300)
    page.click('#w-isles'); page.wait_for_timeout(300)
    r=ev("(() => ({ w: window.__brasshaven.world(), open: document.getElementById('w-open').getAttribute('aria-pressed'), isles: document.getElementById('w-isles').getAttribute('aria-pressed'), sky: document.getElementById('w-sky') }))()")
    check('the Harbours sheet switches to islands', r['w']['islands'] and r['isles']=='true' and r['open']=='false' and r['sky'] is None, r)
    check('no page errors', not errs, errs)
    br.close()
print('ALL PASSED' if not fails else 'FAILED: '+', '.join(fails), len(fails))
sys.exit(1 if fails else 0)
