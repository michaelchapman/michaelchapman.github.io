import os
import sys, time, json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import os
html=open(os.environ.get('BH', f'{ROOT}/brasshaven.html')).read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
# usage: run2.py w h setupjs-file [shot:argsjson ...]
w=int(sys.argv[1]); h=int(sys.argv[2]); setup=sys.argv[3]
shots=sys.argv[4:]
mobile = w < 700
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('BH_CHROMIUM') or None, args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    page=ctx.new_page()
    logs=[]
    page.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    page.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    def route(r):
        u=r.request.url
        if 'three.module' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif u.startswith('http://bh.test/'): r.fulfill(status=200, content_type='text/html', body=page_html)
        else: r.abort()
    page.route('**/*', route)
    page.goto('http://bh.test/index.html')
    page.wait_for_timeout(2500)
    if setup != '-':
        res = page.evaluate(open(f'{ROOT}/test/{setup}').read())
        print('setup:', json.dumps(res)[:int(os.environ.get('SETUPLEN','600'))])
        page.wait_for_timeout(800)
    look=open(f'{ROOT}/test/look.js').read()
    for sh in shots:
        name, args = sh.split(':', 1)
        if args.startswith('JS'):
            res = page.evaluate(args[2:])
        elif args.startswith('FILE'):
            res = page.evaluate(open(f'{ROOT}/test/' + args[4:]).read())
        else:
            res = page.evaluate(f'({look})({args})')
        print(name, json.dumps(res)[:700])
        page.wait_for_timeout(900)
        page.screenshot(path=f'{ROOT}/test/{name}.png')
    for l in logs[:30]: print(l)
    b.close()
