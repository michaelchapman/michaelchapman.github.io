// Drives the real controls on desktop and phone: build, cancel from the queue, place a Nest, launch squads, retask and recall.
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
      q: S0.queue.map(x => x.type), nectar: Math.round(S0.nectar), armed: G.armed, group: G.group.slice(), placing: G.placing, sel: G.sel, stance: G.stance, paused: G.paused, auto: S0.auto,
      sorties: [...s.sorties.values()].filter(o => o.side === 0 && o.label !== 'Guard').map(o => ({ id: o.id, type: o.type, mode: o.mode, n: o.units.length, route: o.route.length, target: o.target })),
      homing: s.units.filter(u => u.side === 0 && u.homing).length, chips: document.querySelectorAll('#queue .qchip').length }; });
    const scr = (x, y) => page.evaluate(([x, y]) => { const { S2, computeM } = window.__ds; computeM(false); return S2(x, y); }, [x, y]);
    // freeze the rival so the test is about controls
    await page.evaluate(() => { const { G } = window.__ds; G.sim.ai[1] = null; G.sim.sides[0].nectar = 600; });

    let st = await S();
    ok(label + ' Auto build starts on', st.auto === true);
    await tap('#btn-auto'); await page.waitForTimeout(150);
    // clear anything Auto queued in the first moments, refunding it
    await page.evaluate(() => { const { G, DS } = window.__ds; for (const q of G.sim.sides[0].queue.slice()) DS.cancelBuild(G.sim, 0, q.id); G.sim.sides[0].nectar = 600; });
    await page.waitForTimeout(150);
    st = await S();
    ok(label + ' the Auto chip turns it off', st.auto === false && st.q.length === 0, JSON.stringify(st.q));
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
    // Patrol squad: tap a patrol point
    await tap('#sq-4'); st = await S(); ok(label + ' arm the Patrol squad', st.armed === 'warden' && st.group.join() === 'warden');
    await tapXY(await scr(600, 500)); await page.waitForTimeout(120); st = await S();
    ok(label + ' tap launches a Warden patrol and disarms', st.sorties.some(o => o.type === 'warden' && o.route === 1) && st.armed === null);
    // edit the Bomb run squad to two Raiders and no Decoys, then drag a bombing route
    if (mobile) {
      const bb = await (await page.$('#sq-3')).boundingBox();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }] });
      await page.waitForTimeout(700);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await page.click('#sq-3', { button: 'right' });
    await page.waitForTimeout(200);
    const sh = await page.evaluate(() => window.__ds.G.sheet);
    ok(label + (mobile ? ' long-press' : ' right-click') + ' on a squad opens its editor and pauses', !!sh && sh.kind === 'squad' && sh.i === 3 && await page.isVisible('#sheet'));
    await page.waitForTimeout(400);
    await tap('#sheet-body [data-act="m+"][data-r="raider"]'); await tap('#sheet-body [data-act="m-"][data-r="decoy"]'); await tap('#sheet-body [data-act="m-"][data-r="decoy"]');
    const mix = await page.evaluate(() => window.__ds.G.squads[3].mix);
    ok(label + ' squad steppers change the mix', mix.raider === 2 && !mix.decoy, JSON.stringify(mix));
    await tap('#sheet-done'); await page.waitForTimeout(150);
    await tap('#sq-3'); st = await S(); ok(label + ' arm the edited squad', st.group.join() === 'raider');
    await drag(await scr(320, 420), await scr(700, 300)); st = await S();
    const rs = st.sorties.find(o => o.type === 'raider');
    ok(label + ' drag launches 2 Raiders on a route', !!rs && rs.n === 2 && rs.mode === 'route', JSON.stringify(st.sorties));
    // Swarm: Stings with Decoys leading
    await tap('#sq-2'); await tapXY(await scr(900, 300)); await page.waitForTimeout(120); st = await S();
    const sw = st.sorties.filter(o => o.type === 'decoy' || o.type === 'sting');
    ok(label + ' Swarm launches Stings and a pair of Decoys', sw.some(o => o.type === 'decoy' && o.n === 2) && sw.some(o => o.type === 'sting' && o.n >= 4), JSON.stringify(sw));
    // select the raiders and recall them
    await page.evaluate(() => { const { G, DS } = window.__ds; for (let i = 0; i < 60; i++) DS.step(G.sim); G.sim.events.length = 0; });
    await page.waitForTimeout(200);
    const rp = await page.evaluate(() => { const { G, S2, computeM } = window.__ds; computeM(false); const u = G.sim.units.find(u => u.side === 0 && u.type === 'raider' && !u.parked); return u ? S2(u.x, u.y) : null; });
    await tapXY(rp); await page.waitForTimeout(150); st = await S();
    ok(label + ' tapping a Raider selects its sortie', st.sel && st.sel.kind === 'sortie');
    if (!mobile) await page.keyboard.press('x'); else await tap('#ctx-main [data-act="recall"]');
    await page.waitForTimeout(120); st = await S();
    ok(label + ' Recall sends the Raiders home', st.homing >= 2, 'homing ' + st.homing);
    // stings raid the Heart by tapping it (build more first: the Swarm took them all)
    await page.evaluate(() => { const { G, DS } = window.__ds; G.sim.sides[0].nectar = 600; for (let i = 0; i < 3; i++) DS.build(G.sim, 0, 'sting'); let n = 0; while (G.sim.sides[0].queue.length && n++ < 30 * 30) DS.step(G.sim); G.sim.events.length = 0; });
    await page.waitForTimeout(200);
    await tap('#sq-1'); await tapXY(await scr(1380, 500)); await page.waitForTimeout(120); st = await S();
    ok(label + ' tapping the rival Heart with Stings armed starts a raid', st.sorties.some(o => o.type === 'sting' && o.mode === 'raid'));
    if (!mobile) {
      await page.keyboard.press('6'); st = await S(); ok('desk key 6 queues a Raider', st.q.includes('raider'));
      await page.keyboard.press('w'); st = await S(); ok('desk key W arms the Strike squad', st.armed === 'sting');
      await page.keyboard.press('t'); st = await S(); ok('desk key T with no Wardens ready leaves the arm unchanged', st.group.join() === 'sting');
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
