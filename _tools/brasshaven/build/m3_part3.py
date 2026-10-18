import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # this _tools/brasshaven folder
p=os.path.join(ROOT, 'brasshaven.html'); s=open(p).read()
def rep(a, b, count=1):
    global s
    n = s.count(a)
    assert n == count, (n, a[:100])
    s = s.replace(a, b)
rep("const ICO = (() => { const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(); return Array.from(g.attributes.position.array); })();",
    "const ICO = (() => { const g = new THREE.IcosahedronGeometry(1, 0); return Array.from((g.index ? g.toNonIndexed() : g).attributes.position.array); })();")
rep("let shipAlt = 5, townCX = 0, townCZ = 0, townRad = 6, mastPos = null;",
"""let townCX = 0, townCZ = 0, townRad = 6, mastPos = null;
// a coarse map of roof heights: airships cruise low over the water and climb over towers
const shipHeights = new Map();
const hkey = (x, z) => Math.floor(x) * 4096 + Math.floor(z);
const heightAt = (x, z) => shipHeights.get(hkey(x, z)) || 0;
const shipBase = (s) => 3.4 + s.i * 0.55;
function shipFloor(s, p) {
  const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw);
  let h = 0;
  for (const d of [-1.1, 0, 1.2, 2.4, 3.6]) h = Math.max(h, heightAt(p.x + fx * d, p.z + fz * d));
  return Math.max(shipBase(s), h + 1.5);
}""")
rep("""  grp.position.set(townCX + Math.cos(a) * r, shipAlt + i * 0.8, townCZ + Math.sin(a) * r);""",
    """  grp.position.set(townCX + Math.cos(a) * r, 0, townCZ + Math.sin(a) * r);""")
rep("""  s.target = shipWaypoint(s);
  scene.add(grp);""", """  s.target = shipWaypoint(s);
  grp.position.y = shipFloor(s, grp.position) + 0.6;
  scene.add(grp);""")
rep("""  shipAlt = Math.max(top + 2.4, mastPos ? mastPos.y + 1.3 : 0, 4.5);
  const want = 1 + (cellCount >= 25 ? 1 : 0) + (mastPos ? 1 : 0);""", """  shipHeights.clear();
  const put = (x, z, h) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const k = hkey(x + dx, z + dz); if ((shipHeights.get(k) || 0) < h) shipHeights.set(k, h); } };
  for (let v = 0; v < V; v++) if (cols[v]) put(X[v], Z[v], topY(31 - Math.clz32(cols[v])) + 0.9);
  if (mastPos) put(mastPos.x, mastPos.z, mastPos.y + 0.4);
  void top;
  const want = 1 + (cellCount >= 60 ? 1 : 0) + (mastPos ? 1 : 0);""")
rep("    let tx = s.target.x, tz = s.target.z, ty = shipAlt + s.i * 0.8, speed = 0.75, bob = 1;",
    "    let tx = s.target.x, tz = s.target.z, ty = shipFloor(s, p), speed = 0.75, bob = 1;")
rep("      p.y += (shipAlt - p.y) * Math.min(1, dt * 0.25);", "      p.y += (shipFloor(s, p) + 0.5 - p.y) * Math.min(1, dt * 0.5);")
rep("""    s.speed += (speed - s.speed) * Math.min(1, dt * 0.8);
    p.x += Math.cos(s.yaw) * s.speed * dt * sp; p.z -= Math.sin(s.yaw) * s.speed * dt * sp;
    const dy = (ty - p.y) * Math.min(1, dt * 0.35 * sp); p.y += dy;""", """    if (ty > p.y + 0.3) speed *= Math.max(0.3, 1 - (ty - p.y) * 0.3);
    s.speed += (speed - s.speed) * Math.min(1, dt * 0.8);
    p.x += Math.cos(s.yaw) * s.speed * dt * sp; p.z -= Math.sin(s.yaw) * s.speed * dt * sp;
    p.y += (ty - p.y) * Math.min(1, dt * (ty > p.y ? 0.9 : 0.3) * sp);""")
rep("dockNow: () => { for (const sh of ships) sh.timer = 0; },",
    "dockNow: () => { for (const sh of ships) sh.timer = 0; }, sim: (sec, step = 0.05) => { const t0 = performance.now() / 1000; for (let t = 0; t < sec; t += step) { tickKey(step); tickTod(step); updateDyn(step, t0 + t); updateSteam(step); updateShips(step, t0 + t); } return pN; }, shipsRaw: ships, emitters: () => { const c = {}; for (const e of emitList) c[e.kind] = (c[e.kind] || 0) + 1; return c; },")
open(p,'w').write(s); print('ok')
