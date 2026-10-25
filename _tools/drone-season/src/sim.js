/* Drone Season · simulation core (milestone 4, Rivals). Pure logic, no DOM, deterministic per seed and across browsers. */
(function (root) {
  'use strict';

  // ---------- constants ----------
  const W = 1500, H = 1000;
  const HC = 5, HW = W / HC, HH = H / HC;          // terrain grid: 5 world units per cell
  const RIDGE_H = 0.16;
  const HOLD_R = 110, GUARD_R = 300;
  const FLAK_RANGE = 165, FLAK_CD = 0.45, FLAK_P = 0.5;
  const LOCK_MEMORY = 3, CONTACT_MEMORY = 6;
  const QUEUE_MAX = 8, NEST_MAX = 2, NEST_FROM_HEART = 560, NEST_FROM_NEST = 300, NEST_ENEMY_CLEAR = 520;
  const BLAST_R = 30, WARDEN_ENGAGE = 210, WARDEN_LEASH = 320;
  const NEST_GUARD_R = 120, AUTO_QUEUE = 2, POST_MAX = 5, PLAN_MAX_ROWS = 12;
  const PLAN_TYPES = ['forager', 'glint', 'sting', 'decoy', 'warden', 'raider', 'relay', 'harrier'];
  const POST_TYPES = ['glint', 'warden', 'decoy', 'harrier'];
  const POST_CAP = { glint: 2, warden: 3, decoy: 4, harrier: 1 };
  const BRIDGE_MAX = 3;   // Relays a post beyond link may take with it
  // Links: your Heart, Nests and Relays carry orders. A Relay passes the link on only while it is linked itself.
  const LINK_R = { heart: 520, nest: 320, relay: 300 }, JAM_R = 200;

  const MODES = {
    short: { key: 'short', name: 'Short game', minutes: 12, round: 720, bloomOpen: 300, bloomScore: 540, nectar: 250, phases: [0, 120, 300, 540, 720] },
    duel:  { key: 'duel',  name: 'Duel',       minutes: 6,  round: 360, bloomOpen: 150, bloomScore: 270, nectar: 150, phases: [0, 60, 150, 270, 360] },
    // training: no clock pressure, the Crown open from the start; the lesson switches Crown scoring on when it gets there
    training: { key: 'training', name: 'Training', minutes: 30, round: 1800, bloomOpen: 0, bloomScore: 1e9, nectar: 200, phases: [0, 1800, 1800, 1800, 1800] },
  };
  const PHASE_INFO = [
    { key: 'pollination', name: 'Pollination', line: 'Scout the valley and claim your blooms' },
    { key: 'contest', name: 'Contest', line: 'Fight for the flanks' },
    { key: 'swarming', name: 'Swarming', line: 'The Crown bloom opens at the centre' },
    { key: 'lastlight', name: 'Last Light', line: 'Hold the Crown bloom to score' },
  ];
  const phasesFor = mode => PHASE_INFO.map((p, i) => Object.assign({ start: MODES[mode].phases[i], end: MODES[mode].phases[i + 1] }, p));

  const TYPES = {
    heart:   { name: 'Heart',   cost: 300, sig: 10, reach: 230, hp: 30, structure: true },
    nest:    { name: 'Nest',    cost: 80,  sig: 6,  reach: 150, hp: 8,  structure: true },
    forager: { name: 'Forager', cost: 25, sig: 3, reach: 70,  hp: 1, speed: 48, turn: 3.2, cargo: 12 },
    glint:   { name: 'Glint',   cost: 10, sig: 2, reach: 200, hp: 1, speed: 85, dash: 135, turn: 4, battery: 75 },
    sting:   { name: 'Sting',   cost: 6,  sig: 2, reach: 90,  hp: 1, speed: 95, dash: 150, turn: 5.5, battery: 50 },
    decoy:   { name: 'Decoy',   cost: 5,  sig: 2, fake: 6, reach: 0, hp: 1, speed: 80, dash: 120, turn: 4.5, battery: 60 },
    warden:  { name: 'Warden',  cost: 35, sig: 4, reach: 160, hp: 2, speed: 115, dash: 165, turn: 6, battery: 150, nets: 3, rearm: 4, rearmT: 5, reuse: true },
    raider:  { name: 'Raider',  cost: 40, sig: 4, reach: 110, hp: 3, speed: 70, dash: 100, turn: 3.2, battery: 150, charges: 3, rearm: 6, rearmT: 7, reuse: true },
    relay:   { name: 'Relay',   cost: 30, sig: 4, reach: 80,  hp: 2, speed: 75, dash: 110, turn: 3.5, battery: 240, rearm: 3, rearmT: 4, reuse: true, support: true },
    harrier: { name: 'Harrier', cost: 45, sig: 5, reach: 100, hp: 2, speed: 80, dash: 120, turn: 3.5, battery: 150, rearm: 5, rearmT: 5, reuse: true, support: true },
  };
  const BUILD = {
    forager: { cost: 25, time: 5, n: 1 },
    glint:   { cost: 10, time: 3, n: 1 },
    sting:   { cost: 24, time: 5, n: 4 },
    decoy:   { cost: 10, time: 3, n: 2 },
    warden:  { cost: 35, time: 8, n: 1 },
    raider:  { cost: 40, time: 10, n: 1 },
    relay:   { cost: 30, time: 6, n: 1 },
    harrier: { cost: 45, time: 9, n: 1 },
    nest:    { cost: 80, time: 12, n: 1, site: true },
  };
  const BUILD_ORDER = ['forager', 'glint', 'sting', 'decoy', 'warden', 'raider', 'relay', 'harrier', 'nest'];
  const DIFF = {
    easy:   { react: 4.5, guard: 2, raid: 12, scout: 45, income: 0.72, hold: 2, nests: 1, force: 0.7, jam: false, adapt: 90 },
    normal: { react: 1.8, guard: 3, raid: 12, scout: 30, income: 1.0,  hold: 4, nests: 1, jam: true, adapt: 60 },
    hard:   { react: 0.8, guard: 4, raid: 14, scout: 22, income: 1.12, hold: 5, nests: 2, jam: true, adapt: 30 },
  };

  // ---------- helpers ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeNoise(seed) {
    const r = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    const perm = new Uint8Array(512), val = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = r() * 2 - 1; }
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];
    const sm = t => t * t * (3 - 2 * t);
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255, X1 = (xi + 1) & 255, Y1 = (yi + 1) & 255;
      const a = val[perm[X + perm[Y]]], b = val[perm[X1 + perm[Y]]];
      const c = val[perm[X + perm[Y1]]], d = val[perm[X1 + perm[Y1]]];
      const u = sm(xf), v = sm(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  // ---------- deterministic maths ----------
  // Two players' browsers run the same battle from the same orders, so every result must match to the last bit.
  // Math.sin, cos, atan2 and hypot may differ between engines (Chrome, Safari), so the simulation uses these,
  // built from + - * / and sqrt only, which IEEE 754 fixes exactly. Accurate to about 1e-11.
  const PI = Math.PI, TWO_PI = 2 * PI, HALF_PI = PI / 2;
  const S3 = -1 / 6, S5 = 1 / 120, S7 = -1 / 5040, S9 = 1 / 362880, S11 = -1 / 39916800, S13 = 1 / 6227020800, S15 = -1 / 1307674368000, S17 = 1 / 355687428096000;
  function dsin(x) {
    x -= TWO_PI * Math.floor((x + PI) / TWO_PI);            // to [-pi, pi)
    if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;   // to [-pi/2, pi/2]
    const x2 = x * x;
    return x * (1 + x2 * (S3 + x2 * (S5 + x2 * (S7 + x2 * (S9 + x2 * (S11 + x2 * (S13 + x2 * (S15 + x2 * S17))))))));
  }
  const dcos = x => dsin(x + HALF_PI);
  function datanUnit(t) {                                   // atan(t) for 0 <= t <= 1
    const y = t / (1 + Math.sqrt(1 + t * t)), y2 = y * y;   // atan(t) = 2 atan(y), with y <= tan(pi/8)
    let s = 1 / 25;
    for (let k = 23; k >= 1; k -= 2) s = 1 / k - y2 * s;
    return 2 * y * s;
  }
  function datan2(y, x) {
    if (x === 0 && y === 0) return 0;
    const ax = x < 0 ? -x : x, ay = y < 0 ? -y : y;
    let a = ax >= ay ? datanUnit(ay / ax) : HALF_PI - datanUnit(ax / ay);
    if (x < 0) a = PI - a;
    return y < 0 ? -a : a;
  }
  const dhypot = (x, y) => Math.sqrt(x * x + y * y);

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (ax, ay, bx, by) => dhypot(bx - ax, by - ay);
  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return dhypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---------- map ----------
  function genMap(seed) {
    const rnd = mulberry32(seed || 1);
    const nz = makeNoise(seed || 1);
    const nz2 = makeNoise(((seed || 1) * 31 + 7) >>> 0);
    const R = (a, b) => a + rnd() * (b - a);
    const flip = rnd() < 0.5 ? 1 : -1;
    const hearts = [{ x: 120, y: 500 }, { x: W - 120, y: 500 }];

    const half = [
      { x: R(245, 285), y: 500 + flip * R(150, 185), rate: 3.0 },
      { x: R(330, 390), y: 500 - flip * R(250, 310), rate: 3.0 },
      { x: R(560, 620), y: 500 + flip * R(300, 350), rate: 3.6 },
    ];
    const names = shuffle(['Thistle', 'Sorrel', 'Vetch', 'Clover', 'Heather', 'Tansy', 'Yarrow', 'Bramble', 'Campion', 'Teasel', 'Burdock', 'Mallow'], rnd);
    const fields = [];
    half.forEach((f, i) => fields.push({ x: f.x, y: f.y, r: 30, rate: f.rate, side: 0, name: names[i] }));
    half.forEach((f, i) => fields.push({ x: W - f.x, y: H - f.y, r: 30, rate: f.rate, side: 1, name: names[i + 3] }));
    fields.push({ x: W / 2, y: H / 2, r: 44, rate: 4.8, side: -1, centre: true, name: 'Crown' });

    // ridges on the amber half, mirrored onto the cobalt half (point symmetry about the centre)
    const rid = [];
    const addRidge = (cx, cy, len, ang, w) => {
      const c = dcos(ang), s = dsin(ang), bend = R(-0.35, 0.35) * len * 0.35;
      rid.push({
        pts: [
          { x: cx - c * len / 2, y: cy - s * len / 2 },
          { x: cx - s * bend, y: cy + c * bend },
          { x: cx + c * len / 2, y: cy + s * len / 2 },
        ], w, peak: R(0.9, 1.12), elev: Math.round((230 + R(0, 160) + w * 1.6) / 5) * 5,
      });
    };
    addRidge(R(505, 595), 500 + R(-100, 100), R(200, 270), Math.PI / 2 + R(-0.45, 0.45), R(52, 64)); // overlook
    addRidge(R(360, 450), 500 - flip * R(120, 175), R(150, 210), R(-0.6, 0.6), R(42, 54));           // flank spur
    addRidge(R(680, 740), 500 + flip * R(175, 235), R(80, 130), R(0, Math.PI), R(38, 50));            // knoll
    const ridges = rid.concat(rid.map(r => ({ pts: r.pts.map(p => ({ x: W - p.x, y: H - p.y })), w: r.w, peak: r.peak, elev: r.elev })));

    // canopy circles (clusters), mirrored
    const can = [];
    const blob = (cx, cy, r) => {
      const n = 3 + ((rnd() * 2) | 0);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * r * 0.65;
        can.push({ x: cx + dcos(a) * d, y: cy + dsin(a) * d, r: r * R(0.5, 0.8) });
      }
    };
    const hf = fields[0];
    blob((hearts[0].x + hf.x) / 2 + 30, (hearts[0].y + hf.y) / 2 + flip * 45, R(52, 68));
    blob(R(420, 470), 500 + R(-70, 70), R(46, 60));
    blob(R(640, 700), 500 + flip * R(230, 290), R(52, 70));
    blob(R(220, 560), 500 - flip * R(340, 420), R(42, 58));
    const canopy = can.concat(can.map(c => ({ x: W - c.x, y: H - c.y, r: c.r })));

    const hgt = new Float32Array(HW * HH), rg = new Uint8Array(HW * HH);
    const canF = new Float32Array(HW * HH), cg = new Uint8Array(HW * HH);
    const sn = (x, y) => 0.5 * (nz(x / 75, y / 75) + nz((W - x) / 75, (H - y) / 75));
    const sn2 = (x, y) => 0.5 * (nz2(x / 38, y / 38) + nz2((W - x) / 38, (H - y) / 38));
    const peaksBy = {};
    for (let j = 0; j < HH; j++) {
      for (let i = 0; i < HW; i++) {
        const x = (i + 0.5) * HC, y = (j + 0.5) * HC, idx = j * HW + i;
        let k = 1;
        for (const hp of hearts) k = Math.min(k, clamp((dist(x, y, hp.x, hp.y) - 80) / 50, 0, 1));
        for (const f of fields) k = Math.min(k, clamp((dist(x, y, f.x, f.y) - f.r - 22) / 40, 0, 1));
        let best = 0, bi = 0;
        const n = sn(x, y);
        for (let r = 0; r < ridges.length; r++) {
          const rr = ridges[r], p = rr.pts;
          const d = Math.min(distToSeg(x, y, p[0].x, p[0].y, p[1].x, p[1].y), distToSeg(x, y, p[1].x, p[1].y, p[2].x, p[2].y));
          let h = 1 - d / rr.w;
          if (h < -0.45) continue;
          h = h * rr.peak + 0.3 * n;
          if (h > best) { best = h; bi = r + 1; }
        }
        best = clamp(best, 0, 1) * k;
        hgt[idx] = best;
        if (best > RIDGE_H) {
          rg[idx] = bi;
          const pk = peaksBy[bi];
          if (!pk || best > pk.h) peaksBy[bi] = { x, y, h: best, id: bi, elev: ridges[bi - 1].elev };
        }
        let c = -1;
        for (const cc of canopy) { const v = 1 - dist(x, y, cc.x, cc.y) / cc.r; if (v > c) c = v; }
        if (c > -0.5) c += 0.32 * sn2(x, y);
        let kc = 1;
        for (const hp of hearts) kc = Math.min(kc, clamp((dist(x, y, hp.x, hp.y) - 60) / 30, 0, 1));
        for (const f of fields) kc = Math.min(kc, clamp((dist(x, y, f.x, f.y) - f.r - 10) / 20, 0, 1));
        c = c * kc;
        canF[idx] = clamp(c, 0, 1);
        cg[idx] = c > 0.08 ? 1 : 0;
      }
    }
    const peaks = Object.values(peaksBy).filter(p => p.h > 0.45);
    // canopy patches: connected groups of canopy cells, used for map labels
    const seen = new Uint8Array(HW * HH), patches = [];
    for (let j = 0; j < HH; j++) {
      for (let i = 0; i < HW; i++) {
        const s0 = j * HW + i;
        if (!cg[s0] || seen[s0]) continue;
        let sx = 0, sy = 0, n = 0;
        const stack = [s0], cells = []; seen[s0] = 1;
        while (stack.length) {
          const c = stack.pop(), ci = c % HW, cj = (c / HW) | 0;
          sx += ci; sy += cj; n++; cells.push(c);
          if (ci > 0 && cg[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
          if (ci < HW - 1 && cg[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
          if (cj > 0 && cg[c - HW] && !seen[c - HW]) { seen[c - HW] = 1; stack.push(c - HW); }
          if (cj < HH - 1 && cg[c + HW] && !seen[c + HW]) { seen[c + HW] = 1; stack.push(c + HW); }
        }
        if (n > 90) {
          // label at the cell furthest from blooms and hearts, staying near the middle of the patch
          const cx = (sx / n + 0.5) * HC, cy = (sy / n + 0.5) * HC;
          let best = null, bs = -1e9;
          for (const c of cells) {
            const x = (c % HW + 0.5) * HC, y = (((c / HW) | 0) + 0.5) * HC;
            let m = 140;
            for (const f of fields) m = Math.min(m, dist(x, y, f.x, f.y) - f.r - 10);
            for (const hp of hearts) m = Math.min(m, dist(x, y, hp.x, hp.y) - 40);
            const sc = m - 0.35 * dist(x, y, cx, cy);
            if (sc > bs) { bs = sc; best = { x, y }; }
          }
          patches.push({ x: best.x, y: best.y, cx, cy, n });
        }
      }
    }
    return { seed, flip, fields, hearts, ridges, canopy, hgt, rg, canF, cg, peaks, patches };
  }

  function ridgeAt(m, x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return m.rg[((y / HC) | 0) * HW + ((x / HC) | 0)];
  }
  function canopyAt(m, x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return m.cg[((y / HC) | 0) * HW + ((x / HC) | 0)];
  }
  // A ridge blocks sight unless one end of the line stands on it.
  function los(m, ax, ay, bx, by) {
    const ra = ridgeAt(m, ax, ay), rb = ridgeAt(m, bx, by);
    const d = dhypot(bx - ax, by - ay), n = Math.ceil(d / 8);
    for (let k = 1; k < n; k++) {
      const t = k / n, r = ridgeAt(m, ax + (bx - ax) * t, ay + (by - ay) * t);
      if (r && r !== ra && r !== rb) return false;
    }
    return true;
  }
  // Visibility polygon for a sensor of reach R (used for the fog of war).
  function visPoly(m, x, y, R, rays) {
    const rs = ridgeAt(m, x, y), pts = new Float32Array(rays * 2);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2, c = dcos(a), s = dsin(a);
      let len = R, inR = 0;
      for (let d = 6; d <= R; d += 6) {
        const px = x + c * d, py = y + s * d;
        if (px < 0 || py < 0 || px >= W || py >= H) { len = d; break; }
        const r = ridgeAt(m, px, py);
        if (inR) { if (r !== inR) { len = d; break; } }
        else if (r && r !== rs) inR = r;
      }
      pts[i * 2] = x + c * len; pts[i * 2 + 1] = y + s * len;
    }
    return pts;
  }

  // ---------- units and bases ----------
  function addUnit(sim, side, type, x, y, extra) {
    const T = TYPES[type];
    const u = {
      id: sim.nextId++, side, type, x, y, px: x, py: y, vx: 0, vy: 0,
      hdg: side ? Math.PI : 0, hp: T.hp, state: 'parked', parked: true, sortie: 0,
      moving: false, dash: false, diving: false, diveT: 0, battery: T.battery || 0,
      charges: T.charges || 0, nets: T.nets || 0, rearmT: 0, rearmPaid: false, homing: false,
      cargo: 0, field: -1, slot: 0, manual: false, wp: 0, off: sim.rnd() * 2 - 1,
      target: 0, spot: 0, retry: 0, scanPhase: (sim.nextId % 3), cool: 0, loiter: 0, orb: sim.rnd() * 6.28, link: true, jam: false,
    };
    if (extra) Object.assign(u, extra);
    sim.units.push(u); sim.byId.set(u.id, u);
    return u;
  }
  const isStructure = u => !!TYPES[u.type].structure;
  function basesOf(sim, side) {
    const out = [sim.hearts[side]];
    for (const u of sim.units) if (u.side === side && u.type === 'nest' && u.hp > 0) out.push(u);
    return out;
  }
  function nearestBase(sim, side, x, y) {
    let best = sim.hearts[side], bd = Infinity;
    for (const b of basesOf(sim, side)) { const d = dist(x, y, b.x, b.y); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  function createSim(opts) {
    opts = opts || {};
    const seed = (opts.seed >>> 0) || 1;
    const diff = DIFF[opts.diff] ? opts.diff : 'normal';
    const mode = MODES[opts.mode] ? opts.mode : 'short';
    const cfg = Object.assign({}, MODES[mode]);   // a copy, so a round (training) can change its own timings
    const map = genMap(seed);
    const sim = {
      seed, diff, mode, cfg, phases: phasesFor(mode), map, t: 0, tick: 0, over: false, winner: -1, reason: '',
      units: [], byId: new Map(), nextId: 1, sorties: new Map(), nextSortie: 1,
      events: [], rnd: mulberry32((seed ^ 0x5bd1e995) >>> 0), holder: -1, presence: [0, 0],
      phase: 0, bloomOpen: false, hearts: [], ai: [null, null], frost: false, links: [[], []],
    };
    sim.sides = [0, 1].map(s => ({
      side: s, nectar: cfg.nectar, harvested: 0, queue: [], qid: 1, guard: true,
      destroyed: 0, lost: 0, kills: 0, losses: 0, spent: 0, score: 0,
      unseen: 0, exposure: 0, pic: new Map(), flakCd: 0, mult: 1,
      droneDestroyed: 0, droneLost: 0, heartDealt: 0, heartTaken: 0,
      heartDealtBy: {}, heartTakenBy: {}, lostBy: {}, lostTo: {}, recovered: 0, returns: 0, decoyDrew: 0,
      fieldDanger: new Float32Array(map.fields.length).fill(-999), best: null,
      plan: [], auto: false, autoSkip: null, posts: [], postSeq: 1,
    }));
    for (let s = 0; s < 2; s++) {
      const hp = map.hearts[s];
      sim.hearts.push(addUnit(sim, s, 'heart', hp.x, hp.y, { parked: false, state: 'heart' }));
      for (let i = 0; i < 2; i++) addUnit(sim, s, 'forager', hp.x + (s ? -22 : 22), hp.y + (i ? 16 : -16), { parked: false, state: 'idle', hdg: s ? Math.PI : 0 });
      addUnit(sim, s, 'glint', hp.x, hp.y);
      for (let i = 0; i < 4; i++) addUnit(sim, s, 'sting', hp.x, hp.y);
    }
    const aiSides = opts.ai || [1];
    for (const s of aiSides) sim.ai[s] = createAI(sim, s, (opts.aiDiff && opts.aiDiff[s]) || diff, opts.aiStyle && opts.aiStyle[s]);
    return sim;
  }

  function phaseAt(sim, t) {
    const P = sim.phases;
    for (let i = 0; i < P.length; i++) if (t < P[i].end) return i;
    return P.length - 1;
  }
  const fieldOpen = (sim, i) => i >= 0 && i < sim.map.fields.length && (!sim.map.fields[i].centre || sim.t >= sim.cfg.bloomOpen);
  function yieldFactor(sim, t) {
    const C = sim.cfg;
    return t < C.bloomScore ? 1 : 1 - 0.65 * clamp((t - C.bloomScore) / (C.round - C.bloomScore), 0, 1);
  }

  function sigOf(sim, u, truth) {
    const T = TYPES[u.type];
    if (T.structure) return T.sig;
    let s = u.type === 'decoy' && !truth ? T.fake : T.sig;
    if (u.type === 'forager' && u.state === 'harvest') s += 3;
    if (u.dash && u.moving) s += 2;
    if (u.diving) s += 4;
    if (ridgeAt(sim.map, u.x, u.y)) s += 1;
    if (canopyAt(sim.map, u.x, u.y)) s -= u.moving ? 1 : 2;
    return Math.max(0.5, s);
  }
  function reachOf(sim, u) {
    const T = TYPES[u.type];
    return T.reach * (!T.structure && ridgeAt(sim.map, u.x, u.y) ? 1.3 : 1);
  }
  // What a drone takes a contact to be. A Decoy passes for a Raider until the hive has seen through it,
  // and a jammed drone never hears that it has.
  function perceivedType(sim, side, e, jammed) {
    if (e.type !== 'decoy') return e.type;
    if (jammed) return 'raider';
    const c = sim.sides[side].pic.get(e.id);
    return c && c.revealed ? 'decoy' : 'raider';
  }

  // ---------- orders ----------
  function nestCount(sim, side) {
    let n = 0;
    for (const u of sim.units) if (u.side === side && u.type === 'nest' && u.hp > 0) n++;
    for (const q of sim.sides[side].queue) if (q.type === 'nest') n++;
    return n;
  }
  function nestSiteError(sim, side, x, y) {
    const m = sim.map, own = sim.hearts[side], eh = sim.hearts[1 - side];
    if (x < 30 || y < 30 || x > W - 30 || y > H - 30) return 'Too close to the edge of the valley.';
    if (nestCount(sim, side) >= NEST_MAX) return 'You can have two Nests at a time.';
    if (dist(x, y, eh.x, eh.y) < NEST_ENEMY_CLEAR) return 'Too close to the rival Heart.';
    if (dist(x, y, own.x, own.y) < 170) return 'Too close to your Heart to be useful.';
    if (ridgeAt(m, x, y)) return 'Nests can’t grow on a ridge.';
    for (const f of m.fields) if (dist(x, y, f.x, f.y) < f.r + 26) return 'Too close to a bloom.';
    let near = dist(x, y, own.x, own.y) <= NEST_FROM_HEART;
    const sites = [];
    for (const u of sim.units) if (u.side === side && u.type === 'nest' && u.hp > 0) sites.push(u);
    for (const q of sim.sides[side].queue) if (q.type === 'nest' && q.site) sites.push(q.site);
    for (const p of sites) {
      const d = dist(x, y, p.x, p.y);
      if (d < 130) return 'Too close to another Nest.';
      if (d <= NEST_FROM_NEST) near = true;
    }
    if (!near) return 'Grow Nests within reach of your Heart or another Nest.';
    return '';
  }
  // Auto items (from the production plan) wait behind anything you queue yourself, except the one already in the vat.
  function build(sim, side, type, site, opts) {
    const S = sim.sides[side], b = BUILD[type];
    if (!b || sim.over || S.nectar < b.cost || S.queue.length >= QUEUE_MAX) return null;
    if (b.site && (!site || nestSiteError(sim, side, site.x, site.y))) return null;
    S.nectar -= b.cost; S.spent += b.cost;
    const auto = !!(opts && opts.auto);
    const q = { id: S.qid++, type, t: b.time, total: b.time, site: b.site ? { x: site.x, y: site.y } : null, auto };
    let at = S.queue.length;
    if (!auto) { const i = S.queue.findIndex((x, k) => k > 0 && x.auto); if (i > 0) at = i; }
    S.queue.splice(at, 0, q);
    return q;
  }
  function cancelBuild(sim, side, qid) {
    const S = sim.sides[side], i = S.queue.findIndex(q => q.id === qid);
    if (i < 0 || sim.over) return null;
    const q = S.queue.splice(i, 1)[0], c = BUILD[q.type].cost;
    S.nectar += c; S.spent -= c;
    if (q.auto) S.autoSkip = { type: q.type, until: sim.t + 15 };   // cancelling an auto item skips that row for a while
    return q;
  }
  function parkedOf(sim, side, type) {
    const out = [];
    for (const u of sim.units) if (u.side === side && u.type === type && u.parked && u.hp > 0 && !(u.rearmT > 0)) out.push(u);
    return out;
  }
  const parkedCount = (sim, side, type) => parkedOf(sim, side, type).length;
  function rearmingCount(sim, side, type) {
    let n = 0;
    for (const u of sim.units) if (u.side === side && u.type === type && u.parked && u.hp > 0 && u.rearmT > 0) n++;
    return n;
  }
  function outCount(sim, side, type) {
    let n = 0;
    for (const u of sim.units) if (u.side === side && u.type === type && !u.parked && u.hp > 0) n++;
    return n;
  }
  const cleanRoute = route => (route || []).map(p => ({ x: clamp(p.x, 6, W - 6), y: clamp(p.y, 6, H - 6) }));

  function launch(sim, side, type, n, route, opts) {
    opts = opts || {};
    const T = TYPES[type];
    if (sim.over || !T || T.structure || type === 'forager') return null;
    const avail = parkedOf(sim, side, type);
    if (!avail.length) return null;
    const k = n === 'all' ? avail.length : Math.max(1, Math.min(n | 0, avail.length));
    const rt = cleanRoute(route);
    const tgt = opts.target ? sim.byId.get(opts.target) : null;
    const h = sim.hearts[side];
    const anchor = rt[0] || (tgt ? { x: tgt.x, y: tgt.y } : { x: h.x + (side ? -40 : 40), y: h.y });
    const base = opts.fromHeart ? h : nearestBase(sim, side, anchor.x, anchor.y);
    const so = {
      id: sim.nextSortie++, side, type, units: [], route: rt, ox: base.x, oy: base.y,
      stance: opts.stance || 'quiet', mode: opts.mode || 'route', target: opts.target || 0,
      cost: 0, destroyed: 0, killed: {}, born: sim.t, label: opts.label || '', n: k, pkg: opts.pkg || 0, post: opts.post || 0,
    };
    for (let i = 0; i < k; i++) {
      const u = avail[i];
      u.parked = false; u.state = 'fly'; u.sortie = so.id; u.wp = 0; u.diving = false; u.homing = false;
      u.x = base.x + (sim.rnd() - 0.5) * 18; u.y = base.y + (sim.rnd() - 0.5) * 18; u.px = u.x; u.py = u.y;
      u.hdg = datan2(anchor.y - u.y, anchor.x - u.x);
      u.dash = so.stance === 'dash'; u.loiter = 0; u.cool = 0; u.link = true; u.jam = false;
      u.target = type === 'raider' && so.mode === 'raid' ? 0 : so.target;   // a Raider flies its route before it bombs
      if (!T.reuse) u.battery = T.battery;
      so.units.push(u.id); so.cost += T.cost;
    }
    sim.sorties.set(so.id, so);
    return so;
  }
  // New orders reach only drones in link. Drones out of link or jammed carry on as they were, on a sortie of their own.
  function splitUnlinked(sim, so) {
    const off = so.units.filter(id => { const u = sim.byId.get(id); return u && u.hp > 0 && !u.link; });
    if (!off.length || off.length === so.units.length) return;
    const rest = Object.assign({}, so, { id: sim.nextSortie++, units: off, route: so.route.slice(), killed: {}, destroyed: 0, cost: 0, n: off.length });
    sim.sorties.set(rest.id, rest);
    for (const id of off) sim.byId.get(id).sortie = rest.id;
    so.units = so.units.filter(id => !off.includes(id));
  }
  const linkedIn = (sim, so) => so.units.some(id => { const u = sim.byId.get(id); return u && u.hp > 0 && u.link; });
  function retask(sim, sortieId, route, opts) {
    opts = opts || {};
    const so = sim.sorties.get(sortieId);
    if (!so || sim.over || !linkedIn(sim, so)) return false;
    splitUnlinked(sim, so);
    so.route = cleanRoute(route); so.mode = opts.mode || 'route'; so.target = opts.target || 0; so.post = 0;
    if (opts.stance) so.stance = opts.stance;
    for (const id of so.units) {
      const u = sim.byId.get(id);
      if (!u || u.hp <= 0) continue;
      u.wp = 0; u.target = u.type === 'raider' && so.mode === 'raid' ? 0 : so.target; u.diving = false; u.state = 'fly'; u.dash = so.stance === 'dash';
      u.homing = false; u.loiter = 0;
    }
    return true;
  }
  function recall(sim, sortieId) {
    const so = sim.sorties.get(sortieId);
    if (!so || sim.over || !linkedIn(sim, so)) return false;
    splitUnlinked(sim, so);
    so.post = 0;
    if (TYPES[so.type].reuse) { for (const id of so.units) { const u = sim.byId.get(id); if (u) { u.homing = true; u.target = 0; } } }
    else if (so.type === 'sting') { so.mode = 'home'; for (const id of so.units) { const u = sim.byId.get(id); if (u) { u.target = 0; u.diving = false; } } }
    else return false;
    return true;
  }
  function setStance(sim, sortieId, stance) {
    const so = sim.sorties.get(sortieId);
    if (!so || !linkedIn(sim, so)) return;
    splitUnlinked(sim, so);
    so.stance = stance;
    for (const id of so.units) { const u = sim.byId.get(id); if (u) u.dash = stance === 'dash'; }
  }
  function freeSlot(sim, u, fi) {
    const used = new Set();
    let n = 0;
    for (const o of sim.units) if (o !== u && o.side === u.side && o.type === 'forager' && o.hp > 0 && o.field === fi) { used.add(o.slot); n++; }
    if (n >= 3) return -1;
    for (let k = 0; k < 3; k++) if (!used.has(k)) return k;
    return -1;
  }
  function assignForager(sim, id, fi) {
    const u = sim.byId.get(id);
    if (!u || u.type !== 'forager' || u.hp <= 0 || !fieldOpen(sim, fi)) return false;
    if (u.field === fi) { u.manual = true; return true; }
    const sl = freeSlot(sim, u, fi);
    if (sl < 0) return false;
    u.field = fi; u.slot = sl; u.manual = true;
    if (u.state !== 'return') u.state = 'toField';
    return true;
  }
  function setGuard(sim, side, on) { sim.sides[side].guard = !!on; }

  function pickField(sim, u) {
    const m = sim.map, S = sim.sides[u.side];
    let best = -1, bs = 1e9;
    for (let i = 0; i < m.fields.length; i++) {
      if (!fieldOpen(sim, i)) continue;
      const sl = freeSlot(sim, u, i);
      if (sl < 0) continue;
      const f = m.fields[i], b = nearestBase(sim, u.side, f.x, f.y);
      let n = 0;
      for (const o of sim.units) if (o !== u && o.side === u.side && o.type === 'forager' && o.hp > 0 && o.field === i) n++;
      let sc = dist(b.x, b.y, f.x, f.y) + n * 45;
      if (sim.t - S.fieldDanger[i] < 25) sc += 450;
      if (f.side >= 0 && f.side !== u.side) sc += 320;
      if (f.centre) sc += 120;
      if (sc < bs) { bs = sc; best = i; }
    }
    return best;
  }

  // ---------- movement ----------
  function moveTo(u, tx, ty, spd, turn, dt) {
    const dx = tx - u.x, dy = ty - u.y, d = dhypot(dx, dy);
    if (d < 0.6) { u.moving = false; return d; }
    const want = datan2(dy, dx), diff = angDiff(want, u.hdg), mt = turn * dt;
    u.hdg += clamp(diff, -mt, mt);
    let s = spd;
    if (d < 40) s = Math.max(spd * 0.22, (spd * d) / 40);
    const step = Math.min(s * dt, d);
    if (Math.abs(diff) > 1.1 && d < 70) { u.x += (dx / d) * step * 0.6; u.y += (dy / d) * step * 0.6; }
    else { u.x += dcos(u.hdg) * step; u.y += dsin(u.hdg) * step; }
    u.moving = step / dt > 10;
    return d;
  }
  function homeIn(u, tx, ty, spd, dt) {
    const dx = tx - u.x, dy = ty - u.y, d = dhypot(dx, dy);
    if (d < 0.01) return 0;
    const step = Math.min(spd * dt, d);
    u.x += (dx / d) * step; u.y += (dy / d) * step;
    u.hdg = datan2(dy, dx); u.moving = true;
    return d - step;
  }
  // Follow the sortie's route; hover in a loose ring at the end. Returns true once at the end.
  function followRoute(sim, u, so, spd, dt) {
    const T = TYPES[u.type], rt = so.route;
    if (u.wp < rt.length) {
      const p = rt[u.wp];
      const prev = u.wp > 0 ? rt[u.wp - 1] : { x: so.ox, y: so.oy };
      const a = datan2(p.y - prev.y, p.x - prev.x) + Math.PI / 2;
      const spread = so.units.length > 1 ? 12 : 0;
      const tx = p.x + dcos(a) * u.off * spread, ty = p.y + dsin(a) * u.off * spread;
      const d = moveTo(u, tx, ty, spd, T.turn, dt);
      if (d < Math.max(14, spd * 0.18) && u.wp < rt.length - 1) u.wp++;
      else if (d < 6) u.wp++;
      return false;
    }
    const end = rt.length ? rt[rt.length - 1] : { x: u.x, y: u.y };
    const ang = u.off * Math.PI, rad = so.units.length > 1 ? 10 + Math.abs(u.off) * 8 : 0;
    moveTo(u, end.x + dcos(ang) * rad, end.y + dsin(ang) * rad, spd * 0.5, T.turn, dt);
    return true;
  }
  function land(sim, u, b) {
    const T = TYPES[u.type], S = sim.sides[u.side];
    const so = sim.sorties.get(u.sortie);
    if (so) so.units = so.units.filter(id => id !== u.id);
    u.parked = true; u.state = 'parked'; u.sortie = 0; u.target = 0; u.dash = false; u.diving = false; u.homing = false;
    u.x = b.x; u.y = b.y; u.moving = false;
    if (T.reuse) {
      u.rearmT = T.rearmT; u.rearmPaid = false;
      S.recovered += T.cost; S.returns++;
      sim.events.push({ k: 'landed', side: u.side, type: u.type, x: b.x, y: b.y });
    } else {
      u.battery = T.battery;
    }
  }
  function flyHome(sim, u, dt) {
    const T = TYPES[u.type], b = nearestBase(sim, u.side, u.x, u.y);
    const d = moveTo(u, b.x, b.y, u.dash && T.dash ? T.dash : T.speed, T.turn, dt);
    if (d < 14) land(sim, u, b);
  }

  // ---------- contacts ----------
  function estimate(sim, side, id) {
    const c = sim.sides[side].pic.get(id);
    if (!c) return null;
    if (c.static && c.known) return { x: c.x, y: c.y, ok: true, stale: false };
    if (c.grade >= 2 || c.lockUntil > sim.t) return { x: c.x, y: c.y, ok: true, stale: false };
    if (c.grade === 1) return { x: c.gx, y: c.gy, ok: false, stale: false };
    return { x: c.x, y: c.y, ok: false, stale: true };
  }
  function targetedBy(sim, side, id, type) {
    type = type || 'sting';
    let n = 0;
    for (const u of sim.units) if (u.side === side && u.type === type && !u.parked && u.hp > 0 && u.target === id) n++;
    return n;
  }

  function detect(sim, dtd) {
    const t = sim.t;
    for (let s = 0; s < 2; s++) {
      const S = sim.sides[s], pic = S.pic;
      const sensors = [];
      for (const u of sim.units) {
        if (u.side !== s || u.parked || u.hp <= 0 || u.jam) continue;   // a jammed drone cannot send back what it sees
        const R = reachOf(sim, u);
        if (R > 0) sensors.push({ x: u.x, y: u.y, R });
      }
      for (const e of sim.units) {
        if (e.side === s || e.parked || e.hp <= 0) continue;
        let c = pic.get(e.id);
        if (e.type === 'heart') {
          if (!c) pic.set(e.id, { id: e.id, grade: 2, x: e.x, y: e.y, gx: e.x, gy: e.y, vx: 0, vy: 0, type: 'heart', known: true, static: true, first: t, seenT: t, trackT: t, lockUntil: 0, held: 99, jitT: 0 });
          e.spot = 2;
          continue;
        }
        const isDecoy = e.type === 'decoy';
        const sg = sigOf(sim, e), tsg = isDecoy ? sigOf(sim, e, true) : 0;
        let best = 0, reveal = false;
        for (const sn of sensors) {
          const dx = e.x - sn.x, dy = e.y - sn.y;
          const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const q = (sn.R * sg) / 5 / d;
          if (q < 0.55) continue;
          const revealHere = isDecoy && !reveal && (sn.R * tsg) / 5 / d >= 1.5;
          if (q <= best && !revealHere) continue;
          if (!los(sim.map, sn.x, sn.y, e.x, e.y)) continue;
          if (q > best) best = q;
          if (revealHere) reveal = true;
          if (best >= 1.5 && (!isDecoy || reveal)) break;
        }
        if (e.type === 'harrier' && e.jams > 0 && best < 1) best = 1;   // jamming gives a Harrier away: tracked while it jams you
        const grade = best >= 1.5 ? 3 : best >= 1 ? 2 : best >= 0.55 ? 1 : 0;
        e.spot = grade;
        if (!c) {
          if (!grade) continue;
          c = { id: e.id, grade: 0, x: e.x, y: e.y, gx: e.x, gy: e.y, vx: 0, vy: 0, type: isDecoy ? 'raider' : e.type, known: false, first: t, seenT: t, trackT: -99, lockUntil: 0, held: 0, jitT: -9 };
          pic.set(e.id, c);
        }
        if (isDecoy && reveal && !c.revealed) {
          c.revealed = true;
          sim.events.push({ k: 'decoyReveal', obs: s, id: e.id, x: e.x, y: e.y });
        }
        const prevGrade = c.grade, wasLocked = c.lockUntil > t;
        c.grade = grade;
        if (grade >= 2) {
          c.type = isDecoy && !c.revealed ? 'raider' : e.type;
          if (prevGrade < 2 && t - c.trackT > 4) sim.events.push({ k: 'contact', obs: s, id: e.id, type: c.type, x: e.x, y: e.y });
          c.x = e.x; c.y = e.y; c.gx = e.x; c.gy = e.y; c.vx = e.vx; c.vy = e.vy;
          c.known = true; c.trackT = t; c.seenT = t; c.held += dtd;
          if (isStructure(e)) c.static = true;
          if (grade === 3) {
            if (!wasLocked) sim.events.push({ k: 'lock', obs: s, id: e.id, type: c.type, x: e.x, y: e.y });
            c.lockUntil = t + LOCK_MEMORY;
          }
        } else {
          c.held = 0;
          if (grade === 1) {
            c.seenT = t;
            if (!c.static && t - c.jitT > 0.8) { c.jitT = t; c.gx = e.x + (sim.rnd() - 0.5) * 56; c.gy = e.y + (sim.rnd() - 0.5) * 56; }
            if (!c.static && t - c.trackT > 4) c.known = false;
          }
          if (!c.static && c.lockUntil > t) { c.x += c.vx * dtd; c.y += c.vy * dtd; }
        }
      }
      // forget stale or dead contacts; structures stay on the picture once found
      for (const [id, c] of pic) {
        const e = sim.byId.get(id);
        if (!e || e.hp <= 0 || e.parked) { pic.delete(id); continue; }
        if (c.static && c.known) continue;
        if (c.grade === 0 && c.lockUntil < t && t - c.seenT > CONTACT_MEMORY) pic.delete(id);
      }
    }
    // exposure stats: share of drone-time spent untracked
    for (const u of sim.units) {
      if (u.parked || u.hp <= 0 || isStructure(u)) continue;
      const S = sim.sides[u.side];
      S.exposure += dtd;
      if (u.spot < 2) S.unseen += dtd;
    }
  }

  // ---------- links and jamming ----------
  // A drone is in link when it is within reach of your Heart, a Nest, or a Relay that is itself in link, and not inside
  // a rival Harrier's jamming. Out of link it keeps its orders; jammed, it also cannot report or use the hive's picture.
  const jammedAt = (sim, side, x, y) => sim.units.some(h => h.side !== side && h.type === 'harrier' && !h.parked && h.hp > 0 && (h.x - x) * (h.x - x) + (h.y - y) * (h.y - y) <= JAM_R * JAM_R);
  function linkPass(sim) {
    const harriers = [[], []];
    for (const u of sim.units) if (u.type === 'harrier' && !u.parked && u.hp > 0) { harriers[u.side].push(u); u.jams = 0; }
    for (const u of sim.units) {
      if (u.parked || u.hp <= 0 || isStructure(u)) continue;
      u.jam = false;
      for (const h of harriers[1 - u.side]) if ((h.x - u.x) * (h.x - u.x) + (h.y - u.y) * (h.y - u.y) <= JAM_R * JAM_R) { u.jam = true; h.jams++; }
    }
    for (let s = 0; s < 2; s++) {
      const nodes = basesOf(sim, s).map(b => ({ x: b.x, y: b.y, r: LINK_R[b.type], id: b.id }));
      const relays = sim.units.filter(u => u.side === s && u.type === 'relay' && !u.parked && u.hp > 0 && !u.jam && !u.homing);
      const used = new Set();
      for (let grew = true; grew;) {
        grew = false;
        for (const r of relays) {
          if (used.has(r.id)) continue;
          const from = nodes.find(n => (n.x - r.x) * (n.x - r.x) + (n.y - r.y) * (n.y - r.y) <= n.r * n.r);
          if (from) { nodes.push({ x: r.x, y: r.y, r: LINK_R.relay, id: r.id, relay: true, from: from.id }); used.add(r.id); grew = true; }
        }
      }
      sim.links[s] = nodes;
      for (const u of sim.units) {
        if (u.side !== s || u.parked || u.hp <= 0 || isStructure(u)) continue;
        u.link = !u.jam && nodes.some(n => (n.x - u.x) * (n.x - u.x) + (n.y - u.y) * (n.y - u.y) <= n.r * n.r);
      }
    }
  }
  const inLink = (sim, side, x, y) => sim.links[side].some(n => (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y) <= n.r * n.r);

  // ---------- combat ----------
  function killUnit(sim, u, src, how) {
    if (u.dead) return;
    u.hp = 0; u.dead = true;
    const S = sim.sides[u.side], v = TYPES[u.type].cost;
    if (how === 'destroyed') {
      const O = sim.sides[1 - u.side], by = src ? src.type : 'other';
      S.lost += v; S.losses++; S.droneLost += v;
      S.lostBy[u.type] = (S.lostBy[u.type] || 0) + 1;
      S.lostTo[by] = (S.lostTo[by] || 0) + v;
      O.destroyed += v; O.kills++; O.droneDestroyed += v;
      if (src && src.sortie) {
        const so = sim.sorties.get(src.sortie);
        if (so) { so.destroyed += v; so.killed[u.type] = (so.killed[u.type] || 0) + 1; }
      }
      if (u.type === 'forager' && u.field >= 0) S.fieldDanger[u.field] = sim.t;
      sim.events.push({ k: 'killed', side: u.side, type: u.type, x: u.x, y: u.y, by });
    } else if (how === 'expired') {
      if (TYPES[u.type].reuse) { S.lost += v; S.droneLost += v; S.losses++; S.lostBy[u.type] = (S.lostBy[u.type] || 0) + 1; }
      const so = sim.sorties.get(u.sortie);
      sim.events.push({ k: 'fizzle', side: u.side, type: u.type, x: u.x, y: u.y, post: so ? so.post : 0 });
    }
  }
  function damage(sim, tgt, amt, src) {
    if (tgt.hp <= 0) return;
    if (tgt.type === 'heart') {
      const hit = Math.min(amt, tgt.hp), by = src ? src.type : 'other', A = sim.sides[1 - tgt.side], D = sim.sides[tgt.side];
      tgt.hp -= hit;
      sim.events.push({ k: 'heartHit', side: tgt.side, x: tgt.x, y: tgt.y, hp: tgt.hp, by });
      if (src && src.sortie) { const so = sim.sorties.get(src.sortie); if (so) { so.destroyed += 10 * hit; so.killed.heart = (so.killed.heart || 0) + hit; } }
      A.destroyed += 10 * hit; A.heartDealt += hit; A.heartDealtBy[by] = (A.heartDealtBy[by] || 0) + hit;
      D.lost += 10 * hit; D.heartTaken += hit; D.heartTakenBy[by] = (D.heartTakenBy[by] || 0) + hit;
      if (tgt.hp <= 0) endGame(sim, 1 - tgt.side, 'heart');
      return;
    }
    tgt.hp -= amt;
    if (tgt.type === 'nest' && tgt.hp > 0) sim.events.push({ k: 'nestHit', side: tgt.side, x: tgt.x, y: tgt.y, hp: tgt.hp });
    if (tgt.hp <= 0) killUnit(sim, tgt, src, 'destroyed');
  }
  function impact(sim, u, tgt) {
    const p = isStructure(tgt) ? 1 : tgt.moving ? 0.78 : 0.95;
    const hit = sim.rnd() < p;
    if (tgt.type === 'decoy') sim.sides[tgt.side].decoyDrew++;
    sim.events.push({ k: 'boom', side: u.side, x: u.x, y: u.y, hit, on: tgt.type });
    killUnit(sim, u, null, 'spent');
    if (hit) damage(sim, tgt, 1, u);
  }
  function drop(sim, u, x, y) {
    u.charges--;
    sim.events.push({ k: 'bomb', side: u.side, x, y });
    for (const e of sim.units) {
      if (e.side === u.side || e.parked || e.hp <= 0) continue;
      const st = isStructure(e);
      if (dist(x, y, e.x, e.y) > BLAST_R + (st ? 14 : 0)) continue;
      if (e.type === 'decoy') sim.sides[e.side].decoyDrew++;
      if (st) { damage(sim, e, 2, u); if (sim.over) return; continue; }
      if (e.diving) continue;
      if (sim.rnd() < (e.moving ? 0.5 : 0.92)) damage(sim, e, 1, u);
    }
  }
  function netShot(sim, u, e) {
    u.nets--; u.cool = 0.7;
    const hit = sim.rnd() < (e.diving ? 0.5 : e.moving ? 0.8 : 0.95);
    if (e.type === 'decoy') sim.sides[e.side].decoyDrew++;
    sim.events.push({ k: 'net', side: u.side, x: u.x, y: u.y, x2: e.x, y2: e.y, hit });
    if (hit) damage(sim, e, 1, u);
  }

  function seekerSees(sim, u, e) {
    const d = Math.max(1, dhypot(e.x - u.x, e.y - u.y));
    return (TYPES.sting.reach * sigOf(sim, e)) / 5 / d >= 1 && los(sim.map, u.x, u.y, e.x, e.y);
  }

  function updateSting(sim, u, dt) {
    const T = TYPES.sting, so = sim.sorties.get(u.sortie);
    u.battery -= dt;
    if (u.battery <= 0 || !so) { killUnit(sim, u, null, 'expired'); return; }
    // terminal dive
    if (u.diving) {
      const tgt = sim.byId.get(u.target);
      if (!tgt || tgt.hp <= 0 || tgt.parked) { u.diving = false; u.target = 0; }
      else {
        const left = homeIn(u, tgt.x, tgt.y, T.dash * 1.3, dt);
        if (left < (isStructure(tgt) ? 14 : 9)) { impact(sim, u, tgt); return; }
        u.diveT -= dt;
        if (u.diveT <= 0) u.diving = false;
        return;
      }
    }
    const spd = u.dash ? T.dash : T.speed;
    let mode = so.mode;
    if (mode === 'home') { flyHome(sim, u, dt); return; }
    if (u.jam && (mode === 'strike' || mode === 'guard')) {   // cut off from the hive's track: hunt with its own seeker
      const tgt = sim.byId.get(u.target);
      if (tgt && tgt.hp > 0 && !tgt.parked && (sim.tick + u.scanPhase) % 3 === 0 && seekerSees(sim, u, tgt)) { u.diving = true; u.diveT = 3; return; }
      mode = 'hunt';
    }
    if (mode === 'raid') {
      const tgt = sim.byId.get(so.target);
      if (tgt && tgt.hp > 0) {
        const d = dhypot(tgt.x - u.x, tgt.y - u.y);
        if (d < 380) u.dash = true;
        if (d < 120) { u.diving = true; u.diveT = 3; u.target = tgt.id; return; }
      } else { so.mode = 'hunt'; so.target = 0; }
      followRoute(sim, u, so, spd, dt);
      return;
    }
    if (mode === 'strike' || mode === 'guard') {
      const tgt = sim.byId.get(u.target);
      const est = u.target ? estimate(sim, u.side, u.target) : null;   // (not reached when jammed)
      if (!tgt || tgt.hp <= 0 || tgt.parked || !est || (est.stale && dhypot(est.x - u.x, est.y - u.y) < 24)) {
        u.target = 0;
        if (mode === 'guard') so.mode = 'home';
        else { so.mode = 'hunt'; so.route = [{ x: u.x, y: u.y }]; u.wp = 0; }
        return;
      }
      if ((sim.tick + u.scanPhase) % 3 === 0 && seekerSees(sim, u, tgt)) { u.diving = true; u.diveT = 3; return; }
      moveTo(u, est.x, est.y, spd, T.turn, dt);
      return;
    }
    // route / hunt: strike anything the seeker finds
    if ((sim.tick + u.scanPhase) % 3 === 0) {
      let best = null, bq = 0;
      for (const e of sim.units) {
        if (e.side === u.side || e.parked || e.hp <= 0 || e.type === 'heart') continue;
        const dx = e.x - u.x, dy = e.y - u.y;
        if (dx * dx + dy * dy > 230 * 230) continue;
        const d = Math.max(1, dhypot(dx, dy));
        const q = (T.reach * sigOf(sim, e)) / 5 / d;
        if (q < 1) continue;
        const taken = targetedBy(sim, u.side, e.id);
        const score = q * (TYPES[perceivedType(sim, u.side, e, u.jam)].cost / 10 + 1) / (1 + taken * 2);
        if (score > bq && los(sim.map, u.x, u.y, e.x, e.y)) { bq = score; best = e; }
      }
      if (best) { u.target = best.id; u.diving = true; u.diveT = 3; return; }
    }
    followRoute(sim, u, so, spd, dt);
  }

  function updateFlier(sim, u, dt) {   // Glints and Decoys: fly the route, loiter, run down
    const T = TYPES[u.type], so = sim.sorties.get(u.sortie);
    u.battery -= dt;
    if (u.battery <= 0 || !so) { killUnit(sim, u, null, 'expired'); return; }
    followRoute(sim, u, so, u.dash ? T.dash : T.speed, dt);
  }

  function updateSupport(sim, u, dt) {   // Relays and Harriers: fly the route, hold station, home to recharge
    const T = TYPES[u.type];
    u.battery -= dt;
    if (u.battery <= 0) { killUnit(sim, u, null, 'expired'); return; }
    const so = sim.sorties.get(u.sortie);
    if (!so || u.battery < 30 || u.hp < T.hp) u.homing = true;
    if (u.homing) { flyHome(sim, u, dt); return; }
    followRoute(sim, u, so, u.dash ? T.dash : T.speed, dt);   // then holds station at the end until its battery runs low
  }

  const WARDEN_PRI = { harrier: 6, sting: 5, raider: 4, decoy: 4, relay: 4, glint: 3, warden: 3, forager: 2 };
  function wardenSees(sim, u, e) {
    const c = u.jam ? null : sim.sides[u.side].pic.get(e.id);   // jammed: only what its own sensor sees
    if (c && (c.grade >= 2 || c.lockUntil > sim.t)) return true;
    const d = Math.max(1, dist(u.x, u.y, e.x, e.y));
    return (reachOf(sim, u) * sigOf(sim, e)) / 5 / d >= 0.7 && los(sim.map, u.x, u.y, e.x, e.y);
  }
  function wardenPick(sim, u, cx, cy) {
    let best = null, bs = -1e9;
    for (const e of sim.units) {
      if (e.side === u.side || e.parked || e.hp <= 0 || isStructure(e)) continue;
      if (dist(e.x, e.y, cx, cy) > WARDEN_ENGAGE) continue;
      const du = dist(e.x, e.y, u.x, u.y);
      if (du > 320 || !wardenSees(sim, u, e)) continue;
      let sc = (WARDEN_PRI[perceivedType(sim, u.side, e, u.jam)] || 1) + (e.diving ? 2 : 0) - du / 200;
      if (targetedBy(sim, u.side, e.id, 'warden') > 0) sc -= 3;
      if (sc > bs) { bs = sc; best = e; }
    }
    return best;
  }
  function updateWarden(sim, u, dt) {
    const T = TYPES.warden;
    u.battery -= dt;
    if (u.battery <= 0) { killUnit(sim, u, null, 'expired'); return; }
    const so = sim.sorties.get(u.sortie);
    if (!so || u.nets <= 0 || u.battery < 25 || u.hp < T.hp) u.homing = true;
    if (u.homing) { u.target = 0; flyHome(sim, u, dt); return; }
    u.cool -= dt;
    const rt = so.route, end = rt.length ? rt[rt.length - 1] : { x: so.ox, y: so.oy };
    if (u.target) {
      const e = sim.byId.get(u.target);
      if (!e || e.hp <= 0 || e.parked || dist(e.x, e.y, end.x, end.y) > WARDEN_LEASH || !wardenSees(sim, u, e)) u.target = 0;
      else {
        const left = homeIn(u, e.x, e.y, T.dash, dt);
        if (left < 11 && u.cool <= 0) { netShot(sim, u, e); u.target = 0; }
        return;
      }
    }
    if (u.cool <= 0 && (sim.tick + u.scanPhase) % 3 === 0) {
      const e = wardenPick(sim, u, end.x, end.y);
      if (e) { u.target = e.id; return; }
    }
    u.dash = so.stance === 'dash';
    if (u.wp < rt.length) { followRoute(sim, u, so, u.dash ? T.dash : T.speed, dt); return; }
    u.orb += dt * 1.25 * (u.off >= 0 ? 1 : -1);
    const r = 46 + Math.abs(u.off) * 16;
    moveTo(u, end.x + dcos(u.orb) * r, end.y + dsin(u.orb) * r, T.speed * 0.75, T.turn, dt);
  }

  function raiderSees(sim, u, e) {
    const c = sim.sides[u.side].pic.get(e.id);
    if (c && c.static && c.known) return true;                      // fixed targets: it was briefed before launch
    if (c && !u.jam && (c.grade >= 2 || c.lockUntil > sim.t)) return true;   // moving ones need the hive's picture
    const d = Math.max(1, dist(u.x, u.y, e.x, e.y));
    return (reachOf(sim, u) * sigOf(sim, e)) / 5 / d >= 1 && los(sim.map, u.x, u.y, e.x, e.y);
  }
  function raiderPick(sim, u, so) {
    let best = null, bs = 0;
    for (const e of sim.units) {
      if (e.side === u.side || e.parked || e.hp <= 0) continue;
      const d = dist(u.x, u.y, e.x, e.y);
      if (d > 150) continue;
      const st = isStructure(e);
      if (e.type === 'heart' && !(so.mode === 'raid' && so.target === e.id)) continue;
      if (!st && e.type !== 'forager' && e.moving) continue;
      if (!raiderSees(sim, u, e)) continue;
      let sc = e.type === 'nest' ? 6 : e.type === 'heart' ? 5 : e.type === 'forager' ? (e.state === 'harvest' ? 4 : 2.5) : 1.5;
      if (!st) for (const o of sim.units) if (o !== e && o.side === e.side && !o.parked && o.hp > 0 && !isStructure(o) && dist(o.x, o.y, e.x, e.y) < BLAST_R) sc += 0.8;
      sc -= d / 150;
      if (sc > bs) { bs = sc; best = e; }
    }
    return best;
  }
  function updateRaider(sim, u, dt) {
    const T = TYPES.raider;
    u.battery -= dt;
    if (u.battery <= 0) { killUnit(sim, u, null, 'expired'); return; }
    const so = sim.sorties.get(u.sortie);
    if (!so || u.charges <= 0 || u.battery < 30) u.homing = true;
    if (u.homing) { u.target = 0; flyHome(sim, u, dt); return; }
    u.cool -= dt;
    if (u.target) {
      const e = sim.byId.get(u.target);
      if (!e || e.hp <= 0 || e.parked || !raiderSees(sim, u, e)) u.target = 0;
      else {
        const left = homeIn(u, e.x, e.y, T.dash, dt);
        if (left < 12) { drop(sim, u, e.x, e.y); u.target = 0; u.cool = 1.3; }
        return;
      }
    }
    if (u.cool <= 0 && (sim.tick + u.scanPhase) % 3 === 0) {
      const e = raiderPick(sim, u, so);
      if (e) { u.target = e.id; return; }
    }
    u.dash = so.stance === 'dash';
    const spd = u.dash ? T.dash : T.speed;
    if ((so.mode === 'strike' || so.mode === 'raid') && so.target) {
      const tgt = sim.byId.get(so.target), est = estimate(sim, u.side, so.target);
      const lost = u.jam && tgt && !isStructure(tgt) && !raiderSees(sim, u, tgt);   // jammed: a moving target it cannot see itself is lost
      if (!tgt || tgt.hp <= 0 || !est || lost || (est.stale && dist(est.x, est.y, u.x, u.y) < 30)) { so.mode = 'route'; so.target = 0; so.route = []; u.homing = true; return; }
      if (so.mode === 'strike' || u.wp >= so.route.length) {
        if (dist(est.x, est.y, u.x, u.y) < 150 && u.cool <= 0 && raiderSees(sim, u, tgt) && (isStructure(tgt) || tgt.type === 'forager' || !tgt.moving)) { u.target = tgt.id; return; }
        moveTo(u, est.x, est.y, spd, T.turn, dt);
        return;
      }
    }
    const done = followRoute(sim, u, so, spd, dt);
    if (done) { u.loiter += dt; if (u.loiter > 6) u.homing = true; }
  }

  function updateForager(sim, u, dt) {
    const S = sim.sides[u.side], h = sim.hearts[u.side], m = sim.map, T = TYPES.forager;
    if (u.state !== 'return' && (u.field < 0 || !fieldOpen(sim, u.field))) {
      u.retry -= dt;
      if (u.retry <= 0) {
        u.retry = 1;
        const fi = pickField(sim, u);
        if (fi >= 0) { u.field = fi; u.slot = freeSlot(sim, u, fi); u.state = 'toField'; u.manual = false; }
        else u.state = 'idle';
      }
    }
    if (u.state === 'idle') { moveTo(u, h.x + (u.side ? -26 : 26), h.y + u.off * 24, T.speed * 0.5, T.turn, dt); return; }
    if (u.state === 'toField') {
      const f = m.fields[u.field];
      const a = (u.side ? Math.PI : 0) + (u.slot - 1) * 1.0 + Math.PI / 2, r = f.r * 0.5;
      const d = moveTo(u, f.x + dcos(a) * r, f.y + dsin(a) * r, T.speed, T.turn, dt);
      if (d < 3) { u.state = 'harvest'; u.moving = false; }
      return;
    }
    if (u.state === 'harvest') {
      const f = m.fields[u.field];
      u.moving = false;
      u.cargo += f.rate * S.mult * yieldFactor(sim, sim.t) * dt;
      if (u.cargo >= T.cargo) { u.cargo = T.cargo; u.state = 'return'; }
      return;
    }
    if (u.state === 'return') {
      const b = nearestBase(sim, u.side, u.x, u.y);
      const d = moveTo(u, b.x + (u.side ? -10 : 10), b.y + u.off * 8, T.speed, T.turn, dt);
      if (d < 12) {
        const gain = u.cargo;
        S.nectar += gain; S.harvested += gain; u.cargo = 0;
        if (gain > 0.5) sim.events.push({ k: 'deliver', side: u.side, n: gain, x: b.x, y: b.y });
        if (!u.manual || !fieldOpen(sim, u.field)) {
          const fi = pickField(sim, u);
          u.field = fi; u.slot = fi >= 0 ? freeSlot(sim, u, fi) : 0; u.manual = false;
        }
        u.state = u.field >= 0 ? 'toField' : 'idle';
      }
    }
  }

  function updateHeart(sim, h, dt) {
    const s = h.side, S = sim.sides[s];
    // build queue: one vat, first in first out
    if (S.queue.length) {
      const q = S.queue[0];
      q.t -= dt;
      if (q.t <= 0) {
        S.queue.shift();
        const b = BUILD[q.type];
        if (q.type === 'nest') {
          addUnit(sim, s, 'nest', q.site.x, q.site.y, { parked: false, state: 'nest', hdg: 0 });
          sim.events.push({ k: 'built', side: s, type: 'nest', n: 1, x: q.site.x, y: q.site.y });
        } else {
          for (let i = 0; i < b.n; i++) {
            if (q.type === 'forager') addUnit(sim, s, 'forager', h.x + (s ? -22 : 22), h.y + (sim.rnd() - 0.5) * 30, { parked: false, state: 'idle', hdg: s ? Math.PI : 0, retry: 0 });
            else addUnit(sim, s, q.type, h.x, h.y);
          }
          sim.events.push({ k: 'built', side: s, type: q.type, n: b.n });
        }
      }
    }
    // flak: shoots the nearest tracked drone in range
    S.flakCd -= dt;
    if (S.flakCd <= 0) {
      let best = null, bd = FLAK_RANGE;
      for (const c of S.pic.values()) {
        if (c.grade < 2 || c.static) continue;
        const e = sim.byId.get(c.id);
        if (!e || e.hp <= 0 || e.parked || isStructure(e)) continue;
        const d = dhypot(e.x - h.x, e.y - h.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        S.flakCd = FLAK_CD;
        const hit = sim.rnd() < FLAK_P;
        if (best.type === 'decoy') sim.sides[best.side].decoyDrew++;
        sim.events.push({ k: 'flak', side: s, x: h.x, y: h.y, x2: best.x, y2: best.y, hit });
        if (hit) damage(sim, best, 1, h);
      }
    }
    // guard: parked Stings intercept tracked drones near the Heart or a Nest
    if (S.guard && sim.tick % 3 === 0) {
      let parked = null, bases = null;
      for (const c of S.pic.values()) {
        if (c.grade < 2 || c.static) continue;
        const e = sim.byId.get(c.id);
        if (!e || e.hp <= 0 || e.parked || isStructure(e)) continue;
        if (!bases) bases = basesOf(sim, s);
        // the Heart guards against anything close; a Nest only against Stings and Raiders closing on it
        let at = null;
        const striker = c.type === 'sting' || c.type === 'raider';
        for (const b of bases) {
          const dx = b.x - e.x, dy = b.y - e.y;
          if (b.type === 'heart' ? dx * dx + dy * dy <= GUARD_R * GUARD_R : striker && dx * dx + dy * dy <= NEST_GUARD_R * NEST_GUARD_R && dx * c.vx + dy * c.vy > 0) { at = b; break; }
        }
        if (!at) continue;
        const need = at.type === 'nest' ? 1 : e.diving ? 2 : Math.min(2, TYPES[c.type].hp);
        let have = targetedBy(sim, s, e.id);
        if (have >= need) continue;
        if (!parked) parked = parkedOf(sim, s, 'sting');
        while (have < need && parked.length) {
          const so = launch(sim, s, 'sting', 1, [], { mode: 'guard', target: e.id, stance: 'dash', label: 'Guard', fromHeart: at.type === 'heart' });
          parked.shift(); have++;
          if (!so) break;
          sim.events.push({ k: 'guard', side: s, type: c.type, x: e.x, y: e.y, at: at.type });
        }
        if (!parked.length) break;
      }
    }
  }

  function endGame(sim, winner, reason) {
    if (sim.over) return;
    sim.over = true; sim.winner = winner; sim.reason = reason;
    for (const so of sim.sorties.values()) noteSortie(sim, so);
    sim.events.push({ k: 'end', winner, reason });
  }
  function noteSortie(sim, so) {
    if (so.noted) return;
    so.noted = true;
    if (so.destroyed < 20) return;
    const S = sim.sides[so.side], ratio = so.destroyed / Math.max(1, so.cost);
    if (!S.best || ratio > S.best.ratio) S.best = { ratio, cost: so.cost, destroyed: so.destroyed, n: so.n, type: so.type, killed: Object.assign({}, so.killed), label: so.label };
  }

  // ---------- step ----------
  const DT = 1 / 30;
  function step(sim, dt) {
    if (sim.over) return;
    dt = dt || DT;
    sim.t += dt; sim.tick++;
    const t = sim.t, C = sim.cfg;
    const ph = phaseAt(sim, t);
    if (ph !== sim.phase) { sim.phase = ph; sim.events.push({ k: 'phase', i: ph }); }
    if (!sim.bloomOpen && t >= C.bloomOpen) { sim.bloomOpen = true; sim.events.push({ k: 'bloomOpen' }); }

    for (let i = 0; i < sim.units.length; i++) {
      const u = sim.units[i];
      if (u.hp <= 0 || u.parked) continue;
      u.px = u.x; u.py = u.y;
      switch (u.type) {
        case 'heart': updateHeart(sim, u, dt); break;
        case 'forager': updateForager(sim, u, dt); break;
        case 'glint': case 'decoy': updateFlier(sim, u, dt); break;
        case 'sting': updateSting(sim, u, dt); break;
        case 'warden': updateWarden(sim, u, dt); break;
        case 'raider': updateRaider(sim, u, dt); break;
        case 'relay': case 'harrier': updateSupport(sim, u, dt); break;
      }
      if (sim.over) return;
    }
    // rearm reusable drones back at base
    for (const u of sim.units) {
      if (!u.parked || !(u.rearmT > 0) || u.hp <= 0) continue;
      const S = sim.sides[u.side], T = TYPES[u.type];
      if (!u.rearmPaid) {
        if (S.nectar < T.rearm) continue;
        S.nectar -= T.rearm; S.spent += T.rearm; u.rearmPaid = true;
      }
      u.rearmT -= dt;
      if (u.rearmT <= 0) {
        u.rearmT = 0; u.hp = T.hp; u.charges = T.charges || 0; u.nets = T.nets || 0; u.battery = T.battery;
        sim.events.push({ k: 'rearmed', side: u.side, type: u.type });
      }
    }
    for (const u of sim.units) { if (!u.parked) { u.vx = (u.x - u.px) / dt; u.vy = (u.y - u.py) / dt; } }

    if (sim.tick % 3 === 0) { linkPass(sim); detect(sim, dt * 3); }

    // tidy the dead
    if (sim.units.some(u => u.hp <= 0 && u.type !== 'heart')) {
      sim.units = sim.units.filter(u => {
        if (u.hp > 0 || u.type === 'heart') return true;
        sim.byId.delete(u.id); return false;
      });
    }
    for (const so of sim.sorties.values()) {
      so.units = so.units.filter(id => { const u = sim.byId.get(id); return u && u.hp > 0 && !u.parked; });
      if (!so.units.length) { noteSortie(sim, so); sim.sorties.delete(so.id); }
    }

    // the Crown bloom
    const cf = sim.map.fields[sim.map.fields.length - 1];
    const pres = [0, 0];
    for (const u of sim.units) {
      if (u.parked || u.hp <= 0 || isStructure(u)) continue;
      const dx = u.x - cf.x, dy = u.y - cf.y;
      if (dx * dx + dy * dy < HOLD_R * HOLD_R) pres[u.side]++;
    }
    sim.presence = pres;
    const holder = pres[0] > pres[1] ? 0 : pres[1] > pres[0] ? 1 : -1;
    if (t >= C.bloomScore) {
      if (holder !== sim.holder) sim.events.push({ k: 'holder', side: holder });
      if (holder >= 0) sim.sides[holder].score += dt;
    }
    sim.holder = holder;

    if (sim.tick % 15 === 7) for (let s = 0; s < 2; s++) { postTick(sim, s); autoTick(sim, s); }
    if (sim.tick % 15 === 0) for (const ai of sim.ai) if (ai) aiTick(sim, ai);

    if (t >= C.round) {
      const a = sim.sides[0], b = sim.sides[1];
      let w = -1;
      if (a.score > b.score + 0.5) w = 0;
      else if (b.score > a.score + 0.5) w = 1;
      else {
        const ra = a.destroyed / Math.max(1, a.lost), rb = b.destroyed / Math.max(1, b.lost);
        w = ra > rb ? 0 : rb > ra ? 1 : -1;
      }
      sim.frost = true;
      endGame(sim, w, 'frost');
    }
    if (sim.events.length > 600) sim.events.splice(0, sim.events.length - 300);
  }

  // ---------- force structure (used by the rival now, and by standing orders later) ----------
  function forceCount(sim, side, type) {
    let n = 0;
    for (const u of sim.units) if (u.side === side && u.type === type && u.hp > 0) n++;
    for (const q of sim.sides[side].queue) if (q.type === type) n += BUILD[type].n;
    return n;
  }
  // Queue the first type in the list that is below its target. Waits for nectar rather than skipping ahead.
  function maintain(sim, side, list, maxQueue) {
    const S = sim.sides[side];
    if (S.queue.length >= maxQueue) return null;
    for (const [type, want] of list) {
      if (forceCount(sim, side, type) < want) return S.nectar >= BUILD[type].cost ? build(sim, side, type) : null;
    }
    return null;
  }

  // ---------- command: production plan, auto build and posts ----------
  // The plan is a priority list of [type, target]; a type may appear more than once to build in stages.
  function setPlan(sim, side, rows) {
    sim.sides[side].plan = (rows || []).filter(r => r && PLAN_TYPES.includes(r.type || r[0]))
      .slice(0, PLAN_MAX_ROWS).map(r => ({ type: r.type || r[0], want: Math.max(0, Math.min(60, (r.want != null ? r.want : r[1]) | 0)) }));
  }
  function setAuto(sim, side, on) { const S = sim.sides[side]; S.auto = !!on; S.autoSkip = null; }

  const byPri = posts => posts.slice().sort((a, b) => b.pri - a.pri || a.id - b.id);
  function postUnits(sim, side, post, type) {
    const out = [];
    for (const so of sim.sorties.values()) {
      if (so.side !== side || so.post !== post.id || (type && so.type !== type)) continue;
      for (const id of so.units) { const u = sim.byId.get(id); if (u && u.hp > 0 && !u.parked) out.push(u); }
    }
    return out;
  }
  // A unit counts as on station until it has to leave: a Warden going home to rearm, or a Glint or Decoy
  // whose battery is down to the time a fresh one needs to fly out (so the relief arrives as it fades).
  function onStation(sim, side, post, u) {
    if (u.homing) return false;
    const T = TYPES[u.type];
    if (u.type === 'warden') return u.nets > 0 && u.battery >= 25 && u.hp >= T.hp;
    const b = nearestBase(sim, side, post.x, post.y);
    return u.battery > dist(b.x, b.y, post.x, post.y) / T.speed + 6;
  }
  function postStaff(sim, side, post) {
    const out = {};
    for (const type of POST_TYPES) {
      const need = post.need[type] | 0;
      if (!need) continue;
      let on = 0, out2 = 0;
      for (const u of postUnits(sim, side, post, type)) { out2++; if (onStation(sim, side, post, u)) on++; }
      out[type] = { need, on, assigned: out2 };
    }
    return out;
  }
  // Whether the hive can staff a post: its spot must be in link ('ok'), not out of reach ('cut') or jammed ('jammed').
  // Drones already there carry on; the hive just cannot send more or relieve them.
  function postReach(sim, side, p) {
    if (jammedAt(sim, side, p.x, p.y)) return 'jammed';
    return inLink(sim, side, p.x, p.y) ? 'ok' : 'cut';
  }
  // Relays a post has taken to carry the link out to it ('bridges'), each holding a spot of its own.
  const bridgesOf = (sim, side, p) => [...sim.sorties.values()].filter(so => so.side === side && so.post === p.id && so.bridge && so.units.length);
  // A post beyond link takes a Relay, if one is ready, to the edge of the link towards it, and keeps one there.
  // Further out it chains them. A jammed spot is no use, so jamming cannot be bridged.
  function bridgeTick(sim, side, p, reach) {
    const list = bridgesOf(sim, side, p);
    const flying = so => so.units.some(id => { const u = sim.byId.get(id); return u && !u.homing && u.wp < so.route.length; });
    if (list.some(flying)) return;                              // one is on its way: wait for it
    for (const so of list) {                                    // relieve a Relay that is fading, at the same spot
      const u = sim.byId.get(so.units[0]), spot = so.route[0];
      if (!u || onStation(sim, side, spot, u)) continue;
      if (list.some(o => o !== so && dist(o.route[0].x, o.route[0].y, spot.x, spot.y) < 25 && o.units.some(id => onStation(sim, side, spot, sim.byId.get(id))))) continue;
      const r = launch(sim, side, 'relay', 1, [spot], { post: p.id, label: 'Relay', stance: 'quiet' });
      if (r) { r.bridge = true; return; }
    }
    if (reach !== 'cut' || list.length >= BRIDGE_MAX) return;
    let n = null, best = Infinity;
    for (const q of sim.links[side]) { const g = dist(q.x, q.y, p.x, p.y) - q.r; if (g < best) { best = g; n = q; } }
    if (!n) return;
    const d = dist(n.x, n.y, p.x, p.y), k = Math.min(n.r * 0.85, Math.max(0, d - LINK_R.relay * 0.6)) / d;
    const spot = { x: n.x + (p.x - n.x) * k, y: n.y + (p.y - n.y) * k };
    if (jammedAt(sim, side, spot.x, spot.y)) return;
    const r = launch(sim, side, 'relay', 1, [spot], { post: p.id, label: 'Relay', stance: 'quiet' });
    if (r) r.bridge = true;
  }
  // Send ready units to any post that is short, highest priority first.
  function postTick(sim, side) {
    const S = sim.sides[side];
    if (!S.posts.length || sim.over) return;
    for (const p of byPri(S.posts)) {
      const reach = postReach(sim, side, p);
      if (reach !== p.reach) { if (p.reach) sim.events.push({ k: 'postReach', side, post: p.id, reach }); p.reach = reach; }
      bridgeTick(sim, side, p, reach);
      for (const type of POST_TYPES) {
        const need = p.need[type] | 0;
        if (!need || reach !== 'ok') continue;
        let on = 0;
        for (const u of postUnits(sim, side, p, type)) if (onStation(sim, side, p, u)) on++;
        if (on >= need) continue;
        const so = launch(sim, side, type, need - on, [{ x: p.x, y: p.y }], { post: p.id, label: 'Post', stance: 'quiet' });
        if (so) sim.events.push({ k: 'postSent', side, post: p.id, type, n: so.n, x: p.x, y: p.y });
      }
    }
  }
  // What the posts are short of, beyond what is ready or queued. Glints and Decoys keep one spare per post for relief;
  // a Warden on its way home or rearming does not count, so the hive builds a spare to cover it.
  function postShort(sim, side) {
    const S = sim.sides[side], want = {}, order = [];
    for (const p of byPri(S.posts)) for (const type of POST_TYPES) {
      const n = p.need[type] | 0;
      if (!n) continue;
      want[type] = (want[type] || 0) + n + (type === 'warden' || type === 'harrier' ? 0 : 1);
      if (!order.includes(type)) order.push(type);
    }
    for (const p of byPri(S.posts)) {
      const k = bridgesOf(sim, side, p).length + (p.reach === 'cut' ? 1 : 0);
      if (!k) continue;
      want.relay = (want.relay || 0) + k + 1;
      if (!order.includes('relay')) order.unshift('relay');
    }
    const out = [];
    for (const type of order) {
      let have = 0;
      for (const u of sim.units) {
        if (u.side !== side || u.type !== type || u.hp <= 0) continue;
        if (u.parked) { if (!(u.rearmT > 0)) have++; continue; }
        const so = sim.sorties.get(u.sortie);
        if (!so || !so.post) continue;                       // busy on your own orders
        const p = S.posts.find(q => q.id === so.post);
        if (p && onStation(sim, side, so.bridge ? so.route[0] : p, u)) have++;
      }
      for (const q of S.queue) if (q.type === type) have += BUILD[type].n;
      if (have < want[type]) out.push([type, want[type] - have]);
    }
    return out;
  }
  // The list auto build works through: what posts are short of first, then the plan.
  function planList(sim, side) {
    const S = sim.sides[side], rows = [];
    for (const [type, short] of postShort(sim, side)) rows.push([type, forceCount(sim, side, type) + short, 'post']);
    for (const r of S.plan) rows.push([r.type, r.want, 'plan']);
    return rows;
  }
  // The first row below its target: what auto build will queue next (it saves up for it rather than skipping ahead).
  function autoNext(sim, side) {
    const S = sim.sides[side], skip = S.autoSkip && S.autoSkip.until > sim.t ? S.autoSkip.type : null;
    for (const [type, want, from] of planList(sim, side)) {
      if (type === skip) continue;
      const have = forceCount(sim, side, type);
      if (have < want) return { type, cost: BUILD[type].cost, have, want, from };
    }
    return null;
  }
  function autoTick(sim, side) {
    const S = sim.sides[side];
    if (!S.auto || sim.over || S.queue.length >= AUTO_QUEUE) return null;
    const nx = autoNext(sim, side);
    if (!nx || S.nectar < nx.cost) return null;
    const q = build(sim, side, nx.type, null, { auto: true });
    if (q && S.autoSkip && S.autoSkip.type !== nx.type) S.autoSkip = null;
    return q;
  }
  function cleanNeed(need) {
    const out = {};
    for (const t of POST_TYPES) out[t] = Math.max(0, Math.min(POST_CAP[t], (need && need[t]) | 0));
    return out;
  }
  function addPost(sim, side, x, y, need, pri, name) {
    const S = sim.sides[side];
    if (S.posts.length >= POST_MAX) return null;
    const p = { id: S.postSeq++, x: clamp(x, 10, W - 10), y: clamp(y, 10, H - 10), need: cleanNeed(need), pri: clamp(pri == null ? 1 : pri | 0, 0, 2), name: name || '' };
    S.posts.push(p);
    return p;
  }
  function editPost(sim, side, id, patch) {
    const p = sim.sides[side].posts.find(q => q.id === id);
    if (!p) return null;
    if (patch.need) p.need = cleanNeed(Object.assign({}, p.need, patch.need));
    if (patch.pri != null) p.pri = clamp(patch.pri | 0, 0, 2);
    if (patch.name != null) p.name = patch.name;
    if (patch.x != null && patch.y != null) {
      p.x = clamp(patch.x, 10, W - 10); p.y = clamp(patch.y, 10, H - 10);
      for (const so of [...sim.sorties.values()]) {
        if (so.side !== side || so.post !== id) continue;
        if (!linkedIn(sim, so)) { so.post = 0; continue; }          // out of link: they stay where they were sent
        if (so.bridge) { so.post = 0; for (const uid of so.units) { const u = sim.byId.get(uid); if (u && u.link) u.homing = true; } continue; }
        const before = sim.nextSortie;
        splitUnlinked(sim, so);
        if (sim.nextSortie > before) sim.sorties.get(before).post = 0;
        so.route = [{ x: p.x, y: p.y }];
        for (const uid of so.units) { const u = sim.byId.get(uid); if (u) { u.wp = 0; u.loiter = 0; } }
      }
    }
    // drop units the post no longer needs (only those in link hear it): reusable ones go home, Glints and Decoys stay until they fade
    for (const type of POST_TYPES) {
      const list = postUnits(sim, side, p, type).filter(u => u.link);
      let extra = postUnits(sim, side, p, type).length - p.need[type];
      for (let i = 0; i < list.length && extra > 0; i++) {
        const so = sim.sorties.get(list[i].sortie);
        if (!so || so.post !== id) continue;
        splitUnlinked(sim, so);
        extra -= so.units.length;
        so.post = 0; if (TYPES[type].reuse) for (const uid of so.units) { const u = sim.byId.get(uid); if (u) u.homing = true; }
      }
    }
    return p;
  }
  function removePost(sim, side, id) {
    const S = sim.sides[side], i = S.posts.findIndex(q => q.id === id);
    if (i < 0) return false;
    S.posts.splice(i, 1);
    for (const so of [...sim.sorties.values()]) {
      if (so.side !== side || so.post !== id) continue;
      so.post = 0;
      if (!linkedIn(sim, so)) continue;                          // out of link: they hold until their batteries say otherwise
      splitUnlinked(sim, so);
      if (TYPES[so.type].reuse) for (const uid of so.units) { const u = sim.byId.get(uid); if (u) u.homing = true; }
    }
    return true;
  }

  // ---------- rival hive ----------
  // Four styles. Each sets the force the hive keeps, when and how it raids, how it holds the Crown, and its tricks.
  // Difficulty (DIFF) sets how fast it reacts and adapts, how much it earns and, on easy, how many units it fields.
  const STYLES = {
    reaper: {
      name: 'Reaper', line: 'An early swarm of Stings and Decoys. It raids early and often, hunts Foragers at the blooms and floods the Crown.',
      beat: 'Wardens on posts and Guard blunt the swarm. Raiders on its thin harvest starve it.',
      force: [
        [['forager', 4], ['glint', 1], ['sting', 10], ['decoy', 2], ['sting', 12]],
        [['forager', 5], ['glint', 1], ['sting', 10], ['decoy', 4], ['raider', 1], ['sting', 16]],
        [['forager', 5], ['glint', 1], ['sting', 12], ['decoy', 6], ['warden', 1], ['sting', 20]],
        [['glint', 1], ['sting', 12], ['decoy', 4], ['sting', 24]],
      ],
      raidAt: 0.2, raidGap: 1.15, raidSize: -1, harvest: 0.5, hold: 0, guard: 0, rush: true,
    },
    bulwark: {
      name: 'Bulwark', line: 'A turtle. Wardens hold its blooms, Nests and the Crown, it grows a second Nest early and parks a Harrier over the Crown late. It raids rarely, but big.',
      beat: 'Out-harvest it early, drain its nets with Decoys, blind its Wardens with a Harrier, and mass on the Crown late.',
      force: [
        [['forager', 5], ['glint', 1], ['sting', 6], ['warden', 1], ['sting', 8]],
        [['forager', 5], ['glint', 1], ['warden', 2], ['sting', 10], ['relay', 1], ['decoy', 2], ['warden', 3], ['sting', 14]],
        [['forager', 5], ['glint', 1], ['warden', 3], ['relay', 1], ['harrier', 1], ['sting', 12], ['raider', 1], ['warden', 4], ['sting', 22]],
        [['glint', 1], ['warden', 4], ['harrier', 1], ['sting', 14], ['decoy', 4], ['sting', 30]],
      ],
      raidAt: 0.42, raidGap: 1.3, raidSize: 2, harvest: 0.2, hold: 0, guard: 1, nests: 1, posts: true, crownJam: 30, queue: 3,
    },
    listener: {
      name: 'Listener', line: 'Eyes everywhere. Its Glints perch on the ridges and quick, precise strikes follow, at your Harriers, Raiders and Relays first.',
      beat: 'Kill its Glints, keep to canopy, and feed its strikes Decoys.',
      force: [
        [['forager', 4], ['glint', 2], ['sting', 8], ['glint', 3], ['sting', 10]],
        [['forager', 5], ['glint', 3], ['sting', 8], ['warden', 1], ['raider', 1], ['sting', 14]],
        [['forager', 5], ['glint', 3], ['sting', 10], ['warden', 2], ['raider', 1], ['sting', 18]],
        [['glint', 3], ['sting', 10], ['warden', 1], ['sting', 22]],
      ],
      raidAt: 0.3, raidGap: 1.15, raidSize: 0, harvest: 0.3, hold: 0, guard: 0, scout: 0.55, glints: 3, perch: true, react: 0.9, strikeK: 1,
    },
    mimic: {
      name: 'Mimic', line: 'Decoys everywhere. A feint on one flank comes before the real raid on the other, its Raiders creep through canopy, and a Harrier rides with the raid.',
      beat: 'Get a Glint close to a raid to see through its Decoys before you chase. Keep Guard on and hold back from the first wave.',
      force: [
        [['forager', 4], ['glint', 1], ['sting', 8], ['decoy', 4], ['sting', 10]],
        [['forager', 5], ['glint', 1], ['sting', 8], ['warden', 2], ['decoy', 6], ['raider', 1], ['sting', 14]],
        [['forager', 5], ['glint', 1], ['sting', 10], ['warden', 2], ['decoy', 8], ['raider', 1], ['harrier', 1], ['sting', 20]],
        [['glint', 1], ['decoy', 6], ['sting', 10], ['warden', 2], ['harrier', 1], ['sting', 24]],
      ],
      raidAt: 0.27, raidGap: 1, raidSize: 0, harvest: 0.35, hold: 1, guard: 1, feint: true, canopy: true,
    },
  };
  const STYLE_KEYS = ['reaper', 'bulwark', 'listener', 'mimic'];
  // Hand a side to the computer (diff, and a style or a random one) or take it away (null).
  // A side without an AI earns at the standard rate.
  function setAI(sim, side, diff, style) {
    sim.ai[side] = diff ? createAI(sim, side, diff, style) : null;
    if (!diff) sim.sides[side].mult = 1;
  }
  function createAI(sim, s, diff, style) {
    const cfg = DIFF[diff] || DIFF.normal;
    sim.sides[s].mult = cfg.income;
    const R = sim.cfg.round, rnd = mulberry32((sim.seed + 977 * (s + 1)) >>> 0);
    const key = STYLES[style] ? style : STYLE_KEYS[Math.floor(rnd() * STYLE_KEYS.length) % STYLE_KEYS.length];
    const st = STYLES[key];
    return {
      side: s, cfg, diff, rnd, style: key, st, scoutT: 5 + s * 2, raidT: R * st.raidAt, holdT: 0, glintHoldT: 0, centreSent: 0,
      nestT: R * ((st.nests ? 0.08 : 0.15) + 0.06 * rnd()), raiderT: R * 0.2, scouted: new Map(), raids: 0, fieldSeen: new Map(),
      pending: null, postT: 0, jamT: 0, seen: new Map(), seenIds: new Set(), adapt: {}, adaptT: cfg.adapt, notes: [],
    };
  }
  function aiScoutPoint(sim, ai) {
    const s = ai.side, m = sim.map, cands = [], perch = ai.st.perch;
    m.fields.forEach((f, i) => { if (f.side !== s) cands.push({ x: f.x, y: f.y, key: 'f' + i }); });
    m.peaks.forEach((p, i) => {
      const enemyHalf = s === 1 ? p.x < W * 0.62 : p.x > W * 0.38, middle = p.x > W * 0.28 && p.x < W * 0.72;
      if (enemyHalf || (perch && middle)) cands.push({ x: p.x, y: p.y, key: 'p' + i, bonus: perch ? 1.1 : 0.35 });
    });
    const eh = sim.hearts[1 - s];
    cands.push({ x: eh.x + (s ? 1 : -1) * -250, y: eh.y + (ai.rnd() - 0.5) * 240, key: 'h' });
    let best = cands[0], bs = -1;
    for (const c of cands) {
      const last = ai.scouted.get(c.key) || -60;
      const sc = ai.rnd() + Math.min(1.5, (sim.t - last) / 50) + (c.bonus || 0);
      if (sc > bs) { bs = sc; best = c; }
    }
    ai.scouted.set(best.key, sim.t);
    return best;
  }
  function aiRoute(ai, from, to, wob) {
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    const a = datan2(to.y - from.y, to.x - from.x) + Math.PI / 2, off = (ai.rnd() - 0.5) * 260 * (wob == null ? 1 : wob);
    return [{ x: mx + dcos(a) * off, y: my + dsin(a) * off }, { x: to.x, y: to.y }];
  }
  // A Mimic's Raiders creep through the canopy patch that costs the least detour, if one is on the way.
  function aiSneakRoute(sim, ai, from, to, wob) {
    if (!ai.st.canopy) return aiRoute(ai, from, to, wob);
    const direct = dist(from.x, from.y, to.x, to.y);
    let best = null, bd = direct * 1.4;
    for (const p of sim.map.patches) {
      const d = dist(from.x, from.y, p.x, p.y) + dist(p.x, p.y, to.x, to.y);
      if (d < bd && dist(from.x, from.y, p.x, p.y) > 90 && dist(p.x, p.y, to.x, to.y) > 60) { bd = d; best = p; }
    }
    return best ? [{ x: best.x, y: best.y }, { x: to.x, y: to.y }] : aiRoute(ai, from, to, wob);
  }
  // A Mimic sends a pair of Decoys along a Raider's route, a little wide of it, to draw the fire meant for it.
  function aiEscort(sim, ai, rt, parked, take) {
    if (!ai.st.feint || parked.decoy.length < 2) return;
    const wide = rt.map(p => ({ x: clamp(p.x + (ai.rnd() - 0.5) * 70, 10, W - 10), y: clamp(p.y + (ai.rnd() - 0.5) * 70, 10, H - 10) }));
    if (launch(sim, ai.side, 'decoy', 2, wide, { stance: 'dash', label: 'Decoys' })) take('decoy', 2);
  }
  function aiNestSite(sim, ai) {
    const s = ai.side, h = sim.hearts[s], m = sim.map;
    const own = m.fields.filter(f => f.side === s);
    const far = own.reduce((a, b) => (dist(h.x, h.y, b.x, b.y) > dist(h.x, h.y, a.x, a.y) ? b : a));
    for (const aim of [far, { x: W / 2, y: H / 2 }]) {
      for (let k = 0; k < 24; k++) {
        const f = 0.45 + ai.rnd() * 0.3;
        const x = h.x + (aim.x - h.x) * f + (ai.rnd() - 0.5) * 140, y = h.y + (aim.y - h.y) * f + (ai.rnd() - 0.5) * 140;
        if (!nestSiteError(sim, s, x, y)) return { x, y };
      }
    }
    return null;
  }
  function aiPatrolSpots(sim, ai) {
    const s = ai.side, m = sim.map, spots = [], ci = m.fields.length - 1;
    if (sim.t >= sim.cfg.bloomScore - 25) spots.push({ x: m.fields[ci].x, y: m.fields[ci].y });
    const n = new Array(m.fields.length).fill(0);
    for (const u of sim.units) if (u.side === s && u.type === 'forager' && u.hp > 0 && u.field >= 0) n[u.field]++;
    n.map((v, i) => [v, i]).filter(a => a[0] >= 2).sort((a, b) => b[0] - a[0]).forEach(([, i]) => spots.push({ x: m.fields[i].x, y: m.fields[i].y }));
    for (const u of sim.units) if (u.side === s && u.type === 'nest' && u.hp > 0) spots.push({ x: u.x, y: u.y });
    return spots;
  }
  function aiCovered(sim, side, p) {
    for (const so of sim.sorties.values()) {
      if (so.side !== side || so.type !== 'warden' || !so.units.length) continue;
      const e = so.route[so.route.length - 1];
      if (e && dist(e.x, e.y, p.x, p.y) < 90) return true;
    }
    return false;
  }
  function aiForagerField(sim, ai) {
    let best = null, bt = sim.t - 60;
    for (const [fi, t] of ai.fieldSeen) if (t > bt && sim.map.fields[fi].side !== ai.side) { bt = t; best = sim.map.fields[fi]; }
    return best;
  }
  // A Bulwark keeps posts: Wardens on its two busiest blooms and its Nests, then the Crown late on.
  // The posts take Relays out where they need them, as a player's do.
  function aiPosts(sim, ai) {
    const s = ai.side, S = sim.sides[s], m = sim.map, C = sim.cfg, ci = m.fields.length - 1;
    const want = [{ x: sim.hearts[s].x + (s ? -70 : 70), y: sim.hearts[s].y, need: { warden: sim.phase >= 2 ? 2 : 1 }, pri: 1, name: 'Heart' }];
    if (sim.t >= C.bloomScore - 60) want.push({ x: m.fields[ci].x, y: m.fields[ci].y, need: { warden: 3, glint: 1 }, pri: 2, name: 'Crown' });
    for (const u of sim.units) if (u.side === s && u.type === 'nest' && u.hp > 0) want.push({ x: u.x, y: u.y, need: { warden: 1 }, pri: 1, name: 'Nest' });
    let blooms = 0;
    for (const sp of aiPatrolSpots(sim, ai)) {
      if (blooms >= 2 || want.some(w => dist(w.x, w.y, sp.x, sp.y) < 90)) continue;
      want.push({ x: sp.x, y: sp.y, need: { warden: 1 }, pri: 0, name: 'Bloom' }); blooms++;
    }
    for (const w of want) {
      if (S.posts.length >= POST_MAX - (w.name === 'Crown' ? 0 : 1)) continue;   // one place is kept for the Crown
      const have = S.posts.find(p => dist(p.x, p.y, w.x, w.y) < 90);
      if (have) { if (have.name === 'Heart' && have.need.warden !== w.need.warden) editPost(sim, s, have.id, { need: w.need }); continue; }
      addPost(sim, s, w.x, w.y, w.need, w.pri, w.name);
    }
    // a post whose Nest has gone is taken down
    for (const p of S.posts.slice()) if (p.name === 'Nest' && !sim.units.some(u => u.side === s && u.type === 'nest' && u.hp > 0 && dist(u.x, u.y, p.x, p.y) < 20)) removePost(sim, s, p.id);
  }
  // What the hive has learned about you changes what it builds. It looks again every so often; harder hives sooner.
  function aiAdapt(sim, ai) {
    const S = sim.sides[ai.side], seen = t => ai.seen.get(t) || 0, a = ai.adapt, note = text => ai.notes.push({ t: Math.round(sim.t), text });
    if (seen('warden') >= 5 && !a.decoy) { a.decoy = 4; note('More Decoys to draw your Wardens’ nets.'); return true; }
    if (((S.lostBy && S.lostBy.forager) || 0) >= 6 && !a.warden) { a.warden = 1; note('More Wardens over its blooms after your strikes on its Foragers.'); return true; }
    if (seen('harrier') >= 1 && !a.sting) { a.sting = 6; note('More Stings to hunt your Harriers.'); return true; }
    if (seen('decoy') >= 8 && !a.glint) { a.glint = 1; note('An extra Glint to look through your Decoys.'); return true; }
    if (seen('relay') >= 2 && !a.relayHunt) { a.relayHunt = true; note('Hunting your Relays.'); return true; }
    return false;
  }
  function aiForce(sim, ai) {
    const cfg = ai.cfg;
    let force = ai.st.force[sim.phase].filter(([t]) => cfg.jam || t !== 'harrier');
    if (cfg.force) force = force.map(([t, n]) => [t, t === 'forager' || t === 'glint' || t === 'relay' || t === 'harrier' ? n : Math.max(1, Math.round(n * cfg.force))]);
    const extra = [];
    for (const t of ['decoy', 'warden', 'glint', 'sting']) {
      if (!ai.adapt[t]) continue;
      const top = force.reduce((m, [ty, n]) => (ty === t ? Math.max(m, n) : m), 0);
      extra.push([t, top + ai.adapt[t]]);
    }
    return extra.length ? force.slice(0, -1).concat(extra, force.slice(-1)) : force;
  }
  // A raid on the Heart: Decoys run ahead, Stings follow along a flank, a Raider and a Harrier join late in the round.
  function aiHeartRaid(sim, ai, plan, parked, take, spare) {
    const s = ai.side, eh = sim.hearts[1 - s], { fp, mid, sg } = plan;
    if (parked.decoy.length) {
      launch(sim, s, 'decoy', 'all', [{ x: fp.x, y: fp.y - sg * 90 }, { x: mid.x, y: mid.y - sg * 70 }, { x: eh.x + (s ? 60 : -60), y: eh.y }], { stance: 'dash', label: 'Decoys' });
      parked.decoy.length = 0;
    }
    const k = Math.min(spare(), plan.k);
    if (k >= 4 && launch(sim, s, 'sting', k, [fp, mid, { x: eh.x, y: eh.y }], { stance: 'quiet', mode: 'raid', target: eh.id, label: 'Raid' })) take('sting', k);
    if (sim.phase >= 2 && parked.raider.length) {
      if (launch(sim, s, 'raider', 1, [fp, mid, { x: eh.x, y: eh.y }], { mode: 'raid', target: eh.id, label: 'Raid' })) take('raider', 1);
    }
    if (parked.harrier.length && sim.t >= ai.jamT) {   // a Harrier rides in behind and jams the defenders near the Heart
      const jp = { x: eh.x + (fp.x - eh.x) * 0.45, y: eh.y + (fp.y - eh.y) * 0.45 };
      if (launch(sim, s, 'harrier', 1, [fp, jp], { label: 'Jam' })) { take('harrier', 1); ai.jamT = sim.t + 40; }
    }
  }
  function aiTick(sim, ai) {
    const s = ai.side, o = 1 - s, S = sim.sides[s], cfg = ai.cfg, st = ai.st, t = sim.t, m = sim.map, C = sim.cfg;
    const h = sim.hearts[s], eh = sim.hearts[o], ci = m.fields.length - 1, cf = m.fields[ci];
    const parked = { sting: [], glint: [], decoy: [], warden: [], raider: [], relay: [], harrier: [] };
    let glOut = 0;
    for (const u of sim.units) {
      if (u.side !== s || u.hp <= 0) continue;
      if (parked[u.type] && u.parked && !(u.rearmT > 0)) parked[u.type].push(u);
      else if (u.type === 'glint' && !u.parked) glOut++;
    }
    const guard = cfg.guard + (st.guard || 0);
    const spare = () => parked.sting.length - guard;
    const take = (type, n) => parked[type].splice(0, n);

    // remember where enemy foragers were seen working, and what of the rival it has seen
    for (const c of S.pic.values()) {
      if (c.grade < 2 || !c.known) continue;
      if (!ai.seenIds.has(c.id)) { ai.seenIds.add(c.id); ai.seen.set(c.type, (ai.seen.get(c.type) || 0) + 1); }
      if (c.type !== 'forager') continue;
      for (let i = 0; i < m.fields.length; i++) if (dist(m.fields[i].x, m.fields[i].y, c.x, c.y) < 60) ai.fieldSeen.set(i, t);
    }
    ai.adaptT -= 0.5;
    if (ai.adaptT <= 0) ai.adaptT = aiAdapt(sim, ai) ? cfg.adapt : 15;

    // build: forward Nests, then the force mix for this phase
    if (t >= ai.nestT && nestCount(sim, s) < cfg.nests + (st.nests || 0) && S.queue.length < 3 && S.nectar >= BUILD.nest.cost && t < C.round * 0.75) {
      ai.nestT = t + C.round * 0.12;
      const site = aiNestSite(sim, ai);
      if (site) build(sim, s, 'nest', site);
    }
    maintain(sim, s, aiForce(sim, ai), st.queue || 2);

    // scout
    ai.scoutT -= 0.5;
    if (ai.scoutT <= 0 && parked.glint.length && glOut < (st.glints || 2)) {
      ai.scoutT = cfg.scout * (st.scout || 1) * (0.75 + ai.rnd() * 0.5);
      const wp = aiScoutPoint(sim, ai);
      if (launch(sim, s, 'glint', 1, aiRoute(ai, h, wp, st.perch ? 0.4 : 1), { stance: 'quiet', label: 'Scout' })) take('glint', 1);
    }

    // Wardens: a Bulwark keeps posts; the others patrol the busiest blooms, the Nest, and the Crown late on
    if (st.posts) { ai.postT -= 0.5; if (ai.postT <= 0) { ai.postT = 10; aiPosts(sim, ai); } }
    else if (parked.warden.length) {
      for (const sp of aiPatrolSpots(sim, ai)) {
        if (!parked.warden.length) break;
        if (aiCovered(sim, s, sp)) continue;
        if (launch(sim, s, 'warden', 1, aiRoute(ai, nearestBase(sim, s, sp.x, sp.y), sp, 0.3), { label: 'Patrol' })) take('warden', 1);
      }
    }

    // Sting strikes on tracked units, most valuable first
    const contacts = [];
    for (const c of S.pic.values()) {
      if (c.grade < 2 || !c.known || c.held < cfg.react * (st.react || 1) || c.static) continue;
      if (c.type === 'sting' || c.type === 'decoy') continue;
      contacts.push(c);
    }
    const worth = c => TYPES[c.type].cost + (ai.adapt.relayHunt && c.type === 'relay' ? 30 : 0);
    contacts.sort((a, b) => worth(b) - worth(a));
    for (const c of contacts) {
      const e = sim.byId.get(c.id);
      if (!e || e.hp <= 0 || targetedBy(sim, s, c.id) > 0) continue;
      const b = nearestBase(sim, s, e.x, e.y), d = dist(e.x, e.y, b.x, b.y);
      if (d > 1050) continue;
      const k = (TYPES[c.type].hp >= 2 ? 3 : 2) + (st.strikeK && TYPES[c.type].cost >= 30 ? st.strikeK : 0);
      if (spare() < k) break;
      if (launch(sim, s, 'sting', k, [], { mode: 'strike', target: c.id, stance: d < 450 ? 'dash' : 'quiet', label: 'Strike' })) take('sting', k);
    }

    // Raiders: enemy Nests first, then wherever enemy foragers were last seen
    if (parked.raider.length && t >= ai.raiderT) {
      let sent = false;
      for (const c of S.pic.values()) {
        if (c.type !== 'nest' || !c.known) continue;
        const e = sim.byId.get(c.id);
        if (!e || e.hp <= 0) continue;
        const rt = aiSneakRoute(sim, ai, h, c, 0.6);
        if (launch(sim, s, 'raider', Math.min(2, parked.raider.length), rt, { mode: 'raid', target: c.id, label: 'Nest strike' })) { take('raider', 2); sent = true; aiEscort(sim, ai, rt, parked, take); }
        break;
      }
      if (!sent) {
        const f = aiForagerField(sim, ai);
        const rt = f ? aiSneakRoute(sim, ai, h, f, 0.8) : null;
        if (f && launch(sim, s, 'raider', 1, rt, { label: 'Harvest raid' })) { take('raider', 1); sent = true; aiEscort(sim, ai, rt, parked, take); }
      }
      ai.raiderT = t + (sent ? 18 : 6) + ai.rnd() * 12;
    }

    // foragers to the Crown bloom once it opens
    if (t >= C.bloomOpen && ai.centreSent < (t > C.bloomScore - 35 ? 2 : 1) && t - S.fieldDanger[ci] > 30) {
      const cand = sim.units.find(u => u.side === s && u.type === 'forager' && u.hp > 0 && u.field !== ci && u.state === 'return');
      if (cand && assignForager(sim, cand.id, ci)) ai.centreSent++;
    }

    // hold the Crown (a Reaper floods it well before it scores)
    if (t >= C.bloomScore - (st.rush ? 45 : 20)) {
      ai.holdT -= 0.5;
      if (ai.holdT <= 0 && sim.presence[s] < cfg.hold + (st.hold || 0) && spare() >= 4) {
        ai.holdT = 8;
        const a = ai.rnd() * Math.PI * 2;
        if (launch(sim, s, 'sting', 4, [{ x: cf.x + dcos(a) * 30, y: cf.y + dsin(a) * 30 }], { stance: 'quiet', mode: 'hunt', label: 'Hold' })) take('sting', 4);
      }
    }
    if (t >= C.bloomScore - 20 && !st.posts) {
      ai.glintHoldT -= 0.5;
      if (ai.glintHoldT <= 0 && parked.glint.length) {
        ai.glintHoldT = 20;
        if (launch(sim, s, 'glint', 1, aiRoute(ai, h, { x: cf.x + (s ? 50 : -50), y: cf.y + (ai.rnd() - 0.5) * 60 }), { stance: 'quiet', label: 'Watch' })) take('glint', 1);
      }
    }

    // a Harrier jams the Crown at Last Light, so the rival's drones there fight half blind
    const harrierOut = sim.units.some(u => u.side === s && u.type === 'harrier' && !u.parked && u.hp > 0);
    if (parked.harrier.length && !harrierOut && t >= ai.jamT && t >= C.bloomScore - (st.crownJam || 20)) {
      const p = { x: cf.x + (s ? 70 : -70), y: cf.y + (ai.rnd() - 0.5) * 80 };
      if (launch(sim, s, 'harrier', 1, aiRoute(ai, h, p, 0.4), { label: 'Jam' })) { take('harrier', 1); ai.jamT = t + 40; }
    }

    // raids: on a harvest, or on the Heart with Decoys running ahead (a Mimic sends a feint along the other flank first)
    if (ai.pending && t >= ai.pending.t) { aiHeartRaid(sim, ai, ai.pending, parked, take, spare); ai.pending = null; }
    if (!ai.pending && t >= ai.raidT && spare() >= cfg.raid + (st.raidSize || 0) && t < C.round - 25) {
      ai.raidT = t + C.round * (0.085 + ai.rnd() * 0.05) * (st.raidGap || 1);
      ai.raids++;
      const k = Math.min(spare(), cfg.raid + (st.raidSize || 0) + 3);
      const field = ai.rnd() < (st.harvest == null ? 0.4 : st.harvest) ? aiForagerField(sim, ai) : null;
      if (field) {
        const n = Math.min(k, st.rush ? 8 : 6);
        if (st.feint && parked.decoy.length >= 2) { launch(sim, s, 'decoy', 2, aiRoute(ai, h, field, 0.5), { stance: 'dash', label: 'Decoys' }); take('decoy', 2); }
        if (launch(sim, s, 'sting', n, aiRoute(ai, h, field), { stance: 'quiet', mode: 'hunt', label: 'Raid' })) take('sting', n);
      } else {
        const sg = ai.rnd() < 0.5 ? 1 : -1;
        const fp = { x: W / 2 + (ai.rnd() - 0.5) * 160, y: H / 2 + sg * (250 + ai.rnd() * 140) };
        const mid = { x: fp.x + (eh.x - fp.x) * 0.55, y: fp.y + (eh.y - fp.y) * 0.55 };
        const plan = { fp, mid, sg, k };
        if (st.feint && parked.decoy.length >= 3) {
          const n = Math.ceil(parked.decoy.length / 2), ff = { x: fp.x, y: H - fp.y }, fm = { x: mid.x, y: H - mid.y };
          launch(sim, s, 'decoy', n, [ff, fm, { x: eh.x + (s ? 60 : -60), y: eh.y }], { stance: 'dash', label: 'Feint' });
          take('decoy', n);
          plan.t = t + 5; ai.pending = plan;
        } else aiHeartRaid(sim, ai, plan, parked, take, spare);
      }
    }
  }

  root.DS = {
    W, H, HC, HW, HH, HOLD_R, GUARD_R, FLAK_RANGE, RIDGE_H, BLAST_R, QUEUE_MAX, NEST_MAX, NEST_FROM_HEART, NEST_FROM_NEST, NEST_ENEMY_CLEAR, WARDEN_ENGAGE,
    NEST_GUARD_R, AUTO_QUEUE, POST_MAX, PLAN_MAX_ROWS, PLAN_TYPES, POST_TYPES, POST_CAP, LINK_R, JAM_R,
    MODES, TYPES, BUILD, BUILD_ORDER, DIFF, DT, STYLES, STYLE_KEYS,
    createSim, step, build, cancelBuild, launch, retask, recall, setStance, assignForager, setGuard, visPoly, sigOf, reachOf,
    ridgeAt, canopyAt, parkedCount, rearmingCount, outCount, phaseAt, estimate, mulberry32, los, fieldOpen, targetedBy, yieldFactor,
    nestSiteError, nestCount, nearestBase, basesOf, forceCount, maintain, perceivedType,
    setPlan, setAuto, autoNext, autoTick, planList, addPost, editPost, removePost, postStaff, postUnits, postReach, inLink, jammedAt, linkPass,
    spawnUnit: addUnit, setAI, dsin, dcos, datan2, dhypot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
