import os
import json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(f'{ROOT}/brasshaven.html').read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>'
three=open(f'{ROOT}/node_modules/three/build/three.module.min.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    page=ctx.new_page(); logs=[]
    page.on('pageerror', lambda e: logs.append(str(e)))
    page.route('**/*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=three) if 'three.module' in r.request.url else (r.fulfill(status=200, content_type='text/html', body=page_html) if r.request.url.startswith('http://bh.test/') else r.abort()))
    page.goto('http://bh.test/'); page.wait_for_timeout(2500)
    pt = page.evaluate("""() => { const b=window.__brasshaven; const V3=b.camera.position.constructor;
      const scr=(x,y,z)=>{const p=new V3(x,y,z).project(b.camera); return [(p.x+1)/2*innerWidth,(1-p.y)/2*innerHeight];};
      for (let v=0; v<b.V; v++){ if(!b.buildable[v]||b.cols[v]) continue; const d=Math.hypot(b.X[v]-b.goal.tx,b.Z[v]-b.goal.tz); if(d<3||d>4) continue;
        const [x,y]=scr(b.X[v],0,b.Z[v]); if (y>650||y<120) continue; const h=b.pickAt(x,y); if(h&&h.type==='water'&&b.nearestVertex(h.x,h.z)===v) return {v,x,y,before:b.cellCount()}; } return null; }""")
    print('target', pt)
    page.touchscreen.tap(pt['x'], pt['y']); page.wait_for_timeout(600)
    after = page.evaluate("() => ({blocks: window.__brasshaven.cellCount(), hintGone: document.getElementById('hint').classList.contains('gone'), undo: !document.getElementById('undo').disabled})")
    print('after tap', after)
    # tap Remove tool then tap the new house roof
    page.touchscreen.tap(*page.evaluate("() => { const r=document.getElementById('tool-remove').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; }"))
    page.wait_for_timeout(200)
    xy = page.evaluate(f"() => {{ const b=window.__brasshaven; const V3=b.camera.position.constructor; const p=new V3(b.X[{pt['v']}], 0.42+0.98+0.2, b.Z[{pt['v']}]).project(b.camera); return [(p.x+1)/2*innerWidth,(1-p.y)/2*innerHeight]; }}")
    page.touchscreen.tap(*xy); page.wait_for_timeout(600)
    print('after remove', page.evaluate("() => ({blocks: window.__brasshaven.cellCount(), tool: document.getElementById('tool-remove').getAttribute('aria-checked')})"))
    print('errors', logs)
    b.close()
