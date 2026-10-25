// Grouped launches and the map orientation lock on a small phone (toolbar resizes and a real rotation).
// Needs Playwright (npm install playwright) and a built page: python3 _tools/drone-season/build/site.py
const path = require('path');
const { chromium } = require('playwright');
const SP = path.join(require('os').tmpdir(), 'drone-season-');
(async () => {
  const browser = await chromium.launch();
  const errors = [], checks = [];
  const ok = (name, cond, info) => checks.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : ''));
  // ---- orientation on a small phone ----
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('orient: ' + e.message));
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.goto('file://' + path.join(__dirname, '..', '..', '..', 'drone-season', 'index.html') + '?debug');
    await page.waitForTimeout(600);
    await page.tap('#btn-go'); await page.waitForTimeout(700);
    const P = () => page.evaluate(() => window.__ds.cam.portrait);
    const p0 = await P();
    const flips = [];
    for (const t of ['#arm-sting', '#arm-glint', '#arm-sting', '#arm-glint', '#btn-guard', '#buy-sting']) { await page.tap(t); await page.waitForTimeout(250); flips.push(await P()); }
    ok('small phone: arming and tapping the dock never flips the map', flips.every(v => v === p0), `start ${p0} then ${flips.join(',')}`);
    for (const h of [620, 700, 600, 667]) { await page.setViewportSize({ width: 375, height: h }); await page.waitForTimeout(250); flips.push(await P()); }
    ok('small phone: browser bars resizing the height never flip it', flips.every(v => v === p0), flips.join(','));
    await page.setViewportSize({ width: 667, height: 375 }); await page.waitForTimeout(300);
    const rot = await P();
    ok('turning the phone sideways re-picks the orientation', rot === false, 'portrait=' + rot);
    await page.setViewportSize({ width: 375, height: 667 }); await page.waitForTimeout(300);
    ok('turning it back restores portrait', (await P()) === p0);
    await ctx.close();
  }
  // ---- groups ----
  for (const [label, vp, mobile] of [['desk', { width: 1366, height: 820 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(label + ': ' + e.message));
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.goto('file://' + path.join(__dirname, '..', '..', '..', 'drone-season', 'index.html') + '?debug');
    await page.waitForTimeout(600);
    const tap = sel => (mobile ? page.tap(sel) : page.click(sel));
    const tapXY = p => (mobile ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
    const scr = (x, y) => page.evaluate(([x, y]) => { const { S2, computeM } = window.__ds; computeM(false); return S2(x, y); }, [x, y]);
    const drag = async (a, b) => {
      if (mobile) {
        const cdp = await ctx.newCDPSession(page);
        const tp = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y }] });
        await tp('touchStart', a);
        for (let i = 1; i <= 10; i++) await tp('touchMove', { x: a.x + (b.x - a.x) * i / 10, y: a.y + (b.y - a.y) * i / 10 });
        await tp('touchEnd', b);
      } else {
        await page.mouse.move(a.x, a.y); await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10);
        await page.mouse.up();
      }
      await page.waitForTimeout(120);
    };
    await tap('#btn-go'); await page.waitForTimeout(500);
    await page.evaluate(() => { const { G, DS } = window.__ds; G.sim.ai[1] = null; G.sim.sides[0].nectar = 600; for (const t of ['raider', 'raider', 'decoy', 'decoy']) DS.build(G.sim, 0, t); let n = 0; while (G.sim.sides[0].queue.length && n++ < 30 * 60) DS.step(G.sim); G.sim.events.length = 0; });
    await page.waitForTimeout(300);
    const S = () => page.evaluate(() => { const { G } = window.__ds, s = G.sim; return { group: G.group.slice(), armed: G.armed, sel: G.sel,
      sorties: [...s.sorties.values()].filter(o => o.side === 0).map(o => ({ id: o.id, type: o.type, n: o.units.length, pkg: o.pkg, stance: o.stance, mode: o.mode, end: o.route.length ? o.route[o.route.length - 1] : null })),
      homing: s.units.filter(u => u.side === 0 && u.homing).length, ctx: document.getElementById('ctx-main').textContent }; });
    await tap('#arm-raider'); await tap('#arm-decoy'); await page.waitForTimeout(200);
    let st = await S();
    ok(label + ' tapping Raiders then Decoys arms a group', st.group.join() === 'raider,decoy' && /Group: 1 Raider \+ 2 Decoys/.test(st.ctx), JSON.stringify(st.group) + ' | ' + st.ctx);
    await page.screenshot({ path: SP + label + '-group-armed.png' });
    await drag(await scr(330, 430), await scr(900, 300));
    st = await S();
    const rs = st.sorties.find(o => o.type === 'raider'), ds = st.sorties.find(o => o.type === 'decoy');
    ok(label + ' one drag launches both on the same route as one package', rs && ds && rs.pkg && rs.pkg === ds.pkg && Math.abs(rs.end.x - ds.end.x) < 1, JSON.stringify(st.sorties));
    ok(label + ' Decoys lead (dash) while Raiders cruise', ds && ds.stance === 'dash' && rs.stance === 'quiet');
    st = await S(); ok(label + ' group stays armed while more are ready', st.group.join() === 'raider,decoy', JSON.stringify(st.group));
    await tap('#ctx-main [data-act="cancel"]');
    await page.evaluate(() => { const { G, DS } = window.__ds; for (let i = 0; i < 45; i++) DS.step(G.sim); G.sim.events.length = 0; });
    await page.waitForTimeout(200);
    const dp = await page.evaluate(() => { const { G, S2, computeM } = window.__ds; computeM(false); const u = G.sim.units.find(u => u.side === 0 && u.type === 'raider' && !u.parked); return u ? S2(u.x, u.y) : null; });
    await tapXY(dp); await page.waitForTimeout(150); st = await S();
    ok(label + ' tapping one member selects the whole group', st.sel && st.sel.pkg === rs.pkg && /Group: .*selected/.test(st.ctx), st.ctx);
    await page.screenshot({ path: SP + label + '-group-selected.png' });
    await tapXY(await scr(700, 700)); await page.waitForTimeout(150); st = await S();
    const r2 = st.sorties.find(o => o.type === 'raider'), d2 = st.sorties.find(o => o.type === 'decoy');
    ok(label + ' a tap retasks every member of the group', r2 && d2 && Math.abs(r2.end.x - 700) < 2 && Math.abs(d2.end.x - 700) < 2, JSON.stringify([r2 && r2.end, d2 && d2.end]));
    if (mobile) { try { await page.tap('#ctx-main [data-act="recall"]', { timeout: 3000 }); } catch (e) { ok(label + ' recall chip present', false, JSON.stringify(await S())); } } else await page.keyboard.press('x');
    await page.waitForTimeout(150); st = await S();
    ok(label + ' Recall brings the Raider home (Decoys stay on task)', st.homing >= 1, 'homing ' + st.homing);
    // a single tile still works on its own, and tapping an armed tile removes it from the group
    await tap('#arm-sting'); await tap('#arm-glint'); await tap('#arm-sting'); st = await S();
    ok(label + ' tapping an armed tile again removes it from the group', st.group.join() === 'glint', JSON.stringify(st.group));
    await ctx.close();
  }
  await browser.close();
  console.log(checks.join('\n'));
  console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
