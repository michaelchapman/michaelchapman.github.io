// The campaign, headless: every scenario is lost (or not won) by a player who does nothing, and won by a scripted
// player who plays it sensibly. node campaign.js [scenario ids, comma separated]
// Run from anywhere: node _tools/drone-season/test/campaign.js
const path = require('path');
require(path.join(__dirname, '..', 'src', 'sim.js'));
require(path.join(__dirname, '..', 'src', 'campaign.js'));
const DS = globalThis.DS, CAMP = globalThis.CAMP;
const W = DS.W, H = DS.H, hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ready = (sim, t) => DS.parkedCount(sim, 0, t);
const known = (sim, type) => [...sim.sides[0].pic.values()].filter(c => c.type === type && c.known && (c.static || c.grade >= 2) && sim.byId.get(c.id));
const strike = (sim, c, k) => ready(sim, 'sting') >= k && DS.targetedBy(sim, 0, c.id) === 0 && DS.launch(sim, 0, 'sting', k, [], { mode: 'strike', target: c.id, stance: 'dash' });
const keep = (sim, list) => DS.maintain(sim, 0, list, 2);
function play(id, solver, limit) {
  const run = CAMP.start(id), sim = run.sim, st = {};
  let next = 0;
  while (!sim.over && sim.t < (limit || 1500)) {
    DS.step(sim); sim.events.length = 0; run.msgs.length = 0;
    if (solver && sim.t >= next) { next = sim.t + 0.5; solver(run, sim, st); }
  }
  return CAMP.settle(run) || { won: false, reason: 'still running at ' + Math.round(sim.t), stars: [] };
}
const g = sim => CAMP.geo(sim);
const SOLVE = {
  eyes(run, sim, st) {
    st.i = st.i || 0;
    const sweeps = [[{ x: 880, y: 160 }, { x: 1150, y: 120 }], [{ x: 880, y: 840 }, { x: 1150, y: 880 }], [{ x: 950, y: 500 }, { x: 1100, y: 700 }], [{ x: 950, y: 300 }, { x: 1100, y: 260 }]];
    if (ready(sim, 'glint') && sim.t - (st.last || -99) > 6) { st.last = sim.t; DS.launch(sim, 0, 'glint', 1, sweeps[st.i++ % sweeps.length], {}); }
    keep(sim, [['glint', 3]]);
  },
  'first-blood'(run, sim, st) {
    for (const c of known(sim, 'forager')) if (strike(sim, c, 2)) break;
    if (ready(sim, 'sting') >= 4 && sim.t - (st.h || -99) > 12) { st.h = sim.t; DS.launch(sim, 0, 'sting', 4, [{ x: run.S.field.x, y: run.S.field.y }], { mode: 'hunt' }); }
    keep(sim, [['sting', 16]]);
  },
  harvest(run, sim, st) {
    if (!st.init) { st.init = 1; DS.setAuto(sim, 0, true); DS.setPlan(sim, 0, [['forager', 7], ['warden', 2], ['sting', 8], ['forager', 9], ['sting', 12]]); }
    for (const f of g(sim).mine.slice(0, 2)) if (ready(sim, 'warden') && ![...sim.sorties.values()].some(so => so.side === 0 && so.type === 'warden' && so.route.length && hyp(so.route[so.route.length - 1], f) < 60)) DS.launch(sim, 0, 'warden', 1, [{ x: f.x, y: f.y }], {});
  },
  hold(run, sim, st) {
    const c = g(sim).crown;
    if (!st.init) { st.init = 1; DS.setAuto(sim, 0, true); DS.setPlan(sim, 0, [['sting', 24], ['warden', 3]]); DS.addPost(sim, 0, c.x, c.y, { warden: 2, glint: 1 }, 2, 'Crown'); }
    if (sim.t > sim.cfg.bloomScore - 15 && ready(sim, 'sting') >= 6 && sim.presence[0] <= sim.presence[1] + 2) DS.launch(sim, 0, 'sting', 6, [{ x: c.x, y: c.y }], { mode: 'hunt' });
  },
  'long-reach'(run, sim, st) {
    if (!st.init) { st.init = 1; DS.setAuto(sim, 0, true); DS.setPlan(sim, 0, [['relay', 3], ['warden', 3], ['sting', 12]]); DS.addPost(sim, 0, run.S.spot.x, run.S.spot.y, { warden: 1 }, 2, 'Ridge'); }
    for (const r of CAMP.own(sim, 0, 'relay', u => !u.parked)) if (ready(sim, 'warden') && !CAMP.own(sim, 0, 'warden', w => !w.parked && hyp(w, r) < 80).length && ready(sim, 'warden') > 1) DS.launch(sim, 0, 'warden', 1, [{ x: r.x, y: r.y }], {});
    for (const c of [...sim.sides[0].pic.values()].filter(c => c.grade >= 2 && c.type === 'sting')) { if (strike(sim, c, 2)) break; }
  },
  static(run, sim, st) {
    if (!st.init) { st.init = 1; DS.setAuto(sim, 0, true); DS.setPlan(sim, 0, [['sting', 24], ['decoy', 4]]); }
    for (const c of known(sim, 'harrier')) {
      if (DS.targetedBy(sim, 0, c.id) < 4 && ready(sim, 'sting') >= 10) DS.launch(sim, 0, 'sting', 10, [], { mode: 'strike', target: c.id, stance: 'dash' });
    }
    for (const c of known(sim, 'warden')) if (strike(sim, c, 3)) break;
  },
  smoke(run, sim, st) {
    const h = g(sim).home;
    if (!st.init) { st.init = 1; DS.setAuto(sim, 0, true); DS.setPlan(sim, 0, [['sting', 24], ['warden', 3], ['glint', 2]]); DS.addPost(sim, 0, h.x + 150, h.y, { warden: 2, glint: 1 }, 2, 'Heart'); }
  },
  'nest-breaker'(run, sim, st) {
    if (!st.init) { st.init = 1; DS.setAuto(sim, 0, true); DS.setPlan(sim, 0, [['raider', 3], ['decoy', 6], ['sting', 16], ['glint', 2]]); }
    const nests = known(sim, 'nest');
    if (nests.length < 2 && ready(sim, 'glint') && sim.t - (st.g || -99) > 15) { st.g = sim.t; DS.launch(sim, 0, 'glint', 1, [{ x: 950, y: 260 }, { x: 1120, y: 500 }, { x: 950, y: 760 }], {}); }
    for (const c of nests) {
      if (ready(sim, 'raider') >= 1 && sim.t - (st.r || -99) > 8) {
        st.r = sim.t;
        if (ready(sim, 'decoy') >= 2) DS.launch(sim, 0, 'decoy', 2, [{ x: c.x - 120, y: c.y }, { x: c.x, y: c.y }], { stance: 'dash' });
        DS.launch(sim, 0, 'raider', Math.min(2, ready(sim, 'raider')), [{ x: c.x - 150, y: c.y + (c.y > H / 2 ? 120 : -120) }, { x: c.x, y: c.y }], { mode: 'raid', target: c.id });
        if (ready(sim, 'sting') >= 8) DS.launch(sim, 0, 'sting', 8, [{ x: c.x, y: c.y }], { mode: 'raid', target: c.id });
      }
      break;
    }
  },
};
// a fair scripted player for the full rounds: the 'm2' player from players.js, plus raids on the Heart when it has the Stings
function rounds(run, sim, st) {
  const S = sim.sides[0], C = sim.cfg, cf = g(sim).crown, eh = sim.hearts[1];
  keep(sim, [['forager', 4], ['glint', 1], ['sting', 8], ['warden', 1], ['raider', 1], ['forager', 5], ['decoy', 2], ['sting', 16], ['warden', 2], ['raider', 2], ['sting', 28]]);
  if (sim.t - (st.scout || -99) > 30 && ready(sim, 'glint')) { st.scout = sim.t; DS.launch(sim, 0, 'glint', 1, [{ x: 560 + Math.random() * 300, y: 300 + Math.random() * 400 }], {}); }
  if (sim.t - (st.strike || -99) > 6) for (const c of known(sim, 'forager').concat(known(sim, 'glint'), known(sim, 'raider'), known(sim, 'harrier'))) if (!c.static && ready(sim, 'sting') >= 8 && strike(sim, c, 4)) { st.strike = sim.t; break; }
  if (sim.t - (st.ward || -99) > 10 && ready(sim, 'warden')) { st.ward = sim.t; const sp = sim.t > C.bloomScore - 20 ? cf : g(sim).mine[0]; DS.launch(sim, 0, 'warden', 1, [{ x: sp.x, y: sp.y }], {}); }
  if (sim.t - (st.raid || -99) > 25 && ready(sim, 'raider')) { const f = g(sim).theirs[Math.floor(Math.random() * 3)]; st.raid = sim.t; DS.launch(sim, 0, 'raider', 1, [{ x: f.x, y: f.y }], {}); }
  if (sim.t > C.bloomScore - 8 && sim.t - (st.hold || -99) > 10 && ready(sim, 'sting') >= 6) { st.hold = sim.t; DS.launch(sim, 0, 'sting', 6, [{ x: cf.x, y: cf.y }], { mode: 'hunt' }); }
  if ((C.bloomScore > 1e8 || sim.t > 200) && ready(sim, 'sting') >= 18 && sim.t - (st.heart || -99) > 40) {
    st.heart = sim.t;
    if (ready(sim, 'decoy')) DS.launch(sim, 0, 'decoy', 'all', [{ x: W / 2, y: 150 }, { x: eh.x - 60, y: eh.y }], { stance: 'dash' });
    DS.launch(sim, 0, 'sting', 16, [{ x: W / 2, y: 150 }, { x: eh.x - 200, y: eh.y - 150 }, { x: eh.x, y: eh.y }], { mode: 'raid', target: eh.id });
    if (ready(sim, 'raider')) DS.launch(sim, 0, 'raider', 'all', [{ x: W / 2, y: 150 }, { x: eh.x, y: eh.y }], { mode: 'raid', target: eh.id });
  }
}
for (const k of ['reaper', 'bulwark', 'two-faces']) SOLVE[k] = rounds;

const only = process.argv[2] ? process.argv[2].split(',') : CAMP.ORDER;
const checks = [];
const ok = (name, cond, info) => checks.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : ''));
let seedR = 1;
for (const id of only) {
  const idle = play(id, null);
  const tries = CAMP.SCENARIOS[id].full ? (+process.env.TRIES || 4) : 1;
  let wins = 0, best = null;
  for (let k = 0; k < tries; k++) {
    let a = (seedR++ * 2654435761) >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const r = play(id, SOLVE[id]);
    if (r.won) wins++;
    if (!best || (r.won && !best.won)) best = r;
  }
  ok(`${id}: doing nothing does not win`, !idle.won, `${idle.reason} at ${Math.round(idle.t || 0)} s`);
  ok(`${id}: a scripted player wins${tries > 1 ? ` (${wins}/${tries})` : ''}`, wins > 0, `${best.won ? 'won' : best.reason} at ${Math.round(best.t || 0)} s, stars ${JSON.stringify(best.stars)}`);
}
console.log(checks.join('\n'));
console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
