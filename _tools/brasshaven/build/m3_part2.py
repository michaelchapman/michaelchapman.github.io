import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # this _tools/brasshaven folder
p=os.path.join(ROOT, 'brasshaven.html'); s=open(p).read()
def rep(a, b, count=1):
    global s
    n = s.count(a)
    assert n == count, (n, a[:100])
    s = s.replace(a, b)

# ---------- engine: proper stroke-length cylinder, line plane in front of the flywheel
i0 = s.index('// a beam engine: red flywheel')
i1 = s.index('// a mill wheel turning in the harbour')
s = s[:i0] + r'''// a mill engine on the outside of a cast-iron wall: red flywheel and crank, connecting rod, crosshead, cylinder
function buildEngine(g, v, f, P, W) {
  const R = Math.min(0.22, (W - 0.2) / 3.6), rc = R * 0.5, L = rc * 2.2, lp = 2 * rc + 0.07;
  const sf = W - R - 0.06, tc = 0.2 + R, dz = 0.11, dl = dz + 0.05;
  const at = (x, dd = dl) => P(sf - x, tc, dd);
  const solid = (a, b, r, seg, col, sf2) => { g.cyl(a, b, r, r, seg, col, sf2); g.cyl(b, a, r, r, seg, col, sf2); };
  const x0 = L + rc + 0.04, cl = 2 * rc + 0.06;
  solid(at(x0), at(x0 + cl), 0.07, 12, C_IRON, S_IRON);
  for (const x of [x0, x0 + cl]) solid(at(x - 0.012), at(x + 0.012), 0.086, 12, C_BRASS, S_BRASS);
  solid(at(x0 - 0.022), at(x0 - 0.008), 0.024, 8, C_BRASS, S_BRASS);
  for (const o of [-0.034, 0.034]) g.strut(add3(at(L - rc - 0.03), [0, o, 0]), add3(at(x0 - 0.022), [0, o, 0]), f.N, 0.007, 0.011, C_BRASS, S_BRASS);
  // bed and plinth under the cylinder
  g.box(P(sf - (x0 + cl / 2), tc - 0.1, dl / 2), f.U, UP, f.N, cl / 2 + 0.05, 0.03, dl / 2 + 0.03, C_OXIDE, S_IRON, 16);
  g.box(P(sf - (x0 + cl / 2), (tc - 0.13) / 2, dl / 2), f.U, UP, f.N, cl / 2 + 0.01, (tc - 0.13) / 2, dl / 2, C_IRON, S_PLATE_I, 16);
  // flywheel pedestal and bearing
  g.box(P(sf, tc / 2, 0.035), f.U, UP, f.N, 0.05, tc / 2, 0.035, C_OXIDE, S_IRON, 16);
  g.cyl(P(sf, tc, 0), P(sf, tc, dz + 0.035), 0.026, 0.026, 8, C_IRON, S_IRON);
  // exhaust up to the eaves; a steam main from the wall into the valve chest
  const ex = at(x0 + cl * 0.6), top = P(sf - (x0 + cl * 0.6), FLOOR_H - 0.14, dl);
  g.cyl(add3(ex, [0, 0.065, 0]), top, 0.02, 0.02, 7, C_IRON, S_IRON, false);
  g.cyl(top, add3(top, [0, 0.07, 0]), 0.032, 0.026, 7, C_BRASS, S_BRASS);
  g.cyl(P(sf - (x0 + cl * 0.25), tc + 0.26, 0), add3(at(x0 + cl * 0.25), [0, 0.06, 0]), 0.017, 0.017, 6, C_PIPE, S_BRASS, false);
  g.dyn.engines.push({ c: P(sf, tc, dz), n: f.N, e: mul3(f.U, -1), R, rc, L, lp, v, exhaust: add3(top, [0, 0.1, 0]) });
}
''' + s[i1:]
rep("  if (hash4(v, nb, y, 9) < 0.55) g.dyn.emit.push({ p: pos(0.045, 0.08, t1 - 0.08), kind: 'leak', v });",
    "  if (hash4(v, nb, y, 9) < 0.55) g.dyn.emit.push({ p: pos(0.045, 0.08, t1 - 0.08), kind: 'leak', v, n: N3 });")
rep("    g.ball(P(s, t, -0.075), 0.012, C_BRASS, S_BRASS);", "    g.cyl(P(s, t, -0.09), P(s, t, -0.03), 0.007, 0.007, 6, C_IRON, S_IRON);")
rep("aB = -0.44 + (seed - 0.5) * 0.2;", "aB = -0.44 + (seed - 0.5) * 0.1;")

# ---------- where machines go
rep("function towerTop(v) { let t = 0; while (t < MAXL && F(v, t + 1)) t++; return t; }",
r'''function towerTop(v) { let t = 0; while (t < MAXL && F(v, t + 1)) t++; return t; }
// an engine house: the lowest cast-iron storey with a wide outside wall carries a steam engine
function engineSpot(v) {
  if (!(cols[v] & ~1)) return null;
  const Wn = ringW[v], door = doorEdge(v);
  for (let y = 1; y <= MAXL; y++) {
    if (!F(v, y) || M(v, y) !== M_IRON) continue;
    let best = -1, bh = -1;
    for (let i = 0; i < Wn.length; i++) {
      if (F(Wn[i], y) || (y === 1 && i === door) || edgeLen(v, i) < 0.62) continue;
      const h = hash4(v, i, 41, 0); if (h > bh) { bh = h; best = i; }
    }
    if (best >= 0) return { y, i: best };
  }
  return null;
}
// a mill: a timber house with a wall onto open water turns a wheel in the harbour
function wheelSpot(v) {
  if (!F(v, 1) || M(v, 1) !== M_TIMBER) return null;
  const Wn = ringW[v], Xs = ringX[v], k = Wn.length; let best = -1, bh = -1;
  for (let i = 0; i < k; i++) {
    const w = Wn[i];
    if (F(w, 0) || F(w, 1) || F(Xs[i], 0) || F(Xs[(i - 1 + k) % k], 0) || edgeLen(v, i) < 0.55) continue;
    const h = hash4(v, i, 44, 0); if (h > bh) { bh = h; best = i; }
  }
  return best >= 0 ? { i: best } : null;
}''')

# ---------- section 6: lights and sky driven by the time of day
i0 = s.index("const scene = new THREE.Scene();\nconst HORIZON")
i1 = s.index("// town material: one shader for every surface")
s = s[:i0] + r'''const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf0d4a6, 60, 190);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 900);

// times of day: sun (or moon), sky, exposure, and how strongly the gaslight shows
const TIMES = [
  { name: 'Morning', line: 'Fresh light off the harbour', el: 46, az: 140, zen: 0x86aecd, hor: 0xe6e2d2, sun: 0xfff1dc, si: 3.0, hs: 0xd4e4ee, hg: 0x7a6852, hi: 0.5, exp: 1.0, night: 0, water: 0x1f4246, steam: 0xf1efe9, sa: 1 },
  { name: 'Golden hour', line: 'Long shadows and warm brass', el: 36, az: 212, zen: 0x8fb2c6, hor: 0xf0d4a6, sun: 0xffdfb2, si: 2.75, hs: 0xcfe0ec, hg: 0x7a6450, hi: 0.4, exp: 1.02, night: 0, water: 0x1f4044, steam: 0xf3e6d0, sa: 1 },
  { name: 'Dusk', line: 'The lamplighters are out', el: 9, az: 250, zen: 0x46507a, hor: 0xf2925e, sun: 0xff9558, si: 1.6, hs: 0xa59ab8, hg: 0x5a4034, hi: 0.32, exp: 1.08, night: 0.7, water: 0x1a3038, steam: 0xc8aba4, sa: 1 },
  { name: 'Night', line: 'Gaslight in every window', el: 38, az: 120, zen: 0x0a1330, hor: 0x26324e, sun: 0xa6b8e0, si: 0.5, hs: 0x4a5c88, hg: 0x2a2420, hi: 0.18, exp: 1.3, night: 1, water: 0x0e1c26, steam: 0x5c6478, sa: 0.35 },
];
const sunDir = new THREE.Vector3(0, 1, 0);
const sun = new THREE.DirectionalLight(0xffdfb2, 2.75);
sun.position.copy(sunDir).multiplyScalar(70);
sun.castShadow = true;
const SH = RADIUS + 3;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 10, far: 160 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.025;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe0ec, 0x7a6450, 0.4);
scene.add(hemi);

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uLow: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uSunAmt: { value: 1 }, uStars: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uLow; uniform vec3 uSunCol; uniform float uSunAmt; uniform float uStars; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(uHor, uZen, pow(smoothstep(0.0, 1.0, h), 0.55));
        col = mix(col, uLow, smoothstep(0.0, -0.18, h));
        float s = max(dot(d, normalize(uSun)), 0.0);
        col += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 10.0) * 0.28) * uSunAmt * smoothstep(-0.05, 0.05, h);
        if (uStars > 0.01) {
          vec3 q = floor(d * 420.0);
          float r = fract(sin(dot(q, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          col += vec3(0.85, 0.88, 1.0) * step(0.9982, r) * (0.45 + 0.55 * fract(r * 977.0)) * uStars * smoothstep(0.03, 0.3, h) * 1.6;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMaterial());
sky.renderOrder = -10;
scene.add(sky);
// the environment map is the same sky with a dark sea below, regenerated when the time of day changes
const envScene = new THREE.Scene(), envSky = skyMaterial();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), envSky));
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function regenEnv() { const rt = pmrem.fromScene(envScene, 0.02, 0.1, 100); scene.environment = rt.texture; if (envRT) envRT.dispose(); envRT = rt; }

''' + s[i1:]

# ---------- town shader: gaslight
rep("const townUniforms = { uBump: { value: 1 } };", "const townUniforms = { uBump: { value: 1 }, uNight: { value: 0 } };")
rep("  sh.uniforms.uBump = townUniforms.uBump;", "  sh.uniforms.uBump = townUniforms.uBump;\n  sh.uniforms.uNight = townUniforms.uNight;")
rep("attribute float surf; varying float vSurf; varying vec3 vWPos; varying vec3 vWNrm;`)", "attribute float surf; attribute float glow; varying float vSurf; varying float vGlow; varying vec3 vWPos; varying vec3 vWNrm;`)")
rep("vSurf = surf; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;", "vSurf = surf; vGlow = glow; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;")
rep("uniform float uBump; varying float vSurf; varying vec3 vWPos; varying vec3 vWNrm;\n${NOISE_GLSL}", "uniform float uBump; uniform float uNight; varying float vSurf; varying float vGlow; varying vec3 vWPos; varying vec3 vWNrm;\n${NOISE_GLSL}")
rep("    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\\nroughnessFactor = sRough;')\n    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\\nmetalnessFactor = sMetal;')",
    "    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\\nroughnessFactor = sRough;')\n    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\\nmetalnessFactor = sMetal;')\n    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\\nif (vGlow > 0.001) totalEmissiveRadiance += uNight * vGlow * vec3(1.0, 0.62, 0.3) * (1.45 + 0.5 * bhNoise(vWPos.xz * 7.0 + vWPos.y * 5.0));')")
rep("townMat.customProgramCacheKey = () => 'brasshaven-town-2';", "townMat.customProgramCacheKey = () => 'brasshaven-town-3';")

# ---------- section 7: the working town
i0 = s.index("/* ============================================================\n   7. Moving parts")
i1 = s.index("/* ============================================================\n   8. Chunked")
s = s[:i0] + open(os.path.join(ROOT, 'build', 'section7.js')).read() + "\n" + s[i1:]

# ---------- flush: mast, power, machines, airships
rep("""function flush() {
  computeCourtyards();
  computeBridges();
  for (const ci of dirty) rebuildChunk(ci);
  dirty.clear();
  rebuildPick();
  rebuildDyn();
  if (groundDirty) { updateShore(); groundDirty = false; }
}""", """function flush() {
  computeCourtyards();
  computeBridges();
  computeMast();
  for (const ci of dirty) rebuildChunk(ci);
  dirty.clear();
  rebuildPick();
  const before = { ...srcCount }, gearsBefore = gearList.length;
  computePower();
  rebuildDyn();
  syncShips();
  if (booted) announceMachines(before, gearsBefore);
  if (groundDirty) { updateShore(); groundDirty = false; }
}
// the mooring mast goes on the tallest tower of five storeys or more; ties keep the mast where it is
function computeMast() {
  let best = -1, bt = 4;
  if (mastV >= 0 && cols[mastV]) { const t = 31 - Math.clz32(cols[mastV]); if (t >= 5) { best = mastV; bt = t; } }
  for (let v = 0; v < V; v++) { if (!(cols[v] >> 1)) continue; const t = 31 - Math.clz32(cols[v]); if (t > bt) { bt = t; best = v; } }
  if (best !== mastV) { if (mastV >= 0) markDirty(mastV); if (best >= 0) markDirty(best); mastV = best; }
}""")

# ---------- starter town: an engine house and a mill
rep("  let tower = -1, dome = -1, glass = -1;", "  let tower = -1, dome = -1, glass = -1, factory = -1, mill = -1;")
rep("""    if (d === 2 && tower < 0 && h > 0.45 && h < 0.8) { tower = v; storeys = 6; }""",
"""    if (d === 2 && tower < 0 && h > 0.45 && h < 0.8) { tower = v; storeys = 6; }
    else if (d === 2 && factory < 0 && h > 0.45 && h < 0.8) { factory = v; storeys = 2; m = M_IRON; }
    else if (d === 2 && mill < 0 && h > 0.45 && h < 0.8) { mill = v; storeys = 1; m = M_TIMBER; }""")

# ---------- interface: time of day and the wind-up key
rep("""  <div class="menu plate" id="menu" hidden>""", """  <div class="side" id="side">
    <button class="round plate" id="time-btn" aria-label="Time of day: Golden hour">
      <svg id="time-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg>
    </button>
    <button class="round plate" id="key-btn" aria-label="Wind the key">
      <span class="tension" id="tension" aria-hidden="true"></span>
      <svg id="key-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12.6v8.4M12 20.6h2.6M12 17.8h2.2"/><path d="M12 12.6c-1.6 0-3.3-.7-4.5-2C6.2 9.2 6 7 7.2 5.8s3.4-1 4.8.6c1.4-1.6 3.6-1.8 4.8-.6s1 3.4-.3 4.8c-1.2 1.3-2.9 2-4.5 2z"/><circle cx="12" cy="9.2" r="1.1"/></svg>
    </button>
  </div>

  <div class="menu plate" id="menu" hidden>""")
rep(""".menu{position:absolute;top:calc(env(safe-area-inset-top,0px) + 70px)""", """.side{position:absolute;top:calc(env(safe-area-inset-top,0px) + 74px);right:max(16px,calc(env(safe-area-inset-right,0px) + 12px));display:flex;flex-direction:column;gap:10px}
.round{width:50px;height:50px;padding:0;display:grid;place-items:center;border-radius:50%;color:var(--brass-hi);cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none}
.round svg{width:26px;height:26px;position:relative}
.round:focus-visible{outline:2px solid var(--brass-hi);outline-offset:2px}
.round:active{transform:translateY(1px)}
.tension{position:absolute;inset:3px;border-radius:50%;background:conic-gradient(var(--brass-hi) calc(var(--t,0) * 1turn),rgba(0,0,0,.42) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3.5px));pointer-events:none}
#key-btn.winding{background:linear-gradient(180deg,#3a2d20,#241b14)}
.menu{position:absolute;top:calc(env(safe-area-inset-top,0px) + 70px)""")

rep("""  ? 'Tap water to build a house. Tap a roof to add a storey, a wall to build beside it. Pick a material from the coins; Paint changes a block’s material. Hold to remove. Drag to turn, pinch to zoom, two fingers to pan.'
  : 'Click water to build a house. Click a roof to add a storey, a wall to build beside it. Pick a material from the coins (keys 1–6); Paint (P) changes a block’s material. Right-click removes. Drag to turn, scroll to zoom, Shift-drag to pan. Ctrl Z undoes.';""",
"""  ? 'Tap water to build a house. Tap a roof to add a storey, a wall to build beside it. Pick a material from the coins; Paint changes a block’s material. Hold to remove. Drag to turn, pinch to zoom, two fingers to pan. Cast-iron houses hold steam engines that power every building joined to them, and timber houses on the water turn mill wheels. Hold the key to wind every machine faster; the dial above it changes the time of day.'
  : 'Click water to build a house. Click a roof to add a storey, a wall to build beside it. Pick a material from the coins (keys 1–6); Paint (P) changes a block’s material. Right-click removes. Drag to turn, scroll to zoom, Shift-drag to pan. Ctrl Z undoes. Cast-iron houses hold steam engines that power every building joined to them, and timber houses on the water turn mill wheels. Hold the key (K) to wind every machine faster; the dial above it (T) changes the time of day.';""")
rep("$('how').textContent = HOW;", "$('how').textContent = HOW;\n" + open(os.path.join(ROOT, 'build', 'ui.js')).read())

rep("  else if (k === 'escape') closeMenu();", "  else if (k === 't') cycleTime();\n  else if (k === 'k') addTension(0.2);\n  else if (k === 'escape') closeMenu();")

# tiers: particle pool size
rep("  townUniforms.uBump.value = t === 'high' ? 1 : 0;", "  townUniforms.uBump.value = t === 'high' ? 1 : 0;\n  pCap = t === 'high' ? PMAX : 500; if (pN > pCap) pN = pCap;")
rep("""  camera.aspect = w / h; camera.updateProjectionMatrix();
}""", """  camera.aspect = w / h; camera.updateProjectionMatrix();
  const sc = (renderer.getPixelRatio() * h) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  steamMat.uniforms.uScale.value = haloMat.uniforms.uScale.value = sc;
}""")

# boot and loop
rep("""  for (let ci = 0; ci < chunkVerts.length; ci++) dirty.add(ci);
  groundDirty = true;
  flush();""", """  for (let ci = 0; ci < chunkVerts.length; ci++) dirty.add(ci);
  groundDirty = true;
  setTime(todIndex, true);
  flush();
  booted = true;""")
rep("""    waterUniforms.uTime.value = now / 1000;
    updateDyn(now / 1000);""", """    waterUniforms.uTime.value = now / 1000;
    tickKey(dt);
    tickTod(dt);
    updateDyn(dt, now / 1000);
    updateSteam(dt);
    updateShips(dt, now / 1000);""")
rep("${cellCount} blocks · ${gearList.length} gears · ${tier}`", "${cellCount} blocks · ${gearList.length} gears · ${engineList.length} engines · ${wheelList.length} wheels · ${pN} puffs · ${tier}`")
rep("gears: () => gearList.length, clocks: () => clockList.length,", "gears: () => gearList.length, clocks: () => clockList.length, engines: () => engineList.length, wheels: () => wheelList.length, ships: () => ships.map((sh) => ({ state: sh.state, p: sh.grp.position.toArray() })), mast: () => mastV, mastPos: () => mastPos && mastPos.toArray(), particles: () => pN, setTime, time: () => todIndex, tension: (x) => { if (x !== undefined) tension = x; return tension; }, powered: (v) => isPowered(v), clusters: () => clusterPowered.slice(), engineSpot, wheelSpot, dockNow: () => { for (const sh of ships) sh.timer = 0; },")
rep("""   Brasshaven, milestone 2: six materials and the paint tool,
   detail rules, junction gears, clock towers, town codes.""", """   Brasshaven, milestone 3: the town is a machine. Engine houses and
   mill wheels power districts of clockwork; steam, gaslight, airships.""")
open(p, 'w').write(s)
print('part 2 ok')
