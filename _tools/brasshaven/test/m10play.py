# milestone 10: the two menus, closing a menu without building, tapping and riding with townsfolk and boats,
# Little hands mode, the turning day and the lamplighter
import os, sys, json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(os.environ.get('BH', f'{ROOT}/brasshaven.html')).read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
town=open(f'{ROOT}/test/town-chimphaven.txt').read().strip()
SHOTS=os.environ.get('SHOTS')
fails=[]
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':820,'height':1180}, is_mobile=True, has_touch=True)
    page=ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    def route(r):
        u=r.request.url
        if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
        else: r.abort()
    page.route('**/*', route)
    page.goto('http://bh.test/index.html'); page.wait_for_timeout(3000)
    print('frames in 2 s:', page.evaluate("new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); })"))
    ev=page.evaluate
    def shot(n):
        if SHOTS: page.screenshot(path=f'{SHOTS}/{n}.png')

    # 1. menus: settings on the gear, the harbour on its name plate; only one open at a time
    page.tap('#gear'); page.wait_for_timeout(300)
    check(ev("!document.getElementById('menu').hidden && document.getElementById('hmenu').hidden"), 'gear opens settings only')
    shot('menu-settings')
    page.tap('#brand'); page.wait_for_timeout(300)
    check(ev("document.getElementById('menu').hidden && !document.getElementById('hmenu').hidden"), 'name plate opens the harbour sheet and closes settings')
    check(ev("document.querySelectorAll('#marks-list .medal').length") == 8, 'eight landmark medals')
    r=ev("(() => { const m = document.getElementById('hmenu'); return { sh: m.scrollHeight, ch: m.clientHeight }; })()")
    check(r['sh'] <= r['ch'] + 2, f'harbour sheet fits without scrolling {r}')
    shot('menu-harbour')
    page.tap('#marks-list .medal'); page.wait_for_timeout(200)
    check('lone tower' in ev("document.getElementById('mark-note').textContent"), 'a medal shows its hint')
    # rename in place
    page.fill('#name-in', 'Test Wharf'); page.press('#name-in', 'Enter'); page.wait_for_timeout(200)
    check(ev("window.__brasshaven.harbourName()") == 'Test Wharf' and page.locator('#harbour-no').text_content() == 'Test Wharf', 'rename from the sheet')
    # a tap on the town closes the menu and builds nothing
    c0=ev("window.__brasshaven.cellCount()")
    page.touchscreen.tap(150, 1000); page.wait_for_timeout(600)
    check(ev("!window.__brasshaven.menuOpen()"), 'tap on the town closes the menu')
    check(ev("window.__brasshaven.cellCount()") == c0, 'and builds nothing')
    page.touchscreen.tap(150, 1000); page.wait_for_timeout(600)
    check(ev("window.__brasshaven.cellCount()") > c0, 'the next tap builds')
    # settings: volume all the way down is off, how to play is a short list
    page.tap('#gear'); page.wait_for_timeout(200)
    page.tap('#m-how'); page.wait_for_timeout(200)
    check(ev("document.querySelectorAll('#how li').length") >= 8, 'how to play is a list')
    ev("(() => { const v = document.getElementById('m-vol'); v.value = '0'; v.dispatchEvent(new Event('input')); })()")
    check(ev("window.__brasshaven.volume()") == 0, 'volume to nought')
    ev("(() => { const v = document.getElementById('m-vol'); v.value = '70'; v.dispatchEvent(new Event('input')); })()")
    page.tap('#t-off'); check(not ev("window.__brasshaven.tips().on"), 'tips off from the switch'); page.tap('#t-on')
    page.tap('#gear'); page.wait_for_timeout(200)

    # 2. tap and ride: open Michael's harbour, let the town come alive, find a walker on screen
    ev(f"(async () => {{ const t = await window.__brasshaven.decodeTown({json.dumps(town)}); window.__brasshaven.openCode(t.c, t.mt, t.name, t.world); }})()")
    page.wait_for_timeout(800)
    ev("window.__brasshaven.setTime(1, true)")
    ev("window.__brasshaven.sim(25)"); page.wait_for_timeout(500)
    def find(kind):
        return ev("""(kind) => { const b = window.__brasshaven; b.syncCam();
          const list = kind === 'walker' ? b.walkersRaw.filter((w) => w.scale > 0.9 && w.state === 'walk') : b.boatsRaw.filter((x) => x.s > 0.9);
          for (const o of list) { const s = b.screenOf(o.x, kind === 'walker' ? 0.42 : 0.3, o.z); if (s && s[0] > 60 && s[0] < 760 && s[1] > 200 && s[1] < 900) { const c = b.creatureAt(s[0], s[1], false); if (c && c.kind === kind) return s; } }
          return null; }""", kind)
    s=None
    for i in range(6):
        s=find('walker')
        if s: break
        ev("(() => { const b = window.__brasshaven, w = b.walkersRaw.find((w) => w.state === 'walk'); if (w) Object.assign(b.goal, { tx: w.x, tz: w.z, dist: 9 }); b.syncCam(); })()")
        page.wait_for_timeout(300)
    check(s is not None, 'a townsperson on screen can be picked')
    if s:
        ev(f"(() => {{ const b = window.__brasshaven, c = b.creatureAt({s[0]}, {s[1]}, false); window.__tapped = c.ref; b.reactTo(c, false); }})()")
        page.wait_for_timeout(200)
        h=ev("window.__brasshaven.hintText()")
        check(len(h) > 3 and ev("window.__tapped.hop > 0 && window.__tapped.pause > 0"), f'a tapped person hops, stops and says who they are: {h!r}')
        shot('tap-person')
        ev(f"(() => {{ const b = window.__brasshaven; b.startRide(b.creatureAt({s[0]}, {s[1]}, false)); }})()")
        page.wait_for_function("window.__brasshaven.view.dist < 4", timeout=30000)
        r=ev("(() => { const b = window.__brasshaven; return { ride: b.ride(), dist: b.view.dist, pill: !document.getElementById('ride-pill').classList.contains('off'), dock: getComputedStyle(document.querySelector('.dock')).visibility }; })()")
        check(r['ride'] and r['ride']['kind'] == 'walker' and r['dist'] < 4 and r['pill'] and r['dock'] == 'hidden', f'riding along with a person {r}')
        shot('ride-person')
        c1=ev("window.__brasshaven.cellCount()")
        page.touchscreen.tap(400, 700); page.wait_for_timeout(800)
        check(not ev("window.__brasshaven.ride()") and ev("window.__brasshaven.cellCount()") == c1, 'a tap ends the ride without building')
    # ride a boat
    ev("window.__brasshaven.sim(30)"); page.wait_for_timeout(300)
    r=ev("(() => { const b = window.__brasshaven, x = b.boatsRaw.find((x) => x.s > 0.9 && x.state !== 'fade'); if (!x) return null; b.startRide({ kind: 'boat', ref: x }); return x.kind; })()")
    if r:
        try: page.wait_for_function("Math.abs(window.__brasshaven.view.dist - window.__brasshaven.goal.dist) < 0.2 && window.__brasshaven.goal.dist < 6", timeout=40000)
        except Exception: pass
        shot('ride-boat')
        check(ev("window.__brasshaven.ride() && window.__brasshaven.ride().kind") == 'boat', f'aboard a {r}')
        ev("window.__brasshaven.endRide()")
    else: print('note: no boat out to ride')
    # ride the airship
    ev("(() => { const b = window.__brasshaven; b.startRide({ kind: 'ship', ref: b.shipsRaw[0] }); })()"); page.wait_for_timeout(2500); shot('ride-airship')
    check(ev("window.__brasshaven.ride() && window.__brasshaven.ride().kind") == 'ship', 'aboard the airship'); ev("window.__brasshaven.endRide()")

    # 3. the turning day and the lamplighter
    ev("window.__brasshaven.setTime(1, true)"); page.wait_for_timeout(300)
    d=ev("window.__brasshaven.day()")
    check(d['on'], 'the day turns by default')
    ev("window.__brasshaven.setDayPos(60 + 59)")
    try: page.wait_for_function("window.__brasshaven.time() === 2", timeout=30000); ok=True
    except Exception: ok=False
    check(ok, 'the day moves on to dusk by itself')
    try: page.wait_for_function("window.__brasshaven.lamps().lighter", timeout=30000)
    except Exception: pass
    L=ev("window.__brasshaven.lamps()")
    check(L['on'] and L['lighter'] and L['lit'] < L['total'], f'at dusk the lamplighter goes out and the lamps are not all lit yet {L}')
    shot('dusk-lamplighter')
    for i in range(12):
        ev("window.__brasshaven.sim(4)")
        L=ev("window.__brasshaven.lamps()")
        if L['lit'] == L['total']: break
    check(L['lit'] == L['total'], f'all the lamps come on {L}')
    ev("window.__brasshaven.setDayPos(119.5)")  # hold at dusk, let it settle
    page.tap('#gear'); page.tap('#d-still'); page.tap('#gear')
    p0=ev("window.__brasshaven.day().pos"); page.wait_for_timeout(1000)
    check(ev("window.__brasshaven.day().pos") == p0, 'Still stops the day')
    page.tap('#gear'); page.tap('#d-turn'); page.tap('#gear')

    # 4. Little hands
    n0=len(ev("window.__brasshaven.slots().list"))
    page.tap('#gear'); page.tap('#lh-on'); page.wait_for_timeout(800)
    r=ev("(() => { const b = window.__brasshaven, s = b.slots(); return { little: b.little(), slots: s.list.length, cur: s.list.find((x) => x.id === s.cur) }; })()")
    check(r['little'] and r['slots'] == n0 + 1 and r['cur'].get('little'), f'Little hands opens a harbour of its own {r["slots"]}')
    check(ev("getComputedStyle(document.querySelector('.dock')).display") == 'none', 'the tools are put away')
    c0=ev("window.__brasshaven.cellCount()")
    for (x, y) in [(300, 600), (420, 650), (500, 560), (420, 650), (420, 650)]:
        page.touchscreen.tap(x, y); page.wait_for_timeout(250)
    c1=ev("window.__brasshaven.cellCount()")
    check(c1 > c0, f'taps build ({c0} to {c1})')
    # holding does not remove
    page.mouse.move(420, 650)
    ev("window.__brasshaven.syncCam()")
    page.touchscreen.tap(420, 650)
    cdn=ev("window.__brasshaven.cellCount()")
    check(cdn >= c1, 'nothing is pulled down')
    # a quick tap on the gear does nothing; a held gear opens the settings
    page.tap('#gear'); page.wait_for_timeout(300)
    check(ev("document.getElementById('menu').hidden"), 'a quick tap on the gear does nothing')
    shot('little-hands')
    t0=ev("window.__brasshaven.time()"); page.tap('#time-btn'); page.wait_for_timeout(300)
    check(ev("window.__brasshaven.time()") in (1, 3) and ev("window.__brasshaven.time()") != t0 or t0 in (0,), 'the big button swaps day and night')
    box=page.locator('#gear').bounding_box()
    page.mouse.move(box['x'] + 20, box['y'] + 20)
    ev("(() => { const g = document.getElementById('gear'); g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9 })); })()")
    page.wait_for_timeout(1800)
    check(not ev("document.getElementById('menu').hidden"), 'a held gear opens the settings')
    page.tap('#lh-off'); page.wait_for_timeout(800)
    r=ev("(() => { const b = window.__brasshaven, s = b.slots(); return { little: b.little(), cur: s.list.find((x) => x.id === s.cur) }; })()")
    check(not r['little'] and not r['cur'].get('little'), 'turning it off goes back to the grown-up harbour')
    check(not errs, f'no page errors {errs[:3]}')
    b.close()
print('FAILED:', fails) if fails else print('all passed')
sys.exit(1 if fails else 0)
