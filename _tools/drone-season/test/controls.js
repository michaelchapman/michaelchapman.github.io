// Drives the real controls on desktop and phone: build, cancel from the queue, place a Nest, launch, retask and recall each unit.
// Needs Playwright (npm install playwright) and a built page: python3 _tools/drone-season/build/site.py
const path = require('path');
const { chromium } = require('playwright');
const SP = path.join(require('os').tmpdir(), 'drone-season-');
(async () => {
  const browser = await chromium.launch();
  const errors = [], checks = [];
  const ok = (name, cond, info) => checks.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : ''));
  for (const [label, vp, mobile] of [['desk', { width: 1366, height: 820 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(label + ': ' + e.message));
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.goto('file://' + path.join(__dirname, '..', '..', '..', 'drone-season', 'index.html') + '?debug');
    await page.waitForTimeout(700);
    const tap = sel => (mobile ? page.tap(sel) : page.click(sel));
    const tapXY = async p => (mobile ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
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
    const S = () => page.evaluate(() => { const { G } = window.__ds, s = G.sim, S0 = s.sides[0]; return {
      q: S0.queue.map(x => x.type), nectar: Math.round(S0.nectar), armed: G.armed, placing: G.placing, sel: G.sel, stance: G.stance, counts: G.counts, paused: G.paused,
      sorties: [...s.sorties.values()].filter(o => o.side === 0 && o.label !== 'Guard').map(o => ({ id: o.id, type: o.type, mode: o.mode, n: o.units.length, route: o.route.length, target: o.target })),
      homing: s.units.filter(u => u.side === 0 && u.homing).length, chips: document.querySelectorAll('#queue .qchip').length }; });
    const scr = (x, y) => page.evaluate(([x, y]) => { const { S2, computeM } = window.__ds; computeM(false); return S2(x, y); }, [x, y]);
    // freeze the rival so the test is about controls
    await page.evaluate(() => { const { G } = window.__ds; G.sim.ai[1] = null; G.sim.sides[0].nectar = 600; });

    let st;
    await tap('#buy-sting'); await tap('#buy-raider'); await tap('#buy-decoy'); await tap('#buy-warden');
    await page.waitForTimeout(250); st = await S();
    ok(label + ' build buttons queue in order', st.q.join() === 'sting,raider,decoy,warden' && st.chips === 4, JSON.stringify(st.q) + ' chips ' + st.chips);
    const before = st.nectar;
    await tap('#queue .qchip:nth-child(2)'); await page.waitForTimeout(200); st = await S();
    ok(label + ' tapping a queued item cancels it with a refund', st.q.join() === 'sting,decoy,warden' && st.nectar === before + 40, `nectar ${before}->${st.nectar}`);
    await tap('#buy-raider'); await tap('#buy-raider');
    // nest placement
    await tap('#buy-nest'); st = await S();
    ok(label + ' Nest button enters placing mode', st.placing === true);
    const eh = await scr(1380, 500);
    await tapXY({ x: eh.x + (mobile ? 0 : -30), y: eh.y + (mobile ? 30 : 0) }); await page.waitForTimeout(150); st = await S();
    ok(label + ' a Nest next to the rival Heart is refused', st.placing === true && !st.q.includes('nest'));
    const site = await page.evaluate(() => { const { G, DS } = window.__ds; for (let x = 330; x < 600; x += 20) for (let y = 200; y < 800; y += 20) if (!DS.nestSiteError(G.sim, 0, x, y)) return { x, y }; return null; });
    const sp = await scr(site.x, site.y);
    await tapXY(sp); await page.waitForTimeout(150); st = await S();
    ok(label + ' a valid tap queues the Nest and leaves placing mode', st.placing === false && st.q.includes('nest'), JSON.stringify(st.q));
    // run the vats: step the sim until the queue empties
    await page.evaluate(() => { const { G, DS } = window.__ds; let n = 0; while (G.sim.sides[0].queue.length && n++ < 30 * 90) DS.step(G.sim); G.sim.events.length = 0; });
    const counts = await page.evaluate(() => { const { G, DS } = window.__ds; return { raider: DS.parkedCount(G.sim, 0, 'raider'), warden: DS.parkedCount(G.sim, 0, 'warden'), decoy: DS.parkedCount(G.sim, 0, 'decoy'), nest: DS.nestCount(G.sim, 0) }; });
    ok(label + ' queued units arrive and the Nest grows', counts.raider === 2 && counts.warden === 1 && counts.decoy === 2 && counts.nest === 1, JSON.stringify(counts));
    await page.waitForTimeout(300);
    // warden: tap a patrol point
    await tap('#arm-warden'); st = await S(); ok(label + ' arm Warden', st.armed === 'warden');
    await tapXY(await scr(600, 500)); await page.waitForTimeout(120); st = await S();
    ok(label + ' tap launches a Warden patrol', st.sorties.some(o => o.type === 'warden' && o.route === 1));
    // raider: drag a bombing route
    await tap('#arm-raider'); st = await S(); ok(label + ' arm Raiders', st.armed === 'raider');
    if (!mobile) { await page.keyboard.press('c'); st = await S(); ok('desk C cycles how many', st.counts.raider === 2, JSON.stringify(st.counts)); }
    else { await tap('#ctx-main [data-act="n2"]'); st = await S(); ok('phone count buttons', st.counts.raider === 2); }
    await drag(await scr(320, 420), await scr(700, 300)); st = await S();
    const rs = st.sorties.find(o => o.type === 'raider');
    ok(label + ' drag launches 2 Raiders on a route', !!rs && rs.n === 2 && rs.mode === 'route', JSON.stringify(st.sorties));
    // decoys: tap a point
    await tap('#arm-decoy'); await tapXY(await scr(900, 300)); await page.waitForTimeout(120); st = await S();
    ok(label + ' Decoys launch as a pair', st.sorties.some(o => o.type === 'decoy' && o.n === 2));
    // select the raiders and recall them
    await page.evaluate(() => { const { G, DS } = window.__ds; for (let i = 0; i < 60; i++) DS.step(G.sim); G.sim.events.length = 0; });
    await page.waitForTimeout(200);
    const rp = await page.evaluate(() => { const { G, S2, computeM } = window.__ds; computeM(false); const u = G.sim.units.find(u => u.side === 0 && u.type === 'raider' && !u.parked); return u ? S2(u.x, u.y) : null; });
    await tapXY(rp); await page.waitForTimeout(150); st = await S();
    ok(label + ' tapping a Raider selects its sortie', st.sel && st.sel.kind === 'sortie');
    if (!mobile) await page.keyboard.press('x'); else await tap('#ctx-main [data-act="recall"]');
    await page.waitForTimeout(120); st = await S();
    ok(label + ' Recall sends the Raiders home', st.homing >= 2, 'homing ' + st.homing);
    // stings raid the Heart by tapping it
    await tap('#arm-sting'); await tapXY(await scr(1380, 500)); await page.waitForTimeout(120); st = await S();
    ok(label + ' tapping the rival Heart with Stings armed starts a raid', st.sorties.some(o => o.type === 'sting' && o.mode === 'raid'));
    if (!mobile) {
      await page.keyboard.press('6'); st = await S(); ok('desk key 6 queues a Raider', st.q.includes('raider'));
      await page.keyboard.press('r'); st = await S(); ok('desk key R with no Wardens ready leaves the arm unchanged', st.armed === 'sting');
      await page.keyboard.press('Escape'); st = await S(); ok('desk Esc cancels', st.armed === null);
      await page.keyboard.press('d'); st = await S(); ok('desk D toggles dash', st.stance === 'dash');
      await page.keyboard.press('p'); st = await S(); ok('desk P pauses', st.paused === true && await page.isVisible('#ov-pause'));
      await page.screenshot({ path: SP + 'desk-pause.png' });
      await page.keyboard.press('p'); st = await S(); ok('desk P resumes', st.paused === false);
    } else {
      await tap('#btn-pause'); st = await S(); ok('phone pause', st.paused === true);
      await tap('#btn-resume'); st = await S(); ok('phone resume', st.paused === false);
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: SP + label + '-interact.png' });
    await ctx.close();
  }
  await browser.close();
  console.log(checks.join('\n'));
  console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
