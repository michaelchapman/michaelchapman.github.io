// Rival styles in the browser: picking one on the title screen, the card that names it at the start of a round,
// the pause card, and the end screen. Needs Playwright and a built page: python3 _tools/drone-season/build/site.py
const path = require('path');
const { chromium } = require('playwright');
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
    await page.waitForTimeout(500);
    const tap = sel => (mobile ? page.tap(sel) : page.click(sel));
    const style = () => page.evaluate(() => window.__ds.G.sim.ai[1] && window.__ds.G.sim.ai[1].style);
    await tap('#seg-style [data-s="bulwark"]');
    ok(label + ' picking a style marks it and remembers it', await page.getAttribute('#seg-style [data-s="bulwark"]', 'aria-pressed') === 'true' && await page.evaluate(() => JSON.parse(localStorage.getItem('ds1.style'))) === 'bulwark');
    await tap('#btn-go'); await page.waitForTimeout(600);
    ok(label + ' the round is against that style', (await style()) === 'bulwark');
    ok(label + ' a card names the rival and how to beat it', await page.isVisible('#rival') && /Bulwark/.test(await page.textContent('#rival-h')) && /How to beat it/.test(await page.textContent('#rival-b')));
    const box = await page.locator('#rival').boundingBox();
    const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).id, [box.x + box.width / 2, box.y + box.height / 2]);
    ok(label + ' taps on the card go through to the map', under === 'cv', under);
    await tap('#rival-x'); await page.waitForTimeout(150);
    ok(label + ' Got it puts the card away', !(await page.isVisible('#rival')));
    await tap('#btn-pause'); await page.waitForTimeout(250);
    ok(label + ' the pause card says who the rival is', await page.isVisible('#pause-rival') && /Bulwark/.test(await page.textContent('#pause-rival')));
    await tap('#btn-resume');
    await page.evaluate(() => { const { G, DS } = window.__ds; while (!G.sim.over) DS.step(G.sim); });
    await page.waitForTimeout(2300);
    ok(label + ' the end screen names the style', /Cobalt played Bulwark/.test(await page.textContent('#end-p')), await page.textContent('#end-p'));
    await tap('#btn-title'); await page.waitForTimeout(300);
    await tap('#seg-style [data-s="any"]');
    await tap('#btn-go'); await page.waitForTimeout(600);
    const st = await style();
    ok(label + ' Any picks one of the four and names it', ['reaper', 'bulwark', 'listener', 'mimic'].includes(st) && new RegExp(st, 'i').test(await page.textContent('#rival-h')), st);
    await tap('#btn-pause'); await page.waitForTimeout(200);
    await tap('#btn-quit'); await page.waitForTimeout(300);
    await tap('#btn-train'); await page.waitForTimeout(500);
    ok(label + ' training has no rival card', !(await page.isVisible('#rival')));
    await ctx.close();
  }
  await browser.close();
  console.log(checks.join('\n'));
  console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
