import os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=br.new_context(viewport={'width':800,'height':600}).new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(1500)
    page.evaluate("""() => { localStorage.clear(); const b = window.__brasshaven; const v = b.nearestVertex(3,3);
      localStorage.setItem('brasshaven:town', JSON.stringify({seed:1887, c:[v, 7]})); }""")
    page.reload(); page.wait_for_timeout(2500)
    print('M1 save loads:', page.evaluate("(() => { const b = window.__brasshaven; return {blocks: b.cellCount(), mat: b.M(b.nearestVertex(3,3), 2)}; })()"))
    page.evaluate("() => window.__brasshaven.commit([[window.__brasshaven.nearestVertex(-3,-3), 0, 1]], [])"); page.wait_for_timeout(800)
    page.reload(); page.wait_for_timeout(2500)
    print('M2 save persists:', page.evaluate("(() => { const b = window.__brasshaven; return {blocks: b.cellCount(), brassGround: b.M(b.nearestVertex(-3,-3), 0)}; })()"))
    print('errors', errs); br.close()
