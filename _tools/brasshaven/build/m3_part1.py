import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # this _tools/brasshaven folder
p=os.path.join(ROOT, 'brasshaven.html'); s=open(p).read()
def rep(a, b, count=1):
    global s
    n = s.count(a)
    assert n == count, (n, a[:90])
    s = s.replace(a, b)

# ---------- Geo: glow channel, safer strut
rep("  constructor() { this.P = []; this.N = []; this.C = []; this.S = []; this.dyn = { gears: [], clocks: [] }; }\n  _v(p, n, c, s) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.C.push(c[0], c[1], c[2]); this.S.push(s); }",
    "  constructor() { this.P = []; this.N = []; this.C = []; this.S = []; this.G = []; this.glow = 0; this.dyn = { gears: [], clocks: [], engines: [], wheels: [], emit: [], lamps: [], mast: null }; }\n  _v(p, n, c, s) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.C.push(c[0], c[1], c[2]); this.S.push(s); this.G.push(this.glow); }")
rep("    let p = cross3(side, u); if (Math.hypot(p[0], p[1], p[2]) < 1e-4) p = cross3(UP, u);",
    "    let p = cross3(side, u); if (Math.hypot(p[0], p[1], p[2]) < 1e-4) p = cross3(UP, u); if (Math.hypot(p[0], p[1], p[2]) < 1e-4) p = cross3(XA, u);")
rep("    g.setAttribute('surf', new THREE.Float32BufferAttribute(this.S, 1));",
    "    g.setAttribute('surf', new THREE.Float32BufferAttribute(this.S, 1));\n    g.setAttribute('glow', new THREE.Float32BufferAttribute(this.G, 1));")

# ---------- state globals
rep("let courtyard = new Uint8Array(V);\nlet bridgeSet = new Set();",
    "let courtyard = new Uint8Array(V);\nlet bridgeSet = new Set();\nlet mastV = -1;")
rep("const C_GREENGLASS = lin(0x9fc7c2),", "const C_PIPE = lin(0xb8693c);\nconst C_GREENGLASS = lin(0x9fc7c2),")
rep("  { name: 'Brass', line: 'riveted plate, portholes and domes' },", "  { name: 'Brass', line: 'riveted plate, portholes and clockwork' },")
rep("  { name: 'Cast iron', line: 'factories, grid windows and smokestacks' },", "  { name: 'Cast iron', line: 'engine houses that power everything joined to them' },")
rep("  { name: 'Timber', line: 'clapboard, shutters and wooden piers' },", "  { name: 'Timber', line: 'clapboard and piers; by the water it turns a mill wheel' },")

# ---------- lamps glow and register
rep("  g.box([lx, y0 + 0.93, lz], XA, UP, ZA, 0.05, 0.07, 0.05, C_LAMP, S_GLASS);",
    "  g.glow = 1.7; g.box([lx, y0 + 0.93, lz], XA, UP, ZA, 0.05, 0.07, 0.05, C_LAMP, S_GLASS); g.glow = 0;\n  g.dyn.lamps.push([lx, y0 + 0.93, lz]);")

# ---------- storey: machine context, steam mains replace seam gears
rep("""  let tower = roofHere && y >= 6;
  if (tower) for (let l = 1; l < y; l++) if (!F(v, l)) { tower = false; break; }
  const ctx = { st, L, walls, roofHere, below, tower };
  for (let i = 0; i < k; i++) if (walls[i]) buildWall(g, v, y, i, ctx, door === i);""",
"""  let tower = roofHere && y >= 6;
  if (tower) for (let l = 1; l < y; l++) if (!F(v, l)) { tower = false; break; }
  const eng = engineSpot(v), whl = wheelSpot(v), tt = towerTop(v);
  let worksWall = -1;
  if (tt >= 6 && y === tt - 1) { let bw = 0; for (let i = 0; i < k; i++) { if (!walls[i]) continue; const W = edgeLen(v, i); if (W >= 0.66 && W > bw) { bw = W; worksWall = i; } } }
  const ctx = { st, L, walls, roofHere, below, tower, engineWall: eng && eng.y === y ? eng.i : -1, wheelWall: whl && y === 1 ? whl.i : -1, worksWall };
  for (let i = 0; i < k; i++) if (walls[i]) buildWall(g, v, y, i, ctx, door === i);
  if (ctx.wheelWall >= 0) buildWheelMount(g, v, ctx.wheelWall);""")
rep("""    // junction gear where a facade runs on into a neighbour of another material
    const a = Wn[i], b = Wn[(i + 1) % k], x = Xs[i], q = Qs[i];
    for (const nb of [a, b]) {
      const other = nb === a ? b : a;
      if (!F(nb, y) || F(other, y) || F(x, y) || M(nb, y) === L.m || nb < v) continue;
      let nx = CX[q] - (X[v] + X[nb]) / 2, nz = CZ[q] - (Z[v] + Z[nb]) / 2; const l = Math.hypot(nx, nz) || 1;
      g.dyn.gears.push({ p: [CX[q], baseY(y) + 0.5, CZ[q]], n: [nx / l, 0, nz / l], r: 0.2, dir: hash4(v, nb, y, 7) < 0.5 ? 1 : -1 });
    }""",
"""    // steam mains run up the seam where this facade carries on into a neighbour
    const a = Wn[i], b = Wn[(i + 1) % k], x = Xs[i], q = Qs[i];
    for (const nb of [a, b]) {
      const other = nb === a ? b : a;
      if (!F(nb, y) || F(other, y) || F(x, y) || nb < v) continue;
      if (M(nb, y) === L.m && hash4(v, nb, 0, 5) > 0.3) continue;
      let nx = CX[q] - (X[v] + X[nb]) / 2, nz = CZ[q] - (Z[v] + Z[nb]) / 2; const l = Math.hypot(nx, nz) || 1;
      buildMains(g, v, nb, y, [CX[q], CZ[q]], [nx / l, nz / l]);
    }""")

MACHINE_BUILDERS = r'''
// ---------- the machine in the walls ----------
function towerTop(v) { let t = 0; while (t < MAXL && F(v, t + 1)) t++; return t; }
// steam mains: paired copper pipes on the seam between two houses, with flanges, valves and gauges
function buildMains(g, v, nb, y, c, n) {
  const base = baseY(y), t1 = base + FLOOR_H;
  const tg = [-n[1], 0, n[0]], N3 = [n[0], 0, n[1]];
  const pos = (o, d, yy) => [c[0] + tg[0] * o + n[0] * d, yy, c[1] + tg[2] * o + n[1] * d];
  for (const o of [-0.045, 0.045]) {
    g.cyl(pos(o, 0.05, base), pos(o, 0.05, t1), 0.022, 0.022, 7, C_PIPE, S_BRASS, false);
    for (const yy of [base + 0.14, t1 - 0.08]) g.cyl(pos(o, 0.05, yy - 0.018), pos(o, 0.05, yy + 0.018), 0.033, 0.033, 7, C_PIPE, S_BRASS);
  }
  g.box(pos(0, 0.022, base + 0.5), tg, UP, N3, 0.075, 0.012, 0.022, C_IRON, S_IRON);
  const h = hash4(v, nb, y, 6);
  if (h < 0.4) {
    const vc = pos(0.045, 0.1, base + 0.42);
    g.cyl(pos(0.045, 0.05, base + 0.42), vc, 0.011, 0.011, 5, C_IRON, S_IRON);
    g.ring(vc, tg, UP, N3, 0.044, 0.058, 0.012, 10, C_OXIDE, S_IRON);
    for (let j = 0; j < 4; j++) { const a = (j * Math.PI) / 2 + 0.4; g.strut(vc, add3(vc, add3(mul3(tg, Math.cos(a) * 0.05), mul3(UP, Math.sin(a) * 0.05))), N3, 0.005, 0.005, C_OXIDE, S_IRON); }
  } else if (h < 0.62) {
    const gc = pos(-0.045, 0.105, base + 0.62);
    g.glow = 0.3; g.disc(gc, tg, UP, N3, 0.045, 10, C_DIAL, S_PLAIN); g.glow = 0;
    g.ring(add3(gc, mul3(N3, -0.014)), tg, UP, N3, 0.045, 0.06, 0.016, 10, C_BRASS, S_BRASS);
  }
  if (hash4(v, nb, y, 9) < 0.55) g.dyn.emit.push({ p: pos(0.045, 0.08, t1 - 0.08), kind: 'leak', v });
}
// a beam engine: red flywheel, crank, connecting rod, crosshead and cylinder, on a wide cast-iron wall
function buildEngine(g, v, f, P, W) {
  const R = Math.min(0.24, (W - 0.29) / 2.6), rc = R * 0.5, L = rc * 2.2, lp = 2 * rc + 0.08;
  const sf = W - R - 0.06, tc = 0.2 + R, dz = 0.11;
  const at = (x, dd = dz) => P(sf - x, tc, dd);
  const x0 = L + rc + 0.04, cl = 0.16;
  g.cyl(at(x0), at(x0 + cl), 0.07, 0.07, 10, C_IRON, S_IRON);
  g.cyl(at(x0 + cl), at(x0), 0.07, 0.07, 10, C_IRON, S_IRON);
  for (const x of [x0, x0 + cl]) g.cyl(at(x - 0.013), at(x + 0.013), 0.088, 0.088, 10, C_BRASS, S_BRASS);
  for (const o of [-0.032, 0.032]) g.strut(add3(at(L - rc - 0.03), [0, o, 0]), add3(at(x0), [0, o, 0]), f.N, 0.007, 0.012, C_BRASS, S_BRASS);
  g.box(P(sf - (x0 + cl / 2), tc - 0.1, dz / 2 + 0.01), f.U, UP, f.N, cl / 2 + 0.04, 0.03, dz / 2 + 0.035, C_OXIDE, S_IRON, 16);
  g.box(P(sf, tc, 0.03), f.U, UP, f.N, 0.06, 0.06, 0.03, C_OXIDE, S_IRON, 16);
  g.cyl(P(sf, tc, 0.0), P(sf, tc, dz + 0.04), 0.024, 0.024, 8, C_IRON, S_IRON);
  const ex = at(x0 + cl * 0.5), top = P(sf - (x0 + cl * 0.5), FLOOR_H - 0.12, dz);
  g.cyl(add3(ex, [0, 0.06, 0]), top, 0.022, 0.022, 7, C_IRON, S_IRON, false);
  g.cyl(top, add3(top, [0, 0.06, 0]), 0.034, 0.03, 7, C_BRASS, S_BRASS);
  g.dyn.engines.push({ c: P(sf, tc, dz), n: f.N, e: mul3(f.U, -1), R, rc, L, lp, v, exhaust: add3(top, [0, 0.08, 0]) });
}
// a mill wheel turning in the harbour beside a timber house
function buildWheelMount(g, v, i) {
  const f = wallFrame(v, i), base = baseY(1);
  const P = (s, t, d) => [f.ax + f.ux * s + f.nx * d, base + t, f.az + f.uz * s + f.nz * d];
  const sc = f.W / 2, tc = -0.14;
  g.box(P(sc, tc + 0.02, 0.05), f.U, UP, f.N, 0.07, 0.1, 0.05, C_PILE, S_WOOD, 16);
  g.cyl(P(sc, tc, 0), P(sc, tc, 0.36), 0.028, 0.028, 8, C_IRON, S_IRON);
  // the leat: a timber trough that feeds water over the wheel
  g.box(P(sc, 0.36, 0.2), f.U, UP, f.N, 0.12, 0.012, 0.13, C_PILE, S_WOOD);
  for (const o of [-0.115, 0.115]) g.box(P(sc + o, 0.39, 0.2), f.U, UP, f.N, 0.008, 0.03, 0.13, C_PILE, S_WOOD);
  g.dyn.wheels.push({ c: P(sc, tc, 0.22), n: f.N, v });
}
// clockwork: a gear train whose teeth genuinely mesh, set into a recessed brass-framed panel
const PITCH = 0.045;
const pitchR = (n) => (n * PITCH) / (2 * Math.PI);
function addTrain(g, v, P, N, sc, seed) {
  const Xg = nrm3(cross3(UP, N));
  const mk = (s, t, teeth, parent) => {
    const p = P(s, t, -0.045);
    const gr = { p, n: N, x: Xg, teeth, v, parent: parent || null, drive: parent ? 0 : seed < 0.5 ? 0.6 : -0.6 };
    if (parent) { const d = sub3(p, parent.p); gr.phi = Math.atan2(d[1], dot3(d, Xg)); }
    g.dyn.gears.push(gr);
    g.ball(P(s, t, -0.075), 0.012, C_BRASS, S_BRASS);
    return gr;
  };
  const a = mk(sc - 0.085, 0.53, 20);
  const dB = pitchR(20) + pitchR(12), aB = -0.44 + (seed - 0.5) * 0.2;
  const sB = sc - 0.085 + Math.cos(aB) * dB, tB = 0.53 + Math.sin(aB) * dB;
  const b = mk(sB, tB, 12, a);
  const dC = pitchR(12) + pitchR(8), aC = 1.22;
  mk(sB + Math.cos(aC) * dC, tB + Math.sin(aC) * dC, 8, b);
}
'''
rep("function chooseOpening(v, y, i, W, ctx, isDoor, street) {", MACHINE_BUILDERS + "\nfunction chooseOpening(v, y, i, W, ctx, isDoor, street) {")
rep("""  if (isDoor) return 'door';
  if (W < 0.46) return 'none';
  if (ctx.tower && W >= 0.56) return 'clock';""",
"""  if (isDoor) return 'door';
  if (i === ctx.engineWall) return 'engine';
  if (i === ctx.wheelWall) return 'none';
  if (i === ctx.worksWall) return 'works';
  if (W < 0.46) return 'none';
  if (ctx.tower && W >= 0.56) return 'clock';""")
rep("    case M_BRASS: return a < 0.14 ? 'gauge' : a < 0.7 ? 'port' : 'lancet';",
    "    case M_BRASS: return a < 0.3 ? (W >= 0.66 ? 'works' : 'gauge') : a < 0.75 ? 'port' : 'lancet';")
rep("    case 'loft': return [{ pts: rectPts(sc, 0.3, 0.14, 0.58), kind: 'loft', cx: sc, ow: 0.3, tb: 0.14, oh: 0.58 }];",
    "    case 'loft': return [{ pts: rectPts(sc, 0.3, 0.14, 0.58), kind: 'loft', cx: sc, ow: 0.3, tb: 0.14, oh: 0.58 }];\n    case 'works': return [{ pts: rectPts(sc, 0.52, 0.32, 0.4), kind: 'works', cx: sc, ow: 0.52, tb: 0.32, oh: 0.4 }];")

# ---------- wall openings: glow, works panels, engines
rep("      const D = h.kind === 'door' || h.kind === 'loft' ? 0.1 : h.kind === 'port' ? 0.06 : 0.075;\n      const revCol = h.kind === 'port' ? C_BRASS : L.trim, revS = h.kind === 'port' ? S_BRASS : L.trimS;",
    "      const D = h.kind === 'door' || h.kind === 'loft' ? 0.1 : h.kind === 'port' ? 0.06 : h.kind === 'works' ? 0.09 : 0.075;\n      const brassy = h.kind === 'port' || h.kind === 'works';\n      const revCol = brassy ? C_BRASS : L.trim, revS = brassy ? S_BRASS : L.trimS;")
rep("""      if (h.kind === 'loft') { fillCol = mul3(st.clap, 0.75); fillS = S_WOOD; }
      for (const fc of THREE.ShapeUtils.triangulateShape(pv, [])) g.tri(P(pv[fc[0]].x, pv[fc[0]].y, -D), P(pv[fc[1]].x, pv[fc[1]].y, -D), P(pv[fc[2]].x, pv[fc[2]].y, -D), N, fillCol, fillS);
""",
"""      if (h.kind === 'loft') { fillCol = mul3(st.clap, 0.75); fillS = S_WOOD; }
      if (h.kind === 'works') { fillCol = mul3(C_IRON, 0.8); fillS = S_PLATE_I; }
      const hi = holes.indexOf(h);
      g.glow = h.kind === 'works' ? 0.22 : h.kind === 'win' || h.kind === 'port' ? (hash4(v, i, y * 8 + hi, 21) < 0.6 ? (h.bars === 'shop' ? 1.0 : 0.5 + 0.5 * hash4(v, i, y * 8 + hi, 22)) : 0) : 0;
      for (const fc of THREE.ShapeUtils.triangulateShape(pv, [])) g.tri(P(pv[fc[0]].x, pv[fc[0]].y, -D), P(pv[fc[1]].x, pv[fc[1]].y, -D), P(pv[fc[2]].x, pv[fc[2]].y, -D), N, fillCol, fillS);
      g.glow = 0;
      if (h.kind === 'works') {
        for (const t of [h.tb - 0.02, h.tb + h.oh + 0.02]) g.box(P(sc, t, 0.012), U, UP, N, h.ow / 2 + 0.04, 0.022, 0.014, C_BRASS, S_BRASS, 16);
        for (const o of [-1, 1]) g.box(P(sc + o * (h.ow / 2 + 0.02), h.tb + h.oh / 2, 0.012), U, UP, N, 0.022, h.oh / 2, 0.014, C_BRASS, S_BRASS, 16);
        addTrain(g, v, P, N, sc, hash4(v, i, y, 23));
        continue;
      }
""")
rep("          for (let j = 1; j < fan.length - 1; j++) g.tri(P(sc, spring, -D + 0.006), P(fan[j][0], fan[j][1], -D + 0.006), P(fan[j + 1][0], fan[j + 1][1], -D + 0.006), N, C_GLASS, S_GLASS);",
    "          g.glow = 0.75;\n          for (let j = 1; j < fan.length - 1; j++) g.tri(P(sc, spring, -D + 0.006), P(fan[j][0], fan[j][1], -D + 0.006), P(fan[j + 1][0], fan[j + 1][1], -D + 0.006), N, C_GLASS, S_GLASS);\n          g.glow = 0;")
rep("      g.disc(P(sc, tc, 0.026), U, UP, N, 0.1, 14, C_DIAL, S_PLAIN);",
    "      g.glow = 0.3; g.disc(P(sc, tc, 0.026), U, UP, N, 0.1, 14, C_DIAL, S_PLAIN); g.glow = 0;")
rep("      g.disc(P(sc, tc, 0.032), U, UP, N, R, 20, C_DIAL, S_PLAIN);",
    "      g.glow = 0.55; g.disc(P(sc, tc, 0.032), U, UP, N, R, 20, C_DIAL, S_PLAIN); g.glow = 0;")
rep("""      g.dyn.clocks.push({ p: P(sc, tc, 0.042), n: N });
    }
  }
""", """      g.dyn.clocks.push({ p: P(sc, tc, 0.042), n: N });
    } else if (type === 'engine') buildEngine(g, v, f, P, W);
  }
""")
rep("""  // junction gear on the floor line where the next storey changes material
  if (F(v, y + 1) && M(v, y + 1) !== m && !F(w, y + 1) && W >= 0.5) {
    g.dyn.gears.push({ p: P(sc, Hs, 0.012), n: N, r: 0.17, dir: hash4(v, i, y, 8) < 0.5 ? 1 : -1 });
  }
""", "")
# glasshouse glow
rep("  g.quad(P(0, t0, -0.012), P(W, t0, -0.012), P(W, t1, -0.012), P(0, t1, -0.012), N, L.wall, S_GREEN);",
    "  g.glow = 0.35; g.quad(P(0, t0, -0.012), P(W, t0, -0.012), P(W, t1, -0.012), P(0, t1, -0.012), N, L.wall, S_GREEN); g.glow = 0;")

# ---------- roofs: mast, glass glow, steam emitters
rep("""  const n = pts.length;
  const isolated = pts.every((p) => p.h === 0);""",
"""  const n = pts.length;
  let hl = 0; for (let l = MAXL; l >= 0; l--) if (F(v, l)) { hl = l; break; }
  const isMast = v === mastV && y === hl;
  const isolated = pts.every((p) => p.h === 0);""")
rep("  if (isolated && (m === M_BRASS || m === M_COPPER)) {\n    const ring = pts.map((p) => [p.w[0], p.w[2]]);",
    "  if (isolated && !isMast && (m === M_BRASS || m === M_COPPER)) {\n    const ring = pts.map((p) => [p.w[0], p.w[2]]);")
rep("""    const apex = [vx, top + Hv, vz];
    for (let j = 0; j < n; j++) {
      const a = pts[j].p, b = pts[(j + 1) % n].p;
      let nn = nrm3(cross3(sub3(a, apex), sub3(b, apex))); if (nn[1] < 0) nn = neg3(nn);
      if (!isFinite(nn[0])) continue;
      const flat = nn[1] > 0.97;
      g.tri(apex, a, b, nn, flat ? C_FLAT : L.roof, flat ? S_IRON : L.roofS);
    }""",
"""    const apex = [vx, top + Hv, vz];
    g.glow = L.roofS === S_GREEN ? 0.3 : 0;
    for (let j = 0; j < n; j++) {
      const a = pts[j].p, b = pts[(j + 1) % n].p;
      let nn = nrm3(cross3(sub3(a, apex), sub3(b, apex))); if (nn[1] < 0) nn = neg3(nn);
      if (!isFinite(nn[0])) continue;
      const flat = nn[1] > 0.97;
      g.tri(apex, a, b, nn, flat ? C_FLAT : L.roof, flat ? S_IRON : L.roofS);
    }
    g.glow = 0;""")
rep("    if (m !== M_TIMBER && m !== M_IRON && (ridges === 0 || (ridges === 1 && hash4(v, y, 31, 0) < 0.55))) {",
    "    if (isMast) buildMast(g, vx, vz, top + Hv - 0.1);\n    else if (m !== M_TIMBER && m !== M_IRON && (ridges === 0 || (ridges === 1 && hash4(v, y, 31, 0) < 0.55))) {")
rep("  if (!(isolated && (m === M_BRASS || m === M_COPPER) && (m === M_BRASS || st.onion))) {",
    "  if (!(isolated && !isMast && (m === M_BRASS || m === M_COPPER) && (m === M_BRASS || st.onion))) {")
rep("      for (const o of [-0.05, 0.05]) g.cyl([s.px + s.ax[0] * o, y1 + 0.03, s.pz + s.ax[2] * o], [s.px + s.ax[0] * o, y1 + 0.13, s.pz + s.ax[2] * o], 0.034, 0.028, 7, C_TERRA, S_TERRA);",
    "      for (const o of [-0.05, 0.05]) g.cyl([s.px + s.ax[0] * o, y1 + 0.03, s.pz + s.ax[2] * o], [s.px + s.ax[0] * o, y1 + 0.13, s.pz + s.ax[2] * o], 0.034, 0.028, 7, C_TERRA, S_TERRA);\n      g.dyn.emit.push({ p: [s.px + s.ax[0] * 0.05, y1 + 0.16, s.pz + s.ax[2] * 0.05], kind: 'chimney', v });")
rep("      g.cyl([s.px, y1 - 0.01, s.pz], [s.px, y1 + 0.035, s.pz], 0.02, 0.02, 5, C_IRON, S_IRON);",
    "      g.cyl([s.px, y1 - 0.01, s.pz], [s.px, y1 + 0.035, s.pz], 0.02, 0.02, 5, C_IRON, S_IRON);\n      g.dyn.emit.push({ p: [s.px, y1 + 0.12, s.pz], kind: 'stove', v });")
rep("    g.cyl([s.px, y1, s.pz], [s.px, y1 + 0.07, s.pz], 0.13, 0.15, 10, C_IRON, S_IRON, false);",
    "    g.cyl([s.px, y1, s.pz], [s.px, y1 + 0.07, s.pz], 0.13, 0.15, 10, C_IRON, S_IRON, false);\n    g.dyn.emit.push({ p: [s.px, y1 + 0.12, s.pz], kind: 'stack', v });")
rep("      g.cyl([bx, top + Hv + 0.18, bz], [bx, top + Hv + 0.23, bz], 0.05, 0.03, 8, C_BRASS, S_BRASS);",
    "      g.cyl([bx, top + Hv + 0.18, bz], [bx, top + Hv + 0.23, bz], 0.05, 0.03, 8, C_BRASS, S_BRASS);\n      g.dyn.emit.push({ p: [bx, top + Hv + 0.26, bz], kind: 'vent', v });")
MAST = r'''
// a lattice mooring mast for airships, on the tallest tower in town
function buildMast(g, x, z, y0) {
  const H = 1.7, b0 = 0.15, b1 = 0.04, levels = 6;
  const corner = (k, t) => { const hw = (b0 + (b1 - b0) * t) * Math.SQRT2, a = (k * Math.PI) / 2 + Math.PI / 4; return [x + Math.cos(a) * hw, y0 + H * t, z + Math.sin(a) * hw]; };
  for (let k = 0; k < 4; k++) g.strut(corner(k, 0), corner(k, 1), XA, 0.013, 0.013, C_IRON, S_IRON);
  for (let j = 0; j <= levels; j++) for (let k = 0; k < 4; k++) g.strut(corner(k, j / levels), corner((k + 1) % 4, j / levels), UP, 0.008, 0.008, C_IRON, S_IRON);
  for (let j = 0; j < levels; j++) for (let k = 0; k < 4; k++) g.strut(corner(k, (j + (k % 2)) / levels), corner((k + 1) % 4, (j + 1 - (k % 2)) / levels), UP, 0.006, 0.006, C_IRON, S_IRON);
  const yt = y0 + H;
  g.cyl([x, yt, z], [x, yt + 0.04, z], 0.1, 0.1, 10, C_BRASS, S_BRASS);
  g.cyl([x, yt + 0.04, z], [x, yt + 0.2, z], 0.05, 0.022, 8, C_IRON, S_IRON);
  g.glow = 1.7; g.ball([x, yt + 0.25, z], 0.035, C_LAMP, S_GLASS); g.glow = 0;
  g.dyn.lamps.push([x, yt + 0.25, z]);
  g.dyn.mast = [x, yt + 0.12, z];
}
'''
rep("/* ============================================================\n   6. Renderer, light, sky, water", MAST + "\n/* ============================================================\n   6. Renderer, light, sky, water")
open(p, 'w').write(s)
print('part 1 ok')
