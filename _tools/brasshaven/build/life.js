
/* ============================================================
   7b. Life in the harbour: clockwork townsfolk and gulls. Nothing is placed by
       hand: walkers use open ground and street doors, gulls use the roofs.
   ============================================================ */
const LIFE_CAPS = { high: { walkers: 40, gulls: 14 }, low: { walkers: 16, gulls: 7 }, lowest: { walkers: 8, gulls: 4 } };
const lifeCap = () => LIFE_CAPS[tier] || LIFE_CAPS.high;
const nightNow = () => (todState ? todState.night : 0);
const rr = (a, b) => a + Math.random() * (b - a);
const anyOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const _o3 = new THREE.Object3D(), _og = new THREE.Object3D(); _og.rotation.order = 'YXZ';
function mergeColored(parts) {
  const list = parts.map(([g, c]) => [g.index ? g.toNonIndexed() : g, new THREE.Color(c)]);
  let n = 0; for (const [g] of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [g, c] of list) {
    const k = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += k;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
const CYL = (r0, r1, h, seg, x, y, z) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z);
const SPH = (r, x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, r < 0.015 ? 5 : 8, r < 0.015 ? 3 : 6).scale(sx, sy, sz).translate(x, y, z);
const BOXG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// ---------- clockwork townsfolk ----------
const WALK_MAX = 48;
const BRASSY = 0xc8a050, DARK = 0x231f1c;
function automatonHead(kind) {
  const parts = [[SPH(0.03, 0, 0.225, 0), BRASSY], [SPH(0.006, 0.027, 0.232, 0.011), DARK], [SPH(0.006, 0.027, 0.232, -0.011), DARK]];
  for (const s of [-1, 1]) parts.push([CYL(0.009, 0.008, 0.085, 6, 0.004, 0.152, 0.044 * s), BRASSY], [SPH(0.011, 0.006, 0.108, 0.045 * s), BRASSY]);
  parts.push([BOXG(0.004, 0.03, 0.004, -0.046, 0.165, 0), BRASSY], [BOXG(0.004, 0.022, 0.03, -0.054, 0.165, 0), BRASSY]);
  if (kind === 0) {
    parts.push([CYL(0.025, 0.027, 0.055, 10, 0, 0.278, 0), DARK], [CYL(0.043, 0.043, 0.006, 12, 0, 0.252, 0), DARK], [CYL(0.0275, 0.0275, 0.009, 10, 0, 0.26, 0), 0x8a3a26]);
    parts.push([SPH(0.005, 0.041, 0.165, 0), BRASSY], [SPH(0.005, 0.045, 0.135, 0), BRASSY]);
  } else {
    parts.push([new THREE.SphereGeometry(0.036, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(-0.004, 0.232, 0), 0xe8dcc0], [CYL(0.037, 0.037, 0.008, 10, -0.004, 0.236, 0), 0x7a3a5a]);
    if (kind === 2) parts.push([CYL(0.003, 0.003, 0.17, 4, 0.03, 0.24, 0.04), DARK], [new THREE.ConeGeometry(0.11, 0.045, 12).translate(0.03, 0.345, 0.04), 0xd9c39a]);
  }
  return mergeColored(parts);
}
const coatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.05 });
const autoMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.55 });
const legMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.6, metalness: 0.5 });
const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffbf66 });
function lifeIM(geo, mat, n) { const im = new THREE.InstancedMesh(geo, mat, n); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; scene.add(im); return im; }
const walkIM = {
  bodyA: lifeIM(CYL(0.033, 0.05, 0.13, 8, 0, 0.135, 0), coatMat, WALK_MAX),
  bodyB: lifeIM(CYL(0.028, 0.068, 0.15, 10, 0, 0.115, 0), coatMat, WALK_MAX),
  headA: lifeIM(automatonHead(0), autoMat, WALK_MAX),
  headB: lifeIM(automatonHead(1), autoMat, WALK_MAX),
  headC: lifeIM(automatonHead(2), autoMat, WALK_MAX),
  legs: lifeIM(new THREE.BoxGeometry(0.014, 0.075, 0.014).translate(0, -0.0375, 0), legMat, WALK_MAX * 2),
  lantern: lifeIM(new THREE.BoxGeometry(0.018, 0.026, 0.018), lanternMat, WALK_MAX),
};
walkIM.lantern.castShadow = false;
for (const im of [walkIM.bodyA, walkIM.bodyB]) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(WALK_MAX * 3).fill(1), 3);
const COATS = [0x7b2a22, 0x2f4a3a, 0x283a5c, 0x8a6a2a, 0x5a3550, 0x4a4f57], DRESSES = [0x8c7aa8, 0x3f7a78, 0xb06a6a, 0xd8cdb0, 0xb0843c];

let walkable = new Uint8Array(V), stopAt = new Uint8Array(V), occ = new Uint8Array(V), walkNodes = [], doors = [], spawnT = 0;
const walkers = [];
function isFountain(v) { if (!courtyard[v]) return false; const h = hash4(v, 0, 66, 0); return h >= 0.5 && h < 0.72; }
function computeWalk() {
  walkable.fill(0); walkNodes = []; doors = [];
  for (let v = 0; v < V; v++) if (F(v, 0) && !F(v, 1) && !isFountain(v)) { walkable[v] = 1; walkNodes.push(v); }
  for (let v = 0; v < V; v++) {
    if (!F(v, 0) || !F(v, 1)) continue;
    const i = doorEdge(v); if (i < 0) continue;
    const w = ringW[v][i]; if (!walkable[w]) continue;
    const f = wallFrame(v, i);
    doors.push({ w, x: f.ax + f.ux * f.W / 2 + f.nx * 0.02, z: f.az + f.uz * f.W / 2 + f.nz * 0.02, nx: f.nx, nz: f.nz });
  }
  // street lamps and doorways are where townsfolk stop to pass the time
  stopAt.fill(0);
  for (const l of lampList) { if (l[1] > GROUND_TOP + 1.2) continue; const v = nearestVertex(l[0], l[2]); if (v >= 0 && walkable[v]) stopAt[v] = 1; }
  for (const d of doors) stopAt[d.w] = 1;
}
function makeWalker(x, z, node) {
  const kind = Math.random() < 0.5 ? 0 : Math.random() < 0.65 ? 1 : 2;
  return {
    x, z, node, prev: -1, gx: x, gz: z, heading: Math.random() * 6.283, kind, color: new THREE.Color(kind === 0 ? anyOf(COATS) : anyOf(DRESSES)),
    lane: (Math.random() < 0.5 ? -1 : 1) * rr(0.1, 0.17), speed: rr(0.15, 0.22), phase: Math.random() * 6.283,
    steps: 5 + Math.floor(Math.random() * 16), scale: 0, state: 'walk', pause: 0, lantern: Math.random() < 0.75, moving: 0,
  };
}
// aim at a street's centre, kept to one side of the way so walkers pass lamps and each other
function aimAt(w, node, fx, fz) {
  let dx = X[node] - fx, dz = Z[node] - fz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  w.gx = X[node] - dz * w.lane; w.gz = Z[node] + dx * w.lane;
}
// how busy a street is: walkers heading for it, plus half of those on the streets around it
function crowd(v) { let c = occ[v]; for (const n of ringW[v]) c += occ[n] * 0.5; return c; }
function spawnWalker() {
  if (!walkNodes.length) return;
  const quietDoors = doors.filter((d) => occ[d.w] === 0 && crowd(d.w) < 1);
  if (quietDoors.length && Math.random() < 0.85) {
    const d = anyOf(quietDoors), w = makeWalker(d.x, d.z, d.w);
    w.state = 'emerge'; w.heading = Math.atan2(-d.nz, d.nx); aimAt(w, d.w, d.x, d.z);
    walkers.push(w); occ[d.w]++;
  } else {
    const quiet = walkNodes.filter((v) => occ[v] === 0 && crowd(v) < 1);
    if (!quiet.length) return;
    const v = anyOf(quiet), w = makeWalker(X[v] + rr(-0.12, 0.12), Z[v] + rr(-0.12, 0.12), v);
    w.gx = w.x; w.gz = w.z; w.pause = rr(0.4, 1.6);
    walkers.push(w); occ[v]++;
  }
}
function arrive(w) {
  if (w.state === 'enter') { w.state = 'gone'; return; }
  if (w.state === 'emerge') w.state = 'walk';
  const u = w.node;
  if (!walkable[u]) { w.state = 'fade'; return; }
  w.steps--;
  if (w.steps <= 0) {
    const d = doors.find((dd) => dd.w === u);
    if (d) { w.state = 'enter'; w.gx = d.x; w.gz = d.z; return; }
    if (w.steps < -14 || !doors.length) { w.state = 'fade'; return; }
  }
  if (Math.random() < (stopAt[u] && occ[u] <= 1 ? 0.35 : 0.08)) w.pause = rr(0.8, 2.6);
  // mostly straight on, now and then round a corner, rarely back the way it came, and away from crowds
  const hx = Math.cos(w.heading), hz = -Math.sin(w.heading);
  let best = -1, bs = -1e9;
  for (const n of ringW[u]) {
    if (!walkable[n] || occ[n] >= 2) continue;
    const dx = X[n] - X[u], dz = Z[n] - Z[u], l = Math.hypot(dx, dz) || 1;
    const s = (dx * hx + dz * hz) / l + Math.random() * 1.3 - (n === w.prev ? 2.5 : 0) - crowd(n) * 0.9;
    if (s > bs) { bs = s; best = n; }
  }
  if (best < 0) { w.pause = rr(1, 2.5); w.prev = -1; return; }
  occ[u]--; occ[best]++;
  w.prev = u; w.node = best; aimAt(w, best, X[u], Z[u]);
}
function updateWalkers(dt) {
  const night = nightNow();
  // about one walker to every three streets, fewer after dark
  const want = Math.min(lifeCap().walkers, Math.round(Math.min(walkNodes.length * 0.45, walkNodes.length * 0.3 + doors.length * 0.3) * (1 - 0.55 * night)));
  occ.fill(0);
  for (const w of walkers) if (w.state !== 'fade' && w.state !== 'gone' && w.node >= 0) occ[w.node]++;
  spawnT -= dt;
  if (walkers.length < want && spawnT <= 0 && walkNodes.length) { spawnWalker(); spawnT = rr(0.4, 1.2); }
  if (walkers.length > want + 2) for (const w of walkers) if (w.state === 'walk' && w.steps > 1) { w.steps = 1; break; }
  const hurry = (1 + tension * 1.4) * (REDUCED ? 0.6 : 1);
  for (let i = walkers.length - 1; i >= 0; i--) {
    const w = walkers[i];
    if (w.state === 'gone') { walkers.splice(i, 1); continue; }
    if (w.state === 'fade') { w.scale -= dt * 2.5; w.moving = 0; if (w.scale <= 0) walkers.splice(i, 1); continue; }
    const dx = w.gx - w.x, dz = w.gz - w.z, d = Math.hypot(dx, dz);
    w.scale = w.state === 'enter' ? Math.min(w.scale, d / 0.12 + 0.08) : Math.min(1, w.scale + dt * 3);
    if (w.pause > 0) { w.pause -= dt; w.moving = Math.max(0, w.moving - dt * 4); continue; }
    if (d < 0.02) { arrive(w); continue; }
    const step = Math.min(d, w.speed * hurry * dt);
    w.x += (dx / d) * step; w.z += (dz / d) * step;
    w.heading += angDiff(w.heading, Math.atan2(-dz, dx)) * Math.min(1, dt * 10);
    w.moving = Math.min(1, w.moving + dt * 4);
    w.phase += dt * w.speed * hurry * 55;
  }
}
const LH_MAX = WALK_MAX + 8;
const lhPos = new Float32Array(LH_MAX * 3), lhSize = new Float32Array(LH_MAX).fill(0.26), lhAlpha = new Float32Array(LH_MAX).fill(0.85);
const lhGeo = new THREE.BufferGeometry();
const lhPosAttr = new THREE.BufferAttribute(lhPos, 3).setUsage(THREE.DynamicDrawUsage);
lhGeo.setAttribute('position', lhPosAttr); lhGeo.setAttribute('size', new THREE.BufferAttribute(lhSize, 1)); lhGeo.setAttribute('alpha', new THREE.BufferAttribute(lhAlpha, 1));
lhGeo.setDrawRange(0, 0);
const lifeHalo = new THREE.Points(lhGeo, haloMat); lifeHalo.frustumCulled = false; lifeHalo.renderOrder = 6; scene.add(lifeHalo);
let nLights = 0;
function addLight(x, y, z, size) { if (nLights >= LH_MAX) return; lhPos[nLights * 3] = x; lhPos[nLights * 3 + 1] = y; lhPos[nLights * 3 + 2] = z; lhSize[nLights] = size; nLights++; }
function drawWalkers(night) {
  let nA = 0, nB = 0, hA = 0, hB = 0, hC = 0, nl = 0, nLan = 0;
  for (const w of walkers) {
    const s = w.scale; if (s <= 0.01) continue;
    const bob = Math.abs(Math.sin(w.phase)) * 0.008 * w.moving;
    _o3.position.set(w.x, GROUND_TOP + bob, w.z); _o3.rotation.set(0, w.heading, 0); _o3.scale.setScalar(s); _o3.updateMatrix();
    const body = w.kind === 0 ? walkIM.bodyA : walkIM.bodyB, bi = w.kind === 0 ? nA++ : nB++;
    body.setMatrixAt(bi, _o3.matrix); body.setColorAt(bi, w.color);
    if (w.kind === 0) walkIM.headA.setMatrixAt(hA++, _o3.matrix); else if (w.kind === 1) walkIM.headB.setMatrixAt(hB++, _o3.matrix); else walkIM.headC.setMatrixAt(hC++, _o3.matrix);
    const sw = Math.sin(w.phase) * 0.55 * w.moving, ch = Math.cos(w.heading), sh = Math.sin(w.heading);
    for (const side of [-1, 1]) {
      const lz = 0.017 * side * s;
      _o3.position.set(w.x + lz * sh, GROUND_TOP + bob + 0.075 * s, w.z + lz * ch);
      _o3.rotation.set(0, w.heading, sw * side); _o3.updateMatrix();
      walkIM.legs.setMatrixAt(nl++, _o3.matrix);
    }
    if (night > 0.3 && w.lantern && w.kind !== 2) {
      const lx = 0.05 * s, lz = 0.045 * s, px = w.x + lx * ch + lz * sh, pz = w.z - lx * sh + lz * ch, py = GROUND_TOP + bob + 0.125 * s;
      _o3.position.set(px, py, pz); _o3.rotation.set(0, w.heading, 0); _o3.updateMatrix();
      walkIM.lantern.setMatrixAt(nLan++, _o3.matrix);
      addLight(px, py, pz, 0.24 * s);
    }
  }
  const set = (im, n) => { im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; };
  set(walkIM.bodyA, nA); set(walkIM.bodyB, nB); set(walkIM.headA, hA); set(walkIM.headB, hB); set(walkIM.headC, hC); set(walkIM.legs, nl); set(walkIM.lantern, nLan);
}

// ---------- the shoreline, for the sound of the sea ----------
let shoreNodes = [];
function computeShore() { shoreNodes = []; for (let v = 0; v < V; v++) if (F(v, 0) && ringW[v].some((w) => !cols[w])) shoreNodes.push(v); }

// ---------- gulls ----------
const GULL_MAX = 16;
const gullBodyGeo = mergeColored([
  [SPH(1, 0, 0, 0, 0.06, 0.026, 0.028), 0xf2f0ea], [SPH(0.019, 0.05, 0.016, 0), 0xf2f0ea],
  [new THREE.ConeGeometry(0.006, 0.026, 5).rotateZ(-Math.PI / 2).translate(0.078, 0.012, 0), 0xe0b030],
  [BOXG(0.04, 0.006, 0.03, -0.065, 0.004, 0), 0x9aa0a6], [SPH(0.003, 0.062, 0.022, 0.012), DARK], [SPH(0.003, 0.062, 0.022, -0.012), DARK],
]);
const gullWingGeo = (() => {
  const pts = [[0.03, 0, 0.01], [-0.03, 0, 0.01], [-0.02, 0, 0.12], [0.015, 0, 0.12], [-0.012, 0, 0.17]];
  const tri = [[0, 1, 2], [0, 2, 3], [3, 2, 4]], colsW = [0xb8bec4, 0xb8bec4, 0x2b2b2e];
  const pos = [], nor = [], col = [], c = new THREE.Color();
  tri.forEach((t, k) => { c.setHex(colsW[k]); for (const i of t) { pos.push(...pts[i]); nor.push(0, 1, 0); col.push(c.r, c.g, c.b); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
})();
const gullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const wingMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
const gullIM = lifeIM(gullBodyGeo, gullMat, GULL_MAX), wingIM = lifeIM(gullWingGeo, wingMat, GULL_MAX * 2);
let perchList = [];
const gulls = [];
const GULL_SPEED = 0.85, GULL_TURN = 1.9, GULL_UP = 0.32, GULL_DOWN = 0.28;
function newGull(x, y, z) {
  const g = { x, y, z, v: GULL_SPEED, vy: 0, heading: Math.random() * 6.283, bank: 0, state: 'circle', cx: x, cz: z, cy: y, r: 1, dir: 1, t: 0, flapT: Math.random() * 6, glide: rr(0.5, 2), flapping: true, perch: null, look: 0 };
  circleAround(g, x, y, z);
  return g;
}
// a circle to wheel round, high enough to clear the roofs under it
function circleAround(g, x, y, z) {
  g.state = 'circle'; g.cx = x; g.cz = z; g.r = rr(0.7, 1.5); g.t = rr(8, 16); g.dir = Math.random() < 0.5 ? -1 : 1;
  let clear = GROUND_TOP + 0.8;
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; clear = Math.max(clear, heightAt(x + Math.cos(a) * g.r, z + Math.sin(a) * g.r) - 0.4); }
  g.cy = Math.max(y, clear);
}
function takeOff(g) {
  if (g.perch && g.perch.taken === g) g.perch.taken = null;
  g.perch = null; g.v = 0.25;
  circleAround(g, g.x + rr(-0.6, 0.6), g.y + rr(0.8, 1.4), g.z + rr(-0.6, 0.6)); g.flapping = true; g.glide = 1.6;
}
function scatterGulls(x, z) { for (const g of gulls) if ((g.state === 'perch' || g.state === 'final') && Math.hypot(g.x - x, g.z - z) < 1.8) takeOff(g); }
const mastBusy = () => ships.some((s) => s.state === 'final' || s.state === 'docked');
function freePerch(x, z, maxD) {
  let best = null, bd = maxD; const busy = mastBusy();
  for (const p of perchList) { if (p.taken || (p.mast && busy)) continue; const d = Math.hypot(p.x - x, p.z - z) + Math.random() * 1.5; if (d < bd) { bd = d; best = p; } }
  return best;
}
// steer toward a point ahead on a circle round (cx, cz): following it traces the circle
function orbitPoint(g, cx, cz, r) {
  const a = Math.atan2(g.z - cz, g.x - cx) + g.dir * Math.min(1.2, 0.5 + 0.35 / Math.max(0.2, r));
  return [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
}
function flyToward(g, tx, ty, tz, speed, turn, dt, sp) {
  const want = Math.atan2(-(tz - g.z), tx - g.x), off = angDiff(g.heading, want);
  const turnRate = Math.max(-turn, Math.min(turn, off * 3));
  g.heading += turnRate * dt * sp;
  g.bank += (-turnRate * 0.28 - g.bank) * Math.min(1, dt * 4);
  g.v += Math.max(-0.8 * dt, Math.min(0.6 * dt, speed - g.v));
  g.x += Math.cos(g.heading) * g.v * dt * sp; g.z -= Math.sin(g.heading) * g.v * dt * sp;
  // height changes gently: a gull circles up and spirals down rather than jumping
  const vyWant = Math.max(-GULL_DOWN, Math.min(GULL_UP, (ty - g.y) * 0.9));
  g.vy += Math.max(-0.6 * dt, Math.min(0.6 * dt, vyWant - g.vy));
  g.y += g.vy * dt * sp;
}
function updateGulls(dt, sp) {
  const night = nightNow();
  const want = perchList.length ? Math.min(lifeCap().gulls, Math.max(3, Math.round(perchList.length / 3))) : 2;
  while (gulls.length < want) gulls.push(newGull(townCX + rr(-4, 4), Math.max(2.4, heightAt(townCX, townCZ) + 0.2) + rr(0, 1), townCZ + rr(-4, 4)));
  while (gulls.length > want) { const g = gulls.pop(); if (g.perch) g.perch.taken = null; }
  for (const g of gulls) {
    if (g.state === 'circle') {
      g.t -= dt;
      const [tx, tz] = orbitPoint(g, g.cx, g.cz, g.r);
      flyToward(g, tx, g.cy + 0.12 * Math.sin(g.t * 0.9), tz, GULL_SPEED, GULL_TURN, dt, sp);
      if (g.t <= 0 || night > 0.5) {
        const p = freePerch(g.x, g.z, night > 0.5 ? 40 : 9);
        if (p) { g.state = 'land'; g.perch = p; p.taken = g; g.dir = Math.random() < 0.5 ? -1 : 1; }
        else if (perchList.length) { const q = anyOf(perchList); circleAround(g, q.x, Math.max(g.y - 0.5, q.y + rr(0.8, 1.6)), q.z); }
        else circleAround(g, townCX + rr(-3, 3), g.y, townCZ + rr(-3, 3));
      }
    } else if (g.state === 'land') {
      // spiral down round the perch, the circle tightening as the gull comes lower
      const p = g.perch, dh = Math.hypot(p.x - g.x, p.z - g.z), above = g.y - p.y;
      const r = Math.min(0.9, Math.max(0.45, above * 0.7));
      const [tx, tz] = dh > r + 0.6 ? [p.x, p.z] : orbitPoint(g, p.x, p.z, r);
      flyToward(g, tx, p.y + 0.04, tz, GULL_SPEED * 0.8, GULL_TURN, dt, sp);
      if (above < 0.14 && dh < 0.8 && dh > 0.25) { g.state = 'final'; g.fy = above; g.fd = dh; }
    } else if (g.state === 'final') {
      // glide in, slowing, and settle
      const p = g.perch, dh = Math.hypot(p.x - g.x, p.z - g.z);
      flyToward(g, p.x, g.y, p.z, Math.min(GULL_SPEED * 0.7, 0.08 + dh * 0.9), GULL_TURN * 2.5, dt, sp);
      g.vy = 0; g.y = p.y + g.fy * Math.min(1, dh / g.fd);
      if (dh < 0.03) { g.state = 'perch'; g.x = p.x; g.y = p.y; g.z = p.z; g.v = 0; g.vy = 0; g.bank = 0; g.t = rr(5, 16); }
      else if (dh > 1.2) g.state = 'land';
    } else if (g.state === 'perch') {
      g.t -= dt; g.look -= dt;
      if (g.look <= 0) { g.heading += rr(-0.8, 0.8); g.look = rr(1, 3); }
      if ((g.t <= 0 && night < 0.5) || (g.perch.mast && mastBusy())) takeOff(g);
    }
    if (g.state !== 'perch') g.y = Math.max(g.y, GROUND_TOP + 0.15);
    // flap to climb or slow down, glide on the level
    g.glide -= dt;
    if (g.glide <= 0) { g.flapping = !g.flapping; g.glide = g.flapping ? rr(0.6, 1.4) : rr(1.2, 2.8); }
    const working = g.state !== 'perch' && (g.vy > 0.12 || g.v < 0.5 || g.state === 'final');
    g.flapT += dt * (g.flapping || working ? 12 : 0) * (REDUCED ? 0.5 : 1);
    if (!g.flapping && !working) g.flapT += (Math.round(g.flapT / Math.PI) * Math.PI - g.flapT) * Math.min(1, dt * 6);
  }
}
function drawGulls() {
  let n = 0, nw = 0;
  for (const g of gulls) {
    const perched = g.state === 'perch', pitch = perched ? 0 : Math.max(-0.35, Math.min(0.35, g.vy / Math.max(0.3, g.v)));
    _og.position.set(g.x, g.y, g.z); _og.rotation.set(g.bank, g.heading, pitch); _og.scale.setScalar(1); _og.updateMatrix();
    gullIM.setMatrixAt(n++, _og.matrix);
    const flap = perched ? -0.35 : Math.sin(g.flapT) * 0.85 + 0.1;
    for (const s of [1, -1]) {
      _og.position.set(g.x, g.y + 0.012, g.z); _og.rotation.set(g.bank - flap * s, g.heading, pitch); _og.scale.set(1, 1, s * (perched ? 0.32 : 1)); _og.updateMatrix();
      wingIM.setMatrixAt(nw++, _og.matrix);
    }
  }
  gullIM.count = n; wingIM.count = nw; gullIM.instanceMatrix.needsUpdate = wingIM.instanceMatrix.needsUpdate = true;
}

// ---------- keeping life in step with the town ----------
function syncLife() {
  computeWalk(); computeShore();
  for (const w of walkers) {
    if ((w.state === 'walk' || w.state === 'emerge') && !walkable[w.node]) w.state = 'fade';
    else if (w.state === 'enter' && !doors.some((d) => Math.abs(d.x - w.gx) < 0.01 && Math.abs(d.z - w.gz) < 0.01)) w.state = 'fade';
  }
  perchList = [];
  for (const d of chunkDyn) if (d && d.perches) for (const p of d.perches) perchList.push({ x: p[0], y: p[1], z: p[2], taken: null });
  if (mastPos) perchList.push({ x: mastPos.x + 0.075, y: mastPos.y - 0.054, z: mastPos.z, taken: null, mast: true });
  for (const g of gulls) {
    if (!g.perch) continue;
    const p = perchList.find((q) => !q.taken && Math.abs(q.x - g.perch.x) < 0.02 && Math.abs(q.z - g.perch.z) < 0.02 && Math.abs(q.y - g.perch.y) < 0.05);
    if (p) { g.perch = p; p.taken = g; } else takeOff(g);
  }
  lifeReady = true;
}
function updateLife(dt, t) {
  const sp = REDUCED ? 0.6 : 1, night = nightNow();
  updateWalkers(dt); updateGulls(dt, sp);
  nLights = 0;
  drawWalkers(night); drawGulls();
  lhGeo.setDrawRange(0, nLights); lhPosAttr.needsUpdate = true; lhGeo.attributes.size.needsUpdate = true;
  lifeHalo.visible = halos.visible && nLights > 0;
}
const LIFE_MATS = [coatMat, autoMat, legMat, lanternMat, gullMat, wingMat];
let lifeReady = false;
function setLifeShadows(on) { for (const im of [walkIM.bodyA, walkIM.bodyB, walkIM.headA, walkIM.headB, walkIM.headC, walkIM.legs, gullIM, wingIM]) im.castShadow = on; }

// ---------- the harbour's sound: water, gulls, mill wheels, gaslight, the hour ----------
let amb = null, ambVolume = Math.max(0, Math.min(100, store.get('ambience', 60) | 0)), ambT = 0, lastHour = null;
const ambGainV = () => Math.pow(ambVolume / 60, 1.5);
function setAmbience(v) { ambVolume = v; store.set('ambience', v); if (amb && actx) amb.out.gain.setTargetAtTime(ambGainV(), actx.currentTime, 0.05); }
function startAmbience() {
  if (amb || !actx || !soundOn) return;
  const out = actx.createGain(); out.gain.value = ambGainV(); out.connect(bus());
  const len = actx.sampleRate * 3, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const loop = (type, freq, q, off) => {
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = buf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(out); src.start(actx.currentTime, off);
    return { f, g };
  };
  amb = { out, buf, wash: loop('lowpass', 480, 0.6, 0), hiss: loop('highpass', 3800, 0.5, 1.3) };
}
function envNoise(dur, type, freq, q, vol, delay = 0) {
  const t = actx.currentTime + delay, len = Math.floor(actx.sampleRate * dur), b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
  const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(amb.out); src.start(t);
}
function gullCry(vol, delay = 0) {
  const t = actx.currentTime + delay, o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain(), f0 = rr(1450, 1900), len = rr(0.22, 0.36);
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.22, t + 0.05); o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + len);
  f.type = 'bandpass'; f.frequency.value = 2300; f.Q.value = 1.6;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0004, t + len + 0.04);
  o.connect(f); f.connect(g); g.connect(amb.out); o.start(t); o.stop(t + len + 0.06);
}
function creak(vol) {
  const t = actx.currentTime, o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(rr(60, 80), t); o.frequency.linearRampToValueAtTime(rr(90, 120), t + 0.3);
  f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 7;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0004, t + 0.42);
  o.connect(f); f.connect(g); g.connect(amb.out); o.start(t); o.stop(t + 0.45);
}
function bell(t0, vol) {
  const out = actx.createGain(); out.gain.value = vol; out.connect(amb.out);
  for (const [m, a, d] of [[0.5, 0.35, 4.5], [1, 1, 3.6], [2, 0.55, 2.4], [2.4, 0.4, 2], [3, 0.3, 1.6], [4.2, 0.18, 1.1], [5.4, 0.12, 0.8]]) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = 196 * m;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t0 + d);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + d + 0.05);
  }
}
// an engine's exhaust beat, part of the town's ambience
function chuff(vol) {
  if (!amb) { noise(0.13, 420, vol, 'lowpass'); return; }
  const t = actx.currentTime, len = Math.floor(actx.sampleRate * 0.13), b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = b; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = vol * 1.4;
  src.connect(f); f.connect(g); g.connect(amb.out); src.start(t);
}
const nearness = (x, z, r) => Math.max(0, 1 - Math.hypot(x - view.tx, z - view.tz) / r);
function tickAmbience(dt) {
  if (!soundOn || !actx || actx.state !== 'running') return;
  if (!amb) startAmbience();
  if (!amb) return;
  ambT -= dt; if (ambT > 0) return; ambT = 0.25;
  const now = actx.currentTime, night = nightNow(), near = Math.max(0.25, Math.min(1, 1.35 - view.dist / 30));
  // the sea: a wash everywhere, louder with laps where quays meet the water
  let shore = 0; for (const v of shoreNodes) shore += nearness(X[v], Z[v], 5);
  const s = Math.min(1, shore / 4);
  amb.wash.g.gain.setTargetAtTime((0.05 + 0.12 * s) * near * (0.78 + 0.22 * Math.sin(now * 0.6) * Math.sin(now * 0.23 + 1)), now, 0.4);
  amb.wash.f.frequency.setTargetAtTime(380 + 260 * s, now, 0.5);
  if (s > 0.1 && Math.random() < 0.35 * s) envNoise(rr(0.25, 0.45), 'bandpass', rr(500, 1000), 0.8, 0.05 * s * near);
  // gas lamps hiss after dark
  let lamps = 0; for (const l of lampList) lamps += nearness(l[0], l[2], 4);
  amb.hiss.g.gain.setTargetAtTime(night * Math.min(1, lamps / 3) * near * 0.012, now, 0.5);
  // gulls call by day
  if (night < 0.5) {
    let flying = 0; for (const g of gulls) if (g.state !== 'perch') flying += nearness(g.x, g.z, 7);
    if (Math.random() < 0.05 * Math.min(1, flying / 2)) { const v = 0.045 * near; gullCry(v); if (Math.random() < 0.5) gullCry(v * 0.8, rr(0.32, 0.45)); }
  }
  // mill wheels creak as they turn
  for (const w of wheelList) { const n = nearness(w.c[0], w.c[2], 5); if (n > 0 && Math.random() < 0.06 * (1 + tension)) creak(0.035 * n * near); }
  // tower clocks strike the real hour together
  const h = new Date().getHours();
  if (lastHour !== null && h !== lastHour && clockList.length) {
    let cn = 0; for (const c of clockList) cn = Math.max(cn, nearness(c.p[0], c.p[2], 14));
    const n = h % 12 || 12, t0 = now + 0.2;
    for (let i = 0; i < n; i++) bell(t0 + i * 2, 0.07 * (0.4 + 0.6 * cn));
  }
  lastHour = h;
}
