/* Drone Season · campaign: chapters of short scenarios, as data, and the rules that run them. Pure logic, no DOM.
   A scenario sets up a round (map, what each side starts with and may build, the rival: a script or a style), gives
   the player one objective and two optional goals for stars, and may carry coach tips the page shows as it plays.
   More chapters are added by adding to CHAPTERS and SCENARIOS. */
(function (root) {
  'use strict';
  const DS = root.DS, W = DS.W, H = DS.H;
  const hyp = (ax, ay, bx, by) => DS.dhypot(ax - bx, ay - by);
  const byNear = (list, p) => list.slice().sort((a, b) => hyp(a.x, a.y, p.x, p.y) - hyp(b.x, b.y, p.x, p.y));
  const clock = t => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
  const ALL = ['forager', 'glint', 'sting', 'decoy', 'warden', 'raider', 'relay', 'harrier', 'nest'];

  // ---------- helpers scenarios share ----------
  function geo(sim) {
    const m = sim.map, home = sim.hearts[0], rival = sim.hearts[1], crown = m.fields[m.fields.length - 1];
    return {
      m, home, rival, crown,
      mine: byNear(m.fields.filter(f => f.side === 0), home),
      theirs: byNear(m.fields.filter(f => f.side === 1), rival),
      peaks: m.peaks, patches: m.patches,
    };
  }
  const own = (sim, side, type, f) => sim.units.filter(u => u.side === side && u.type === type && u.hp > 0 && (!f || f(u)));
  const alive = (sim, ids) => (ids || []).filter(id => { const u = sim.byId.get(id); return u && u.hp > 0; });
  // make sure n of a type are parked and ready at a side's Heart
  function grant(sim, side, type, n) {
    const h = sim.hearts[side];
    for (let have = DS.parkedCount(sim, side, type); have < n; have++) DS.spawnUnit(sim, side, type, h.x, h.y);
  }
  // put drones in the air at a point, flying a route
  function fly(run, side, type, n, from, route, opts) {
    const sim = run.sim;
    grant(sim, side, type, n);
    const so = DS.launch(sim, side, type, n, route, Object.assign({ stance: 'quiet' }, opts || {}));
    if (!so) return null;
    for (const id of so.units) {
      const u = sim.byId.get(id), to = route[0] || from;
      u.x = u.px = from.x + (run.rnd() - 0.5) * 24; u.y = u.py = from.y + (run.rnd() - 0.5) * 24;
      u.hdg = DS.datan2(to.y - u.y, to.x - u.x);
    }
    return so;
  }
  // put a rival unit on the player's picture as a track (for things a scenario wants found)
  function reveal(sim, u) {
    const pic = sim.sides[0].pic, c = pic.get(u.id);
    if (c && c.grade >= 2) return;
    pic.set(u.id, Object.assign(c || {}, { id: u.id, grade: 2, x: u.x, y: u.y, gx: u.x, gy: u.y, vx: 0, vy: 0, type: u.type, known: true, static: false, first: c ? c.first : sim.t, seenT: sim.t, trackT: sim.t, lockUntil: 0, held: c ? c.held : 0, jitT: 0 }));
  }
  const nest = (sim, side, x, y) => DS.spawnUnit(sim, side, 'nest', x, y, { parked: false, state: 'nest', hdg: 0 });
  // where Cobalt's drones come from: the far side, level with the target, a little to one flank
  const fromEast = (run, p, spread) => ({ x: W * 0.72 + (run.rnd() - 0.5) * 60, y: Math.max(60, Math.min(H - 60, p.y + (run.rnd() - 0.5) * (spread || 200))) });
  const ridgeMark = sim => { const h = sim.hearts[0], ps = byNear(sim.map.peaks.filter(p => p.x < W * 0.45), h); return ps[0] ? { x: ps[0].x, y: ps[0].y } : { x: 480, y: 500 }; };
  const busiest = (sim, side) => {
    const g = geo(sim), list = side ? g.theirs : g.mine;
    let best = list[0], bn = -1;
    for (const f of list) { const n = own(sim, side, 'forager', u => hyp(u.x, u.y, f.x, f.y) < f.r + 30).length; if (n > bn) { bn = n; best = f; } }
    return best;
  };
  // the base a scenario starts from: no clock of its own, no Crown, no frost; the scenario ends it
  const OPEN = { round: 3600, noFrost: true, bloomOpen: 1e9, bloomScore: 1e9, phases: [0, 3600, 3600, 3600, 3600] };

  // ---------- chapters ----------
  const CHAPTERS = [
    { id: 'first-light', n: 1, title: 'First light', line: 'Learn the hive: see, strike, build and hold.', scenarios: ['eyes', 'first-blood', 'harvest', 'hold'] },
    { id: 'spectrum', n: 2, title: 'Spectrum', line: 'Links, jamming and lies.', scenarios: ['long-reach', 'static', 'smoke', 'nest-breaker'] },
    { id: 'rivals', n: 3, title: 'Rivals', line: 'Full rounds against hives that fight their own way.', scenarios: ['reaper', 'bulwark', 'two-faces'] },
  ];

  // ---------- scenarios ----------
  // steps: coach tips the page shows in order. Each has a heading (h), text (p), and may highlight a control (hi),
  // mark a spot on the map (mark), wait for something (check) or show a button (next). ctx = { run, sim, S, d, ui }.
  const SCENARIOS = {
    // ===== Chapter 1: First light =====
    eyes: {
      title: 'Eyes', line: 'Find a hidden Nest with your Glints.', seed: 7729, limit: 300,
      brief: ['Whatever is seen is killed, so the first job is seeing.', 'Cobalt has hidden a Nest somewhere on its side of the valley. Find it with your Glints: quiet scouts with long sight. A Glint perched on a ridge sees further, and canopy hides whatever sits under it.'],
      goal: 'Find the hidden Cobalt Nest.',
      cfg: OPEN, kit: ['glint'], start: { 0: { forager: 2, glint: 3 }, 1: { forager: 2 } }, nectar: { 0: 30, 1: 0 },
      setup(run) {
        const sim = run.sim, g = geo(sim);
        // under the rival-side canopy furthest from the Crown that is not on top of their Heart
        const spots = g.patches.filter(p => p.x > W * 0.55 && hyp(p.x, p.y, g.rival.x, g.rival.y) > 260);
        const p = spots.sort((a, b) => hyp(b.x, b.y, g.crown.x, g.crown.y) - hyp(a.x, a.y, g.crown.x, g.crown.y))[0] || { x: W * 0.8, y: H * 0.8 };
        run.S.nest = nest(sim, 1, p.x, p.y).id;
        run.S.area = { x: p.x + (p.x > W * 0.8 ? -90 : 60), y: p.y + (p.y > H / 2 ? -70 : 70) };
      },
      progress(run) {
        const c = run.sim.sides[0].pic.get(run.S.nest);
        return { text: 'Find the Nest', done: !!(c && c.known) };
      },
      won: 'You found it. Now Cobalt knows you know.',
      stars: [
        { text: 'Find it within 1:30', check: run => run.result.t <= 90 },
        { text: 'Keep clear of their Heart’s flak: lose no Glints', check: run => !(run.sim.sides[0].lostBy.glint) },
      ],
      steps: [
        { h: 'Your hive', p: c => `You command the amber hive: your Heart is ${c.ui.homeAt()} and Cobalt is ${c.ui.cobaltAt()}. In this valley whatever is seen is killed, so the first job is seeing.`, next: 'Start' },
        { h: 'Scout', p: c => `Tap ${c.ui.sq(0)}, then tap the marked ridge. Glints are quiet scouts with long sight.`, hi: '#sq-0',
          enter: c => { c.d.mark = ridgeMark(c.sim); },
          mark: c => ({ x: c.d.mark.x, y: c.d.mark.y, r: 26, label: 'RIDGE' }),
          check: c => own(c.sim, 0, 'glint', u => !u.parked && hyp(u.x, u.y, c.d.mark.x, c.d.mark.y) < 45).length > 0,
          hint: 'Missed it? Tap your Glint on the map to select it, then tap the marked ridge.' },
        { h: 'Sight', p: () => 'On a ridge a Glint sees 30% further: the dashed ring is its sight. Ridges block sight unless you stand on one. Green dashed patches are <b>canopy</b>: anything under it is hard to see, yours included.', next: 'Next' },
        { h: 'Search', p: c => `Somewhere on Cobalt’s side sits a Nest. Send Glints to look: tap ${c.ui.sq(0)}, then tap where to look, or drag a route through several places. A Glint flies for 75 seconds, and the Cobalt Heart shoots anything that comes close.`,
          mark: c => (c.since > 40 ? { x: c.S.area.x, y: c.S.area.y, r: 170, label: 'TRY HERE' } : { x: W * 0.78, y: H / 2, r: 220, label: 'COBALT\u2019S SIDE' }),
          hint: 'Still looking? Try the marked area: drag a route through it.', hintAfter: 40 },
      ],
    },
    'first-blood': {
      title: 'First blood', line: 'Stings, routes and the quick menu.', seed: 3301, limit: 240,
      brief: ['Stings are cheap and spent on impact: one ◆6 Sting for a ◆25 Forager is a good trade.', 'Cobalt’s Foragers are working a bloom near the centre. Destroy six of them before they finish their harvest.'],
      goal: 'Destroy 6 Cobalt Foragers.',
      cfg: OPEN, kit: ['glint', 'sting'], start: { 0: { forager: 2, glint: 1, sting: 8 }, 1: { forager: 8 } }, nectar: { 0: 60, 1: 0 },
      setup(run) {
        const sim = run.sim, g = geo(sim);
        const f = byNear(g.theirs, g.crown)[0];
        run.S.field = { x: f.x, y: f.y, r: f.r };
        run.S.fi = sim.map.fields.indexOf(f);
      },
      // Cobalt keeps three Foragers on the bloom while it has them
      watch(run) {
        const sim = run.sim, fi = run.S.fi;
        if (sim.tick % 15) return;
        const on = own(sim, 1, 'forager', u => u.field === fi && u.manual).length;
        if (on < 3) { const u = own(sim, 1, 'forager', x => x.field !== fi || !x.manual)[0]; if (u) DS.assignForager(sim, u.id, fi); }
      },
      progress(run) {
        const k = run.sim.sides[1].lostBy.forager || 0;
        return { text: `Foragers ${Math.min(6, k)}/6`, done: k >= 6 };
      },
      won: 'Six Foragers down: Cobalt’s harvest is broken.',
      stars: [
        { text: 'Within 2:30', check: run => run.result.t <= 150 },
        { text: 'Use 12 Stings or fewer', check: run => (run.sim.sides[0].used.sting || 0) <= 12 },
      ],
      steps: [
        { h: 'Contact', p: () => 'A Cobalt Glint is scouting you. Blue brackets mean your sensors hold it; red means a firing solution. <b>Tap it</b>, then choose <b>Strike</b>.',
          enter: c => {
            const sim = c.sim, g = geo(sim), m = ridgeMark(sim);
            const a = DS.datan2(g.rival.y - m.y, g.rival.x - m.x), at = r => ({ x: m.x + DS.dcos(a) * r, y: m.y + DS.dsin(a) * r });
            const so = fly(c.run, 1, 'glint', 1, at(320), [at(150)]);
            c.d.ids = so ? so.units.slice() : [];
            c.S.reveal = c.d.ids;   // your Heart has caught its signal: it stays on your picture
            grant(sim, 0, 'sting', 4);
          },
          mark: c => { const u = c.sim.byId.get((c.d.ids || [])[0]); return u && u.hp > 0 ? { x: u.x, y: u.y, r: 22, label: 'CONTACT', lock: true } : null; },
          tick: c => { const u = c.sim.byId.get((c.d.ids || [])[0]); if (u && u.hp > 0) u.battery = 75; },
          check: c => !alive(c.sim, c.d.ids).length,
          hint: 'Tap the blue diamond inside the brackets. A menu offers Strike, Bomb or Intercept.', hintAfter: 12 },
        { h: 'Build', p: () => '<b>Nectar</b>, top left, pays for everything; your Foragers bring it home. Tap <b>Stings</b> in the Build tab to queue four more.', hi: '#buy-sting',
          enter: c => { c.sim.sides[0].nectar = Math.max(c.sim.sides[0].nectar, 30); c.ui.tab('build'); },
          check: c => c.sim.sides[0].queue.some(q => q.type === 'sting' && !q.auto) },
        { h: 'Strike', p: c => `Cobalt Foragers are working the marked bloom. Tap ${c.ui.sq(1)}, then drag a route from your Heart to it. Stings hunt along the route and dive on the first thing they find.`, hi: '#sq-1',
          enter: c => grant(c.sim, 0, 'sting', 4),
          mark: c => ({ x: c.S.field.x, y: c.S.field.y, r: c.S.field.r + 12, label: 'COBALT FORAGERS' }),
          check: c => [...c.sim.sorties.values()].some(so => so.side === 0 && so.type === 'sting' && so.route.length && hyp(so.route[so.route.length - 1].x, so.route[so.route.length - 1].y, c.S.field.x, c.S.field.y) < 130),
          hint: 'Press near your Heart and drag to the marked bloom before letting go. A single tap on the bloom works too.' },
        { h: 'Finish the job', p: () => 'Foragers flare while they harvest, which makes them easy to find. Keep sending Stings until six are down, and build more when you run low.', next: 'Got it' },
      ],
    },
    harvest: {
      title: 'Harvest', line: 'Build, Auto and Wardens on patrol.', seed: 5150, limit: 360,
      brief: ['Nectar pays for everything, and Foragers bring it home from the blooms.', 'Bank ◆450 of harvest while Cobalt sends raids after your Foragers. Wardens on patrol net raiders before they reach them, and parked Stings guard your Heart.'],
      goal: 'Harvest ◆450.',
      cfg: OPEN, kit: ['forager', 'glint', 'sting', 'decoy', 'warden'],
      start: { 0: { forager: 2, glint: 1, sting: 4, warden: 1 }, 1: {} }, nectar: { 0: 150, 1: 0 },
      setup(run) { run.S.h0 = run.sim.sides[0].harvested; },
      script: [50, 105, 160, 215, 270, 325].map((at, i) => ({ at, run(run) {
        const sim = run.sim, f = busiest(sim, 0), to = { x: f.x, y: f.y };
        if (i % 2 === 1) {   // a Raider bombs the bloom
          const from = fromEast(run, to);
          fly(run, 1, 'raider', 1, from, [{ x: (from.x + to.x) / 2, y: from.y }, to], { label: 'Raid' });
          if (i > 2) fly(run, 1, 'sting', 3, fromEast(run, to), [to], { mode: 'hunt', label: 'Raid' });
        } else fly(run, 1, 'sting', [3, 4, 6][i / 2] || 6, fromEast(run, to), [to], { mode: 'hunt', label: 'Raid' });
        run.msgs.push({ text: `Raid inbound on ${f.name}.`, kind: 'lock' });
      } })),
      progress(run) {
        const h = run.sim.sides[0].harvested - run.S.h0;
        return { text: `Harvest ◆${Math.min(450, Math.floor(h))}/450`, done: h >= 450 };
      },
      won: 'The vats are full and the raids came to nothing.',
      stars: [
        { text: 'Lose no more than one Forager', check: run => (run.sim.sides[0].lostBy.forager || 0) <= 1 },
        { text: 'Within 4:30', check: run => run.result.t <= 270 },
      ],
      steps: [
        { h: 'More Foragers', p: () => '<b>Nectar</b>, top left, pays for everything, and Foragers bring it home from the blooms. Tap <b>Forager</b> in the Build tab: more Foragers, more nectar.', hi: '#buy-forager',
          enter: c => c.ui.tab('build'),
          check: c => c.sim.sides[0].queue.some(q => q.type === 'forager' && !q.auto) || own(c.sim, 0, 'forager').length > 2 },
        { h: 'Auto build', p: () => 'Tapping every build gets busy in a fight. Turn on <b>Auto</b> and the hive keeps two items queued from your plan, rebuilding what you lose.', hi: '#btn-auto',
          check: c => c.sim.sides[0].auto },
        { h: 'Your plan', p: () => 'Tap <b>Plan</b> to see what Auto builds: it works down the list and builds the first row below its target. The round pauses while the plan is open; tap Done when you have had a look.', hi: '#btn-plan',
          check: c => c.ui.planSeen() },
        { h: 'Patrol', p: c => `Raids are coming for your blooms. Tap ${c.ui.sq(4)}, then tap your busiest bloom. A Warden nets drones that come near, then flies home to rearm.`, hi: '#sq-4',
          enter: c => grant(c.sim, 0, 'warden', 1),
          mark: c => { const f = busiest(c.sim, 0); return { x: f.x, y: f.y, r: f.r + 12, label: 'PATROL HERE' }; },
          check: c => own(c.sim, 0, 'warden', u => !u.parked && c.sim.map.fields.some(f => f.side === 0 && hyp(u.x, u.y, f.x, f.y) < 150)).length > 0 },
        { h: 'Keep it coming', p: () => 'Keep <b>Guard</b> on: parked Stings launch at drones that come close to your Heart. Bank ◆450 of harvest; the bar at the top counts it.', next: 'Got it' },
      ],
    },
    hold: {
      title: 'Hold', line: 'Posts, Relays and the Crown.', seed: 4242, limit: 480,
      brief: ['In Last Light the Crown bloom at the centre scores for whichever hive has more drones on it.', 'Cobalt is coming for it. Be first to 60 seconds of Crown score. A post keeps a spot staffed for you; the Crown is just beyond your Heart’s link, so a Relay goes out first.'],
      goal: 'Reach 60 Crown score before Cobalt does.',
      cfg: Object.assign({}, OPEN, { bloomOpen: 0, bloomScore: 120 }), kit: ['forager', 'glint', 'sting', 'decoy', 'warden', 'relay'],
      start: { 0: { forager: 3, glint: 1, sting: 16, decoy: 2, warden: 2, relay: 1 }, 1: {} }, nectar: { 0: 250, 1: 0 },
      script: [
        // Cobalt's Stings make for the Crown from the time it scores, a little more each wave
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ when: run => run.sim.t >= run.sim.cfg.bloomScore - 6 + i * 24, run(run) {
          const g = geo(run.sim), c = g.crown;
          fly(run, 1, 'sting', Math.min(8, 3 + i), fromEast(run, c, 260), [{ x: c.x + 18, y: c.y + (run.rnd() - 0.5) * 40 }], { mode: 'hunt', label: 'Hold' });
        } })),
        { at: 100, run(run) { raidHeart(run, 5); } },
      ],
      progress(run) {
        const a = run.sim.sides[0].score, b = run.sim.sides[1].score;
        return { text: run.sim.t < run.sim.cfg.bloomScore ? `Crown scores in ${Math.ceil(run.sim.cfg.bloomScore - run.sim.t)} s` : `Crown ${Math.floor(a)} : ${Math.floor(b)}`, done: a >= 60 };
      },
      fail: run => (run.sim.sides[1].score >= 60 ? 'Cobalt held the Crown for 60 seconds first.' : null),
      won: 'The Crown is yours.',
      stars: [
        { text: 'No hits on your Heart', check: run => !run.sim.sides[0].heartTaken },
        { text: 'Hold Cobalt under 20', check: run => run.sim.sides[1].score < 20 },
      ],
      steps: [
        { h: 'Set a post', p: () => 'A <b>post</b> is a spot the hive keeps staffed. <b>Press and hold</b> on the Crown bloom until a menu opens, choose <b>Post here</b>, then <b>Set post</b>.',
          mark: c => { const g = geo(c.sim); return { x: g.crown.x, y: g.crown.y, r: g.crown.r + 14, label: 'CROWN BLOOM' }; },
          check: c => { const g = geo(c.sim); return c.sim.sides[0].posts.some(p => hyp(p.x, p.y, g.crown.x, g.crown.y) < 140); },
          hint: 'Hold your finger or the mouse button still on the Crown for half a second. Or open the Posts tab, tap + Post, then tap the Crown.' },
        { h: 'Standing orders', p: () => 'The hive keeps the post staffed, relieving the Glint before its battery fades. The Crown is just beyond your Heart’s link, so a <b>Relay</b> flies out first to carry it. Open the <b>Posts</b> tab to see who is on station.', hi: '#tab-posts',
          check: c => c.ui.tabIs('posts') },
        { h: 'Link', p: () => 'New orders reach only drones in <b>link</b>: near your Heart, a Nest, or a Relay that is linked itself. The dashed amber edge shows it whenever you give orders. Beyond it, drones carry on with their last orders.', next: 'Next',
          enter: c => { c.d.showLink = true; },
          mark: c => { const r = own(c.sim, 0, 'relay', u => !u.parked)[0]; return r ? { x: r.x, y: r.y, r: 16, label: 'RELAY' } : null; } },
        { h: 'Raid', p: () => 'A Cobalt raid is heading for your Heart. With <b>Guard</b> on, parked Stings launch at drones that come close, and the Heart fires its flak. Watch, or send a squad yourself.', hi: '#btn-guard',
          enter: c => { if (!c.S.raid) raidHeart(c.run, 5); },
          check: c => !alive(c.sim, c.S.raid).length && c.since > 4 },
        { h: 'Hold the Crown', p: c => `The Crown scores now and Cobalt Stings are moving in. Send ${c.ui.sq(2)} or ${c.ui.sq(1)} to hold it. First to 60 wins.`,
          enter: c => { c.sim.cfg.bloomScore = Math.min(c.sim.cfg.bloomScore, c.sim.t + 3); },
          mark: c => { const g = geo(c.sim); return { x: g.crown.x, y: g.crown.y, r: DS.HOLD_R, label: 'HOLD THE CROWN' }; },
          hint: 'Tap a squad, then tap the Crown. The score is at the top.', hintAfter: 20 },
      ],
    },

    // ===== Chapter 2: Spectrum =====
    'long-reach': {
      title: 'Long reach', line: 'Carry your link across the valley.', seed: 8086, limit: 360,
      brief: ['Orders reach only drones in link: near your Heart, a Nest, or a Relay that is itself in link. Out of link, drones carry on with their last orders.', 'Cobalt watches the valley from the far ridge. Hold a post there for 45 seconds. A post out of link sends a ready Relay ahead of it, and Relays chain, so build them; Cobalt will hunt them.'],
      goal: 'Keep a post on the far ridge staffed for 45 seconds.',
      cfg: OPEN, kit: ['forager', 'glint', 'sting', 'decoy', 'warden', 'relay'],
      start: { 0: { forager: 3, glint: 1, sting: 8, warden: 2 }, 1: { forager: 2 } }, nectar: { 0: 220, 1: 0 },
      setup(run) {
        const sim = run.sim, g = geo(sim);
        const pk = byNear(g.peaks.filter(p => p.x > W * 0.55 && hyp(p.x, p.y, g.rival.x, g.rival.y) > 300), g.crown)[0] || { x: W * 0.62, y: H * 0.45 };
        run.S.spot = { x: pk.x, y: pk.y }; run.S.held = 0;
        fly(run, 1, 'glint', 1, { x: pk.x + 60, y: pk.y }, [{ x: pk.x, y: pk.y }], { label: 'Watch' });
      },
      script: [40, 80, 120, 160, 200, 240, 280, 320].map(at => ({ at, run(run) {
        // Cobalt hunts your outermost Relay
        const g = geo(run.sim), rs = own(run.sim, 0, 'relay', u => !u.parked).sort((a, b) => b.x - a.x);
        const to = rs[0] ? { x: rs[0].x, y: rs[0].y } : { x: (g.home.x + run.S.spot.x) / 2, y: run.S.spot.y };
        fly(run, 1, 'sting', 3, fromEast(run, to), [to], { mode: 'hunt', label: 'Hunt' });
      } })),
      watch(run) {
        const sim = run.sim, S0 = sim.sides[0];
        const ok = S0.posts.some(p => hyp(p.x, p.y, run.S.spot.x, run.S.spot.y) < 90 && DS.postReach(sim, 0, p) === 'ok' && Object.values(DS.postStaff(sim, 0, p)).some(v => v.on > 0));
        run.S.on = ok;
        if (ok) run.S.held += DS.DT;
      },
      progress(run) { return { text: `Post held ${Math.floor(run.S.held)}/45 s`, done: run.S.held >= 45 }; },
      won: 'Your link reaches across the valley.',
      stars: [
        { text: 'Lose no Relays', check: run => !(run.sim.sides[0].lostBy.relay) },
        { text: 'Within 3:30', check: run => run.result.t <= 210 },
      ],
      steps: [
        { h: 'The far ridge', p: () => 'Press and hold the marked ridge, choose <b>Post here</b>, and set it with a Warden. It is far beyond your link: watch the post send Relays out ahead of it. Build Relays if you have none, or turn on <b>Auto</b>.',
          mark: c => ({ x: c.S.spot.x, y: c.S.spot.y, r: 30, label: 'FAR RIDGE' }),
          check: c => c.sim.sides[0].posts.some(p => hyp(p.x, p.y, c.S.spot.x, c.S.spot.y) < 90) },
        { h: 'Keep the chain', p: () => 'Cobalt Stings hunt your outermost Relay. Lose one and everything beyond it is out of link, and the post goes unrelieved. Wardens near your Relays keep them alive.', next: 'Got it' },
      ],
    },
    static: {
      title: 'Static', line: 'Find and kill the jammers.', seed: 2718, limit: 420,
      brief: ['A Harrier jams your drones near it: they cannot report what they see, take new orders or use the hive’s picture, and a jammed post gets no relief. Sending more drones into the jamming does not fix it.', 'Killing the Harrier does, and its noise gives it away while it jams you. Three are coming, one after another.'],
      goal: 'Destroy 3 Cobalt Harriers.',
      cfg: OPEN, kit: ['forager', 'glint', 'sting', 'decoy', 'warden', 'relay', 'harrier'],
      start: { 0: { forager: 4, glint: 2, sting: 16, warden: 2, decoy: 2 }, 1: {} }, nectar: { 0: 200, 1: 0 },
      setup(run) {
        const sim = run.sim, f = geo(sim).mine[1] || geo(sim).mine[0];
        DS.addPost(sim, 0, f.x, f.y, { warden: 1 }, 1, f.name);
        run.S.wave = 0; run.S.ids = []; run.S.killed = 0; run.S.nextT = 12;
      },
      watch(run) {
        const sim = run.sim, S = run.S;
        const live = alive(sim, S.ids);
        S.killed = S.wave - live.length;
        for (const id of live) {   // they stay until killed, and move on to where your drones are if they jam nothing
          const u = sim.byId.get(id); u.stay = true; if (u.battery < 100) u.battery = 400;
          u.idleT = u.jams ? 0 : (u.idleT || 0) + DS.DT;
          const so = sim.sorties.get(u.sortie);
          if (u.idleT > 15 && so) { u.idleT = 0; const f = busiest(sim, 0); so.route = [{ x: f.x + 40, y: f.y }]; u.wp = 0; }
          reveal(sim, u);   // a Harrier this loud is never hard to find
        }
        if (!live.length && S.wave < 3 && sim.t >= S.nextT) {
          // over your blooms, where your Foragers are, so its jamming gives it away
          const g = geo(sim), at = [g.mine[1] || g.mine[0], g.mine[0], busiest(sim, 0)][S.wave];
          const p = { x: at.x + 50, y: at.y + (at.y > H / 2 ? -40 : 40) }, from = fromEast(run, p);
          const so = fly(run, 1, 'harrier', 1, from, [p], { label: 'Jam' });
          if (so) { S.ids.push(so.units[0]); sim.byId.get(so.units[0]).battery = 400; }
          fly(run, 1, 'warden', S.wave === 2 ? 2 : 1, from, [p], { label: 'Escort' });
          if (S.wave) fly(run, 1, 'sting', S.wave === 2 ? 4 : 3, from, [p], { mode: 'hunt', label: 'Escort' });
          S.wave++; S.nextT = 1e9;
          run.msgs.push({ text: `A Cobalt Harrier is jamming ${at.name}.`, kind: 'cobalt' });
        }
        if (!live.length && S.nextT === 1e9 && S.wave < 3) S.nextT = sim.t + 15;
      },
      progress(run) { return { text: `Harriers ${run.S.killed}/3`, done: run.S.killed >= 3 }; },
      won: 'The static clears.',
      stars: [
        { text: 'Lose no Wardens', check: run => !(run.sim.sides[0].lostBy.warden) },
        { text: 'Within 4:00', check: run => run.result.t <= 240 },
      ],
      steps: [
        { h: 'Static', p: () => 'A Harrier is over your post. Your drones near it are jammed: they cannot see for the hive or hear you. Its noise gives it away, so you can see it: <b>tap it</b> and <b>Strike</b>, or send Stings at it from outside the jamming.',
          mark: c => { const u = c.sim.byId.get(c.S.ids[0]); return u && u.hp > 0 ? { x: u.x, y: u.y, r: 22, label: 'HARRIER', lock: true } : null; },
          check: c => c.S.killed >= 1, hint: 'Stings on a strike that get jammed hunt with their own seekers: send enough of them.', hintAfter: 25 },
        { h: 'Two more', p: () => 'The next ones bring escorts. Wardens net Stings, so send more than you think, or bring Decoys to draw the nets. Your own <b>Harrier</b> can jam their escorts.', next: 'Got it' },
      ],
    },
    smoke: {
      title: 'Smoke', line: 'Decoys, feints and a steady Guard.', seed: 5150, limit: 240, survive: true,
      brief: ['Decoys read as Raiders until a sensor gets a close look. Cobalt will feint at your Heart with Decoys on one flank and send the real raid on the other.', 'Keep your Heart above 15 for four minutes. Keep Guard on, and do not empty your Heart chasing the first wave.'],
      goal: 'Survive 4:00 with your Heart above 15.',
      cfg: OPEN, kit: ['forager', 'glint', 'sting', 'decoy', 'warden', 'relay', 'harrier'],
      start: { 0: { forager: 3, glint: 2, sting: 16, warden: 2 }, 1: {} }, nectar: { 0: 200, 1: 0 },
      script: [35, 95, 155, 210].map((at, i) => ({ at, run(run) {
        const sg = run.rnd() < 0.5 ? 1 : -1;
        run.S.flank = sg;
        const h = run.sim.hearts[0], f1 = { x: W * 0.55, y: H / 2 + sg * 330 }, m1 = { x: W * 0.3, y: H / 2 + sg * 260 };
        fly(run, 1, 'decoy', 6, f1, [m1, { x: h.x + 50, y: h.y }], { stance: 'dash', label: 'Feint' });
        run.S.pending = { t: run.sim.t + 6, i, sg };
      } })),
      watch(run) {
        const p = run.S.pending, sim = run.sim;
        if (p && sim.t >= p.t) {
          run.S.pending = null;
          const h = sim.hearts[0], f2 = { x: W * 0.55, y: H / 2 - p.sg * 320 }, m2 = { x: W * 0.32, y: H / 2 - p.sg * 230 };
          fly(run, 1, 'sting', [8, 10, 12, 12][p.i], f2, [m2, { x: h.x, y: h.y }], { mode: 'raid', target: h.id, label: 'Raid' });
          if (p.i >= 2) fly(run, 1, 'decoy', 4, f2, [m2, { x: h.x + 40, y: h.y }], { stance: 'dash', label: 'Decoys' });
          if (p.i === 3) fly(run, 1, 'harrier', 1, f2, [{ x: h.x + 260, y: h.y - p.sg * 120 }], { label: 'Jam' });
        }
      },
      progress(run) {
        const sim = run.sim;
        return { text: `Hold ${Math.max(0, Math.ceil(240 - sim.t))} s · Heart ${sim.hearts[0].hp}`, done: false };
      },
      fail: run => (run.sim.hearts[0].hp <= 15 ? 'Your Heart fell to 15.' : null),
      won: 'The smoke clears and your Heart stands.',
      stars: [
        { text: 'Your Heart takes fewer than 6 hits', check: run => run.sim.sides[0].heartTaken < 6 },
        { text: 'See through 8 Decoys', check: run => run.sim.sides[0].revealed >= 8 },
      ],
      steps: [
        { h: 'Look first', p: () => 'Raids are coming, some of them fake. A Decoy shows as a Raider until a sensor sees it close, then it is marked DECOY. A Glint perched between your Heart and the flanks sees them early.', next: 'Got it' },
      ],
    },
    'nest-breaker': {
      title: 'Nest-breaker', line: 'Raiders, forward Nests and Decoys.', seed: 3301, limit: 480,
      brief: ['Raiders carry three bombs for anything that sits still, then fly home to rearm at the nearest base.', 'Cobalt has two Nests on its flanks, watched by Wardens. Destroy both. A forward Nest of your own shortens every trip, and Decoys draw the Wardens’ nets.'],
      goal: 'Destroy both Cobalt Nests.',
      cfg: OPEN, kit: ALL,
      start: { 0: { forager: 4, glint: 1, sting: 8, raider: 2, decoy: 4, warden: 1 }, 1: { forager: 2, sting: 6, warden: 2 } }, nectar: { 0: 300, 1: 0 },
      setup(run) {
        const sim = run.sim, g = geo(sim);
        const spots = [{ x: W * 0.74, y: H * 0.24 }, { x: W * 0.74, y: H * 0.76 }].map(p => {
          for (let k = 0; k < 40; k++) { const q = { x: p.x + ((k % 7) - 3) * 22, y: p.y + (Math.floor(k / 7) - 3) * 22 }; if (!DS.ridgeAt(sim.map, q.x, q.y) && !sim.map.fields.some(f => hyp(f.x, f.y, q.x, q.y) < f.r + 30)) return q; }
          return p;
        });
        run.S.nests = spots.map(p => nest(sim, 1, p.x, p.y).id);
        for (const p of spots) DS.addPost(sim, 1, p.x, p.y, { warden: 1 }, 1, 'Nest');
        void g;
      },
      progress(run) {
        const k = run.S.nests.length - alive(run.sim, run.S.nests).length;
        return { text: `Nests ${k}/2`, done: k >= 2 };
      },
      won: 'Both Nests are rubble.',
      stars: [
        { text: 'Lose no Raiders', check: run => !(run.sim.sides[0].lostBy.raider) },
        { text: 'Within 5:00', check: run => run.result.t <= 300 },
      ],
      steps: [
        { h: 'Bombing run', p: c => `Find the Nests with a Glint first: a Raider needs to know where to go. Then tap ${c.ui.sq(3)} and tap a Nest, or drag a route around the Wardens to it. Decoys in the squad run ahead and draw their nets.`, next: 'Got it' },
      ],
    },

    // ===== Chapter 3: Rivals =====
    reaper: {
      title: 'Reaper', line: 'Weather an early swarm, then win.', seed: 5150, full: true, rival: 'reaper',
      brief: ['Reaper hives swarm early: Stings and Decoys, raids early and often, and a flood onto the Crown before it scores.', 'This one has a head start. Win the round, by Crown score at frost or by destroying the Cobalt Heart.'],
      goal: 'Win the round.',
      start: { 1: { forager: 2, glint: 1, sting: 12, decoy: 2 } },
      setup(run) { const ai = run.sim.ai[1]; if (ai) ai.raidT = 75; },
      progress(run) { const s = run.sim.sides; return { text: `Crown ${Math.floor(s[0].score)} : ${Math.floor(s[1].score)}`, done: false }; },
      won: 'The swarm broke on your Heart.',
      stars: [
        { text: 'Your Heart never drops below 20', check: run => run.minHp >= 20 },
        { text: 'Lose no more than 4 Foragers', check: run => (run.sim.sides[0].lostBy.forager || 0) <= 4 },
      ],
    },
    bulwark: {
      title: 'Bulwark', line: 'Break a fortress before frost.', seed: 8086, full: true, rival: 'bulwark', limit: 720,
      brief: ['Bulwark hives turtle behind Wardens and posts, and this one has had time to dig in: two Nests, Wardens on post and a Harrier over the Crown.', 'There is no Crown score this time. Destroy the Cobalt Heart before frost.'],
      goal: 'Destroy the Cobalt Heart.',
      cfg: { bloomScore: 1e9, noFrost: true }, heartHp: { 1: 20 }, nectar: { 0: 450 },
      start: { 1: { forager: 4, glint: 1, sting: 8, warden: 3, relay: 1 } },
      setup(run) {
        const sim = run.sim;
        for (const p of [{ x: W * 0.7, y: H * 0.3 }, { x: W * 0.7, y: H * 0.7 }]) {
          for (let k = 0; k < 40; k++) { const q = { x: p.x + ((k % 7) - 3) * 22, y: p.y + (Math.floor(k / 7) - 3) * 22 }; if (!DS.nestSiteError(sim, 1, q.x, q.y)) { nest(sim, 1, q.x, q.y); break; } }
        }
      },
      progress(run) { return { text: `Cobalt Heart ${run.sim.hearts[1].hp}`, done: false }; },
      won: 'The fortress falls.',
      stars: [
        { text: 'With 3:00 or more left', check: run => run.result.t <= 540 },
        { text: 'Lose no more than 2 Raiders', check: run => (run.sim.sides[0].lostBy.raider || 0) <= 2 },
      ],
    },
    'two-faces': {
      title: 'Two faces', line: 'A rival that changes its play.', seed: 2718, full: true, rival: 'listener',
      brief: ['The best hives change their play. This one opens as a Listener, eyes everywhere and precise strikes, and at the halfway mark it turns Mimic: Decoys and feints.', 'You start with a stronger hive: four Foragers, eight Stings and a Warden. Win the round.'],
      goal: 'Win the round.',
      start: { 0: { forager: 4, glint: 1, sting: 8, warden: 1 } },
      script: [{ at: 360, run(run) { DS.setAI(run.sim, 1, run.sim.diff, 'mimic'); run.S.turned = true; run.msgs.push({ text: 'Cobalt has turned Mimic: expect feints and Decoys.', kind: 'cobalt' }); } }],
      progress(run) { const s = run.sim.sides; return { text: `Crown ${Math.floor(s[0].score)} : ${Math.floor(s[1].score)}`, done: false }; },
      won: 'Neither face fooled you.',
      stars: [
        { text: 'Win by Crown score of 100 or more', check: run => run.sim.sides[0].score >= 100 },
        { text: 'Cost exchange 2 : 1 or better', check: run => run.sim.sides[0].destroyed / Math.max(1, run.sim.sides[0].lost) >= 2 },
      ],
    },
  };
  // a raid on your Heart from the far flank, as the coach and the script both use it
  function raidHeart(run, n) {
    const sim = run.sim, h = sim.hearts[0], side = h.y < H / 2 ? -1 : 1;
    const from = { x: h.x + 520, y: h.y + side * 330 }, mid = { x: h.x + 300, y: h.y + side * 230 };
    const so = fly(run, 1, 'sting', n, from, [mid, { x: h.x, y: h.y }], { mode: 'raid', target: h.id, label: 'Raid' });
    run.S.raid = so ? so.units.slice() : [];
    run.msgs.push({ text: 'Raid inbound on your Heart.', kind: 'lock' });
  }

  const ORDER = [];
  CHAPTERS.forEach(ch => ch.scenarios.forEach((id, i) => { const sc = SCENARIOS[id]; sc.id = id; sc.chapter = ch.n; sc.n = i + 1; ORDER.push(id); }));

  // ---------- running a scenario ----------
  function start(id, opts) {
    opts = opts || {};
    const sc = SCENARIOS[id];
    const cfg = sc.full ? Object.assign({}, sc.cfg || {}) : Object.assign({}, OPEN, sc.cfg || {});
    const sim = DS.createSim({
      seed: sc.seed, mode: 'short', diff: opts.diff || sc.diff || 'normal', cfg,
      ai: sc.rival ? [1] : [], aiStyle: sc.rival ? { 1: sc.rival } : null,
      kit: sc.kit ? { 0: sc.kit } : null, start: sc.start, nectar: sc.nectar, heartHp: sc.heartHp,
    });
    const run = { id, sc, sim, S: {}, rnd: DS.mulberry32((sc.seed ^ 0x9e3779b9) >>> 0), fired: new Set(), result: null, prog: { text: '', done: false }, msgs: [], minHp: sim.hearts[0].hp };
    sim.hook = () => tick(run);
    if (sc.setup) sc.setup(run);
    run.prog = sc.progress(run);
    return run;
  }
  function tick(run) {
    const sim = run.sim, sc = run.sc;
    if (run.result) return;
    if (sim.over) { settle(run); return; }
    for (const ev of sc.script || []) {
      if (run.fired.has(ev)) continue;
      if (ev.when ? ev.when(run) : sim.t >= ev.at) { run.fired.add(ev); ev.run(run); }
    }
    if (sc.watch) sc.watch(run);
    for (const id of run.S.reveal || []) { const u = sim.byId.get(id); if (u && u.hp > 0) reveal(sim, u); }   // units a scenario wants found
    run.minHp = Math.min(run.minHp, sim.hearts[0].hp);
    run.prog = sc.progress(run);
    if (run.prog.done) return finish(run, true, 'objective');
    const f = sc.fail ? sc.fail(run) : null;
    if (f) return finish(run, false, f);
    if (sc.limit && sim.t >= sc.limit) return finish(run, !!sc.survive, sc.survive ? 'survived' : 'Out of time.');
  }
  function finish(run, won, reason) {
    const sim = run.sim, sc = run.sc;
    run.result = { won, reason, t: sim.t };
    run.result.stars = [won].concat(sc.stars.map(st => won && !!st.check(run)));
    run.result.text = won ? sc.won : reason;
    if (!sim.over) DS.endGame(sim, won ? 0 : 1, won ? 'objective' : 'failed');
  }
  // a round that ended by itself (a Heart destroyed, or frost in a full round)
  function settle(run) {
    if (run.result || !run.sim.over) return run.result;
    const sim = run.sim, won = sim.winner === 0;
    finish(run, won, won ? 'won' : sim.reason === 'heart' ? 'Your Heart has fallen.' : 'Cobalt won the round.');
    if (won && sim.reason === 'heart') run.result.text = 'Cobalt Heart destroyed. ' + run.sc.won;
    return run.result;
  }
  const next = id => ORDER[ORDER.indexOf(id) + 1] || null;
  const chapterOf = id => CHAPTERS.find(ch => ch.scenarios.includes(id));

  // ---------- progress (the page keeps it in the browser) ----------
  // progress: { [id]: { won: bool, stars: [bool, bool, bool] } }. A scenario is open once the one before it is won.
  const isOpen = (prog, id) => { const i = ORDER.indexOf(id); return i === 0 || !!(prog[ORDER[i - 1]] && prog[ORDER[i - 1]].won); };
  function record(prog, run) {
    const r = settle(run) || run.result, old = prog[run.id] || { won: false, stars: [false, false, false] };
    prog[run.id] = { won: old.won || r.won, stars: old.stars.map((s, i) => s || !!r.stars[i]) };
    return prog;
  }
  const starCount = (prog, ids) => (ids || ORDER).reduce((n, id) => n + ((prog[id] && prog[id].stars.filter(Boolean).length) || 0), 0);

  root.CAMP = { CHAPTERS, SCENARIOS, ORDER, start, settle, next, chapterOf, isOpen, record, starCount, clock, geo, own, alive, hyp };
})(typeof window !== 'undefined' ? window : globalThis);
