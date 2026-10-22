# milestone 7: save slots. Run with BH_CHROMIUM=/opt/pw-browsers/chromium python3 test/m7slots.py
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
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=br.new_context(viewport={'width':800,'height':600}).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(1500)
    ev=page.evaluate
    # a harbour saved before slots existed: town2 plus a name, and no slot list
    ev("""() => { const b = window.__brasshaven; b.commit([[b.nearestVertex(-4, 5), 0, 3]], []); b.saveNow();
      const t = localStorage.getItem('brasshaven:town:1'); localStorage.clear();
      localStorage.setItem('brasshaven:town2', t); localStorage.setItem('brasshaven:name', JSON.stringify('Old Haven')); }""")
    page.reload(); page.wait_for_timeout(2500)
    r=ev("(() => { const b = window.__brasshaven, s = b.slots(); return { n: s.list.length, cur: s.cur, name: b.harbourName(), iron: b.M(b.nearestVertex(-4, 5), 0), has: b.F(b.nearestVertex(-4, 5), 0) }; })()")
    check('the old harbour becomes slot 1', r['n']==1 and r['cur']==1 and r['name']=='Old Haven' and r['has'] and r['iron']==3, r)
    old=ev("(() => { const b = window.__brasshaven; return b.cellCount(); })()")
    # a new harbour starts from the starter town, with fresh undo
    r=ev("""(() => { const b = window.__brasshaven; b.newSlot(null, ''); const s = b.slots();
      return { n: s.list.length, cur: s.cur, cells: b.cellCount(), name: b.harbourName(), undo: document.getElementById('undo').disabled }; })()""")
    check('a new harbour opens with the starter town', r['n']==2 and r['cur']==2 and r['cells']>10 and r['name']=='' and r['undo'], r)
    ev("() => { const b = window.__brasshaven; b.commit([[b.nearestVertex(6, -6), 0, 1]], []); b.saveNow(); }")
    r=ev("(() => { const b = window.__brasshaven; b.openSlot(1); return { cells: b.cellCount(), name: b.harbourName(), other: b.F(b.nearestVertex(6, -6), 0) }; })()")
    check('switching back restores the first harbour', r['cells']==old and r['name']=='Old Haven' and not r['other'], {**r, 'old': old})
    page.reload(); page.wait_for_timeout(2500)
    r=ev("(() => { const b = window.__brasshaven; const a = { cur: b.slots().cur, name: b.harbourName() }; b.openSlot(2); a.other = b.F(b.nearestVertex(6, -6), 0); return a; })()")
    check('the open harbour and both towns survive a reload', r['cur']==1 and r['name']=='Old Haven' and r['other'], r)
    # the menu lists the harbours with thumbnails; Copy makes a third
    page.click('#brand'); page.click('#m-slots'); page.wait_for_timeout(300)
    r=ev("(() => ({ rows: document.querySelectorAll('#slots-list li').length, thumbs: [...document.querySelectorAll('#slots-list img')].filter((i) => i.src.startsWith('data:image/jpeg')).length, val: document.getElementById('m-slots-val').textContent }))()")
    check('the Harbours list shows both with thumbnails', r['rows']==2 and r['thumbs']==2 and r['val']=='2 of 8', r)
    page.click('#slots-list li.cur button:text("Copy")'); page.wait_for_timeout(300)
    r=ev("(() => { const b = window.__brasshaven, s = b.slots(); return { n: s.list.length, cur: s.cur, name: b.harbourName(), other: b.F(b.nearestVertex(6, -6), 0) }; })()")
    check('Copy makes a new harbour from this one', r['n']==3 and r['cur']==3 and r['other'] and r['name'].endswith('(copy)'), r)
    page.screenshot(path=f'{ROOT}/test/m7-slots.png')
    # fill all eight; New is disabled and a town code replaces the open harbour
    ev("() => { const b = window.__brasshaven; while (b.slots().list.length < 8) b.newSlot(null, ''); }")
    ev("() => window.__brasshaven.closeMenu()")
    page.click('#brand'); page.click('#m-slots'); page.wait_for_timeout(200)
    r=ev("(() => ({ dis: document.getElementById('slot-new').disabled, msg: document.getElementById('slots-msg').textContent }))()")
    check('New is turned off with eight harbours', r['dis'] and 'eight' in r['msg'], r)
    r=ev("""(async () => { const b = window.__brasshaven; b.openSlot(2); const code = await b.encodeTown(); b.openSlot(1);
      const { c, mt, name } = await b.decodeTown(code); b.openCode(c, mt, name);
      return { n: b.slots().list.length, cur: b.slots().cur, other: b.F(b.nearestVertex(6, -6), 0) }; })()""")
    check('a town code replaces the open harbour when all are in use', r['n']==8 and r['cur']==1 and r['other'], r)
    ev("() => window.__brasshaven.undo()")
    r=ev("(() => { const b = window.__brasshaven; return { name: b.harbourName(), other: b.F(b.nearestVertex(6, -6), 0) }; })()")
    check('undo brings the replaced harbour back', r['name']=='Old Haven' and not r['other'], r)
    # deleting the open harbour moves to a neighbour
    ev("() => window.__brasshaven.closeMenu()")
    page.click('#brand'); page.click('#m-slots'); page.wait_for_timeout(200)
    page.click('#slots-list li.cur button:text("Delete")'); page.click('#slot-del-yes'); page.wait_for_timeout(300)
    r=ev("(() => { const b = window.__brasshaven, s = b.slots(); return { n: s.list.length, cur: s.cur, ids: s.list.map((x) => x.id), gone: localStorage.getItem('brasshaven:town:1') }; })()")
    check('Delete removes the harbour and opens another', r['n']==7 and 1 not in r['ids'] and r['cur'] in r['ids'] and r['gone'] is None, r)
    # with a free slot, a code opens in a harbour of its own
    r=ev("""(async () => { const b = window.__brasshaven; b.openSlot(2); const code = await b.encodeTown(); const { c, mt, name } = await b.decodeTown(code); b.openCode(c, mt, name);
      return { n: b.slots().list.length, cur: b.slots().cur, other: b.F(b.nearestVertex(6, -6), 0) }; })()""")
    check('a town code opens in a new harbour when there is room', r['n']==8 and r['cur'] not in (2,) and r['other'], r)
    check('no page errors', not errs, errs)
    br.close()
print('ALL PASSED' if not fails else 'FAILED: '+', '.join(fails), len(fails))
sys.exit(1 if fails else 0)
