// The campaign in the browser: the campaign screen, and chapter 1 (which teaches the game) played through the real
// controls on desktop and phone sizes, then the first scenario on a small phone. Needs Playwright and a built page:
// python3 _tools/drone-season/build/site.py
const path = require('path');
const { chromium } = require('playwright');
const SP = path.join(require('os').tmpdir(), 'drone-season-camp-');
(async () => {
  const browser = await chromium.launch();
  const errors = [], checks = [];
  const ok = (name, cond, info) => checks.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : ''));
  for (const [label, vp, mobile, full] of [['desk', { width: 1366, height: 820 }, false, true], ['phone', { width: 390, height: 844 }, true, true], ['small phone', { width: 375, height: 667 }, true, false]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(label + ': ' + e.message));
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.goto('file://' + path.join(__dirname, '..', '..', '..', 'drone-season', 'index.html') + '?debug');
    await page.waitForTimeout(500);
    const tap = sel => (mobile ? page.tap(sel) : page.click(sel));
    const tapXY = p => (mobile ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
    const hold = async p => {
      if (mobile) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
        await page.waitForTimeout(650);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); }
      await page.waitForTimeout(450);
    };
    const tip = () => page.evaluate(() => window.__ds.TR.i);
    const title = () => page.textContent('#coach-h');
    // run the round forward (in sim time) until the tip changes, the round ends, or the time runs out
    const until = async (from, secs) => {
      for (let k = 0; k < secs; k++) {
        await page.evaluate(() => { const { G, DS } = window.__ds; for (let i = 0; i < 30 && !G.sim.over; i++) DS.step(G.sim); });
        await page.waitForTimeout(110);
        if ((await tip()) !== from || await page.evaluate(() => window.__ds.G.sim.over)) return true;
      }
      return false;
    };
    const markXY = () => page.evaluate(() => { const { TR, RUN, S2, computeM } = window.__ds; computeM(false); const st = RUN.sc.steps[TR.i], m = st && st.mark ? st.mark({ run: RUN, sim: RUN.sim, S: RUN.S, d: TR.d, since: 99, ui: {} }) : null; return m ? S2(m.x, m.y) : null; });
    const scr = (x, y) => page.evaluate(([x, y]) => { const { S2, computeM } = window.__ds; computeM(false); return S2(x, y); }, [x, y]);
    // play on in sim time until the scenario ends, with a helper that stands in for the player's later orders
    const finish = async (helper, secs) => {
      for (let k = 0; k < secs && !(await page.evaluate(() => window.__ds.G.sim.over)); k++) {
        await page.evaluate(h => { const { G, DS, RUN } = window.__ds; new Function('G', 'DS', 'RUN', h)(G, DS, RUN); for (let i = 0; i < 30 && !G.sim.over; i++) DS.step(G.sim); }, helper || '');
        if (k % 10 === 0) await page.waitForTimeout(30);
      }
      await page.waitForTimeout(1900);
      return page.evaluate(() => ({ end: !document.getElementById('ov-end').hidden, h: document.getElementById('end-h').textContent, p: document.getElementById('end-p').textContent, next: !document.getElementById('btn-next').hidden }));
    };

    try {
    // ---- the campaign screen ----
    ok(label + ' the title offers the campaign to a new player', await page.isVisible('#btn-camp') && await page.isVisible('#train-hint'));
    await tap('#btn-camp'); await page.waitForTimeout(250);
    const open = await page.evaluate(() => [...document.querySelectorAll('.scen')].map(b => !b.disabled));
    ok(label + ' the campaign lists three chapters, only the first scenario open', (await page.$$('.chap')).length === 3 && open[0] && open.slice(1).every(o => !o), JSON.stringify(open));
    if (full) await page.screenshot({ path: SP + label + '-list.png' });
    await tap('.scen[data-id="eyes"]'); await page.waitForTimeout(200);
    ok(label + ' a scenario opens on its briefing', /Eyes/i.test(await page.textContent('#camp-h')) && /Objective/.test(await page.textContent('#camp-body')));
    await tap('[data-act="camp-start"]'); await page.waitForTimeout(600);

    // ---- 1.1 Eyes ----
    ok(label + ' Eyes starts with its first tip and only Glints to build', (await tip()) === 0 && await page.isVisible('#coach') && await page.isVisible('#buy-glint') && !(await page.isVisible('#buy-sting')));
    ok(label + ' the top bar shows the objective', /find the nest/i.test(await page.textContent('#phase')), await page.textContent('#phase'));
    await tap('#coach-btns [data-act="tr-next"]'); await page.waitForTimeout(200);
    ok(label + ' the Scout tip highlights the squad', (await tip()) === 1 && await page.evaluate(() => document.getElementById('sq-0').classList.contains('coach-hi')));
    await tap('#sq-0'); await tapXY(await markXY());
    ok(label + ' a Glint on the ridge passes the tip', await until(1, 20), await title());
    await tap('#coach-btns [data-act="tr-next"]'); await page.waitForTimeout(200);
    ok(label + ' then the search', (await tip()) === 3, await title());
    const nestAt = await page.evaluate(() => { const { RUN } = window.__ds, u = RUN.sim.byId.get(RUN.S.nest); return { x: u.x - 60, y: u.y }; });
    await tap('#sq-0'); await tapXY(await scr(nestAt.x, nestAt.y));
    let end = await finish('', 120);
    ok(label + ' finding the Nest completes the scenario', end.end && /complete/i.test(end.h) && end.next, JSON.stringify(end));
    ok(label + ' and the win is saved', await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('ds1.camp1') || '{}'); return !!(p.eyes && p.eyes.won); }));
    if (full) await page.screenshot({ path: SP + label + '-eyes-end.png' });
    if (!full) { await ctx.close(); continue; }   // eslint-disable-line no-continue

    // ---- 1.2 First blood ----
    await tap('#btn-next'); await page.waitForTimeout(250);
    ok(label + ' Next scenario opens the next briefing', /First blood/i.test(await page.textContent('#camp-h')));
    await tap('[data-act="camp-start"]'); await page.waitForTimeout(600);
    await until(0, 4);
    const cp = await markXY();
    await tapXY(cp); await page.waitForTimeout(250);
    ok(label + ' tapping the contact opens quick orders', await page.isVisible('#qmenu'));
    await tap('#qmenu [data-i="0"]'); await page.waitForTimeout(150);
    let done = await until(0, 25);
    if (!done) { const p = await markXY(); if (p) { await tapXY(p); await page.waitForTimeout(200); if (await page.isVisible('#qmenu')) await tap('#qmenu [data-i="0"]'); } done = await until(0, 25); }
    ok(label + ' Strike kills it and the tips move on', done && (await tip()) === 1, await title());
    await tap('#buy-sting'); await page.waitForTimeout(300);
    ok(label + ' queuing Stings passes Build', (await tip()) === 2, await title());
    await tap('#sq-1'); await tapXY(await markXY()); await page.waitForTimeout(300);
    ok(label + ' Strike at the marked bloom passes', (await tip()) === 3, await title());
    await tap('#coach-btns [data-act="tr-next"]'); await page.waitForTimeout(150);
    ok(label + ' the last tip puts the coach away', !(await page.isVisible('#coach')));
    end = await finish(`
      for (const c of G.sim.sides[0].pic.values()) if (c.type === 'forager' && c.grade >= 2 && DS.parkedCount(G.sim, 0, 'sting') >= 2 && !DS.targetedBy(G.sim, 0, c.id)) { DS.launch(G.sim, 0, 'sting', 2, [], { mode: 'strike', target: c.id }); break; }
      const f = RUN.S.field;
      if (DS.parkedCount(G.sim, 0, 'sting') >= 4 && !G.sim.units.some(u => u.side === 0 && u.type === 'sting' && !u.parked)) DS.launch(G.sim, 0, 'sting', 4, [{ x: f.x, y: f.y }], { mode: 'hunt' });
      DS.maintain(G.sim, 0, [['sting', 12]], 2);`, 240);
    ok(label + ' six Foragers down completes it', end.end && /complete/i.test(end.h), JSON.stringify(end));

    // ---- 1.3 Harvest ----
    await tap('#btn-next'); await page.waitForTimeout(250); await tap('[data-act="camp-start"]'); await page.waitForTimeout(600);
    ok(label + ' Harvest starts on the Forager tip', (await tip()) === 0 && /Harvest/i.test(await page.textContent('#phase')), await title());
    await tap('#buy-forager'); await page.waitForTimeout(300);
    await tap('#btn-auto'); await page.waitForTimeout(300);
    ok(label + ' a Forager and Auto pass two tips', (await tip()) === 2, await title());
    await tap('#btn-plan'); await page.waitForTimeout(500); await tap('#sheet-done'); await page.waitForTimeout(400);
    ok(label + ' opening and closing the plan passes', (await tip()) === 3, await title());
    await tap('#sq-4'); await tapXY(await markXY());
    ok(label + ' a Warden on patrol passes', await until(3, 20), await title());
    await tap('#coach-btns [data-act="tr-next"]'); await page.waitForTimeout(150);
    end = await finish('', 360);
    ok(label + ' banking ◆450 completes it', end.end && /complete/i.test(end.h), JSON.stringify(end));

    // ---- 1.4 Hold ----
    await tap('#btn-next'); await page.waitForTimeout(250); await tap('[data-act="camp-start"]'); await page.waitForTimeout(600);
    await hold(await markXY());
    ok(label + ' holding the Crown opens quick orders', await page.isVisible('#qmenu'));
    await tap('#qmenu [data-i="3"]'); await page.waitForTimeout(450); await tap('#sheet-done'); await page.waitForTimeout(400);
    ok(label + ' setting the post passes', (await tip()) === 1, await title());
    await tap('#tab-posts'); await page.waitForTimeout(300);
    ok(label + ' opening Posts passes', (await tip()) === 2, await title());
    await page.evaluate(() => { const { G, DS } = window.__ds; for (let i = 0; i < 30 * 20; i++) DS.step(G.sim); });
    const pl = await page.evaluate(() => { const { G, DS } = window.__ds, p = G.sim.sides[0].posts[0]; return { reach: DS.postReach(G.sim, 0, p), relay: G.sim.units.some(u => u.side === 0 && u.type === 'relay' && !u.parked && u.link) }; });
    ok(label + ' a Relay carries the link to the Crown post', pl.relay && pl.reach === 'ok', JSON.stringify(pl));
    await page.screenshot({ path: SP + label + '-link.png' });
    await tap('#coach-btns [data-act="tr-next"]'); await page.waitForTimeout(250);
    ok(label + ' the raid is beaten off', await until(3, 40), await title());
    const spots = [];
    for (let i = 0; i < 12; i++) { spots.push(await page.evaluate(() => Math.round(document.getElementById('coach').getBoundingClientRect().top))); await page.waitForTimeout(110); }
    ok(label + ' the coach card holds still on the Crown tip', new Set(spots).size === 1, spots.join(','));
    await tap('#btn-pause'); await page.waitForTimeout(200);
    ok(label + ' the pause card shows the objective and stars', /Reach 60 Crown score/.test(await page.textContent('#pause-rival')) && /No hits on your Heart/.test(await page.textContent('#pause-rival')));
    await tap('#btn-resume');
    await tap('#sq-2'); await tapXY(await markXY()); await page.waitForTimeout(200);
    end = await finish(`
      const c = G.sim.map.fields[G.sim.map.fields.length - 1];
      if (DS.parkedCount(G.sim, 0, 'sting') >= 6 && G.sim.presence[0] <= G.sim.presence[1] + 2) DS.launch(G.sim, 0, 'sting', 6, [{ x: c.x, y: c.y }], { mode: 'hunt' });
      DS.maintain(G.sim, 0, [['sting', 24]], 2);`, 400);
    ok(label + ' holding the Crown to 60 completes it, and the chapter', end.end && /complete/i.test(end.h) && /Chapter 1, First light, is complete/.test(end.p), JSON.stringify(end));
    await page.screenshot({ path: SP + label + '-hold-end.png' });
    await tap('#btn-title'); await page.waitForTimeout(300);
    const open2 = await page.evaluate(() => [...document.querySelectorAll('.scen')].map(b => !b.disabled));
    ok(label + ' Campaign shows chapter 2 open', open2.slice(0, 5).every(Boolean) && !open2[5], JSON.stringify(open2));
    // ---- every other scenario starts, shows its objective, plays a minute and a half, and leaves cleanly ----
    if (label === 'desk') {
      await page.evaluate(() => { const { CAMP } = window.__ds, p = {}; for (const id of CAMP.ORDER) p[id] = { won: true, stars: [true, false, false] }; localStorage.setItem('ds1.camp1', JSON.stringify(p)); });
      for (const id of await page.evaluate(() => window.__ds.CAMP.ORDER.slice(4))) {
        await tap(`.scen[data-id="${id}"]`); await page.waitForTimeout(150); await tap('[data-act="camp-start"]'); await page.waitForTimeout(400);
        const before = errors.length;
        for (let k = 0; k < 9; k++) { await page.evaluate(() => { const { G, DS } = window.__ds; for (let i = 0; i < 300 && !G.sim.over; i++) DS.step(G.sim); }); await page.waitForTimeout(60); }
        const st = await page.evaluate(() => ({ id: window.__ds.RUN && window.__ds.RUN.id, phase: document.getElementById('phase').textContent, over: window.__ds.G.sim.over }));
        ok(`${label} ${id} plays without errors`, st.id === id && errors.length === before && st.phase.length > 0, JSON.stringify(st));
        if (st.over) { await page.waitForTimeout(1900); await tap('#btn-title'); } else { await tap('#btn-pause'); await page.waitForTimeout(150); await tap('#btn-quit'); }
        await page.waitForTimeout(250);
      }
    }
    } catch (e) { ok(label + ' ran to the end', false, e.message.split('\n')[0]); }
    await ctx.close();
  }
  await browser.close();
  console.log(checks.join('\n'));
  console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
