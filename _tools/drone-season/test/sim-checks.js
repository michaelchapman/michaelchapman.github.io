// Quick checks of unit behaviour in the simulation. node sim-checks.js
const path = require('path');
require(path.join(__dirname, '..', 'src', 'sim.js'));
const DS = globalThis.DS;
const checks = [];
const ok = (name, cond, info) => checks.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : ''));

// A Raider sent on a bombing run along a drawn route flies the route, not straight at the target.
for (const raidOn of ['heart', 'nest']) {
  const sim = DS.createSim({ seed: 4241, mode: 'short', ai: [] });
  for (let i = 0; i < 10; i++) DS.step(sim);
  const h = sim.hearts[0], eh = sim.hearts[1];
  let tgt = eh;
  if (raidOn === 'nest') { tgt = DS.spawnUnit(sim, 1, 'nest', 1000, 300, { parked: false, state: 'nest', hdg: 0 }); sim.sides[0].pic.set(tgt.id, { id: tgt.id, grade: 2, x: tgt.x, y: tgt.y, gx: tgt.x, gy: tgt.y, vx: 0, vy: 0, type: 'nest', known: true, static: true, first: 0, seenT: 0, trackT: 0, lockUntil: 0, held: 9, jitT: 0 }); }
  DS.spawnUnit(sim, 0, 'raider', h.x, h.y);
  const route = [{ x: 400, y: 850 }, { x: 750, y: 900 }, { x: tgt.x, y: tgt.y }];
  const so = DS.launch(sim, 0, 'raider', 1, route, { mode: 'raid', target: tgt.id });
  const u = sim.byId.get(so.units[0]);
  let near = [false, false], minY = 1e9;
  for (let i = 0; i < 30 * 40 && u.hp > 0 && !u.homing; i++) {
    DS.step(sim);
    route.slice(0, 2).forEach((p, k) => { if (Math.hypot(u.x - p.x, u.y - p.y) < 30) near[k] = true; });
    if (u.wp < 2) minY = Math.min(minY, u.y);
  }
  ok(`a Raider raiding the ${raidOn} passes each waypoint of its route`, near.every(Boolean), JSON.stringify(near));
  ok(`and does not cut straight across first`, minY > 480, `lowest y before the last leg ${Math.round(minY)}`);
}
// Retasking a Raider onto a new route to a structure keeps to the route too.
{
  const sim = DS.createSim({ seed: 4241, mode: 'short', ai: [] });
  for (let i = 0; i < 10; i++) DS.step(sim);
  const h = sim.hearts[0], eh = sim.hearts[1];
  DS.spawnUnit(sim, 0, 'raider', h.x, h.y);
  const so = DS.launch(sim, 0, 'raider', 1, [{ x: 300, y: 500 }], {});
  for (let i = 0; i < 30 * 2; i++) DS.step(sim);
  DS.retask(sim, so.id, [{ x: 500, y: 150 }, { x: eh.x, y: eh.y }], { mode: 'raid', target: eh.id });
  const u = sim.byId.get(so.units[0]);
  let near = false;
  for (let i = 0; i < 30 * 20 && u.hp > 0 && !u.homing; i++) { DS.step(sim); if (Math.hypot(u.x - 500, u.y - 150) < 30) near = true; }
  ok('a Raider retasked onto a route to the Heart flies the route', near);
}
// ---------- links and jamming ----------
const fresh = () => { const sim = DS.createSim({ seed: 4241, mode: 'short', ai: [] }); for (let i = 0; i < 10; i++) DS.step(sim); return sim; };
const fly = (sim, side, type, x, y, route) => {
  DS.spawnUnit(sim, side, type, sim.hearts[side].x, sim.hearts[side].y);
  const so = DS.launch(sim, side, type, 1, route || [{ x, y }], {});
  const u = sim.byId.get(so.units[0]);
  u.x = x; u.y = y; u.wp = so.route.length;
  return { u, so };
};
const run = (sim, secs) => { for (let i = 0; i < 30 * secs; i++) DS.step(sim); };
// Out of link: a drone keeps its orders and cannot be retasked or recalled.
{
  const sim = fresh();
  const { u, so } = fly(sim, 0, 'warden', 900, 500);
  run(sim, 0.2);
  ok('a drone beyond the Heart\'s link is out of link', !u.link);
  ok('and cannot be retasked', DS.retask(sim, so.id, [{ x: 300, y: 300 }]) === false);
  ok('or recalled', DS.recall(sim, so.id) === false && !u.homing);
  const near = fly(sim, 0, 'warden', 400, 500);
  run(sim, 0.2);
  ok('a drone near the Heart is in link and takes new orders', near.u.link && DS.retask(sim, near.so.id, [{ x: 300, y: 300 }]) === true);
}
// A Relay carries the link onward, and passes it on only while it is linked itself.
{
  const sim = fresh();
  const r1 = fly(sim, 0, 'relay', 560, 500), far = fly(sim, 0, 'warden', 780, 500);
  run(sim, 0.2);
  ok('a Relay inside the Heart\'s link extends it', r1.u.link && far.u.link, `relay ${r1.u.link} far ${far.u.link}`);
  const r2 = fly(sim, 0, 'relay', 830, 500), farther = fly(sim, 0, 'warden', 1080, 520);
  run(sim, 0.2);
  ok('Relays chain', r2.u.link && farther.u.link);
  r1.u.hp = 0; run(sim, 0.2);
  ok('lose the first Relay and the chain beyond it drops', !r2.u.link && !farther.u.link && !far.u.link);
}
// A Harrier jams: jammed drones cannot report, cannot be ordered, and do not pass on a link.
{
  const sim = fresh();
  const g = fly(sim, 0, 'glint', 450, 500), e = fly(sim, 1, 'relay', 480, 520);
  run(sim, 1);
  const seen = sim.sides[0].pic.has(e.u.id);
  const sim2 = fresh();
  const g2 = fly(sim2, 0, 'glint', 450, 500), e2 = fly(sim2, 1, 'relay', 480, 520);
  fly(sim2, 1, 'harrier', 520, 560);
  run(sim2, 1);
  ok('a Glint reports a contact next to it', seen && g.u.hp > 0);
  ok('a jammed Glint does not', g2.u.jam && !sim2.sides[0].pic.has(e2.u.id), `jam ${g2.u.jam}`);
  ok('and is out of link while jammed', !g2.u.link && DS.retask(sim2, g2.so.id, [{ x: 200, y: 200 }]) === false);
  const r = fly(sim2, 0, 'relay', 500, 600), beyond = fly(sim2, 0, 'warden', 600, 900);
  run(sim2, 0.2);
  ok('a jammed Relay passes on no link', r.u.jam && !sim2.links[0].some(n => n.id === r.u.id));
}
// Posts are staffed only while their spot is in link and not jammed.
{
  const sim = fresh();
  const S = sim.sides[0];
  for (let i = 0; i < 3; i++) DS.spawnUnit(sim, 0, 'warden', sim.hearts[0].x, sim.hearts[0].y);
  const far = DS.addPost(sim, 0, 1000, 500, { warden: 1 }, 1);
  run(sim, 1);
  ok('a post beyond link is cut off and not staffed', DS.postReach(sim, 0, far) === 'cut' && DS.postUnits(sim, 0, far).length === 0);
  DS.removePost(sim, 0, far.id);
  const p = DS.addPost(sim, 0, 450, 500, { warden: 2 }, 1);
  const h = fly(sim, 1, 'harrier', 470, 560);
  run(sim, 1);
  ok('a jammed post is not staffed', DS.postReach(sim, 0, p) === 'jammed' && DS.postUnits(sim, 0, p).length === 0);
  h.u.hp = 0;
  run(sim, 1);
  ok('once the jamming stops it is', DS.postReach(sim, 0, p) === 'ok' && DS.postUnits(sim, 0, p).length === 2);
  void S;
}
// A jammed Warden cannot use the hive's picture: it engages only what its own sensor sees.
for (const jam of [false, true]) {
  const sim = fresh();
  const w = fly(sim, 0, 'warden', 450, 500), c = fly(sim, 1, 'relay', 635, 500);
  if (jam) fly(sim, 1, 'harrier', 450, 692);
  const tip = () => sim.sides[0].pic.set(c.u.id, { id: c.u.id, grade: 3, x: c.u.x, y: c.u.y, gx: c.u.x, gy: c.u.y, vx: 0, vy: 0, type: 'relay', known: true, static: false, first: 0, seenT: sim.t, trackT: sim.t, lockUntil: sim.t + 99, held: 9, jitT: 0 });
  let went = false;
  for (let i = 0; i < 30; i++) { tip(); DS.step(sim); if (w.u.target === c.u.id) went = true; }
  ok(jam ? 'a jammed Warden ignores a contact only the hive can see' : 'a Warden in link engages a contact the hive tracks', jam ? !went && w.u.jam : went);
}
// A post beyond link takes a Relay out to bridge the gap, then is staffed; Auto builds the Relay it needs.
{
  const sim = fresh();
  for (let i = 0; i < 2; i++) DS.spawnUnit(sim, 0, 'warden', sim.hearts[0].x, sim.hearts[0].y);
  const cf = sim.map.fields[sim.map.fields.length - 1];
  const p = DS.addPost(sim, 0, cf.x, cf.y, { warden: 2 }, 2);
  run(sim, 1);
  ok('a post on the Crown is beyond the Heart\'s link', DS.postReach(sim, 0, p) === 'cut');
  ok('with no Relay ready, Auto wants one', DS.autoNext(sim, 0) && DS.autoNext(sim, 0).type === 'relay');
  DS.spawnUnit(sim, 0, 'relay', sim.hearts[0].x, sim.hearts[0].y);
  run(sim, 12);
  const relays = sim.units.filter(u => u.type === 'relay' && !u.parked);
  ok('a Relay flies out to bridge it', relays.length === 1 && relays[0].link, relays.map(u => Math.round(u.x)).join());
  ok('then the post is in link and staffed', DS.postReach(sim, 0, p) === 'ok' && DS.postUnits(sim, 0, p, 'warden').length === 2);
}
// A cut-off part of a sortie carries on when the rest is retasked.
{
  const sim = fresh();
  for (let i = 0; i < 2; i++) DS.spawnUnit(sim, 0, 'warden', sim.hearts[0].x, sim.hearts[0].y);
  const so = DS.launch(sim, 0, 'warden', 2, [{ x: 900, y: 500 }], {});
  const [a, b] = so.units.map(id => sim.byId.get(id));
  a.x = 400; b.x = 900; b.y = 500;
  run(sim, 0.2);
  DS.retask(sim, so.id, [{ x: 300, y: 200 }]);
  ok('retasking a sortie moves only the drones in link', a.sortie === so.id && b.sortie !== so.id && sim.sorties.get(b.sortie).route[0].x === 900);
}
// ---------- rival styles ----------
{
  const sim0 = DS.createSim({ seed: 4241, mode: 'short', ai: [1] });
  ok('a rival with no style asked for gets one of the four', DS.STYLE_KEYS.includes(sim0.ai[1].style), sim0.ai[1].style);
  const watch = (style, until, test) => {
    const sim = DS.createSim({ seed: 9001, mode: 'short', ai: [0, 1], aiStyle: { 0: 'listener', 1: style } });
    const seen = {};
    while (!sim.over && sim.t < until) {
      DS.step(sim);
      for (const e of sim.events) if (e.k === 'raidStart') seen.raid = true;
      sim.events.length = 0;
      test(sim, seen);
    }
    return { sim, seen };
  };
  const sortie = (sim, label) => [...sim.sorties.values()].some(so => so.side === 1 && so.label === label && so.units.length);
  let r = watch('reaper', 720 * 0.3, (sim, seen) => { if (!seen.raidAt && (sortie(sim, 'Raid'))) seen.raidAt = sim.t; });
  ok('a Reaper raids early', r.seen.raidAt && r.seen.raidAt < 720 * 0.3, `first raid at ${Math.round(r.seen.raidAt || 0)} s`);
  r = watch('bulwark', 720 * 0.8, (sim, seen) => { seen.posts = Math.max(seen.posts || 0, sim.sides[1].posts.length); if (sim.sides[1].posts.some(p => p.name === 'Crown')) seen.crown = true; });
  ok('a Bulwark keeps posts, the Crown among them by Last Light', r.seen.posts >= 3 && r.seen.crown, `${r.seen.posts} posts`);
  r = watch('listener', 720 * 0.5, (sim, seen) => { const n = sim.units.filter(u => u.side === 1 && u.type === 'glint' && !u.parked && u.hp > 0).length; seen.glints = Math.max(seen.glints || 0, n); });
  ok('a Listener keeps several Glints out', r.seen.glints >= 3, `${r.seen.glints} at once`);
  r = watch('mimic', 720, (sim, seen) => { if (sortie(sim, 'Feint')) seen.feint = true; });
  ok('a Mimic sends a feint', r.seen.feint);
  // it adapts to what it sees
  const sim = DS.createSim({ seed: 4241, mode: 'short', ai: [1], aiDiff: { 1: 'hard' }, aiStyle: { 1: 'reaper' } });
  for (let i = 0; i < 6; i++) fly(sim, 0, 'warden', 1180, 260 + i * 90);
  for (let i = 0; i < 30 * 60 && !sim.ai[1].notes.length; i++) DS.step(sim);
  ok('a rival that sees Wardens builds more Decoys, and says so', sim.ai[1].adapt.decoy > 0 && /Decoys/.test((sim.ai[1].notes[0] || {}).text), JSON.stringify(sim.ai[1].notes));
}
console.log(checks.join('\n'));
console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
