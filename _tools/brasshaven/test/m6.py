# milestone 6: every landmark appears, is announced once, and goes away again; townsfolk scale; flush time
import os, sys, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.environ.get('BH', f'{ROOT}/brasshaven.html')).read()
page_html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>'
three = open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
ALL = ['lighthouse', 'observatory', 'cathedral', 'gate', 'ironworks', 'gasworks', 'market']
fails = []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1).new_page()
    logs = []
    page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    def route(r):
        u = r.request.url
        if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
        else: r.abort()
    page.route('**/*', route)
    page.goto('http://bh.test/index.html')
    page.wait_for_timeout(2500)
    ev = page.evaluate
    check(ev('window.__brasshaven.found().length') == 0, 'nothing found in the starter town')
    res = ev(open(f'{ROOT}/test/m6build.js').read())
    print(json.dumps(res))
    for i, lid in enumerate(ALL):
        check(lid in res[lid], f'{lid} appears ({res[lid]})')
    check(sorted(res['found']) == sorted(ALL), 'all seven recorded as found')
    check(res['plate'] is not False, f'name-plate showing ({res["plate"]})')
    check(max(res['times'].values()) < 120, f'commit times {res["times"]}')
    marks = ev('window.__brasshaven.marks().map((m) => m.type)')
    check(all(t in marks for t in ['beam', 'dome', 'gas', 'gate', 'furnace']), f'moving parts {sorted(set(marks))}')
    # night: beam on, dome open, portcullis down, gas low, sparks flying
    ev('window.__brasshaven.setTime(3, true)'); ev('window.__brasshaven.sim(6)')
    m = ev('window.__brasshaven.marks()')
    d = {x['type']: x for x in m}
    check(d['dome']['k'] > 0.9, f'dome open at night ({d["dome"]["k"]:.2f})')
    check(d['gate']['k'] > 0.9 and len(ev('window.__brasshaven.gateShut()')) == 1, 'portcullis down at night')
    check(ev('window.__brasshaven.sparks()') > 5, f'furnace sparks ({ev("window.__brasshaven.sparks()")})')
    ev('window.__brasshaven.setTime(1, true)'); ev('window.__brasshaven.sim(6)')
    d = {x['type']: x for x in ev('window.__brasshaven.marks()')}
    check(d['dome']['k'] < 0.1 and d['gate']['k'] < 0.1, 'dome shut and portcullis up by day')
    # the landmark list in the menu
    ev("document.getElementById('gear').click()"); ev("document.getElementById('m-marks').click()")
    page.wait_for_timeout(300)
    txt = ev("document.getElementById('m-marks-val').textContent")
    check(txt == '7 of 8', f'menu count {txt}')  # the shipyard is not built here; m9boats covers it
    check(ev("document.querySelectorAll('#marks-list button').length") == 7, 'a Show button for each')
    page.screenshot(path=f'{ROOT}/test/m6-menu.png')
    ev("document.getElementById('gear').click()")
    # found survives a reload; undoing a landmark takes it away but keeps it found
    s = res['sites']
    ev(f"window.__brasshaven.commit([], [[{s['lighthouse']}, 5]])")
    check('lighthouse' not in [l['id'] for l in ev('window.__brasshaven.landmarks()')], 'lighthouse goes when its top storey is removed')
    ev(f"window.__brasshaven.commit([[{s['market']}, 1, 0]], [])")
    check('market' not in [l['id'] for l in ev('window.__brasshaven.landmarks()')], 'market goes when a house fills its square')
    ev(f"window.__brasshaven.commit([], [[{s['observatory']}, 6]])")
    ids = [l['id'] for l in ev('window.__brasshaven.landmarks()')]
    check('observatory' not in ids and 'lighthouse' in ids, 'observatory without its brass top becomes a lighthouse')
    ev(f"window.__brasshaven.commit([], [[{s['observatory']}, 5]])")
    ev(f"window.__brasshaven.commit([[{s['gasworks']}, 1, 2]], [])")
    check('gasworks' not in [l['id'] for l in ev('window.__brasshaven.landmarks()')], 'gasworks goes when its square is built on')
    left = [l['id'] for l in ev('window.__brasshaven.landmarks()')]
    check(sorted(left) == sorted(['cathedral', 'gate', 'ironworks']), f'others stay ({left})')
    check(len(ev('window.__brasshaven.found()')) == 7, 'still all found')
    # townsfolk the height of a doorway
    check(abs(ev('window.__brasshaven.person') - 1.65) < 1e-6, 'townsfolk scaled to the doors')
    for l in logs[:20]: print(l)
    check(not any('PAGEERROR' in l for l in logs), 'no page errors')
    b.close()
print('FAILED' if fails else 'ALL PASSED', len(fails))
sys.exit(1 if fails else 0)
