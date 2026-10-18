
/* ============================================================
   7b. Life in the harbour: clockwork townsfolk, steam launches, the paddle
       steamer and gulls. Nothing is placed by hand: walkers use open ground and
       street doors, boats use open water and timber piers, gulls use roofs.
   ============================================================ */
const LIFE_CAPS = { high: { walkers: 40, gulls: 14, launches: 3 }, low: { walkers: 16, gulls: 7, launches: 2 }, lowest: { walkers: 8, gulls: 4, launches: 1 } };
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

let walkable = new Uint8Array(V), stopAt = new Uint8Array(V), walkNodes = [], doors = [], spawnT = 0;
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
function spawnWalker() {
  if (!walkNodes.length) return;
  if (doors.length && Math.random() < 0.85) {
    const d = anyOf(doors), w = makeWalker(d.x, d.z, d.w);
    w.state = 'emerge'; w.heading = Math.atan2(-d.nz, d.nx); aimAt(w, d.w, d.x, d.z);
    walkers.push(w);
  } else {
    const v = anyOf(walkNodes), w = makeWalker(X[v] + rr(-0.12, 0.12), Z[v] + rr(-0.12, 0.12), v);
    w.gx = w.x; w.gz = w.z; w.pause = rr(0.4, 1.6);
    walkers.push(w);
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
  if (Math.random() < (stopAt[u] ? 0.35 : 0.08)) w.pause = rr(0.8, 2.6);
  // mostly straight on, now and then round a corner, rarely back the way it came
  const hx = Math.cos(w.heading), hz = -Math.sin(w.heading);
  let best = -1, bs = -1e9;
  for (const n of ringW[u]) {
    if (!walkable[n]) continue;
    const dx = X[n] - X[u], dz = Z[n] - Z[u], l = Math.hypot(dx, dz) || 1;
    const s = (dx * hx + dz * hz) / l + Math.random() * 1.3 - (n === w.prev ? 2.5 : 0);
    if (s > bs) { bs = s; best = n; }
  }
  if (best < 0) { w.pause = rr(1, 2.5); w.prev = -1; return; }
  w.prev = u; w.node = best; aimAt(w, best, X[u], Z[u]);
}
function updateWalkers(dt) {
  const night = nightNow();
  const want = Math.min(lifeCap().walkers, Math.round((walkNodes.length * 0.3 + doors.length * 0.8) * (1 - 0.55 * night)));
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

// ---------- the harbour: open water, piers and berths ----------
let seaNode = new Uint8Array(V), nearLand = new Uint8Array(V), shoreNodes = [], piers = [], docks = [], steamerBerth = null;
function isSea(x, z) { const v = nearestVertex(x, z); return v < 0 || cols[v] === 0; }
function computeHarbour() {
  for (let v = 0; v < V; v++) seaNode[v] = cols[v] === 0 && ringW[v].length ? 1 : 0;
  shoreNodes = []; nearLand.fill(0);
  for (let v = 0; v < V; v++) {
    if (F(v, 0) && ringW[v].some((w) => seaNode[w])) shoreNodes.push(v);
    if (seaNode[v] && ringW[v].some((w) => cols[w])) nearLand[v] = 1;
  }
  const isDeck = (v) => F(v, 0) && M(v, 0) === M_TIMBER;
  const pierOf = new Int32Array(V).fill(-1); piers = [];
  for (let v = 0; v < V; v++) {
    if (!isDeck(v) || pierOf[v] >= 0) continue;
    const id = piers.length, cells = [v]; pierOf[v] = id;
    for (let k = 0; k < cells.length; k++) for (const w of ringW[cells[k]]) if (isDeck(w) && pierOf[w] < 0) { pierOf[w] = id; cells.push(w); }
    piers.push({ id, size: cells.length, cells });
  }
  docks = [];
  for (const p of piers) for (const v of p.cells) {
    if (F(v, 1)) continue;
    ringW[v].forEach((w, i) => {
      if (!seaNode[w] || edgeLen(v, i) < 0.45) return;
      const f = wallFrame(v, i);
      docks.push({ key: v * 16 + i, v, w, pier: p.id, x: f.ax + f.ux * f.W / 2, z: f.az + f.uz * f.W / 2, nx: f.nx, nz: f.nz, ux: f.ux, uz: f.uz, open: ringW[w].filter((u) => seaNode[u]).length, busy: null });
    });
  }
  // the steamer ties up alongside the most open stretch of the longest pier, three cells or more
  steamerBerth = null;
  const big = piers.filter((p) => p.size >= 3).sort((a, b) => b.size - a.size)[0];
  if (big) {
    let best = null, bs = -1;
    for (const d of docks) {
      if (d.pier !== big.id) continue;
      const cx = d.x + d.nx * 0.46, cz = d.z + d.nz * 0.46;
      for (const sgn of [1, -1]) {
        const hx = d.ux * sgn, hz = d.uz * sgn;
        let score = d.open;
        for (const k of [-1.4, -0.75, 0.75, 1.4]) if (isSea(cx + hx * k, cz + hz * k) && isSea(cx + hx * k + d.nx * 0.3, cz + hz * k + d.nz * 0.3)) score += 1.5;
        if (score > bs) { bs = score; best = { key: d.key, x: cx, z: cz, hx, hz, heading: Math.atan2(-hz, hx) }; }
      }
    }
    if (best && bs >= 7) steamerBerth = best;
  }
  // launches keep clear of the steamer's stretch of quay
  if (steamerBerth) for (const d of docks) {
    const px = d.x + d.nx * 0.27 - steamerBerth.x, pz = d.z + d.nz * 0.27 - steamerBerth.z;
    const along = Math.max(-0.8, Math.min(0.8, px * steamerBerth.hx + pz * steamerBerth.hz));
    if (Math.hypot(px - steamerBerth.hx * along, pz - steamerBerth.hz * along) < 0.62) d.steamer = true;
  }
}
// shortest way over open water, kept off the quays where it can be
function seaPath(from, to) {
  if (from < 0 || to < 0 || !seaNode[from] || !seaNode[to]) return null;
  const dist = new Float64Array(V).fill(Infinity), prev = new Int32Array(V).fill(-1), heap = [];
  const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  dist[from] = 0; push(0, from);
  while (heap.length) {
    const [d, u] = pop();
    if (u === to) break;
    if (d > dist[u]) continue;
    for (const w of ringW[u]) {
      if (!seaNode[w]) continue;
      const nd = d + Math.hypot(X[w] - X[u], Z[w] - Z[u]) * (nearLand[w] ? 2.4 : 1);
      if (nd < dist[w]) { dist[w] = nd; prev[w] = u; push(nd, w); }
    }
  }
  if (!isFinite(dist[to])) return null;
  const path = []; for (let u = to; u >= 0; u = prev[u]) path.push(u);
  return path.reverse();
}
function nearestSeaNode(x, z) {
  const v = nearestVertex(x, z);
  if (v >= 0 && seaNode[v]) return v;
  let best = -1, bd = 1e9;
  for (let u = 0; u < V; u++) if (seaNode[u]) { const d = (X[u] - x) ** 2 + (Z[u] - z) ** 2; if (d < bd) { bd = d; best = u; } }
  return best;
}
function farSeaNode(minR, maxR = 1e9) {
  const opts = [], wider = [];
  for (let u = 0; u < V; u++) {
    if (!seaNode[u]) continue;
    const r = Math.hypot(X[u] - townCX, Z[u] - townCZ);
    if (r > minR) (r < maxR ? opts : wider).push(u);
  }
  return opts.length ? anyOf(opts) : wider.length ? anyOf(wider) : -1;
}

// ---------- boats ----------
function hullInto(g, L, B, H, D, col, deck) {
  const top = [[L * 0.5, 0], [L * 0.3, B * 0.5], [-L * 0.4, B * 0.5], [-L * 0.5, B * 0.34], [-L * 0.5, -B * 0.34], [-L * 0.4, -B * 0.5], [L * 0.3, -B * 0.5]];
  const bot = top.map(([x, z]) => [x * 0.86, z * 0.5]);
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    const a = [top[i][0], H, top[i][1]], b = [top[j][0], H, top[j][1]], c = [bot[j][0], -D, bot[j][1]], d = [bot[i][0], -D, bot[i][1]];
    let n = nrm3(cross3(sub3(b, a), sub3(d, a)));
    const mid = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]; if (n[0] * mid[0] + n[2] * mid[2] < 0) n = neg3(n);
    g.quad(a, b, c, d, n, col, S_PLAIN);
    g.box([(a[0] + b[0]) / 2, H + 0.006, (a[2] + b[2]) / 2], nrm3(sub3(b, a)), UP, nrm3(cross3(nrm3(sub3(b, a)), UP)), Math.hypot(b[0] - a[0], b[2] - a[2]) / 2 + 0.004, 0.008, 0.008, lin(0xe8dcc0), S_PLAIN);
  }
  for (let i = 1; i < top.length - 1; i++) g.tri([top[0][0], H, top[0][1]], [top[i][0], H, top[i][1]], [top[i + 1][0], H, top[i + 1][1]], UP, deck, S_WOOD);
}
function launchGeometry(hex) {
  const g = new Geo(), cream = lin(0xe8dcc0);
  hullInto(g, 0.5, 0.17, 0.05, 0.05, lin(hex), C_DECK);
  g.box([-0.05, 0.09, 0], XA, UP, ZA, 0.075, 0.04, 0.06, cream, S_WOOD);
  g.box([-0.05, 0.136, 0], XA, UP, ZA, 0.088, 0.008, 0.072, lin(0x3a3530), S_PLAIN);
  g.glow = 1.1;
  for (const s of [-1, 1]) g.box([-0.05, 0.1, 0.061 * s], XA, UP, ZA, 0.06, 0.012, 0.002, C_GLASS, S_GLASS);
  g.glow = 0;
  g.cyl([0.07, 0.05, 0], [0.07, 0.2, 0], 0.02, 0.02, 8, C_IRON, S_IRON);
  g.cyl([0.07, 0.165, 0], [0.07, 0.18, 0], 0.022, 0.022, 8, C_BRASS, S_BRASS);
  g.cyl([-0.22, 0.05, 0], [-0.22, 0.2, 0], 0.003, 0.003, 4, C_IRON, S_IRON, false);
  g.twoSided([-0.22, 0.2, 0], [-0.22, 0.16, 0], [-0.3, 0.18, 0], ZA, lin(0x9a2a1e), S_PLAIN);
  return g.toGeometry();
}
function steamerGeometry() {
  const g = new Geo(), cream = lin(0xe8dcc0), red = lin(0x9a2a1e), H = 0.07, B = 0.32;
  hullInto(g, 1.5, B, H, 0.06, lin(0x1e1e22), C_DECK);
  // paddle boxes
  for (const s of [-1, 1]) {
    const zi = (B / 2 - 0.01) * s, zo = (B / 2 + 0.13) * s, R = 0.17, cy = 0.03, seg = 12;
    const arc = (z, k) => { const a = (Math.PI * k) / seg; return [R * Math.cos(a), cy + R * Math.sin(a), z]; };
    for (let k = 0; k < seg; k++) {
      g.tri([0, cy, zo], arc(zo, k), arc(zo, k + 1), [0, 0, s], cream, S_PLAIN);
      const a0 = arc(zi, k), a1 = arc(zi, k + 1), b0 = arc(zo, k), b1 = arc(zo, k + 1), am = (Math.PI * (k + 0.5)) / seg;
      g.quad(a0, a1, b1, b0, [Math.cos(am), Math.sin(am), 0], cream, S_PLAIN);
      g.box(add3(arc(zo, k + 0.5), [0, 0, 0.004 * s]), nrm3(sub3(arc(zo, k + 1), arc(zo, k))), [0, 0, s], nrm3(cross3(nrm3(sub3(arc(zo, k + 1), arc(zo, k))), [0, 0, s])), (R * Math.PI) / seg / 2 + 0.003, 0.004, 0.012, C_BRASS, S_BRASS);
    }
  }
  g.box([-0.05, H + 0.07, 0], XA, UP, ZA, 0.48, 0.07, 0.12, cream, S_WOOD);
  g.box([-0.05, H + 0.148, 0], XA, UP, ZA, 0.52, 0.008, 0.15, C_DECK, S_WOOD);
  g.glow = 1.15;
  for (const s of [-1, 1]) g.box([-0.05, H + 0.085, 0.121 * s], XA, UP, ZA, 0.44, 0.018, 0.002, C_GLASS, S_GLASS);
  g.glow = 0;
  g.box([0.33, H + 0.215, 0], XA, UP, ZA, 0.08, 0.06, 0.08, cream, S_WOOD);
  g.box([0.33, H + 0.28, 0], XA, UP, ZA, 0.09, 0.006, 0.09, lin(0x3a3530), S_PLAIN);
  g.glow = 1.15; g.box([0.411, H + 0.225, 0], XA, UP, ZA, 0.002, 0.02, 0.06, C_GLASS, S_GLASS); g.glow = 0;
  for (const s of [-1, 1]) g.box([-0.05, H + 0.19, 0.145 * s], XA, UP, ZA, 0.5, 0.004, 0.003, C_BRASS, S_BRASS);
  for (const fx of [0.06, -0.2]) {
    g.cyl([fx, H + 0.15, 0], [fx, H + 0.62, 0], 0.042, 0.042, 12, red, S_PLAIN);
    g.cyl([fx, H + 0.55, 0], [fx, H + 0.62, 0], 0.045, 0.045, 12, C_IRON, S_IRON);
  }
  g.cyl([0.58, H, 0], [0.58, H + 0.5, 0], 0.006, 0.004, 5, C_IRON, S_IRON, false);
  g.cyl([-0.68, H, 0], [-0.68, H + 0.32, 0], 0.005, 0.004, 5, C_IRON, S_IRON, false);
  g.twoSided([-0.68, H + 0.32, 0], [-0.68, H + 0.24, 0], [-0.8, H + 0.28, 0], ZA, red, S_PLAIN);
  return g.toGeometry();
}
const LAUNCH_GEOS = [0x2f4a3a, 0x7b2a22, 0x283a5c].map(launchGeometry), STEAMER_GEO = steamerGeometry();
const EMIT_BOAT = { life: [1.4, 2.0], s: [0.04, 0.26], a: 0.38, vy: 0.4, spread: 0.01 };
const EMIT_FUNNEL = { life: [3.2, 4.2], s: [0.1, 0.62], a: 0.42, vy: 0.5, spread: 0.03 };
const EMIT_WAKE = { life: [1.3, 1.9], s: [0.05, 0.26], a: 0.3, vy: 0, spread: 0.02 };
const boats = [];
function makeBoat(kind, x, z, heading) {
  const grp = new THREE.Group();
  const hull = new THREE.Mesh(kind === 'steamer' ? STEAMER_GEO : anyOf(LAUNCH_GEOS), townMat);
  hull.castShadow = true; hull.receiveShadow = true; grp.add(hull);
  const b = { kind, grp, hull, x, z, heading, speed: 0, wps: [], final: null, state: 'idle', timer: rr(1, 3), dock: null, lastPier: -1, phase: Math.random() * 6, puffT: 0, wakeT: 0, paddles: [], back: 0, sink: 0 };
  if (kind === 'steamer') {
    b.maxSpeed = 0.6; b.turn = 0.5;
    for (const s of [-1, 1]) { const p = new THREE.Mesh(wheelGeo, wheelMat); p.scale.set(0.37, 0.37, 0.5); p.position.set(0, 0.03, (0.16 + 0.06) * s); p.castShadow = true; grp.add(p); b.paddles.push(p); }
  } else { b.maxSpeed = rr(0.48, 0.6); b.turn = 1.8; }
  scene.add(grp);
  boats.push(b);
  return b;
}
const boatAt = (b, lx, ly, lz) => { const c = Math.cos(b.heading), s = Math.sin(b.heading); return [b.x + lx * c + lz * s, WATER_Y + ly, b.z - lx * s + lz * c]; };
function routeTo(b, node, extra) {
  const path = seaPath(nearestSeaNode(b.x, b.z), node);
  if (!path) return false;
  b.wps = path.slice(1).map((v) => [X[v], Z[v]]).concat(extra || []);
  return true;
}
// a launch's next trip: to a free berth on another pier, or out to sea and back
function planLaunch(b) {
  if (b.dock && b.dock.busy === b) b.dock.busy = null;
  b.dock = null; b.final = null;
  const free = docks.filter((d) => !d.busy && !d.steamer && d.pier !== b.lastPier);
  const pool = free.length ? free : docks.filter((d) => !d.busy && !d.steamer);
  if (pool.length && !(b.lastPier >= 0 && Math.random() < 0.3)) {
    const d = anyOf(pool);
    if (routeTo(b, d.w, [[d.x + d.nx * 0.64, d.z + d.nz * 0.64], [d.x + d.nx * 0.27, d.z + d.nz * 0.27]])) {
      b.dock = d; d.busy = b; b.final = Math.atan2(d.nz, -d.nx); b.state = 'sail'; return;
    }
  }
  const far = farSeaNode(townRad + 2, townRad + 6);
  if (far < 0 || !routeTo(b, far)) b.wps = [[b.x + rr(-3, 3), b.z + rr(-3, 3)]];
  b.state = 'out';
}
function steerBoat(b, dt, sp) {
  const wp = b.wps[0];
  let target = b.maxSpeed * (1 + tension * 0.5);
  if (wp) {
    const dx = wp[0] - b.x, dz = wp[1] - b.z, d = Math.hypot(dx, dz), last = b.wps.length === 1;
    if (last && b.final !== null) target = Math.min(target, Math.max(0.05, d * 0.8));
    if (d < (last ? 0.05 : 0.5)) { b.wps.shift(); }
    else {
      const want = Math.atan2(-dz, dx), off = angDiff(b.heading, want);
      b.heading += Math.max(-b.turn, Math.min(b.turn, off * 2.2)) * dt * sp;
      if (Math.abs(off) > 1.1) target *= 0.35;
    }
  } else target = 0;
  b.speed += (target - b.speed) * Math.min(1, dt * 1.2);
  b.x += Math.cos(b.heading) * b.speed * dt * sp; b.z -= Math.sin(b.heading) * b.speed * dt * sp;
  return !b.wps.length;
}
function circlePoint(b, ahead) {
  const R = Math.max(townRad + 3.4, 6);
  const a = Math.atan2(b.z - townCZ, b.x - townCX) + ahead * (b.dir || 1);
  return [townCX + Math.cos(a) * R, townCZ + Math.sin(a) * R];
}
function updateBoats(dt, t, sp) {
  for (let i = boats.length - 1; i >= 0; i--) {
    const b = boats[i];
    if (b.sink) { b.sink += dt; b.grp.position.y = WATER_Y - b.sink * 0.25; if (b.sink > 1.2) { scene.remove(b.grp); boats.splice(i, 1); } continue; }
    if (b.kind === 'launch') {
      if (b.state === 'idle') { b.timer -= dt; if (b.timer <= 0) planLaunch(b); }
      else if (b.state === 'back') { b.back -= dt; b.speed = -0.14; b.x += Math.cos(b.heading) * b.speed * dt * sp; b.z -= Math.sin(b.heading) * b.speed * dt * sp; if (b.back <= 0) { b.speed = 0; planLaunch(b); } }
      else if (b.state === 'moored') {
        b.speed = 0; b.timer -= dt;
        if (b.final !== null) b.heading += angDiff(b.heading, b.final) * Math.min(1, dt * 2);
        if (b.timer <= 0) { b.lastPier = b.dock ? b.dock.pier : -1; b.state = 'back'; b.back = 1.6; hornNear(b, false); }
      } else if (steerBoat(b, dt, sp)) {
        if (b.state === 'sail' && b.dock) { b.state = 'moored'; b.timer = rr(4, 8); }
        else { b.state = 'idle'; b.timer = rr(1, 4); }
      }
      if (b.replan) { b.replan = false; planLaunch(b); }
    } else updateSteamer(b, dt, sp);
    // bob and lean, smoke and wake
    const bob = Math.sin(t * 1.7 + b.phase) * (b.kind === 'steamer' ? 0.006 : 0.01);
    b.grp.position.set(b.x, WATER_Y + bob, b.z);
    b.grp.rotation.set(Math.sin(t * 1.3 + b.phase) * 0.02, b.heading, Math.sin(t * 1.1 + b.phase * 2) * 0.012);
    b.puffT -= dt;
    if (b.puffT <= 0) {
      if (b.kind === 'steamer') { for (const fx of [0.06, -0.2]) emitPuff(EMIT_FUNNEL, boatAt(b, fx, 0.07 + 0.66, 0)); b.puffT = b.speed > 0.1 ? 0.28 : 0.7; }
      else { emitPuff(EMIT_BOAT, boatAt(b, 0.07, 0.22, 0)); b.puffT = b.speed > 0.1 ? 0.3 : 0.9; }
    }
    b.wakeT -= dt;
    if (Math.abs(b.speed) > 0.12 && b.wakeT <= 0) {
      const back = b.kind === 'steamer' ? -0.72 : -0.24;
      for (const s of [-1, 1]) emitPuff(EMIT_WAKE, boatAt(b, back, 0.02, (b.kind === 'steamer' ? 0.1 : 0.05) * s));
      b.wakeT = tier === 'high' ? 0.09 : 0.2;
    }
    for (const p of b.paddles) {
      p.rotation.z -= dt * b.speed * 9 * sp;
      if (Math.abs(b.speed) > 0.1 && Math.random() < dt * 14) { const s = p.position.z > 0 ? 1 : -1, w = boatAt(b, rr(-0.12, 0.12), 0.02, 0.22 * s); spawn(w[0], w[1], w[2], rr(-0.2, 0.2), rr(0.4, 0.8), rr(-0.2, 0.2), 0.6, 0.04, 0.1, 0.5, 1); }
    }
  }
}
function updateSteamer(b, dt, sp) {
  const berth = steamerBerth;
  if (b.state === 'leaving') {
    if (!b.wps.length) { const a = Math.atan2(b.z - townCZ, b.x - townCX); b.wps = [[townCX + Math.cos(a) * (townRad + 16), townCZ + Math.sin(a) * (townRad + 16)]]; }
    steerBoat(b, dt, sp);
    if (Math.hypot(b.x - townCX, b.z - townCZ) > townRad + 14) b.sink = 0.001;
    return;
  }
  if (!berth && b.state !== 'cruise' && b.state !== 'out') { b.state = 'leaving'; b.wps = []; return; }
  if (b.state === 'idle' || b.state === 'cruise') {
    b.state = 'cruise'; b.timer -= dt;
    if (!b.wps.length) b.wps = [circlePoint(b, 0.5)];
    steerBoat(b, dt, sp);
    if (!berth && b.timer < -20) { b.state = 'leaving'; b.wps = []; return; }
    if (berth && b.timer <= 0) {
      const ax = berth.x - berth.hx * 1.9, az = berth.z - berth.hz * 1.9;
      if (routeTo(b, nearestSeaNode(ax, az), [[ax, az], [berth.x, berth.z]])) { b.state = 'approach'; b.final = berth.heading; b.berthKey = berth.key; }
      else b.timer = 10;
    }
  } else if (b.state === 'approach') {
    if (!berth || berth.key !== b.berthKey) { b.state = 'cruise'; b.wps = []; b.final = null; b.timer = 15; return; }
    if (steerBoat(b, dt, sp)) {
      b.state = 'berthed'; b.timer = 18; b.speed = 0; hornNear(b, true);
      if (firstTime('steamer')) flashHint('The paddle steamer calls', 'She ties up at your longest pier');
    }
  } else if (b.state === 'berthed') {
    b.speed = 0; b.timer -= dt;
    b.heading += angDiff(b.heading, b.final) * Math.min(1, dt * 1.5);
    b.x += (berth ? berth.x - b.x : 0) * Math.min(1, dt * 2); b.z += (berth ? berth.z - b.z : 0) * Math.min(1, dt * 2);
    if (b.timer <= 0 || !berth || berth.key !== b.berthKey) {
      b.state = 'depart'; b.final = null; hornNear(b, true);
      b.wps = [[b.x + Math.cos(b.heading) * 1.1, b.z - Math.sin(b.heading) * 1.1]];
    }
  } else if (b.state === 'depart') {
    if (steerBoat(b, dt, sp)) {
      const c = circlePoint(b, 0.3);
      if (!routeTo(b, nearestSeaNode(c[0], c[1]))) b.wps = [c];
      b.state = 'out';
    }
  } else if (b.state === 'out') {
    if (steerBoat(b, dt, sp)) { b.state = 'cruise'; b.wps = []; b.timer = rr(28, 50); b.dir = Math.random() < 0.5 ? 1 : -1; }
  }
}
function syncBoats() {
  const cap = lifeCap().launches;
  const pierCount = new Set(docks.map((d) => d.pier)).size;
  const want = Math.min(cap, Math.max(1, Math.min(pierCount + 1, Math.ceil(docks.length / 4))));
  const launches = boats.filter((b) => b.kind === 'launch' && !b.sink);
  for (let k = launches.length; k < want; k++) {
    const far = farSeaNode(booted ? townRad + 3 : townRad + 1), v = far >= 0 ? far : nearestSeaNode(townCX + townRad + 3, townCZ);
    if (v < 0) break;
    makeBoat('launch', X[v], Z[v], Math.random() * 6.28).timer = rr(0.5, 3);
  }
  for (let k = launches.length - 1; k >= want; k--) { const b = launches[k]; if (b.dock) b.dock.busy = null; b.sink = 0.001; }
  const steamer = boats.find((b) => b.kind === 'steamer' && !b.sink);
  if (steamerBerth && !steamer) {
    const a = Math.random() * Math.PI * 2, R = Math.max(townRad + 3.4, 6) + 5;
    const b = makeBoat('steamer', townCX + Math.cos(a) * R, townCZ + Math.sin(a) * R, a + Math.PI / 2);
    b.state = 'cruise'; b.timer = rr(6, 12); b.dir = 1;
  }
}
// after the town changes: re-link berths, and boats now sitting on land quietly go
function relinkBoats() {
  for (const b of boats) {
    if (b.sink) continue;
    if (b.dock) {
      const d = docks.find((dd) => dd.key === b.dock.key);
      if (d) { b.dock = d; d.busy = b; } else { b.dock = null; if (b.state === 'sail' || b.state === 'moored') b.replan = true; }
    }
    if (!isSea(b.x, b.z) && b.state !== 'berthed') b.sink = 0.001;
  }
}

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
function newGull(x, y, z) {
  return { x, y, z, state: 'circle', cx: x, cz: z, cy: y, r: rr(0.6, 1.6), ang: Math.random() * 6.283, dir: Math.random() < 0.5 ? -1 : 1, t: rr(6, 14), flapT: Math.random() * 6, glide: rr(0.5, 2), flapping: true, heading: 0, perch: null, look: 0 };
}
function circleAround(g, x, y, z) { g.state = 'circle'; g.cx = x; g.cz = z; g.cy = y; g.r = rr(0.6, 1.6); g.t = rr(6, 14); g.ang = Math.atan2(g.z - z, g.x - x); }
function takeOff(g) {
  if (g.perch && g.perch.taken === g) g.perch.taken = null;
  g.perch = null; circleAround(g, g.x + rr(-0.8, 0.8), g.y + rr(0.7, 1.4), g.z + rr(-0.8, 0.8)); g.flapping = true; g.glide = 1.2;
}
function scatterGulls(x, z) { for (const g of gulls) if (g.state === 'perch' && Math.hypot(g.x - x, g.z - z) < 1.8) takeOff(g); }
const mastBusy = () => ships.some((s) => s.state === 'final' || s.state === 'docked');
function freePerch(x, z, maxD) {
  let best = null, bd = maxD; const busy = mastBusy();
  for (const p of perchList) { if (p.taken || (p.mast && busy)) continue; const d = Math.hypot(p.x - x, p.z - z) + Math.random() * 1.5; if (d < bd) { bd = d; best = p; } }
  return best;
}
function updateGulls(dt, sp) {
  const night = nightNow();
  const want = perchList.length ? Math.min(lifeCap().gulls, Math.max(3, Math.round(perchList.length / 3))) : 2;
  while (gulls.length < want) gulls.push(newGull(townCX + rr(-4, 4), Math.max(2.4, heightAt(townCX, townCZ) + 0.4) + rr(0, 1), townCZ + rr(-4, 4)));
  while (gulls.length > want) { const g = gulls.pop(); if (g.perch) g.perch.taken = null; }
  for (const g of gulls) {
    const px = g.x, pz = g.z;
    if (g.state === 'circle') {
      g.t -= dt;
      g.ang += (0.9 / Math.max(0.5, g.r)) * g.dir * dt * sp;
      const tx = g.cx + g.r * Math.cos(g.ang), tz = g.cz + g.r * Math.sin(g.ang), ty = Math.max(g.cy + 0.15 * Math.sin(g.ang * 2), heightAt(tx, tz) + 0.3);
      const k = Math.min(1, dt * 2.2);
      g.x += (tx - g.x) * k; g.y += (ty - g.y) * k; g.z += (tz - g.z) * k;
      if (g.t <= 0 || night > 0.5) {
        const p = freePerch(g.x, g.z, night > 0.5 ? 40 : 9);
        if (p) { g.state = 'land'; g.perch = p; p.taken = g; g.flapping = true; }
        else if (perchList.length) { const q = anyOf(perchList); circleAround(g, q.x, q.y + rr(0.8, 1.8), q.z); }
        else circleAround(g, townCX + rr(-3, 3), g.y, townCZ + rr(-3, 3));
      }
    } else if (g.state === 'land') {
      const p = g.perch, dx = p.x - g.x, dy = p.y - g.y, dz = p.z - g.z, d = Math.hypot(dx, dy, dz);
      if (d < 0.03) { g.state = 'perch'; g.x = p.x; g.y = p.y; g.z = p.z; g.t = rr(4, 14); g.heading = Math.random() * 6.283; }
      else { const s = Math.min(d, (0.6 + d * 0.8) * dt * sp); g.x += (dx / d) * s; g.y += (dy / d) * s; g.z += (dz / d) * s; }
    } else if (g.state === 'perch') {
      g.t -= dt; g.look -= dt;
      if (g.look <= 0) { g.heading += rr(-0.8, 0.8); g.look = rr(1, 3); }
      if ((g.t <= 0 && night < 0.5) || (g.perch.mast && mastBusy())) takeOff(g);
    }
    const vx = g.x - px, vz = g.z - pz;
    if (g.state !== 'perch' && Math.hypot(vx, vz) > 1e-4) g.heading += angDiff(g.heading, Math.atan2(-vz, vx)) * Math.min(1, dt * 6);
    g.glide -= dt;
    if (g.glide <= 0) { g.flapping = !g.flapping || g.state === 'land'; g.glide = g.flapping ? rr(0.6, 1.4) : rr(1, 2.5); }
    g.flapT += dt * (g.flapping ? 13 : 0) * (REDUCED ? 0.5 : 1);
  }
}
function drawGulls() {
  let n = 0, nw = 0;
  for (const g of gulls) {
    _og.position.set(g.x, g.y, g.z); _og.rotation.set(0, g.heading, 0); _og.scale.setScalar(1); _og.updateMatrix();
    gullIM.setMatrixAt(n++, _og.matrix);
    const perched = g.state === 'perch';
    const flap = perched ? -0.35 : g.flapping ? Math.sin(g.flapT) * 0.85 : 0.12;
    for (const s of [1, -1]) {
      _og.position.set(g.x, g.y + 0.012, g.z); _og.rotation.set(-flap * s, g.heading, 0); _og.scale.set(1, 1, s * (perched ? 0.32 : 1)); _og.updateMatrix();
      wingIM.setMatrixAt(nw++, _og.matrix);
    }
  }
  gullIM.count = n; wingIM.count = nw; gullIM.instanceMatrix.needsUpdate = wingIM.instanceMatrix.needsUpdate = true;
}

// ---------- keeping life in step with the town ----------
function syncLife() {
  computeWalk(); computeHarbour();
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
  relinkBoats(); syncBoats();
  lifeReady = true;
}
function updateLife(dt, t) {
  const sp = REDUCED ? 0.6 : 1, night = nightNow();
  updateWalkers(dt); updateBoats(dt, t, sp); updateGulls(dt, sp);
  nLights = 0;
  drawWalkers(night); drawGulls();
  if (night > 0.3) for (const b of boats) {
    if (b.sink) continue;
    if (b.kind === 'steamer') { const m = boatAt(b, 0.58, 0.07 + 0.5, 0), s = boatAt(b, -0.68, 0.07 + 0.3, 0); addLight(m[0], m[1], m[2], 0.32); addLight(s[0], s[1], s[2], 0.22); }
    else { const m = boatAt(b, 0.2, 0.1, 0); addLight(m[0], m[1], m[2], 0.2); }
  }
  lhGeo.setDrawRange(0, nLights); lhPosAttr.needsUpdate = true; lhGeo.attributes.size.needsUpdate = true;
  lifeHalo.visible = halos.visible && nLights > 0;
}
const LIFE_MATS = [coatMat, autoMat, legMat, lanternMat, gullMat, wingMat];
let lifeReady = false;
function setLifeShadows(on) { for (const im of [walkIM.bodyA, walkIM.bodyB, walkIM.headA, walkIM.headB, walkIM.headC, walkIM.legs, gullIM, wingIM]) im.castShadow = on; }

// ---------- the harbour's sound: water, gulls, mill wheels, horns, gaslight, the hour ----------
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
function horn(vol, big) {
  const t = actx.currentTime, dur = big ? 1.5 : 0.32, f = actx.createBiquadFilter(), g = actx.createGain();
  f.type = 'lowpass'; f.frequency.value = big ? 650 : 1500; f.Q.value = 2;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.09); g.gain.setValueAtTime(vol, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0004, t + dur + 0.1);
  for (const hz of big ? [98, 131] : [233, 311]) { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.connect(f); o.start(t); o.stop(t + dur + 0.12); }
  f.connect(g); g.connect(amb.out);
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
function hornNear(b, big) { if (amb && soundOn && actx) horn((big ? 0.075 : 0.035) * (0.4 + 0.6 * nearness(b.x, b.z, 14)), big); }
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
