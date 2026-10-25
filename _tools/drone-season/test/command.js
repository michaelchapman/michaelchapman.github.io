// Command features in the browser: the production plan and Auto, posts, quick orders on the map, and the Flying list.
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
    await page.waitForTimeout(600);
    const tap = sel => (mobile ? page.tap(sel) : page.click(sel));
    const tapXY = p => (mobile ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
    const scr = (x, y) => page.evaluate(([x, y]) => { const { S2, computeM } = window.__ds; computeM(false); return S2(x, y); }, [x, y]);
    const hold = async p => {
      if (mobile) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
        await page.waitForTimeout(650);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); }
      await page.waitForTimeout(450);
    };
    const run = s => page.evaluate(n => { const { G, DS } = window.__ds; for (let i = 0; i < 30 * n; i++) DS.step(G.sim); G.sim.events.length = 0; }, s);
    const S = () => page.evaluate(() => { const { G, DS } = window.__ds, s = G.sim, S0 = s.sides[0]; return {
      t: s.t, q: S0.queue.map(x => x.type + (x.auto ? '*' : '')), auto: S0.auto, plan: S0.plan.map(r => r.type + r.want).join(','), sheet: G.sheet, menu: !!G.menu, sel: G.sel,
      posts: S0.posts.map(p => ({ id: p.id, name: p.name, need: p.need, pri: p.pri, staff: DS.postStaff(s, 0, p) })),
      sorties: [...s.sorties.values()].filter(o => o.side === 0 && o.label !== 'Guard').map(o => ({ id: o.id, type: o.type, mode: o.mode, n: o.units.length, target: o.target, post: o.post, label: o.label })),
      ctx: document.getElementById('ctx-main').textContent }; });
    await tap('#btn-go'); await page.waitForTimeout(500);
    await page.evaluate(() => { const { G } = window.__ds; G.sim.ai[1] = null; });
    let st;
    // ---- plan and Auto ----
    await page.waitForTimeout(1200);
    st = await S();
    ok(label + ' Auto queues from the plan as the round starts', st.auto && st.q.length === 2 && st.q.every(x => x.endsWith('*')), JSON.stringify(st.q));
    await page.evaluate(() => { window.__ds.G.sim.sides[0].nectar = 500; });
    await tap('#buy-raider'); await page.waitForTimeout(100); st = await S();
    ok(label + ' a manual build goes ahead of queued auto items', st.q[1] === 'raider', JSON.stringify(st.q));
    await tap('#btn-plan'); await page.waitForTimeout(200);
    const t0 = (await S()).t; await page.waitForTimeout(600); st = await S();
    ok(label + ' the Plan sheet pauses the round', st.sheet && st.sheet.kind === 'plan' && Math.abs(st.t - t0) < 1e-6, `t ${t0} -> ${st.t}`);
    await page.waitForTimeout(400);
    await tap('#sheet-body [data-act="preset"][data-k="Swarm"]'); st = await S();
    ok(label + ' a preset replaces the plan', st.plan === 'forager5,glint1,sting12,decoy4,sting24,harrier1,glint2,sting36', st.plan);
    await tap('#sheet-body [data-act="down"][data-r="0"]'); st = await S();
    ok(label + ' rows reorder', st.plan.startsWith('glint1,forager5'), st.plan);
    await tap('#sheet-body [data-act="w+"][data-r="2"]'); st = await S();
    ok(label + ' steppers move by the batch size', st.plan.includes('sting16'), st.plan);
    if (!mobile) { await page.keyboard.press('Escape'); } else await tap('#sheet-done');
    await page.waitForTimeout(400); st = await S();
    ok(label + ' closing the sheet resumes the round', !st.sheet && st.t > t0, `t ${t0} -> ${st.t}`);
    await page.screenshot({ path: SP + label + '-cmd-auto.png' });
    // ---- a post from the hold menu ----
    const gp = await scr(520, 320);   // inside the Heart's link
    await hold(gp);
    st = await S();
    ok(label + ' press and hold opens quick orders', st.menu, JSON.stringify(st.sel));
    await tap('#qmenu [data-i="3"]'); await page.waitForTimeout(450); st = await S();
    ok(label + ' Post here opens a new-post sheet', st.sheet && st.sheet.kind === 'post' && st.sheet.isNew);
    await tap('#sheet-body [data-act="n+"][data-r="warden"]'); await tap('#sheet-body [data-act="pri"][data-v="2"]');
    await tap('#sheet-done'); await page.waitForTimeout(200); st = await S();
    const post = st.posts[0];
    ok(label + ' Set post creates it with what was chosen', post && post.need.glint === 1 && post.need.warden === 2 && post.pri === 2, JSON.stringify(st.posts));
    await page.evaluate(() => { const { G, DS } = window.__ds; G.sim.sides[0].nectar = 400; for (const t of ['warden', 'warden']) DS.build(G.sim, 0, t); });
    await run(40); st = await S();
    const sf = st.posts[0].staff;
    ok(label + ' the hive staffs the post', sf.glint.on === 1 && sf.warden.on === 2, JSON.stringify(sf));
    ok(label + ' post units fly as post sorties', st.sorties.filter(o => o.post === post.id).length >= 2);
    await tap('#tab-posts'); await page.waitForTimeout(250);
    ok(label + ' a new post starts selected', st.sel && st.sel.kind === 'post');
    await tap(`#body-posts [data-post="${post.id}"]`); await page.waitForTimeout(150); st = await S();
    ok(label + ' tapping its card deselects it', !st.sel);
    await tap(`#body-posts [data-post="${post.id}"]`); await page.waitForTimeout(150); st = await S();
    ok(label + ' and tapping again selects it', st.sel && st.sel.kind === 'post' && /, high priority/i.test(st.ctx), st.ctx);
    await page.screenshot({ path: SP + label + '-cmd-post.png' });
    await tap('#ctx-main [data-act="post-del"]'); await page.waitForTimeout(150); st = await S();
    ok(label + ' Remove takes the post away and releases its units', !st.posts.length && !st.sorties.some(o => o.post), JSON.stringify(st.sorties));
    // ---- tap a contact for quick orders ----
    // the released Glint still loiters at the old post; send a rival Glint close by so it is tracked
    await page.evaluate(() => { const { G, DS } = window.__ds; DS.launch(G.sim, 1, 'glint', 1, [{ x: 565, y: 330 }], {}); });
    await run(12);
    await page.waitForTimeout(200);
    const cp = await page.evaluate(() => { const { G, S2, computeM } = window.__ds; computeM(false); for (const c of G.sim.sides[0].pic.values()) if (c.type === 'glint' && c.grade >= 2) { const e = G.sim.byId.get(c.id); return S2(e.x, e.y); } return null; });
    ok(label + ' an enemy Glint is tracked', !!cp, cp ? '' : await page.evaluate(() => { const { G } = window.__ds; return JSON.stringify(G.sim.units.filter(u => u.type === 'glint' && !u.parked).map(u => [u.side, Math.round(u.x), Math.round(u.y), u.jam, u.link])); }));
    if (cp) {
      await tapXY(cp); await page.waitForTimeout(200); st = await S();
      ok(label + ' tapping a contact opens Strike, Bomb, Intercept', st.menu && /Strike/.test(await page.textContent('#qmenu')) && /Intercept/.test(await page.textContent('#qmenu')));
      await page.screenshot({ path: SP + label + '-cmd-contact.png' });
      await tap('#qmenu [data-i="0"]'); await page.waitForTimeout(150); st = await S();
      ok(label + ' Strike sends Stings at it', st.sorties.some(o => o.type === 'sting' && o.mode === 'strike' && o.target), JSON.stringify(st.sorties));
      await tap('#tab-flying'); await page.waitForTimeout(250);
      const cards = await page.$$eval('#body-flying [data-so]', bs => bs.map(b => b.textContent));
      ok(label + ' the Flying tab lists it', cards.some(c => /Strike/.test(c)), JSON.stringify(cards));
      await tap('#body-flying [data-so]'); await page.waitForTimeout(150); st = await S();
      ok(label + ' a Flying card selects that package', st.sel && st.sel.kind === 'sortie' && /Strike: .*selected/.test(st.ctx), st.ctx);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(checks.join('\n'));
  console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
