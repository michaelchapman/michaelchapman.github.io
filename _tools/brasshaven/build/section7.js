/* ============================================================
   7. The working town: engines, mill wheels, clockwork trains, clocks,
      power districts, steam, gaslight, time of day and airships
   ============================================================ */
const chunkDyn = [];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const ZV = new THREE.Vector3(0, 0, 1), YV = new THREE.Vector3(0, 1, 0);

function mergeParts(parts) {
  const list = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let n = 0; for (const p of list) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const p of list) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}
const brassMat = new THREE.MeshStandardMaterial({ color: 0xc89c4c, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 });
const steelMat = new THREE.MeshStandardMaterial({ color: 0xb4b8bc, metalness: 1, roughness: 0.26 });
const redMat = new THREE.MeshStandardMaterial({ color: 0x7d2318, metalness: 0.25, roughness: 0.5 });
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, metalness: 0, roughness: 0.85 });
const handMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, metalness: 0.5, roughness: 0.45 });

// a spur gear whose teeth sit on the shared pitch, so any two trains mesh
function gearGeometry(n) {
  const R = pitchR(n), r1 = R + 0.014, r0 = R - 0.017, step = (Math.PI * 2) / n;
  const sh = new THREE.Shape();
  for (let k = 0; k < n; k++) {
    const c = k * step;
    [[r0, c - 0.3 * step], [r1, c - 0.14 * step], [r1, c + 0.14 * step], [r0, c + 0.3 * step]].forEach(([r, a], j) => {
      const x = r * Math.cos(a), y = r * Math.sin(a);
      if (!k && !j) sh.moveTo(x, y); else sh.lineTo(x, y);
    });
  }
  sh.closePath();
  if (n >= 12) {
    const nh = n >= 20 ? 5 : 4, hr = n >= 20 ? 0.028 : 0.013, hc = n >= 20 ? 0.072 : 0.043;
    for (let h = 0; h < nh; h++) { const a = (h * 2 * Math.PI) / nh + 0.4; const p = new THREE.Path(); p.absarc(Math.cos(a) * hc, Math.sin(a) * hc, hr, 0, Math.PI * 2, true); sh.holes.push(p); }
  }
  const body = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 6 }).translate(0, 0, -0.007);
  const hub = new THREE.CylinderGeometry(0.017, 0.017, 0.03, 10).rotateX(Math.PI / 2);
  return mergeParts([body, hub]);
}
// flywheel of unit radius in its plane, real thickness across it; crank pin at half radius
function flywheelGeometry() {
  const rim = new THREE.Shape(); rim.absarc(0, 0, 1, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.83, 0, Math.PI * 2, true); rim.holes.push(hole);
  const parts = [new THREE.ExtrudeGeometry(rim, { depth: 0.045, bevelEnabled: false, curveSegments: 32 }).translate(0, 0, -0.0225)];
  for (let j = 0; j < 6; j++) parts.push(new THREE.BoxGeometry(0.84, 0.1, 0.022).translate(0.42, 0, 0).rotateZ((j * Math.PI) / 3 + Math.PI / 6));
  parts.push(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 14).rotateX(Math.PI / 2));
  parts.push(new THREE.BoxGeometry(0.66, 0.16, 0.02).translate(0.24, 0, 0.035));
  parts.push(new THREE.CylinderGeometry(0.07, 0.07, 0.055, 8).rotateX(Math.PI / 2).translate(0.5, 0, 0.06));
  return mergeParts(parts);
}
function waterWheelGeometry() {
  const parts = [];
  const ringG = (ro, ri, z) => {
    const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(h);
    return new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false, curveSegments: 28 }).translate(0, 0, z - 0.011);
  };
  for (const z of [-0.075, 0.075]) {
    parts.push(ringG(0.4, 0.365, z), ringG(0.2, 0.175, z));
    for (let j = 0; j < 8; j++) parts.push(new THREE.BoxGeometry(0.37, 0.026, 0.02).translate(0.185, 0, z).rotateZ((j * Math.PI) / 4));
  }
  for (let j = 0; j < 12; j++) parts.push(new THREE.BoxGeometry(0.13, 0.016, 0.17).translate(0.37, 0, 0).rotateZ((j * Math.PI) / 6 + 0.13));
  parts.push(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12).rotateX(Math.PI / 2));
  return mergeParts(parts);
}
function propGeometry() {
  const parts = [new THREE.SphereGeometry(0.03, 8, 6)];
  for (let j = 0; j < 3; j++) parts.push(new THREE.BoxGeometry(0.012, 0.17, 0.045).translate(0, 0.09, 0).rotateY(0.35).rotateX((j * 2 * Math.PI) / 3));
  return mergeParts(parts);
}
const GEAR_N = [8, 12, 20];
const gearGeos = {}; for (const n of GEAR_N) gearGeos[n] = gearGeometry(n);
const flyGeo = flywheelGeometry(), wheelGeo = waterWheelGeometry();
const rodGeo = new THREE.BoxGeometry(1, 0.026, 0.014);
const pistonGeo = new THREE.CylinderGeometry(0.011, 0.011, 1, 6).rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
const crossGeo = new THREE.BoxGeometry(0.05, 0.048, 0.032);
const hourGeo = new THREE.BoxGeometry(0.034, 0.15, 0.012).translate(0, 0.055, 0);
const minGeo = new THREE.BoxGeometry(0.022, 0.21, 0.012).translate(0, 0.085, 0.012);

// ---------- power: buildings that touch form a district; an engine or mill wheel powers it ----------
let clusterOf = new Int32Array(V).fill(-1), clusterPowered = [], tension = 0, booted = false, keyHinted = false;
const srcCount = { e: 0, w: 0 };
const isPowered = (v) => { const c = clusterOf[v]; return c >= 0 && clusterPowered[c]; };
const runFactor = (v) => (isPowered(v) ? 1 + tension * 2.5 : tension * 1.6);
function computePower() {
  clusterOf.fill(-1); clusterPowered = [];
  let ne = 0, nw = 0;
  for (let v = 0; v < V; v++) {
    if (clusterOf[v] >= 0 || !(cols[v] & ~1)) continue;
    const id = clusterPowered.length; let powered = false;
    const stack = [v]; clusterOf[v] = id;
    while (stack.length) {
      const u = stack.pop();
      if (engineSpot(u)) { powered = true; ne++; }
      if (wheelSpot(u)) { powered = true; nw++; }
      const cu = cols[u] & ~1;
      for (const w of ringW[u]) if (clusterOf[w] < 0 && (cols[w] & cu)) { clusterOf[w] = id; stack.push(w); }
    }
    clusterPowered.push(powered);
  }
  srcCount.e = ne; srcCount.w = nw;
}
function announceMachines(before, gearsBefore) {
  if (srcCount.e > before.e) flashHint('Steam up', 'This engine house powers every building joined to it');
  else if (srcCount.w > before.w) flashHint('The mill wheel turns', 'It powers every building joined to this house');
  else if (gearList.length > gearsBefore && !keyHinted && tension < 0.05 && gearList.some((g) => !g.parent && !isPowered(g.v))) {
    keyHinted = true;
    flashHint('This clockwork has no power', 'Join it to a cast-iron engine house, or wind the key');
  }
}

// ---------- instanced moving parts ----------
let dynMeshes = [];
let gearList = [], clockList = [], engineList = [], wheelList = [], emitList = [], lampList = [];
const angMem = new Map();
const pkey = (p) => Math.round(p[0] * 400) + ':' + Math.round(p[1] * 400) + ':' + Math.round(p[2] * 400);
function instanced(geo, mat, n, shadow) {
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.frustumCulled = false; im.castShadow = !!shadow; im.receiveShadow = true;
  scene.add(im); dynMeshes.push(im); return im;
}
const basisQ = (x, n) => new THREE.Quaternion().setFromRotationMatrix(_m4.makeBasis(x, YV, n));
function rebuildDyn() {
  // remember where every wheel had turned to, so rebuilding a chunk does not make machinery jump
  angMem.clear();
  for (const gr of gearList) if (!gr.parent) angMem.set(pkey(gr.p), gr.ang);
  for (const e of engineList) angMem.set(pkey(e.c), e.th);
  for (const w of wheelList) angMem.set(pkey(w.c), w.ang);
  for (const im of dynMeshes) { scene.remove(im); im.dispose(); }
  dynMeshes = [];
  gearList = []; clockList = []; engineList = []; wheelList = []; emitList = []; lampList = [];
  for (const d of chunkDyn) if (d) {
    for (const x of d.gears) gearList.push(x);
    for (const x of d.clocks) clockList.push(x);
    for (const x of d.engines) engineList.push(x);
    for (const x of d.wheels) wheelList.push(x);
    for (const x of d.emit) emitList.push(x);
    for (const x of d.lamps) lampList.push(x);
  }
  for (const n of GEAR_N) {
    const these = gearList.filter((gr) => gr.teeth === n);
    if (!these.length) continue;
    const im = instanced(gearGeos[n], brassMat, these.length, true);
    these.forEach((gr, i) => { gr.im = im; gr.idx = i; });
  }
  for (const gr of gearList) {
    gr.pos = new THREE.Vector3(...gr.p);
    gr.q0 = basisQ(new THREE.Vector3(...gr.x), new THREE.Vector3(...gr.n));
    gr.ang = gr.parent ? 0 : angMem.get(pkey(gr.p)) ?? hash4(Math.round(gr.p[0] * 50), Math.round(gr.p[2] * 50), Math.round(gr.p[1] * 50), 3) * 6;
  }
  if (engineList.length) {
    const n = engineList.length;
    const fw = instanced(flyGeo, redMat, n, true), rod = instanced(rodGeo, steelMat, n, true), pis = instanced(pistonGeo, steelMat, n, false), xh = instanced(crossGeo, brassMat, n, false);
    engineList.forEach((e, i) => {
      Object.assign(e, { idx: i, fw, rod, pis, xh });
      const N = new THREE.Vector3(...e.n), A = new THREE.Vector3().crossVectors(YV, N).normalize();
      e.A = A; e.N = N; e.C = new THREE.Vector3(...e.c);
      e.sg = e.e[0] * A.x + e.e[2] * A.z >= 0 ? 1 : -1;
      e.q0 = basisQ(A, N);
      e.th = angMem.get(pkey(e.c)) ?? hash4(e.v, 3, 1, 4) * 6;
    });
  }
  if (wheelList.length) {
    const im = instanced(wheelGeo, wheelMat, wheelList.length, true);
    wheelList.forEach((w, i) => {
      const N = new THREE.Vector3(...w.n), A = new THREE.Vector3().crossVectors(YV, N).normalize();
      Object.assign(w, { im, idx: i, A, C: new THREE.Vector3(...w.c), q0: basisQ(A, N), acc: 0 });
      w.ang = angMem.get(pkey(w.c)) ?? hash4(w.v, 5, 1, 4) * 6;
    });
  }
  if (clockList.length) {
    const hourIM = instanced(hourGeo, handMat, clockList.length, false), minIM = instanced(minGeo, handMat, clockList.length, false);
    clockList.forEach((c, i) => {
      const n = new THREE.Vector3(...c.n), x = new THREE.Vector3().crossVectors(YV, n);
      Object.assign(c, { idx: i, hourIM, minIM, pos: new THREE.Vector3(...c.p), base: basisQ(x, n) });
    });
  }
  for (const em of emitList) em.acc = Math.random();
  rebuildHalos();
  updateDyn(0, performance.now() / 1000);
}
let chuffClock = 0;
function updateDyn(dt, t) {
  const sp = REDUCED ? 0.3 : 1;
  // clockwork: each driver turns by its district's power; driven gears follow by tooth ratio
  for (const gr of gearList) {
    if (!gr.parent) gr.ang += dt * gr.drive * runFactor(gr.v) * sp;
    else { const pa = gr.parent; gr.ang = gr.phi + Math.PI + Math.PI / gr.teeth - (pa.teeth / gr.teeth) * (pa.ang - gr.phi); }
    _q.copy(gr.q0).multiply(_q2.setFromAxisAngle(ZV, gr.ang));
    gr.im.setMatrixAt(gr.idx, _m4.compose(gr.pos, _q, _one));
  }
  // engines: crank, connecting rod and crosshead solved exactly, a puff of exhaust each stroke
  const espd = 2.3 * (1 + tension * 1.5) * sp;
  chuffClock = Math.max(0, chuffClock - dt);
  for (const e of engineList) {
    const prev = e.th; e.th += dt * espd;
    if (Math.floor(e.th / Math.PI) !== Math.floor(prev / Math.PI)) {
      emitPuff(EMIT.exhaust, e.exhaust); emitPuff(EMIT.exhaust, e.exhaust);
      if (chuffClock <= 0 && soundOn && actx) {
        const dd = Math.hypot(e.c[0] - view.tx, e.c[2] - view.tz);
        if (dd < 7 && view.dist < 28) { noise(0.13, 420, 0.05 * (1 - dd / 7), 'lowpass'); chuffClock = 0.22; }
      }
    }
    const px = e.rc * Math.cos(e.th), py = e.rc * Math.sin(e.th);
    const hx = e.sg * (e.sg * px + Math.sqrt(e.L * e.L - py * py));
    _q.copy(e.q0).multiply(_q2.setFromAxisAngle(ZV, e.th));
    e.fw.setMatrixAt(e.idx, _m4.compose(e.C, _q, _s3.set(e.R, e.R, 1)));
    _v3.copy(e.C).addScaledVector(e.A, (px + hx) / 2).addScaledVector(YV, py / 2).addScaledVector(e.N, 0.05);
    _q.copy(e.q0).multiply(_q2.setFromAxisAngle(ZV, Math.atan2(-py, hx - px)));
    e.rod.setMatrixAt(e.idx, _m4.compose(_v3, _q, _s3.set(e.L, 1, 1)));
    _v3.copy(e.C).addScaledVector(e.A, hx).addScaledVector(e.N, 0.05);
    e.xh.setMatrixAt(e.idx, _m4.compose(_v3, e.q0, _one));
    _q.copy(e.q0).multiply(_q2.setFromAxisAngle(ZV, e.sg > 0 ? 0 : Math.PI));
    e.pis.setMatrixAt(e.idx, _m4.compose(_v3, _q, _s3.set(e.lp, 1, 1)));
  }
  // mill wheels, with spray where the paddles meet the harbour
  const wspd = 0.9 * (1 + tension) * sp, spray = tier === 'high' ? 9 : 4;
  for (const w of wheelList) {
    w.ang += dt * wspd;
    _q.copy(w.q0).multiply(_q2.setFromAxisAngle(ZV, w.ang));
    w.im.setMatrixAt(w.idx, _m4.compose(w.C, _q, _one));
    w.acc += dt * spray;
    while (w.acc >= 1) {
      w.acc -= 1;
      const sd = Math.random() < 0.5 ? -1 : 1, r = 0.3 + Math.random() * 0.1, o = (Math.random() - 0.5) * 0.16;
      spawn(w.c[0] + w.A.x * sd * r + w.n[0] * o, WATER_Y + 0.03, w.c[2] + w.A.z * sd * r + w.n[2] * o, w.A.x * sd * 0.3, 0.55 + Math.random() * 0.5, w.A.z * sd * 0.3, 0.75, 0.035, 0.1, 0.55, 1);
    }
  }
  // tower clocks keep real time
  if (clockList.length) {
    const d = new Date(), mins = d.getMinutes() + d.getSeconds() / 60, hrs = (d.getHours() % 12) + mins / 60;
    for (const c of clockList) {
      _q.copy(c.base).multiply(_q2.setFromAxisAngle(ZV, -(hrs / 12) * Math.PI * 2));
      c.hourIM.setMatrixAt(c.idx, _m4.compose(c.pos, _q, _one));
      _q.copy(c.base).multiply(_q2.setFromAxisAngle(ZV, -(mins / 60) * Math.PI * 2));
      c.minIM.setMatrixAt(c.idx, _m4.compose(c.pos, _q, _one));
    }
  }
  // chimneys, stacks and vents; vents and leaking mains only breathe where there is power
  const rmul = tier === 'high' ? 1 : 0.55;
  for (const em of emitList) {
    const k = EMIT[em.kind]; if (!k) continue;
    let rate = k.rate * rmul;
    if (k.powered) { if (!isPowered(em.v)) continue; rate *= 1 + tension; }
    if (em.kind === 'stack') rate *= 1 + 1.5 * tension;
    em.acc += dt * rate;
    while (em.acc >= 1) { em.acc -= 1; emitPuff(k, em.p, em.n); }
  }
  for (const im of dynMeshes) im.instanceMatrix.needsUpdate = true;
}

// ---------- steam: a pool of soft points ----------
const STEAM_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function pointsMat(additive) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTex: { value: STEAM_TEX }, uCol: { value: new THREE.Color(1, 1, 1) }, uScale: { value: 600 }, uOp: { value: 1 } },
    vertexShader: `attribute float size; attribute float alpha; uniform float uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale / max(0.2, -mv.z); vA = alpha; }`,
    fragmentShader: `uniform sampler2D uTex; uniform vec3 uCol; uniform float uOp; varying float vA;
      void main(){ float a = texture2D(uTex, gl_PointCoord).a * vA * uOp; if (a < 0.004) discard; gl_FragColor = vec4(uCol, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
const EMIT = {
  chimney: { rate: 0.45, life: [4, 5], s: [0.12, 0.55], a: 0.3, vy: 0.28, spread: 0.04 },
  stove: { rate: 0.5, life: [3, 4], s: [0.08, 0.42], a: 0.28, vy: 0.25, spread: 0.03 },
  stack: { rate: 2.2, life: [5.5, 6.5], s: [0.22, 1.1], a: 0.42, vy: 0.55, spread: 0.06 },
  vent: { rate: 0.9, life: [2, 3], s: [0.07, 0.35], a: 0.35, vy: 0.32, spread: 0.03, powered: true },
  leak: { rate: 0.5, life: [1.2, 1.8], s: [0.04, 0.24], a: 0.4, vy: 0.12, spread: 0.02, powered: true, out: 0.25 },
  exhaust: { life: [1.8, 2.4], s: [0.07, 0.48], a: 0.5, vy: 0.55, spread: 0.02 },
};
const PMAX = 1400;
let pN = 0, pCap = PMAX;
const pPos = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX), pAlpha = new Float32Array(PMAX);
const pVel = new Float32Array(PMAX * 3), pAge = new Float32Array(PMAX), pLife = new Float32Array(PMAX), pS0 = new Float32Array(PMAX), pS1 = new Float32Array(PMAX), pA0 = new Float32Array(PMAX), pGrav = new Uint8Array(PMAX);
const steamGeo = new THREE.BufferGeometry();
const aPos = new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage), aSize = new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage), aAlpha = new THREE.BufferAttribute(pAlpha, 1).setUsage(THREE.DynamicDrawUsage);
steamGeo.setAttribute('position', aPos); steamGeo.setAttribute('size', aSize); steamGeo.setAttribute('alpha', aAlpha);
steamGeo.setDrawRange(0, 0);
const steamMat = pointsMat(false);
const steam = new THREE.Points(steamGeo, steamMat); steam.frustumCulled = false; steam.renderOrder = 5; scene.add(steam);
function spawn(x, y, z, vx, vy, vz, life, s0, s1, a0, grav) {
  if (pN >= pCap) return;
  const i = pN++, j = i * 3;
  pPos[j] = x; pPos[j + 1] = y; pPos[j + 2] = z; pVel[j] = vx; pVel[j + 1] = vy; pVel[j + 2] = vz;
  pAge[i] = 0; pLife[i] = life; pS0[i] = s0; pS1[i] = s1; pA0[i] = a0; pGrav[i] = grav; pSize[i] = s0; pAlpha[i] = 0;
}
function emitPuff(k, p, n) {
  const l = k.life[0] + Math.random() * (k.life[1] - k.life[0]), j = k.spread;
  let vx = (Math.random() - 0.5) * j * 3, vz = (Math.random() - 0.5) * j * 3;
  if (n && k.out) { vx += n[0] * k.out; vz += n[2] * k.out; }
  spawn(p[0] + (Math.random() - 0.5) * j, p[1], p[2] + (Math.random() - 0.5) * j, vx, k.vy * (0.8 + Math.random() * 0.4), vz, l, k.s[0], k.s[1] * (0.8 + Math.random() * 0.4), k.a, 0);
}
function killParticle(i) {
  const last = --pN; if (i === last) return;
  const a = i * 3, b = last * 3;
  for (let c = 0; c < 3; c++) { pPos[a + c] = pPos[b + c]; pVel[a + c] = pVel[b + c]; }
  pAge[i] = pAge[last]; pLife[i] = pLife[last]; pS0[i] = pS0[last]; pS1[i] = pS1[last]; pA0[i] = pA0[last]; pGrav[i] = pGrav[last]; pSize[i] = pSize[last]; pAlpha[i] = pAlpha[last];
}
function updateSteam(dt) {
  const wx = 0.22, wz = 0.1, drag = Math.min(1, dt * 0.4);
  for (let i = 0; i < pN; i++) {
    const a = pAge[i] + dt, j = i * 3;
    if (a >= pLife[i] || (pGrav[i] && pPos[j + 1] < WATER_Y)) { killParticle(i); i--; continue; }
    pAge[i] = a;
    if (pGrav[i]) pVel[j + 1] -= 3.2 * dt;
    else { pVel[j] += (wx - pVel[j]) * drag; pVel[j + 2] += (wz - pVel[j + 2]) * drag; pVel[j + 1] *= 1 - dt * 0.25; }
    pPos[j] += pVel[j] * dt; pPos[j + 1] += pVel[j + 1] * dt; pPos[j + 2] += pVel[j + 2] * dt;
    const t = a / pLife[i];
    pSize[i] = pS0[i] + (pS1[i] - pS0[i]) * Math.sqrt(t);
    pAlpha[i] = pA0[i] * Math.min(1, t * 8) * Math.pow(1 - t, 1.5);
  }
  steamGeo.setDrawRange(0, pN);
  aPos.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = true;
}
// gaslight halos around every street lamp and the mast light, shown after dusk
const haloMat = pointsMat(true); haloMat.uniforms.uCol.value.setRGB(1.0, 0.62, 0.28);
const halos = new THREE.Points(new THREE.BufferGeometry(), haloMat); halos.frustumCulled = false; halos.renderOrder = 6; halos.visible = false; scene.add(halos);
function rebuildHalos() {
  const n = lampList.length, p = new Float32Array(n * 3), sz = new Float32Array(n), a = new Float32Array(n);
  lampList.forEach((l, i) => { p.set(l, i * 3); sz[i] = 0.62; a[i] = 0.7; });
  halos.geometry.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('size', new THREE.BufferAttribute(sz, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(a, 1));
  halos.geometry = g;
}

// ---------- time of day ----------
const LOW_ENV = new THREE.Color(0x2c4a4c), LOW_NIGHT = new THREE.Color(0x0a1418), GRID_COL = new THREE.Color(0xfff0cf);
let todIndex = Math.max(0, Math.min(TIMES.length - 1, store.get('time', 1) | 0)), todState = null, todFrom = null, todTo = null, todK = 1, todEnvStep = 0;
function presetState(p) {
  const C = (h) => new THREE.Color(h);
  return { dir: new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - p.el), THREE.MathUtils.degToRad(p.az)), zen: C(p.zen), hor: C(p.hor), sun: C(p.sun), hs: C(p.hs), hg: C(p.hg), water: C(p.water), steam: C(p.steam), si: p.si, hi: p.hi, exp: p.exp, night: p.night, sa: p.sa };
}
function mixState(a, b, k) {
  const o = {};
  for (const key in a) {
    const x = a[key], y = b[key];
    o[key] = typeof x === 'number' ? x + (y - x) * k : x.isColor ? new THREE.Color().lerpColors(x, y, k) : x.clone().lerp(y, k).normalize();
  }
  return o;
}
function applyTod(S) {
  sunDir.copy(S.dir); sun.position.copy(sunDir).multiplyScalar(70);
  sun.color.copy(S.sun); sun.intensity = S.si;
  hemi.color.copy(S.hs); hemi.groundColor.copy(S.hg); hemi.intensity = S.hi;
  renderer.toneMappingExposure = S.exp;
  for (const m of [sky.material, envSky]) { const u = m.uniforms; u.uSun.value.copy(S.dir); u.uZen.value.copy(S.zen); u.uHor.value.copy(S.hor); u.uSunCol.value.copy(S.sun); u.uSunAmt.value = S.sa; }
  sky.material.uniforms.uLow.value.copy(S.hor); sky.material.uniforms.uStars.value = S.night;
  envSky.uniforms.uLow.value.copy(LOW_ENV).lerp(LOW_NIGHT, S.night);
  scene.fog.color.copy(S.hor);
  waterMat.color.copy(S.water);
  townUniforms.uNight.value = S.night;
  steamMat.uniforms.uCol.value.copy(S.steam);
  haloMat.uniforms.uOp.value = S.night; halos.visible = S.night > 0.02;
  gridLines.material.uniforms.uCol.value.copy(GRID_COL).multiplyScalar(1 - 0.6 * S.night);
}
function setTime(i, instant) {
  i = ((i % TIMES.length) + TIMES.length) % TIMES.length;
  todIndex = i; store.set('time', i);
  if (instant || REDUCED || !todState) { todState = presetState(TIMES[i]); applyTod(todState); regenEnv(); todK = 1; return; }
  todFrom = todState; todTo = presetState(TIMES[i]); todK = 0; todEnvStep = 0;
}
function tickTod(dt) {
  if (todK >= 1) return;
  todK = Math.min(1, todK + dt / 2.4);
  const k = todK * todK * (3 - 2 * todK);
  todState = mixState(todFrom, todTo, k);
  applyTod(todState);
  const step = Math.floor(todK * 3);
  if (step > todEnvStep || todK >= 1) { todEnvStep = step; regenEnv(); }
}

// ---------- airships ----------
const C_ENV_A = lin(0xe6d8b8), C_ENV_B = lin(0xc9b083), C_FIN = lin(0x8a3a26);
function airshipGeometry() {
  const g = new Geo();
  const NS = 22, NA = 16, HL = 1.1, R = 0.42;
  const prof = (u) => (R * Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.16 * u)) / 1.04;
  const nAt = (u, a) => {
    if (u <= -0.999) return [-1, 0, 0]; if (u >= 0.999) return [1, 0, 0];
    const uu = Math.max(-0.98, Math.min(0.98, u)), e = 0.01, dr = (prof(uu + e) - prof(uu - e)) / (2 * e * HL);
    return nrm3([-dr, Math.cos(a), Math.sin(a)]);
  };
  const P = (u, a) => { const r = prof(u); return [u * HL, r * Math.cos(a), r * Math.sin(a)]; };
  for (let i = 0; i < NS; i++) {
    const u0 = -Math.cos((Math.PI * i) / NS), u1 = -Math.cos((Math.PI * (i + 1)) / NS);
    for (let j = 0; j < NA; j++) {
      const a0 = (j / NA) * Math.PI * 2, a1 = ((j + 1) / NA) * Math.PI * 2, col = j % 2 ? C_ENV_A : C_ENV_B;
      g.triN(P(u0, a0), P(u1, a0), P(u1, a1), nAt(u0, a0), nAt(u1, a0), nAt(u1, a1), col, S_PLAIN);
      g.triN(P(u0, a0), P(u1, a1), P(u0, a1), nAt(u0, a0), nAt(u1, a1), nAt(u0, a1), col, S_PLAIN);
    }
  }
  // brass nose cap and bands
  g.cyl([HL * 0.94, 0, 0], [HL + 0.035, 0, 0], prof(0.94) + 0.006, 0, 10, C_BRASS, S_BRASS, false);
  g.cyl([-HL * 0.96, 0, 0], [-HL - 0.03, 0, 0], prof(-0.96) + 0.006, 0, 8, C_BRASS, S_BRASS, false);
  for (const u of [0.56, -0.42]) g.cyl([u * HL - 0.012, 0, 0], [u * HL + 0.012, 0, 0], prof(u) + 0.005, prof(u) + 0.005, 18, C_BRASS, S_BRASS, false);
  // cruciform tail fins
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, rd = [0, Math.cos(a), Math.sin(a)], nn = [0, -Math.sin(a), Math.cos(a)];
    const at = (x, r) => [x, rd[1] * r, rd[2] * r];
    const A = at(-0.62, prof(-0.56) - 0.01), B = at(-1.04, prof(-0.945) - 0.005), C = at(-1.12, 0.47), D = at(-0.84, 0.4);
    g.twoSided(A, B, C, nn, C_FIN, S_PLAIN); g.twoSided(A, C, D, nn, C_FIN, S_PLAIN);
    g.strut(D, C, nn, 0.008, 0.008, C_BRASS, S_BRASS);
  }
  // gondola with gaslit windows
  const gy = -0.6;
  g.box([0.04, gy, 0], XA, UP, ZA, 0.34, 0.07, 0.085, C_DECK, S_WOOD);
  g.box([0.04, gy + 0.08, 0], XA, UP, ZA, 0.37, 0.012, 0.1, C_BRASS, S_BRASS);
  g.box([0.04, gy - 0.075, 0], XA, UP, ZA, 0.3, 0.012, 0.072, C_BRASS, S_BRASS);
  g.glow = 1.3;
  for (const sz of [-1, 1]) for (let j = 0; j < 5; j++) g.box([-0.2 + j * 0.12, gy + 0.012, sz * 0.087], XA, UP, ZA, 0.032, 0.026, 0.004, C_GLASS, S_GLASS);
  g.box([0.382, gy + 0.008, 0], XA, UP, ZA, 0.004, 0.038, 0.06, C_GLASS, S_GLASS);
  g.glow = 0;
  for (const sx of [-0.24, 0.3]) for (const sz of [-1, 1]) {
    const ex = sx * 1.15, r = prof(ex / HL);
    g.strut([sx, gy + 0.09, sz * 0.08], [ex, -Math.sqrt(Math.max(0, r * r - 0.0144)) + 0.01, sz * 0.12], XA, 0.007, 0.007, C_IRON, S_IRON);
  }
  // engine pods on outriggers
  for (const sz of [-1, 1]) {
    const py = -0.44, pz = sz * 0.38;
    g.cyl([0.06, py, pz], [-0.3, py, pz], 0.045, 0.035, 10, C_BRASS, S_BRASS);
    g.cyl([0.06, py, pz], [0.13, py, pz], 0.045, 0.0, 10, C_BRASS, S_BRASS, false);
    g.strut([-0.12, py + 0.03, sz * 0.36], [-0.12, -0.2, sz * 0.335], XA, 0.008, 0.008, C_IRON, S_IRON);
    g.strut([-0.12, py, sz * 0.34], [-0.05, gy + 0.08, sz * 0.09], XA, 0.007, 0.007, C_IRON, S_IRON);
  }
  return g.toGeometry();
}
const shipGeo = airshipGeometry(), propGeo = propGeometry();
const ships = [];
let shipAlt = 5, townCX = 0, townCZ = 0, townRad = 6, mastPos = null;
function shipWaypoint(s) {
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2, r = (0.3 + Math.random() * 0.8) * townRad + 1.5;
    const x = townCX + Math.cos(a) * r, z = townCZ + Math.sin(a) * r;
    if (Math.hypot(x - s.grp.position.x, z - s.grp.position.z) > 5 || tries === 7) return new THREE.Vector3(x, 0, z);
  }
}
function makeShip(i, near) {
  const grp = new THREE.Group(); grp.rotation.order = 'YXZ';
  const hull = new THREE.Mesh(shipGeo, townMat); hull.castShadow = true; hull.receiveShadow = true; grp.add(hull);
  const props = [-1, 1].map((sz) => { const p = new THREE.Mesh(propGeo, brassMat); p.position.set(-0.335, -0.44, sz * 0.38); p.castShadow = true; grp.add(p); return p; });
  const a = Math.random() * Math.PI * 2, r = near ? townRad * 0.5 + 2 : townRad + 14;
  grp.position.set(townCX + Math.cos(a) * r, shipAlt + i * 0.8, townCZ + Math.sin(a) * r);
  const s = { grp, hull, props, i, yaw: Math.atan2(Math.sin(a), -Math.cos(a)) + (Math.random() - 0.5), roll: 0, pitch: 0, speed: 0.75, state: 'cruise', timer: 14 + Math.random() * 16, spin: Math.random() * 6, hd: null };
  s.target = shipWaypoint(s);
  scene.add(grp);
  return s;
}
function syncShips() {
  let sx = 0, sz = 0, n = 0, top = 0;
  for (let v = 0; v < V; v++) { const c = cols[v]; if (!c) continue; sx += X[v]; sz += Z[v]; n++; top = Math.max(top, topY(31 - Math.clz32(c))); }
  if (n) { townCX = sx / n; townCZ = sz / n; }
  let rad = 3; for (let v = 0; v < V; v++) if (cols[v]) rad = Math.max(rad, Math.hypot(X[v] - townCX, Z[v] - townCZ));
  townRad = rad;
  mastPos = null; for (const d of chunkDyn) if (d && d.mast) mastPos = new THREE.Vector3(...d.mast);
  shipAlt = Math.max(top + 2.4, mastPos ? mastPos.y + 1.3 : 0, 4.5);
  const want = 1 + (cellCount >= 25 ? 1 : 0) + (mastPos ? 1 : 0);
  while (ships.length < want) ships.push(makeShip(ships.length, !booted));
  while (ships.length > want) { const s = ships.pop(); scene.remove(s.grp); }
  for (const s of ships) if (!mastPos && s.state !== 'cruise') { s.state = 'cruise'; s.target = shipWaypoint(s); s.timer = 30; }
}
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
const DOCK = 1.16;
function updateShips(dt, t) {
  const sp = REDUCED ? 0.5 : 1;
  for (const s of ships) {
    const p = s.grp.position;
    let tx = s.target.x, tz = s.target.z, ty = shipAlt + s.i * 0.8, speed = 0.75, bob = 1;
    if (s.state === 'cruise') {
      s.timer -= dt;
      if (Math.hypot(tx - p.x, tz - p.z) < 1.6) { s.target = shipWaypoint(s); tx = s.target.x; tz = s.target.z; }
      if (mastPos && s.i === 0 && s.timer <= 0) {
        const hx = mastPos.x - p.x, hz = mastPos.z - p.z, l = Math.hypot(hx, hz) || 1;
        s.hd = [hx / l, hz / l]; s.state = 'approach';
      }
    }
    if (s.state === 'approach') {
      tx = mastPos.x - s.hd[0] * 6.5; tz = mastPos.z - s.hd[1] * 6.5; ty = mastPos.y + 0.5;
      if (Math.hypot(tx - p.x, tz - p.z) < 1.2) s.state = 'final';
    }
    if (s.state === 'final') {
      tx = mastPos.x - s.hd[0] * DOCK; tz = mastPos.z - s.hd[1] * DOCK; ty = mastPos.y;
      const dist = Math.hypot(tx - p.x, tz - p.z);
      speed = Math.max(0.1, Math.min(0.75, dist * 0.45)); bob = Math.min(1, dist);
      if (dist < 1.4) {
        // glide in along the mooring line, nose to the mast
        const k = Math.min(1, dt * 0.9);
        p.x += (tx - p.x) * k; p.z += (tz - p.z) * k; p.y += (ty - p.y) * Math.min(1, dt * 1.2);
        s.yaw += angDiff(s.yaw, Math.atan2(-s.hd[1], s.hd[0])) * Math.min(1, dt * 1.5);
        s.speed = dist * 0.6;
        if (dist < 0.03 && Math.abs(p.y - ty) < 0.03) { s.state = 'docked'; s.timer = 12; }
        s.roll *= 1 - Math.min(1, dt * 2); s.pitch *= 1 - Math.min(1, dt * 2);
        s.grp.rotation.set(s.roll, s.yaw, s.pitch); s.hull.position.y = 0; spinProps(s, dt);
        continue;
      }
    }
    if (s.state === 'docked') {
      s.timer -= dt; s.speed = 0; s.hull.position.y = 0;
      p.set(mastPos.x - s.hd[0] * DOCK, mastPos.y, mastPos.z - s.hd[1] * DOCK);
      s.grp.rotation.set(0, s.yaw, 0); spinProps(s, dt);
      if (s.timer <= 0) { s.state = 'leave'; s.timer = 5; }
      continue;
    }
    if (s.state === 'leave') {
      // back off the mast, climbing, then turn away to cruise
      s.timer -= dt; s.speed += (-0.28 - s.speed) * Math.min(1, dt);
      p.x += Math.cos(s.yaw) * s.speed * dt * sp; p.z -= Math.sin(s.yaw) * s.speed * dt * sp;
      p.y += (shipAlt - p.y) * Math.min(1, dt * 0.25);
      s.grp.rotation.set(0, s.yaw, 0); spinProps(s, dt);
      if (s.timer <= 0) { s.state = 'cruise'; s.timer = 40 + Math.random() * 30; s.target = shipWaypoint(s); }
      continue;
    }
    const want = Math.atan2(-(tz - p.z), tx - p.x);
    const rate = Math.max(-0.45, Math.min(0.45, angDiff(s.yaw, want) * 0.9));
    s.yaw += rate * dt * sp;
    s.roll += (-rate * 0.3 - s.roll) * Math.min(1, dt * 2);
    s.speed += (speed - s.speed) * Math.min(1, dt * 0.8);
    p.x += Math.cos(s.yaw) * s.speed * dt * sp; p.z -= Math.sin(s.yaw) * s.speed * dt * sp;
    const dy = (ty - p.y) * Math.min(1, dt * 0.35 * sp); p.y += dy;
    s.pitch += (Math.max(-0.12, Math.min(0.12, (ty - p.y) * 0.08)) - s.pitch) * Math.min(1, dt);
    s.hull.position.y = Math.sin(t * 0.7 + s.i * 2.1) * 0.05 * bob;
    s.grp.rotation.set(s.roll, s.yaw, s.pitch);
    spinProps(s, dt);
  }
}
function spinProps(s, dt) {
  s.spin += dt * (3 + 16 * Math.abs(s.speed)) * (REDUCED ? 0.3 : 1);
  s.props[0].rotation.x = s.spin; s.props[1].rotation.x = -s.spin;
  for (const pr of s.props) pr.position.y = -0.44 + s.hull.position.y;
}
