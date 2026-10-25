// Scripted players against each difficulty: turtle (only defends), active (contests the Crown), m2 (also uses the
// milestone 2 units), command (sets a production plan with Auto and posts, then only strikes and holds).
// node players.js [short|duel] [easy,normal,hard] [turtle,active,m2,command]
// Run from anywhere: node _tools/drone-season/test/players.js
const path = require('path');
require(path.join(__dirname, '..', 'src', 'sim.js'));
const DS = globalThis.DS;
function play(seed, diff, style, mode) {
  const sim = DS.createSim({ seed, diff, mode, ai: [1] });
  const C = sim.cfg, cf = sim.map.fields[sim.map.fields.length - 1];
  let next = 0, lastScout = -99, lastStrike = -99, lastHold = -99, lastRaid = -99, lastWard = -99, nestTried = false, crownPost = false;
  if (style === 'command') {
    // the Balanced preset; a post on the Crown goes up before Last Light
    DS.setPlan(sim, 0, [['forager', 5], ['glint', 1], ['sting', 8], ['warden', 1], ['raider', 1], ['decoy', 2], ['sting', 16], ['warden', 2], ['sting', 28]]);
    DS.setAuto(sim, 0, true);
  }
  while (!sim.over) {
    DS.step(sim); sim.events.length = 0;
    if (sim.t < next) continue;
    next = sim.t + 1.0;
    const S = sim.sides[0];
    const nF = DS.forceCount(sim, 0, 'forager');
    const plan = style === 'm2'
      ? [['forager', 4], ['glint', 1], ['sting', 8], ['warden', 1], ['raider', 1], ['forager', 5], ['decoy', 2], ['sting', 16], ['warden', 2]]
      : [['forager', 4], ['glint', 1], ['sting', 30]];
    if (style === 'turtle') DS.maintain(sim, 0, [['forager', 4], ['sting', 40]], 2); else if (style !== 'command') DS.maintain(sim, 0, plan, 2);
    if (style === 'turtle') continue;
    if (style === 'command' && !crownPost && sim.t > C.bloomScore - 45) { crownPost = true; DS.addPost(sim, 0, cf.x, cf.y, { glint: 1, warden: 2 }, 2, 'Crown'); }
    if (sim.t - lastScout > 30 && DS.parkedCount(sim, 0, 'glint')) { lastScout = sim.t; DS.launch(sim, 0, 'glint', 1, [{ x: 560 + Math.random() * 300, y: 300 + Math.random() * 400 }], {}); }
    if (sim.t - lastStrike > 6) {
      for (const c of S.pic.values()) {
        if (c.grade >= 2 && c.known && !c.static && (c.type === 'forager' || c.type === 'glint' || c.type === 'raider') && DS.parkedCount(sim, 0, 'sting') >= 8 && DS.targetedBy(sim, 0, c.id) === 0) {
          DS.launch(sim, 0, 'sting', 4, [], { mode: 'strike', target: c.id }); lastStrike = sim.t; break;
        }
      }
    }
    if (style === 'm2') {
      if (!nestTried && sim.t > 150 && S.nectar > 100) { nestTried = true; for (let x = 420; x < 600; x += 20) { const p = { x, y: 500 }; if (!DS.nestSiteError(sim, 0, p.x, p.y)) { DS.build(sim, 0, 'nest', p); break; } } }
      if (sim.t - lastWard > 10 && DS.parkedCount(sim, 0, 'warden')) {
        lastWard = sim.t;
        const spot = sim.t > C.bloomScore - 20 ? cf : sim.map.fields[0];
        DS.launch(sim, 0, 'warden', 1, [{ x: spot.x, y: spot.y }], {});
      }
      if (sim.t - lastRaid > 25 && DS.parkedCount(sim, 0, 'raider')) {
        const f = sim.map.fields.filter(f => f.side === 1)[Math.floor(Math.random() * 3)];
        lastRaid = sim.t; DS.launch(sim, 0, 'raider', 1, [{ x: f.x, y: f.y }], {});
      }
    }
    if (sim.t > C.bloomScore - 8 && sim.t - lastHold > 10 && DS.parkedCount(sim, 0, 'sting') >= 6) { lastHold = sim.t; DS.launch(sim, 0, 'sting', 6, [{ x: cf.x, y: cf.y }], { mode: 'hunt' }); }
  }
  const [a, b] = sim.sides;
  return { win: sim.winner, why: sim.reason, t: Math.round(sim.t), hp: sim.hearts.map(h => h.hp), score: [a.score | 0, b.score | 0] };
}
const mode = process.argv[2] || 'short';
for (const diff of (process.argv[3] || 'easy,normal,hard').split(',')) {
  for (const style of (process.argv[4] || 'turtle,active,m2,command').split(',')) {
    let w = 0, heart = 0; const eg = [];
    for (let s = 1; s <= 8; s++) { const r = play(s * 4241, diff, style, mode); if (r.win === 0) w++; if (r.why === 'heart' && r.win === 1) heart++; if (s <= 2) eg.push(r); }
    console.log(mode, diff.padEnd(6), style.padEnd(7), 'player wins', w, '/ 8', ' heart lost', heart, ' e.g.', JSON.stringify(eg[0]));
  }
}
