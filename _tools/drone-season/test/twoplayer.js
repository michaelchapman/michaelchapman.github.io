// Two players in two browsers: a desktop host invites, a phone guest opens the link, and both play in lockstep.
// Needs Playwright, plus a local PeerServer and the PeerJS client: npm install playwright peer peerjs
// and a built page: python3 _tools/drone-season/build/site.py
const path = require('path');
const { chromium } = require('playwright');
const { PeerServer } = require('peer');
const PEERJS = require.resolve('peerjs/dist/peerjs.min.js');
const SP = path.join(require('os').tmpdir(), 'drone-season-2p-');
const PORT = 9123;
(async () => {
  const server = PeerServer({ port: PORT, path: '/', host: '127.0.0.1' });
  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const errors = [], checks = [];
  const ok = (name, cond, info) => { const l = (cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : ''); checks.push(l); if (process.env.V) console.log(l); };
  const page0 = 'file://' + path.join(__dirname, '..', '..', '..', 'drone-season', 'index.html') + `?debug&peerhost=127.0.0.1&peerport=${PORT}`;
  const open = async (label, vp, mobile) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(label + ': ' + e.message));
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.route('**/peerjs@*/dist/peerjs.min.js', r => r.fulfill({ path: PEERJS, contentType: 'application/javascript' }));
    return { ctx, page, mobile, tap: sel => (mobile ? page.tap(sel) : page.click(sel)), tapXY: p => (mobile ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y)) };
  };
  const st = p => p.evaluate(() => { const d = window.__ds, s = d.G.sim; return { mode: d.G.mode, me: d.ME, flip: d.cam.flip, live: d.NET.live, role: d.NET.role, tick: s.tick, paused: d.G.paused, ai: [!!s.ai[0], !!s.ai[1]], seed: s.seed,
    sorties: [...s.sorties.values()].filter(o => o.label !== 'Guard').map(o => ({ side: o.side, type: o.type, n: o.units.length })), queue: s.sides.map(S => S.queue.map(q => q.type)), net: !document.getElementById('ov-net').hidden, pk: document.getElementById('pause-k').textContent }; });
  const scr = (p, x, y) => p.evaluate(([x, y]) => { const { S2, computeM } = window.__ds; computeM(false); return S2(x, y); }, [x, y]);

  const H = await open('host', { width: 1366, height: 820 }, false);
  await H.page.goto(page0); await H.page.waitForTimeout(600);
  await H.tap('#btn-friend');
  await H.page.waitForFunction(() => document.getElementById('invite-url').value.includes('join='), null, { timeout: 15000 });
  const url = await H.page.inputValue('#invite-url');
  ok('the host gets an invite link', /\?join=ds-[a-z0-9]{10}/.test(url), url.replace(/^.*\?/, '?'));
  await H.page.screenshot({ path: SP + 'host-lobby.png' });

  const Gs = await open('guest', { width: 390, height: 844 }, true);
  await Gs.page.goto(url);
  await H.page.waitForFunction(() => window.__ds.NET.live, null, { timeout: 20000 });
  await Gs.page.waitForFunction(() => window.__ds.NET.live, null, { timeout: 20000 });
  await H.page.waitForTimeout(1500);
  let h = await st(H.page), g = await st(Gs.page);
  ok('opening the link starts the round for both', h.mode === 'play' && g.mode === 'play' && h.seed === g.seed, `host ${h.mode} guest ${g.mode}`);
  ok('the host is amber (side 0), the guest cobalt (side 1) with the map turned round', h.me === 0 && g.me === 1 && !h.flip && g.flip);
  ok('no computer on either side', !h.ai[0] && !h.ai[1] && !g.ai[0] && !g.ai[1]);
  ok('both battles are running', h.tick > 20 && g.tick > 20 && Math.abs(h.tick - g.tick) < 20, `ticks ${h.tick} / ${g.tick}`);
  const gh = await Gs.page.evaluate(() => { const { S2, computeM, G } = window.__ds; computeM(false); const a = G.sim.hearts[1], b = G.sim.hearts[0]; return { mine: S2(a.x, a.y), theirs: S2(b.x, b.y) }; });
  ok('the guest sees their own Heart at the bottom of the phone', gh.mine.y > gh.theirs.y + 200, JSON.stringify(gh));

  // orders from each side reach both battles
  await H.tap('#sq-1'); await H.tapXY(await scr(H.page, 600, 400)); await H.page.waitForTimeout(150);
  await Gs.tap('#sq-0'); await Gs.tapXY(await scr(Gs.page, 900, 600));
  await Gs.tap('#buy-raider');
  await H.page.waitForTimeout(1500);
  h = await st(H.page); g = await st(Gs.page);
  const has = (s, side, type) => s.sorties.some(o => o.side === side && o.type === type);
  ok("the host's Strike flies in both battles", has(h, 0, 'sting') && has(g, 0, 'sting'), JSON.stringify(g.sorties));
  ok("the guest's Scout flies in both battles", has(h, 1, 'glint') && has(g, 1, 'glint'), JSON.stringify(h.sorties));
  ok("the guest's build is queued in both", h.queue[1].includes('raider') && g.queue[1].includes('raider'), JSON.stringify([h.queue, g.queue]));
  await H.page.screenshot({ path: SP + 'host-play.png' }); await Gs.page.screenshot({ path: SP + 'guest-play.png' });

  // a pause stops both; either can resume
  await Gs.tap('#btn-pause'); await H.page.waitForTimeout(500);
  h = await st(H.page); g = await st(Gs.page);
  ok("the guest's pause stops both", h.paused && g.paused && /rival/.test(h.pk), h.pk);
  const t1 = h.tick; await H.page.waitForTimeout(700); h = await st(H.page);
  ok('and the battle holds still', h.tick === t1);
  await H.tap('#btn-resume'); await H.page.waitForTimeout(600);
  h = await st(H.page); g = await st(Gs.page);
  ok("the host's resume restarts both", !h.paused && !g.paused);

  // run a while: the built-in hash check would raise the out-of-step overlay
  await H.page.waitForTimeout(9000);
  h = await st(H.page); g = await st(Gs.page);
  ok('after ten seconds the two battles still match', !h.net && !g.net && h.live && g.live, `ticks ${h.tick} / ${g.tick}`);
  const hz = await Promise.all([H.page, Gs.page].map(p => p.evaluate(() => { const d = window.__ds; return { tick: d.G.sim.tick, h: d.hashSim(d.G.sim) }; })));
  ok('and the battles are equal where they meet', hz[0].tick !== hz[1].tick || hz[0].h === hz[1].h, JSON.stringify(hz));

  // end the round early on both (while paused, so both change at the same tick) and rematch
  await H.tap('#btn-pause'); await H.page.waitForTimeout(500);
  const tEnd = Math.ceil(Math.max(...await Promise.all([H.page, Gs.page].map(p => p.evaluate(() => window.__ds.G.sim.t))))) + 3;
  for (const p of [H.page, Gs.page]) await p.evaluate(t => { window.__ds.G.sim.cfg.round = t; }, tEnd);   // the same end time in both battles
  await H.tap('#btn-resume');
  await H.page.waitForFunction(() => window.__ds.G.mode === 'end', null, { timeout: 30000 });
  await Gs.page.waitForFunction(() => window.__ds.G.mode === 'end', null, { timeout: 30000 });
  const ends = await Promise.all([H.page, Gs.page].map(p => p.evaluate(() => ({ winner: window.__ds.G.sim.winner, tick: window.__ds.G.sim.tick, rematch: !document.getElementById('btn-rematch').hidden, again: !document.getElementById('btn-again').hidden }))));
  ok('both rounds end at the same tick with the same winner', ends[0].tick === ends[1].tick && ends[0].winner === ends[1].winner, JSON.stringify(ends));
  ok('the end screen offers a rematch instead of a new map', ends.every(e => e.rematch && !e.again));
  await Gs.page.screenshot({ path: SP + 'guest-end.png' });
  const seed0 = h.seed;
  await Gs.tap('#btn-rematch'); await H.page.waitForTimeout(400);
  ok("the guest's rematch request reaches the host", /wants a rematch/.test(await H.page.textContent('#end-net')));
  await H.tap('#btn-rematch');
  await Gs.page.waitForFunction(() => window.__ds.G.mode === 'play', null, { timeout: 15000 });
  await H.page.waitForTimeout(800);
  h = await st(H.page); g = await st(Gs.page);
  ok('the rematch starts for both on a new map', h.mode === 'play' && g.mode === 'play' && h.seed === g.seed && h.seed !== seed0 && h.live && g.live);

  // the guest leaves from the pause menu: the host is told at once and can finish against the computer
  await Gs.tap('#btn-pause'); await Gs.page.waitForTimeout(300);
  await Gs.tap('#btn-quit');
  await H.page.waitForFunction(() => !document.getElementById('ov-net').hidden, null, { timeout: 30000 });
  const lh = await H.page.textContent('#net-h');
  ok('when the guest leaves, the host is told', /left/.test(lh), lh);
  g = await st(Gs.page);
  ok('and the guest is back on the title screen', g.mode === 'title' && !g.role);
  await Gs.ctx.close();
  await H.page.screenshot({ path: SP + 'host-left.png' });
  await H.page.click('#net-btns [data-act="net-ai"]'); await H.page.waitForTimeout(800);
  h = await st(H.page);
  ok('and can finish against the computer', h.mode === 'play' && !h.paused && h.ai[1] && !h.live);

  await browser.close();
  server.close && server.close();
  console.log(checks.join('\n'));
  console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  process.exit(0);
})();
