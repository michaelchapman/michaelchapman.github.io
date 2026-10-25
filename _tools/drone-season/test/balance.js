// Computer against computer: win split, how often a Heart falls, and how much each new unit gets used.
// node balance.js [short|duel] [rounds]
// Run from anywhere: node _tools/drone-season/test/balance.js
const path = require('path');
require(path.join(__dirname, '..', 'src', 'sim.js'));
const DS = globalThis.DS;
function run(seed, mode, diffs, ai) {
  const t0 = Date.now();
  const sim = DS.createSim({ seed, mode, diff: 'normal', ai: ai || [0, 1], aiDiff: diffs || { 0: 'normal', 1: 'normal' } });
  const ev = {}, built = {};
  let maxUnits = 0;
  while (!sim.over) {
    DS.step(sim);
    for (const e of sim.events) { ev[e.k] = (ev[e.k] || 0) + 1; if (e.k === 'built') built[e.type] = (built[e.type] || 0) + 1; }
    sim.events.length = 0;
    maxUnits = Math.max(maxUnits, sim.units.length);
  }
  const [a, b] = sim.sides;
  return { seed, mode, t: Math.round(sim.t), win: sim.winner, why: sim.reason, hp: sim.hearts.map(h => h.hp),
    score: [a.score | 0, b.score | 0], harv: [a.harvested | 0, b.harvested | 0],
    lostBy: [a.lostBy, b.lostBy], heartBy: [a.heartTakenBy, b.heartTakenBy], rec: [a.recovered, b.recovered], decoyDrew: [a.decoyDrew, b.decoyDrew],
    maxUnits, ms: Date.now() - t0, ev, built };
}
const mode = process.argv[2] || 'short', n = +(process.argv[3] || 10);
const wins = [0, 0, 0]; let heartEnds = 0, ms = 0;
const agg = {};
for (let s = 1; s <= n; s++) {
  const r = run(s * 7919, mode);
  wins[r.win + 1]++; if (r.why === 'heart') heartEnds++; ms += r.ms;
  for (const k of ['bomb', 'net', 'decoyReveal', 'landed', 'rearmed', 'nestHit']) agg[k] = (agg[k] || 0) + (r.ev[k] || 0);
  for (const [k, v] of Object.entries(r.built)) agg['built_' + k] = (agg['built_' + k] || 0) + v;
  if (s <= 3) console.log(JSON.stringify({ seed: r.seed, t: r.t, win: r.win, why: r.why, hp: r.hp, score: r.score, harv: r.harv, lostBy: r.lostBy, heartBy: r.heartBy, rec: r.rec, decoyDrew: r.decoyDrew, maxUnits: r.maxUnits, ms: r.ms }));
}
console.log(mode, 'draw/amber/cobalt', wins, 'heart ends', heartEnds, 'avg ms', Math.round(ms / n));
console.log('per round avg', Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, +(v / n).toFixed(1)])));
