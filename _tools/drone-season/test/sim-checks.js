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
console.log(checks.join('\n'));
console.log(checks.filter(c => c.startsWith('PASS')).length + '/' + checks.length + ' passed');
