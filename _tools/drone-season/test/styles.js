// The four rival styles against each other, computer against computer: each pairing played from both sides.
// Prints each style's overall win rate (the milestone 4 gate: none above about 60%), the pairings, and how each
// style plays: what it builds, how often it raids and bombs, its Crown score, and what it adapted to.
// node styles.js [short|duel] [games per pairing and side] [diff]
// Run from anywhere: node _tools/drone-season/test/styles.js
const path = require('path');
require(path.join(__dirname, '..', 'src', 'sim.js'));
const DS = globalThis.DS;
const mode = process.argv[2] || 'short', n = +(process.argv[3] || 4), diff = process.argv[4] || 'normal';
const K = DS.STYLE_KEYS;
const wins = {}, games = {}, pair = {}, how = {};
for (const k of K) { wins[k] = 0; games[k] = 0; how[k] = { built: {}, raids: 0, bombs: 0, score: 0, harv: 0, lost: 0, left: 0, heartKills: 0, notes: {}, n: 0 }; }
let seed = 1;
for (let i = 0; i < K.length; i++) for (let j = i; j < K.length; j++) {
  const a = K[i], b = K[j];
  let wa = 0, wb = 0;
  for (let g = 0; g < n; g++) for (const flip of [false, true]) {
    const st = flip ? { 0: b, 1: a } : { 0: a, 1: b };
    const sim = DS.createSim({ seed: (seed++) * 6151, mode, ai: [0, 1], aiDiff: { 0: diff, 1: diff }, aiStyle: st });
    const ev = [{}, {}];
    while (!sim.over) {
      DS.step(sim);
      for (const e of sim.events) {
        if (e.k === 'built' && e.side != null) ev[e.side]['b_' + e.type] = (ev[e.side]['b_' + e.type] || 0) + 1;
        if (e.k === 'bomb' && e.side != null) ev[e.side].bomb = (ev[e.side].bomb || 0) + 1;
      }
      sim.events.length = 0;
    }
    for (const s of [0, 1]) {
      const k = st[s], H = how[k], ai = sim.ai[s];
      H.n++; H.raids += ai.raids; H.harv += sim.sides[s].harvested | 0; H.left += sim.sides[s].nectar | 0; H.lost += Object.values(sim.sides[s].lostBy || {}).reduce((a, v) => a + v, 0); H.bombs += ev[s].bomb || 0; H.score += sim.sides[s].score | 0;
      if (sim.reason === 'heart' && sim.winner === s) H.heartKills++;
      for (const [t, v] of Object.entries(ev[s])) if (t.startsWith('b_')) H.built[t.slice(2)] = (H.built[t.slice(2)] || 0) + v;
      for (const nt of ai.notes) H.notes[nt.text] = (H.notes[nt.text] || 0) + 1;
      if (a !== b) { games[k]++; if (sim.winner === s) wins[k]++; }
    }
    if (a !== b) { if (sim.winner === (flip ? 1 : 0)) wa++; else if (sim.winner === (flip ? 0 : 1)) wb++; }
  }
  if (a !== b) pair[`${a} v ${b}`] = `${wa}-${wb}`;
}
console.log(mode, diff, `${n * 2} games per pairing`);
for (const k of K) console.log(k.padEnd(9), 'wins', `${wins[k]}/${games[k]}`, `${Math.round((100 * wins[k]) / Math.max(1, games[k]))}%`);
console.log(pair);
for (const k of K) {
  const H = how[k], per = v => +(v / H.n).toFixed(1);
  console.log(k, JSON.stringify({ harvest: per(H.harv), unspent: per(H.left), lost: per(H.lost), raids: per(H.raids), bombs: per(H.bombs), crown: per(H.score), heartKills: H.heartKills, built: Object.fromEntries(Object.entries(H.built).map(([t, v]) => [t, per(v)])), adapted: H.notes }));
}
