// Plays the training round through the real controls on desktop and phone sizes, checking each step advances.
// Needs Playwright (npm install playwright) and a built page: python3 _tools/drone-season/build/site.py
const path = require('path');
const { chromium } = require('playwright');
const SP = path.join(require('os').tmpdir(), 'drone-season-train-');
(async () => {
  const browser = await chromium.launch();
  const errors = [], checks = [];
  const ok = (name, cond, info) => { const l = (cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : ''); checks.push(l); if (process.env.V) console.log(l); };
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
    const step = () => page.evaluate(() => window.__ds.TR.i);
    const title = () => page.textContent('#coach-h');
    // run the round forward (in sim time) until the step changes or the time runs out
    const until = async (from, secs) => {
      for (let k = 0; k < secs; k++) {
        await page.evaluate(() => { const { G, DS } = window.__ds; for (let i = 0; i < 30; i++) DS.step(G.sim); });
        await page.waitForTimeout(130);
        if ((await step()) !== from) return true;
      }
      return false;
    };
    const markXY = () => page.evaluate(() => { const { TR, TSTEPS, S2, computeM } = window.__ds; computeM(false); const st = TSTEPS[TR.i], m = st && st.mark ? st.mark(TR.d) : null; return m ? S2(m.x, m.y) : { x: 10, y: 10, none: TR.i }; });

    ok(label + ' the title offers training to a new player', await page.isVisible('#btn-train') && await page.isVisible('#train-hint'));
    await tap('#btn-train'); await page.waitForTimeout(500);
    ok(label + ' training starts on its own map with no rival commander', await page.evaluate(() => { const { G } = window.__ds; return G.training && G.sim.mode === 'training' && !G.sim.ai[1] && !G.sim.sides[0].auto; }));
    ok(label + ' the coach shows step 1', (await step()) === 0 && await page.isVisible('#coach'), await title());
    await page.screenshot({ path: SP + label + '-0.png' });
    await tap('#coach-btns [data-act="tr-next"]'); await page.waitForTimeout(200);
    // 1 scout
    ok(label + ' Scout step highlights the squad', (await step()) === 1 && await page.evaluate(() => document.getElementById('sq-0').classList.contains('coach-hi')));
    await tap('#sq-0'); await tapXY(await markXY());
    ok(label + ' a Glint perched on the ridge passes the step', await until(1, 20), await title());
    await tap('#coach-btns [data-act="tr-next"]'); await page.waitForTimeout(250);
    // 3 contact
    ok(label + ' a cobalt Glint appears', (await step()) === 3);
    await until(3, 4);
    await page.screenshot({ path: SP + label + '-3.png' });
    const cp = await markXY();
    await tapXY(cp); await page.waitForTimeout(250);
    ok(label + ' tapping the contact opens quick orders', await page.isVisible('#qmenu'));
    await tap('#qmenu [data-i="0"]'); await page.waitForTimeout(150);
    let done = await until(3, 25);
    if (!done) { await tapXY(await markXY()); await page.waitForTimeout(200); if (await page.isVisible('#qmenu')) await tap('#qmenu [data-i="0"]'); done = await until(3, 25); }
    ok(label + ' Strike kills it and the lesson moves on', done, await title());
    // 4 build, 5 auto, 6 plan
    await tap('#buy-sting'); await page.waitForTimeout(300);
    ok(label + ' queuing Stings passes Build', (await step()) === 5, await title());
    await tap('#btn-auto'); await page.waitForTimeout(300);
    ok(label + ' turning on Auto passes', (await step()) === 6, await title());
    await tap('#btn-plan'); await page.waitForTimeout(500); await tap('#sheet-done'); await page.waitForTimeout(400);
    ok(label + ' opening and closing the plan passes', (await step()) === 7, await title());
    // 7 strike the foragers' bloom
    await page.screenshot({ path: SP + label + '-7.png' });
    await tap('#sq-1'); await tapXY(await markXY()); await page.waitForTimeout(300);
    ok(label + ' Strike at the marked bloom passes', (await step()) === 8, await title());
    await tap('#coach-btns [data-act="tr-next"]'); await page.waitForTimeout(250);
    // 9 post at the Crown
    ok(label + ' Set a post step', (await step()) === 9, await title());
    await hold(await markXY());
    ok(label + ' holding the Crown opens quick orders', await page.isVisible('#qmenu'));
    await tap('#qmenu [data-i="3"]'); await page.waitForTimeout(450); await tap('#sheet-done'); await page.waitForTimeout(400);
    ok(label + ' setting the post passes', (await step()) === 10, await title());
    await tap('#tab-posts'); await page.waitForTimeout(300);
    ok(label + ' opening Posts passes', (await step()) === 11, await title());
    // 11 raid
    await until(11, 2);
    await page.screenshot({ path: SP + label + '-11.png' });
    ok(label + ' the raid is beaten off', await until(11, 40), await title());
    const hp = await page.evaluate(() => window.__ds.G.sim.hearts[0].hp);
    // 12 hold the Crown
    await tap('#sq-2'); await tapXY(await markXY()); await page.waitForTimeout(200);
    await page.screenshot({ path: SP + label + '-12.png' });
    ok(label + ' holding the Crown passes', await until(12, 40), await title());
    await page.waitForTimeout(300);
    await page.screenshot({ path: SP + label + '-13.png' });
    ok(label + ' training ends and is remembered', (await step()) === 13 && await page.evaluate(() => JSON.parse(localStorage.getItem('ds1.trained'))), `heart ${hp}`);
    await tap('#coach-btns [data-act="tr-play"]'); await page.waitForTimeout(400);
    ok(label + ' Play a short game starts a real round without the coach', await page.evaluate(() => { const { G } = window.__ds; return !G.training && G.sim.mode !== 'training' && !!G.sim.ai[1] && document.getElementById('coach').hidden; }));
    await ctx.close();
  }
  await browser.close();
  console.log(checks.join('\n'));
  console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
