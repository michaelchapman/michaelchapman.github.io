import os
import json, os, base64
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(os.environ.get('BH', f'{ROOT}/brasshaven.html')).read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
def mk(p, w, h, mobile):
    ctx=p.new_context(viewport={'width':w,'height':h}, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    page=ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: errs.append('console '+m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    def route(r):
        u=r.request.url
        if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
        else: r.abort()
    page.route('**/*', route)
    page.goto('http://bh.test/index.html'); page.wait_for_timeout(2500)
    return ctx, page, errs
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx, page, errs = mk(b, 1100, 760, False)
    E = lambda js: page.evaluate(js)
    print('tips at start', E('window.__brasshaven.tips()'))
    # tips advance by doing: build on water near town, then storey, then material, iron
    r = E("""(() => { const b = window.__brasshaven; const cx = b.goal.tx, cz = b.goal.tz; let v = -1;
      for (let k = 0; k < 60 && v < 0; k++) { const c = b.nearestVertex(cx + 5 + (k % 6), cz + 3 - Math.floor(k / 6)); if (!b.cols[c] && b.buildable[c]) v = c; }
      return v; })()""")
    # use the real action path: plan from screen coords is fiddly; call act through a projected point
    proj = E(f"""(() => {{ const b = window.__brasshaven; const v = {r}; const p = new (b.camera.position.constructor)(b.X[v], 0, b.Z[v]); p.project(b.camera); const c = b.renderer.domElement; return [ (p.x + 1) / 2 * c.clientWidth, (1 - p.y) / 2 * c.clientHeight ]; }})()""")
    page.mouse.click(proj[0], proj[1]); page.wait_for_timeout(1800)
    print('after build', E('window.__brasshaven.tips()'), 'blocks', E('window.__brasshaven.cellCount()'))
    proj2 = E(f"""(() => {{ const b = window.__brasshaven; const v = {r}; const p = new (b.camera.position.constructor)(b.X[v], 0.42 + 0.98 + 0.3, b.Z[v]); p.project(b.camera); const c = b.renderer.domElement; return [ (p.x + 1) / 2 * c.clientWidth, (1 - p.y) / 2 * c.clientHeight ]; }})()""")
    page.mouse.click(proj2[0], proj2[1]); page.wait_for_timeout(1800)
    print('after storey', E('window.__brasshaven.tips()'), 'blocks', E('window.__brasshaven.cellCount()'))
    page.keyboard.press('4'); page.wait_for_timeout(300)
    print('beckon on iron coin?', E("document.querySelector('.coin.m3').classList.contains('beckon') || document.getElementById('palette').classList.contains('beckon')"))
    page.mouse.click(proj2[0], proj2[1] - 60); page.wait_for_timeout(1800)
    print('after iron', E('window.__brasshaven.tips()'))
    page.keyboard.press('k'); page.wait_for_timeout(1700)
    print('after key', E('window.__brasshaven.tips()'), 'beckon time', E("document.getElementById('time-btn').classList.contains('beckon')"))
    page.keyboard.press('t'); page.wait_for_timeout(1700)
    print('after time', E('window.__brasshaven.tips()'), 'hint', page.locator('#hint').text_content())
    # postcard
    page.locator('#pc-btn').click(); page.wait_for_timeout(600)
    print('pc mode', E("document.getElementById('app').classList.contains('pc')"), 'frame', E("document.getElementById('pc-frame').getBoundingClientRect().toJSON()"))
    page.screenshot(path=f'{ROOT}/test/m4-frame.png', timeout=120000)
    page.locator('#pc-snap').click(timeout=120000)
    page.wait_for_function("window.__brasshaven.pcBlob() && !document.getElementById('pc-sheet').hidden", timeout=60000)
    page.wait_for_timeout(600)
    print('blob', E("window.__brasshaven.pcBlob().size"), E("window.__brasshaven.pcBlob().type"), 'save visible', E("!document.getElementById('pc-save').hidden"), 'share', E("!document.getElementById('pc-share').hidden"), 'msg', E("document.getElementById('pc-msg').textContent"))
    page.screenshot(path=f'{ROOT}/test/m4-sheet.png', timeout=120000)
    # pull out the card image itself
    data = E("""new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(window.__brasshaven.pcBlob()); })""")
    open(f'{ROOT}/test/m4-card.jpg','wb').write(base64.b64decode(data.split(',')[1]))
    print('tips after snap', E('window.__brasshaven.tips()'))
    with page.expect_download() as dli:
        page.locator('#pc-save').click()
    print('download', dli.value.suggested_filename, 'msg', E("document.getElementById('pc-msg').textContent"))
    page.locator('#pc-done').click(); page.wait_for_timeout(400)
    print('pc exited', not E("document.getElementById('app').classList.contains('pc')"), 'hint after tour', page.locator('#hint').get_attribute('class'))
    # settings: name, codes with names, undo restores
    page.locator('#gear').click(); page.locator('#m-name').click(); page.fill('#name-in', "Michael's Wharf"); page.locator('#name-go').click(); page.wait_for_timeout(300)
    print('name', E('window.__brasshaven.harbourName()'), 'plate', page.locator('#harbour-no').text_content())
    code = E('window.__brasshaven.encodeTown()')
    print('code tail', code[-30:])
    dec = E(f"window.__brasshaven.decodeTown({json.dumps(code)}).then(r => r.name)")
    print('decoded name', dec)
    E('window.__brasshaven.undo()')
    print('after undo name', repr(E('window.__brasshaven.harbourName()')), page.locator('#harbour-no').text_content())
    # volume and motion
    if E("document.getElementById('menu').hidden"): page.locator('#gear').click()
    page.wait_for_timeout(200)
    page.locator('#m-vol').fill('35'); page.locator('#mo-calm').click()
    print('volume', E('window.__brasshaven.volume()'), 'calm', E('window.__brasshaven.motion()'), 'stored', E("[localStorage.getItem('brasshaven:volume'), localStorage.getItem('brasshaven:motion')]"))
    page.screenshot(path=f'{ROOT}/test/m4-menu.png', timeout=120000)
    # tiers
    E("window.__brasshaven.applyTier('lowest')")
    page.wait_for_timeout(1500)
    print('tier', E('window.__brasshaven.tier()'), 'ships', len(E('window.__brasshaven.ships()')))
    E("window.__brasshaven.applyTier('high')")
    page.wait_for_timeout(1500)
    print('tier back', E('window.__brasshaven.tier()'), 'ships', len(E('window.__brasshaven.ships()')))
    print('errors', errs)
    ctx.close(); b.close()
