/* Drone Season · rendering, input, sound and overlays (milestone 2.6: command tools, training, two players). */
(function () {
  'use strict';
  const DS = window.DS, W = DS.W, H = DS.H, TAU = Math.PI * 2, T = DS.TYPES;
  const $ = id => document.getElementById(id);
  const app = $('app'), cv = $('cv'), ctx = cv.getContext('2d');
  const fogCv = document.createElement('canvas'), fctx = fogCv.getContext('2d');
  const COL = { amber: '#f5a524', amberHi: '#ffc867', cobalt: '#5b8cff', cobaltHi: '#a3bdff', bloom: '#d7a6ff', lock: '#ff5e4d', ink: '#e4ece8', dim: '#9aaaa5', faint: '#66766f', leaf: '#7fd1a4' };
  const SIDE = [COL.amber, COL.cobalt];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const FONT_D = '"Chakra Petch", "Bahnschrift", "Segoe UI", sans-serif';
  const FONT_M = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const SQUAD_TYPES = ['glint', 'sting', 'decoy', 'warden', 'raider'];
  const SQUAD_MAX = { glint: 3, sting: 24, decoy: 8, warden: 3, raider: 3 };
  const SQUAD_STEP = { sting: 2 };
  const DEFAULT_SQUADS = [
    { name: 'Scout', mix: { glint: 1 } },
    { name: 'Strike', mix: { sting: 4 } },
    { name: 'Swarm', mix: { sting: 8, decoy: 2 } },
    { name: 'Bomb run', mix: { raider: 1, decoy: 2 } },
    { name: 'Patrol', mix: { warden: 1 } },
  ];
  const PRESETS = {
    Balanced: [['forager', 5], ['glint', 1], ['sting', 8], ['warden', 1], ['raider', 1], ['decoy', 2], ['sting', 16], ['warden', 2], ['sting', 28]],
    Swarm: [['forager', 5], ['glint', 1], ['sting', 12], ['decoy', 4], ['sting', 24], ['glint', 2], ['sting', 36]],
    Bombers: [['forager', 5], ['glint', 1], ['sting', 8], ['raider', 2], ['decoy', 4], ['raider', 3], ['sting', 12], ['decoy', 6], ['sting', 24]],
    Fortress: [['forager', 5], ['glint', 1], ['sting', 8], ['warden', 2], ['sting', 16], ['warden', 3], ['glint', 2], ['sting', 28]],
  };
  const PLAN_MAX = { forager: 12, glint: 6, sting: 40, decoy: 12, warden: 6, raider: 6 };
  const PRI = ['Low', 'Normal', 'High'];
  const PLURAL = { glint: 'Glints', sting: 'Stings', decoy: 'Decoys', warden: 'Wardens', raider: 'Raiders', forager: 'Foragers', nest: 'Nests', heart: 'Heart flak', other: 'other fire' };
  const nameN = (type, n) => (n === 1 ? T[type].name : PLURAL[type]);
  const units = (n, type) => `${n} ${nameN(type, n)}`;
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const DRONES = new Set(['glint', 'sting', 'decoy', 'warden', 'raider']);

  // ---------- settings ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ds1.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ds1.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const randSeed = () => 1000 + Math.floor(Math.random() * 9000);
  const copySquads = list => list.map(q => ({ name: q.name, mix: Object.assign({}, q.mix) }));
  function cleanSquads(v) {
    if (!Array.isArray(v) || v.length !== DEFAULT_SQUADS.length) return copySquads(DEFAULT_SQUADS);
    return v.map((q, i) => {
      const mix = {};
      for (const t of SQUAD_TYPES) { const n = q && q.mix ? q.mix[t] | 0 : 0; if (n > 0) mix[t] = Math.min(SQUAD_MAX[t], n); }
      const name = q && typeof q.name === 'string' && q.name.trim() ? q.name.trim().slice(0, 12) : DEFAULT_SQUADS[i].name;
      return { name, mix };
    });
  }
  function cleanPlan(v) {
    if (!Array.isArray(v)) return PRESETS.Balanced.map(([type, want]) => ({ type, want }));
    return v.filter(r => r && DS.PLAN_TYPES.includes(r.type)).slice(0, DS.PLAN_MAX_ROWS).map(r => ({ type: r.type, want: clamp(r.want | 0, 0, PLAN_MAX[r.type]) }));
  }

  const G = {
    sim: null, mode: 'title', paused: false,
    seed: store.get('seed', randSeed()), diff: store.get('diff', 'normal'), round: store.get('round', 'short'), muted: store.get('muted', false),
    squads: cleanSquads(store.get('squads', null)), plan: cleanPlan(store.get('plan', null)), auto: store.get('auto', true) !== false,
    tab: 'build', sheet: null, menu: null, again: null, training: false, mix: {}, armedSq: [], placingPost: false, movingPost: 0, listKeys: {},
    armed: null, group: [], pkgSeq: 1, stance: 'quiet', sel: null, placing: false,
    acc: 0, last: 0, now: 0,
    terrain: null, terrainSeed: -1, vis: [], visT: -1, fx: [], trails: new Map(), shake: 0,
    hover: null, rateHist: [], hudT: 0, raidT: -99, thr: {}, ctxKey: '', qKey: '', endShown: false, overT: 0,
    agg: { mine: {}, theirs: {}, t: 0, val: 0 }, tipI: 0, tipT: 0, sfxT: {}, warnedLL: false, firstNest: true,
  };
  if (!DS.DIFF[G.diff]) G.diff = 'normal';
  if (!DS.MODES[G.round]) G.round = 'short';
  if (!(G.seed >= 1000 && G.seed <= 9999)) G.seed = randSeed();

  // ---------- whose side you are ----------
  // ME is your side in the simulation, OP your rival's. On your own you are side 0; the second player in a two-player
  // game is side 1, and sees the valley turned round so their Heart is on the left too, in amber.
  let ME = 0, OP = 1;
  const vs = s => (s === ME ? 0 : s === OP ? 1 : s);   // a sim side as the viewer sees it: 0 yours, 1 theirs

  // ---------- camera ----------
  const cam = { z: 1, cx: W / 2, cy: H / 2, portrait: false, fit: 1, px: 0, py: 0, pw: 1, ph: 1, flip: false };
  let M = [1, 0, 0, 1, 0, 0], DPR = 1, VW = 1, VH = 1;

  function layout() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const r = app.getBoundingClientRect();
    VW = Math.max(1, r.width); VH = Math.max(1, r.height);
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    fogCv.width = Math.ceil(VW / 4); fogCv.height = Math.ceil(VH / 4);
    const title = G.mode === 'title';
    const topH = title ? 0 : $('top').offsetHeight, dockH = title ? 0 : $('dock').offsetHeight;
    cam.px = 0; cam.py = topH; cam.pw = VW; cam.ph = Math.max(60, VH - topH - dockH);
    if (title && VW > 900 && VW > VH) { cam.px = VW * 0.36; cam.pw = VW * 0.64; }
    const fitP = Math.min((cam.pw - 12) / H, (cam.ph - 12) / W), fitL = Math.min((cam.pw - 12) / W, (cam.ph - 12) / H);
    const wide = VW >= VH;
    // Pick the map's orientation when a round starts or the device turns, never because the dock changed height.
    if (G.mode !== 'play' || cam.lockWide !== wide || cam.lockMode !== G.mode) cam.portrait = fitP > fitL * 1.04;
    cam.lockWide = wide; cam.lockMode = G.mode;
    cam.fit = cam.portrait ? fitP : fitL;
    clampCam();
    computeM(false);
  }
  function computeM(shake) {
    const s = cam.fit * cam.z, sx = cam.px + cam.pw / 2, sy = cam.py + cam.ph / 2;
    let ox = 0, oy = 0;
    if (shake && G.shake > 0 && !REDUCED) { ox = (Math.random() - 0.5) * G.shake * 12; oy = (Math.random() - 0.5) * G.shake * 12; }
    if (!cam.portrait) M = [s, 0, 0, s, sx - cam.cx * s + ox, sy - cam.cy * s + oy];
    else M = [0, -s, s, 0, sx - cam.cy * s + ox, sy + cam.cx * s + oy];
    // the cobalt player sees the map turned half round (it is point-symmetric), so their Heart sits where amber's would
    if (cam.flip) M = [-M[0], -M[1], -M[2], -M[3], M[0] * W + M[2] * H + M[4], M[1] * W + M[3] * H + M[5]];
  }
  const S2 = (x, y) => ({ x: M[0] * x + M[2] * y + M[4], y: M[1] * x + M[3] * y + M[5] });
  function toWorld(X, Y) {
    const [a, b, c, d, e, f] = M, det = a * d - b * c;
    return { x: (d * (X - e) - c * (Y - f)) / det, y: (-b * (X - e) + a * (Y - f)) / det };
  }
  const scale = () => cam.fit * cam.z;
  const sAng = h => Math.atan2(M[1] * Math.cos(h) + M[3] * Math.sin(h), M[0] * Math.cos(h) + M[2] * Math.sin(h));
  function clampCam() {
    const s = cam.fit * cam.z;
    const vw = (cam.portrait ? cam.ph : cam.pw) / s, vh = (cam.portrait ? cam.pw : cam.ph) / s;
    cam.cx = vw >= W ? W / 2 : clamp(cam.cx, vw / 2, W - vw / 2);
    cam.cy = vh >= H ? H / 2 : clamp(cam.cy, vh / 2, H - vh / 2);
  }
  function panBy(dx, dy) {
    const s = scale();
    if (!cam.portrait) { cam.cx -= dx / s; cam.cy -= dy / s; } else { cam.cy -= dx / s; cam.cx += dy / s; }
    clampCam();
  }
  function zoomAt(X, Y, z) {
    computeM(false);
    const w = toWorld(X, Y);
    cam.z = clamp(z, 1, 3.2); clampCam(); computeM(false);
    const w2 = toWorld(X, Y);
    const fs = cam.flip ? -1 : 1;
    cam.cx += fs * (w.x - w2.x); cam.cy += fs * (w.y - w2.y); clampCam(); computeM(false);
  }
  const uk = () => clamp(0.92 + (cam.z - 1) * 0.3, 0.88, 1.55) * (Math.min(VW, VH) < 520 ? 0.9 : 1.08);

  // ---------- terrain ----------
  function marching(hg, gw, gh, lv, seg) {
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const a = hg[j * gw + i], b = hg[j * gw + i + 1], c = hg[(j + 1) * gw + i + 1], d = hg[(j + 1) * gw + i];
        const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const tx = i + (lv - a) / (b - a), ry = j + (lv - b) / (c - b), bx = i + (lv - d) / (c - d), ly = j + (lv - a) / (d - a);
        const TOP = [tx, j], RIGHT = [i + 1, ry], BOTTOM = [bx, j + 1], LEFT = [i, ly];
        const s = (p, q) => seg(p[0], p[1], q[0], q[1]);
        switch (idx) {
          case 1: case 14: s(LEFT, BOTTOM); break;
          case 2: case 13: s(BOTTOM, RIGHT); break;
          case 3: case 12: s(LEFT, RIGHT); break;
          case 4: case 11: s(TOP, RIGHT); break;
          case 5: s(LEFT, TOP); s(BOTTOM, RIGHT); break;
          case 6: case 9: s(TOP, BOTTOM); break;
          case 7: case 8: s(LEFT, TOP); break;
          case 10: s(LEFT, BOTTOM); s(TOP, RIGHT); break;
        }
      }
    }
  }
  function hexPath(g, x, y, r) {
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }
  function renderTerrain(map) {
    const TS = 1.25, tw = Math.round(W * TS), th = Math.round(H * TS);
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    const g = c.getContext('2d');
    const HW = DS.HW, HH = DS.HH, hg = map.hgt, cf = map.canF, HC = DS.HC;
    const sm = document.createElement('canvas'); sm.width = HW; sm.height = HH;
    const sg = sm.getContext('2d'), img = sg.createImageData(HW, HH), d = img.data;
    const rnd = DS.mulberry32((map.seed * 13 + 5) >>> 0);
    for (let j = 0; j < HH; j++) {
      for (let i = 0; i < HW; i++) {
        const k = j * HW + i, h = hg[k];
        const hx = hg[j * HW + Math.min(HW - 1, i + 1)] - hg[j * HW + Math.max(0, i - 1)];
        const hy = hg[Math.min(HH - 1, j + 1) * HW + i] - hg[Math.max(0, j - 1) * HW + i];
        const sh = clamp(-(hx * 0.75 + hy * 0.65) * 3.4, -0.6, 0.6) * Math.min(1, h * 5);
        const n = (rnd() - 0.5) * 3;
        let r = 15 + h * 22 + sh * 36 + n, gg = 21 + h * 30 + sh * 40 + n, b = 26 + h * 32 + sh * 42 + n;
        const cv2 = cf[k];
        if (cv2 > 0) { const a = Math.min(1, cv2 * 3) * 0.92; r = r * (1 - a) + 13 * a; gg = gg * (1 - a) + 46 * a; b = b * (1 - a) + 34 * a; }
        const o = k * 4; d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(sm, 0, 0, tw, th);
    g.setTransform(TS, 0, 0, TS, 0, 0);
    // canopy: three-lobed leaf clusters, then a dashed edge so the cover reads at a glance
    for (let n = 0; n < 9000; n++) {
      const x = rnd() * W, y = rnd() * H;
      if (!DS.canopyAt(map, x, y)) continue;
      const v = cf[((y / HC) | 0) * HW + ((x / HC) | 0)];
      const a = rnd() * TAU, r = 1.1 + rnd() * 1.5;
      g.fillStyle = rnd() < 0.55 ? `rgba(92,170,128,${0.26 + v * 0.38})` : `rgba(3,16,11,${0.34 + v * 0.4})`;
      for (let l = 0; l < 3; l++) { const bb = a + l * 2.09; g.beginPath(); g.arc(x + Math.cos(bb) * r * 0.8, y + Math.sin(bb) * r * 0.8, r * 0.72, 0, TAU); g.fill(); }
    }
    g.beginPath();
    marching(cf, HW, HH, 0.06, (x1, y1, x2, y2) => { g.moveTo((x1 + 0.5) * HC, (y1 + 0.5) * HC); g.lineTo((x2 + 0.5) * HC, (y2 + 0.5) * HC); });
    g.strokeStyle = 'rgba(127,209,164,0.6)'; g.lineWidth = 1.1; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]);
    // contour lines
    [0.16, 0.34, 0.52, 0.7, 0.88].forEach((lv, li) => {
      g.beginPath();
      marching(hg, HW, HH, lv, (x1, y1, x2, y2) => { g.moveTo((x1 + 0.5) * HC, (y1 + 0.5) * HC); g.lineTo((x2 + 0.5) * HC, (y2 + 0.5) * HC); });
      g.strokeStyle = li === 0 ? 'rgba(150,198,196,0.55)' : `rgba(150,198,196,${0.15 + li * 0.045})`;
      g.lineWidth = li === 0 ? 1.15 : 0.7;
      g.stroke();
    });
    // hex comb
    g.beginPath();
    const hr = 34, hw = Math.sqrt(3) * hr;
    for (let row = 0, y = 0; y < H + hr; row++, y += hr * 1.5) for (let x = (row % 2) * hw / 2; x < W + hw; x += hw) hexPath(g, x, y, hr);
    g.strokeStyle = 'rgba(170,200,196,0.04)'; g.lineWidth = 0.8; g.stroke();
    // frame and scale ticks
    g.strokeStyle = 'rgba(150,198,196,0.3)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, W - 1, H - 1);
    g.beginPath();
    for (let x = 0; x <= W; x += 50) { const L = x % 250 === 0 ? 11 : 5; g.moveTo(x, 0); g.lineTo(x, L); g.moveTo(x, H); g.lineTo(x, H - L); }
    for (let y = 0; y <= H; y += 50) { const L = y % 250 === 0 ? 11 : 5; g.moveTo(0, y); g.lineTo(L, y); g.moveTo(W, y); g.lineTo(W - L, y); }
    g.strokeStyle = 'rgba(150,198,196,0.4)'; g.stroke();
    return c;
  }

  function glowSprite(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},0.95)`); gr.addColorStop(0.22, `rgba(${rgb},0.4)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  const GLOW = { amber: glowSprite('245,165,36'), cobalt: glowSprite('91,140,255'), bloom: glowSprite('215,166,255'), lock: glowSprite('255,94,77'), white: glowSprite('255,236,210') };
  const SGLOW = [GLOW.amber, GLOW.cobalt];

  // ---------- sound ----------
  const AU = { ctx: null };
  function audioInit() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const a = new AC(); AU.ctx = a;
      AU.master = a.createGain(); AU.master.gain.value = G.muted ? 0 : 0.75; AU.master.connect(a.destination);
      AU.lp = a.createBiquadFilter(); AU.lp.type = 'lowpass'; AU.lp.frequency.value = 16000; AU.lp.connect(AU.master);
      const nb = a.createBuffer(1, a.sampleRate, a.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      AU.noise = nb;
      AU.bf = a.createBiquadFilter(); AU.bf.type = 'lowpass'; AU.bf.frequency.value = 480; AU.bf.Q.value = 3;
      AU.bg = a.createGain(); AU.bg.gain.value = 0;
      AU.bf.connect(AU.bg); AU.bg.connect(AU.lp);
      AU.bo = [a.createOscillator(), a.createOscillator()];
      AU.bo[0].type = 'sawtooth'; AU.bo[1].type = 'sawtooth';
      AU.bo[0].frequency.value = 96; AU.bo[1].frequency.value = 98.6;
      AU.bo.forEach(o => { o.connect(AU.bf); o.start(); });
    } catch (e) { AU.ctx = null; }
  }
  function tone(type, f0, f1, dur, vol, delay) {
    const a = AU.ctx;
    if (!a || G.muted) return;
    const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AU.lp); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, f0, f1, type, delay) {
    const a = AU.ctx;
    if (!a || G.muted) return;
    const t = a.currentTime + (delay || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = AU.noise; f.type = type || 'lowpass';
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(AU.lp); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03);
  }
  const SFX = {
    chirp: () => tone('sine', 1300, 2100, 0.07, 0.045),
    lock: () => { tone('square', 1900, 1900, 0.035, 0.02); tone('square', 1900, 1900, 0.035, 0.02, 0.06); },
    boom: v => { noise(0.45, 0.26 * v, 1300, 110); tone('sine', 120, 42, 0.32, 0.1 * v); },
    bomb: v => { noise(0.7, 0.32 * v, 900, 60); tone('sine', 80, 30, 0.55, 0.16 * v); },
    net: () => noise(0.16, 0.06, 2600, 700, 'bandpass'),
    flak: () => noise(0.05, 0.05, 4200, 1600, 'highpass'),
    built: () => tone('triangle', 620, 930, 0.09, 0.05),
    landed: () => { tone('triangle', 520, 520, 0.07, 0.035); tone('triangle', 780, 780, 0.09, 0.03, 0.07); },
    reveal: () => { tone('square', 300, 1200, 0.12, 0.025); tone('square', 1200, 300, 0.12, 0.02, 0.1); },
    launch: () => noise(0.3, 0.06, 500, 2600, 'bandpass'),
    alarm: () => { for (let i = 0; i < 3; i++) { tone('sawtooth', 560, 560, 0.1, 0.03, i * 0.22); tone('sawtooth', 420, 420, 0.1, 0.03, i * 0.22 + 0.11); } },
    heart: () => { tone('sine', 74, 36, 0.6, 0.28); noise(0.6, 0.16, 900, 90); },
    chime: () => { tone('sine', 660, 660, 0.5, 0.045); tone('sine', 990, 990, 0.6, 0.035, 0.12); },
    tick: () => tone('square', 2600, 2600, 0.015, 0.014),
    refund: () => { tone('triangle', 930, 620, 0.1, 0.04); },
    deny: () => tone('square', 220, 180, 0.08, 0.03),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.4, 0.05, i * 0.13)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f, 0.45, 0.05, i * 0.16)),
  };
  function play(name, gap, arg) {
    if (!AU.ctx || G.muted) return;
    const now = performance.now() / 1000;
    if (gap && now - (G.sfxT[name] || 0) < gap) return;
    G.sfxT[name] = now;
    try { SFX[name](arg == null ? 1 : arg); } catch (e) { /* audio node failure is not fatal */ }
  }
  function setMuted(m) {
    G.muted = m; store.set('muted', m);
    if (AU.master) AU.master.gain.value = m ? 0 : 0.75;
    const b = $('btn-sound');
    b.setAttribute('aria-pressed', String(m));
    b.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    b.querySelector('use').setAttribute('href', m ? '#g-mute' : '#g-sound');
  }
  function audioFrame() {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime, sim = G.sim;
    let n = 0;
    if (sim && G.mode === 'play' && !G.paused) for (const u of sim.units) if (u.side === ME && !u.parked && DRONES.has(u.type)) n++;
    AU.bg.gain.setTargetAtTime(n ? Math.min(0.045, 0.009 * Math.sqrt(n)) : 0, t, 0.25);
    AU.bo[0].frequency.setTargetAtTime(92 + n * 1.6, t, 0.4);
    AU.bo[1].frequency.setTargetAtTime(94.6 + n * 1.66, t, 0.4);
    AU.lp.frequency.setTargetAtTime(16000, t, 0.12);
  }

  // ---------- effects ----------
  function sparks(n) { const a = []; for (let i = 0; i < n; i++) a.push({ a: Math.random() * TAU, v: 0.6 + Math.random() * 0.8 }); return a; }
  function fx(k, x, y, o) {
    const f = Object.assign({ k, x, y, t: 0, life: 1 }, o);
    if (typeof f.side === 'number') f.side = vs(f.side);   // effects are coloured as the viewer sees the sides
    G.fx.push(f); if (G.fx.length > 500) G.fx.shift();
  }
  function updateFx(dt) {
    for (const f of G.fx) f.t += dt;
    G.fx = G.fx.filter(f => f.t < f.life);
    G.shake = Math.max(0, G.shake - dt * 2.4);
  }
  function drawFx() {
    const k = uk(), s = scale();
    for (const f of G.fx) {
      const p = S2(f.x, f.y), q = f.t / f.life;
      if (f.k === 'boom' || f.k === 'debris') {
        const big = f.big, col = f.side ? '91,140,255' : '245,165,36';
        ctx.globalCompositeOperation = 'lighter';
        if (q < 0.45) {
          const r = (6 + (big ? 44 : 22) * Math.sqrt(q / 0.45)) * k;
          ctx.globalAlpha = (1 - q / 0.45) * (f.k === 'debris' ? 0.6 : 0.9);
          ctx.drawImage(f.hit === false ? GLOW.white : f.k === 'debris' ? GLOW.lock : GLOW.white, p.x - r, p.y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1 - q;
        ctx.strokeStyle = `rgba(${f.k === 'debris' ? '255,140,110' : col},1)`; ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (const sp of f.sparks || []) {
          const r1 = (4 + 20 * q * sp.v) * k * (big ? 1.6 : 1), r2 = r1 + 5 * k * (1 - q);
          ctx.moveTo(p.x + Math.cos(sp.a) * r1, p.y + Math.sin(sp.a) * r1);
          ctx.lineTo(p.x + Math.cos(sp.a) * r2, p.y + Math.sin(sp.a) * r2);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = (1 - q) * 0.35;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, (8 + 22 * q) * k, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'bomb') {
        const R = DS.BLAST_R * s;
        ctx.globalCompositeOperation = 'lighter';
        if (q < 0.5) { const r = R * (0.5 + q * 1.6); ctx.globalAlpha = (1 - q / 0.5) * 0.95; ctx.drawImage(GLOW.white, p.x - r, p.y - r, r * 2, r * 2); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1 - q;
        ctx.strokeStyle = f.side ? COL.cobaltHi : COL.amberHi; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, R * (0.4 + q * 0.9), 0, TAU); ctx.stroke();
        ctx.globalAlpha = (1 - q) * 0.5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, R * (0.8 + q * 1.4), 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'net') {
        const p2 = S2(f.x2, f.y2), r = (5 + 7 * Math.min(1, q * 3)) * k;
        ctx.globalAlpha = 1 - q;
        ctx.strokeStyle = f.side ? COL.cobaltHi : COL.amberHi; ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.moveTo(p2.x, p2.y); ctx.lineTo(p2.x + Math.cos(a) * r, p2.y + Math.sin(a) * r); }
        ctx.stroke();
        hexAt(ctx, p2.x, p2.y, r * 0.75, 0); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'flak') {
        const p2 = S2(f.x2, f.y2);
        ctx.globalAlpha = 1 - q;
        ctx.strokeStyle = f.side ? COL.cobaltHi : COL.amberHi; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(GLOW.white, p2.x - 7, p2.y - 7, 14, 14);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      } else if (f.k === 'ping' || f.k === 'lockping' || f.k === 'reveal') {
        ctx.globalAlpha = (1 - q) * 0.9;
        ctx.strokeStyle = f.k === 'ping' ? COL.cobaltHi : f.k === 'reveal' ? COL.ink : COL.lock; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, (6 + 26 * q) * k, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'heart') {
        ctx.globalAlpha = (1 - q) * 0.8;
        ctx.strokeStyle = f.side ? COL.cobaltHi : COL.lock; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, (16 + 80 * q) * k, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'landed' || f.k === 'grown') {
        ctx.globalAlpha = (1 - q) * 0.8;
        ctx.strokeStyle = COL.amberHi; ctx.lineWidth = 1.2;
        hexAt(ctx, p.x, p.y, (12 + (f.k === 'grown' ? 40 : 16) * q) * k, Math.PI / 6); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.k === 'deliver' || f.k === 'text') {
        ctx.globalAlpha = 1 - q;
        ctx.font = `600 ${11 * k}px ${FONT_M}`; ctx.fillStyle = f.col || COL.bloom; ctx.textAlign = 'center';
        ctx.fillText(f.k === 'deliver' ? '+' + f.n : f.text, p.x, p.y - 26 * k - q * 22);
        ctx.globalAlpha = 1;
      } else if (f.k === 'value') {
        ctx.globalAlpha = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
        ctx.font = `700 ${12 * k}px ${FONT_M}`; ctx.textAlign = 'center';
        ctx.fillStyle = f.side ? COL.amberHi : COL.lock;
        ctx.fillText((f.side ? '+' : '−') + '◆' + f.n, p.x, p.y - 14 * k - q * 18);
        ctx.globalAlpha = 1;
      } else if (f.k === 'fizzle') {
        ctx.globalAlpha = (1 - q) * 0.5;
        ctx.strokeStyle = COL.faint; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, (3 + 10 * q) * k, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- glyphs ----------
  function hexAt(g, x, y, r, rot) {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (rot || 0) + (k * Math.PI) / 3, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }
  function raiderPath() {
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -7.5); ctx.lineTo(-1.5, -2.2); ctx.lineTo(-6.5, 0); ctx.lineTo(-1.5, 2.2); ctx.lineTo(-4, 7.5); ctx.closePath();
  }
  function drawGlyph(type, x, y, ang, col, k, u, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (type === 'sting') {
      ctx.rotate(ang); ctx.scale(k, k);
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.6); ctx.lineTo(-2.2, 0); ctx.lineTo(-5, 4.6); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      if (u && u.diving) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke(); }
    } else if (type === 'glint') {
      ctx.scale(k, k);
      ctx.beginPath(); ctx.moveTo(0, -6.2); ctx.lineTo(4.8, 0); ctx.lineTo(0, 6.2); ctx.lineTo(-4.8, 0); ctx.closePath();
      ctx.lineWidth = 1.7; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 1.9, 0, TAU); ctx.fill();
      if (u && !u.moving) {
        ctx.rotate(G.now * 1.6 + u.id);
        ctx.globalAlpha *= 0.55; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
      }
    } else if (type === 'forager') {
      ctx.rotate(ang); ctx.scale(k, k);
      hexAt(ctx, 0, 0, 5.8, 0); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#0b1115'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill();
      if (u && u.cargo > 0.5) { ctx.fillStyle = COL.bloom; ctx.beginPath(); ctx.arc(-7.5, 0, 1.4 + (u.cargo / 12) * 1.4, 0, TAU); ctx.fill(); }
    } else if (type === 'raider') {
      ctx.rotate(ang); ctx.scale(k * 1.3, k * 1.3);
      raiderPath(); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#0b1115'; ctx.beginPath(); ctx.arc(0.6, 0, 1.6, 0, TAU); ctx.fill();
      if (u && u.side === ME) {
        ctx.fillStyle = COL.amberHi;
        for (let i = 0; i < u.charges; i++) { ctx.beginPath(); ctx.arc(-8.6 - i * 2.9, 0, 1.05, 0, TAU); ctx.fill(); }
      }
    } else if (type === 'warden') {
      ctx.rotate(ang); ctx.scale(k * 1.15, k * 1.15);
      ctx.beginPath(); ctx.moveTo(7.5, 0); ctx.lineTo(-3, -5.6); ctx.lineTo(-3, 5.6); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.fillRect(-7, -6.4, 2.3, 12.8);
    } else if (type === 'decoy') {
      ctx.rotate(ang); ctx.scale(k * 1.15, k * 1.15);
      raiderPath(); ctx.lineWidth = 1.2; ctx.strokeStyle = col; ctx.stroke();
      if (u && u.side === ME) {
        ctx.setLineDash([1.6, 2.6]); ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(0, 0, 9.5 + 1.5 * Math.sin(G.now * 6 + u.id), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }
  function brackets(x, y, r, col, lw, dashed) {
    const l = r * 0.45;
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    if (dashed) ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x - r, y - r + l); ctx.lineTo(x - r, y - r); ctx.lineTo(x - r + l, y - r);
    ctx.moveTo(x + r - l, y - r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r, y - r + l);
    ctx.moveTo(x + r, y + r - l); ctx.lineTo(x + r, y + r); ctx.lineTo(x + r - l, y + r);
    ctx.moveTo(x - r + l, y + r); ctx.lineTo(x - r, y + r); ctx.lineTo(x - r, y + r - l);
    ctx.stroke();
    if (dashed) ctx.setLineDash([]);
  }
  function hpRing(p, r, hp, max, col, k) {
    const gap = max > 12 ? 0.035 : 0.09;
    ctx.lineWidth = 2.4 * k;
    for (let i = 0; i < max; i++) {
      const a0 = -Math.PI / 2 + (i / max) * TAU + gap, a1 = -Math.PI / 2 + ((i + 1) / max) * TAU - gap;
      ctx.strokeStyle = i < hp ? col : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, a0, a1); ctx.stroke();
    }
  }
  function drawHeart(h, k) {
    const v = vs(h.side), p = S2(h.x, h.y), col = SIDE[v], R = 15 * k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 + 0.15 * Math.sin(G.now * 2.2 + v * 2);
    ctx.drawImage(SGLOW[v], p.x - 36 * k, p.y - 36 * k, 72 * k, 72 * k);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 2; ctx.strokeStyle = col;
    hexAt(ctx, p.x, p.y, R, Math.PI / 6); ctx.fillStyle = 'rgba(6,9,12,0.85)'; ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1;
    hexAt(ctx, p.x, p.y, R * 0.6, Math.PI / 6);
    ctx.fillStyle = v ? 'rgba(91,140,255,0.3)' : 'rgba(245,165,36,0.3)'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, (2.6 + 0.8 * Math.sin(G.now * 3 + v)) * k, 0, TAU); ctx.fill();
    const max = T.heart.hp, rr = R + 6 * k;
    hpRing(p, rr, h.hp, max, col, k);
    ctx.font = `600 ${10 * k}px ${FONT_M}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = h.hp < max * 0.34 ? COL.lock : COL.dim;
    ctx.fillText(String(h.hp), p.x, p.y + rr + 5 * k);
    ctx.textBaseline = 'alphabetic';
  }
  function drawNest(x, y, side, k, alpha, hp, ghost) {
    const p = S2(x, y), col = SIDE[side], R = 10.5 * k;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (!ghost) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.4;
      ctx.drawImage(SGLOW[side], p.x - 24 * k, p.y - 24 * k, 48 * k, 48 * k);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
    }
    hexAt(ctx, p.x, p.y, R, Math.PI / 6);
    ctx.fillStyle = 'rgba(6,9,12,0.82)'; ctx.fill();
    ctx.lineWidth = 1.7; ctx.strokeStyle = col;
    if (ghost) ctx.setLineDash([3, 3]);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = col;
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * R * 0.42, p.y + Math.sin(a) * R * 0.42, 1.8 * k, 0, TAU); ctx.fill(); }
    if (hp != null) hpRing(p, R + 4.5 * k, hp, T.nest.hp, col, k * 0.8);
    ctx.restore();
  }

  // ---------- drawing ----------
  function setWorld() { ctx.setTransform(M[0] * DPR, M[1] * DPR, M[2] * DPR, M[3] * DPR, M[4] * DPR, M[5] * DPR); }
  function setScreen() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  const RAYS = { heart: 84, nest: 56, glint: 64, warden: 44, raider: 32, forager: 22, sting: 26 };

  function computeVis() {
    const sim = G.sim, out = [];
    for (const u of sim.units) {
      if (u.side !== ME || u.parked || u.hp <= 0) continue;
      const R = DS.reachOf(sim, u);
      if (R <= 0) continue;
      out.push(DS.visPoly(sim.map, u.x, u.y, R, RAYS[u.type] || 26));
    }
    return out;
  }
  function drawFog() {
    const fw = fogCv.width, k = fw / VW;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, fw, fogCv.height);
    fctx.fillStyle = 'rgba(3,6,10,0.56)';
    fctx.fillRect(0, 0, fw, fogCv.height);
    fctx.globalCompositeOperation = 'destination-out';
    fctx.setTransform(M[0] * k, M[1] * k, M[2] * k, M[3] * k, M[4] * k, M[5] * k);
    fctx.fillStyle = '#000';
    for (const p of G.vis) {
      fctx.beginPath(); fctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) fctx.lineTo(p[i], p[i + 1]);
      fctx.closePath(); fctx.fill();
    }
    fctx.globalCompositeOperation = 'source-over';
    setScreen();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogCv, 0, 0, VW, VH);
  }
  function drawFields() {
    const sim = G.sim, m = sim.map, s = scale(), pic = sim.sides[ME].pic, C = sim.cfg;
    const flare = new Array(m.fields.length).fill(0);
    for (const u of sim.units) {
      if (u.type !== 'forager' || u.state !== 'harvest' || u.hp <= 0 || u.field < 0) continue;
      if (u.side === ME) flare[u.field]++;
      else { const c = pic.get(u.id); if (c && c.grade >= 2) flare[u.field]++; }
    }
    m.fields.forEach((f, i) => {
      const open = DS.fieldOpen(sim, i), pulse = 0.5 + 0.5 * Math.sin(G.now * 1.6 + i * 1.7), fl = Math.min(3, flare[i]);
      const R = f.r * (open ? 2.3 + 0.3 * fl : 1.5);
      const a0 = open ? 0.3 + 0.1 * pulse + 0.12 * fl : 0.07;
      const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      gr.addColorStop(0, `rgba(215,166,255,${a0})`); gr.addColorStop(0.42, `rgba(215,166,255,${a0 * 0.35})`); gr.addColorStop(1, 'rgba(215,166,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.fill();
      if (open) {
        ctx.fillStyle = 'rgba(236,208,255,0.75)';
        const nm = f.centre ? 14 : 9;
        for (let q = 0; q < nm; q++) {
          const ph = q * 2.399 + i, rr = f.r * (0.25 + ((q * 37) % 70) / 100), sp = 0.25 + ((q * 13) % 9) / 30;
          const a = ph + G.now * sp, px = f.x + Math.cos(a) * rr, py = f.y + Math.sin(a * 1.3) * rr * 0.8;
          ctx.beginPath(); ctx.arc(px, py, (0.9 + (q % 3) * 0.35) * 1.6 / Math.max(0.5, s), 0, TAU); ctx.fill();
        }
      }
      ctx.lineWidth = 1.2 / s; ctx.strokeStyle = open ? 'rgba(215,166,255,0.62)' : 'rgba(215,166,255,0.3)';
      if (!open) ctx.setLineDash([4 / s, 5 / s]);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (G.sel && G.sel.kind === 'forager' && open) {
        ctx.strokeStyle = `rgba(255,200,103,${0.35 + 0.35 * pulse})`; ctx.lineWidth = 2 / s;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 8, 0, TAU); ctx.stroke();
      }
      if (f.centre && sim.t > C.bloomScore - 45) {
        const hcol = sim.holder === ME ? '245,165,36' : sim.holder === OP ? '91,140,255' : '215,166,255';
        ctx.strokeStyle = `rgba(${hcol},${sim.t >= C.bloomScore ? 0.65 : 0.3})`; ctx.lineWidth = 1.4 / s;
        ctx.setLineDash([8 / s, 6 / s]); ctx.lineDashOffset = -G.now * 12 / s;
        ctx.beginPath(); ctx.arc(f.x, f.y, DS.HOLD_R, 0, TAU); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
    });
  }
  function ring(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function drawWorldOverlays() {
    const sim = G.sim, s = scale(), h = sim.hearts[ME], S0 = sim.sides[ME];
    if (G.mode === 'play' && S0.guard) {
      ctx.strokeStyle = 'rgba(245,165,36,0.14)'; ctx.lineWidth = 1 / s; ctx.setLineDash([3 / s, 7 / s]);
      ring(h.x, h.y, DS.GUARD_R); ctx.stroke();
      for (const b of DS.basesOf(sim, ME)) if (b.type === 'nest') { ring(b.x, b.y, DS.NEST_GUARD_R); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    // posts: the Warden patrol ring, strong when the post is selected
    if (G.mode === 'play') {
      const selP = G.sel && G.sel.kind === 'post' ? G.sel.id : 0;
      for (const p of S0.posts) {
        if (!p.need.warden && p.id !== selP) continue;
        ctx.strokeStyle = p.id === selP ? 'rgba(255,200,103,0.55)' : 'rgba(245,165,36,0.13)'; ctx.lineWidth = 1 / s;
        ctx.setLineDash([2 / s, 6 / s]); ring(p.x, p.y, p.need.warden ? DS.WARDEN_ENGAGE : 90); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // where a Nest may grow
    if (G.placing) {
      ctx.setLineDash([6 / s, 6 / s]); ctx.lineWidth = 1.4 / s;
      ctx.fillStyle = 'rgba(245,165,36,0.05)'; ctx.strokeStyle = 'rgba(255,200,103,0.6)';
      ring(h.x, h.y, DS.NEST_FROM_HEART); ctx.fill(); ctx.stroke();
      for (const b of DS.basesOf(sim, ME)) if (b.type === 'nest') { ring(b.x, b.y, DS.NEST_FROM_NEST); ctx.fill(); ctx.stroke(); }
      for (const q of S0.queue) if (q.site) { ring(q.site.x, q.site.y, DS.NEST_FROM_NEST); ctx.fill(); ctx.stroke(); }
      const eh = sim.hearts[OP];
      ctx.strokeStyle = 'rgba(255,94,77,0.55)'; ctx.fillStyle = 'rgba(255,94,77,0.05)';
      ring(eh.x, eh.y, DS.NEST_ENEMY_CLEAR); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
    }
    // routes of our sorties
    const selIds = selSet();
    for (const so of sim.sorties.values()) {
      if (so.side !== ME) continue;
      let lead = null;
      for (const id of so.units) { const u = sim.byId.get(id); if (u) { lead = u; break; } }
      if (!lead) continue;
      const sel = selIds.has(so.id);
      if (lead.homing || so.mode === 'home') {
        const b = DS.nearestBase(sim, ME, lead.x, lead.y);
        ctx.strokeStyle = sel ? 'rgba(255,200,103,0.8)' : 'rgba(245,165,36,0.22)'; ctx.lineWidth = 1 / s;
        ctx.setLineDash([2 / s, 5 / s]); ctx.beginPath(); ctx.moveTo(lead.x, lead.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        continue;
      }
      const tgtId = lead.target || ((so.mode === 'strike' || so.mode === 'guard') ? so.target : 0);
      if (tgtId && (so.mode === 'strike' || so.mode === 'guard' || (so.type === 'warden' && lead.target) || (so.type === 'raider' && lead.target))) {
        const est = DS.estimate(sim, ME, tgtId);
        if (est) {
          ctx.strokeStyle = sel ? 'rgba(255,94,77,0.9)' : 'rgba(255,94,77,0.42)'; ctx.lineWidth = (sel ? 1.6 : 1) / s;
          ctx.setLineDash([3 / s, 4 / s]);
          ctx.beginPath(); ctx.moveTo(lead.x, lead.y); ctx.lineTo(est.x, est.y); ctx.stroke(); ctx.setLineDash([]);
          if (so.type !== 'warden') continue;
        }
      }
      const pts = so.route.slice(lead.wp);
      const end = so.route[so.route.length - 1];
      if (pts.length) {
        ctx.strokeStyle = sel ? 'rgba(255,200,103,0.9)' : so.mode === 'raid' ? 'rgba(255,94,77,0.4)' : so.post ? 'rgba(245,165,36,0.16)' : 'rgba(245,165,36,0.34)';
        ctx.lineWidth = (sel ? 1.7 : 1.1) / s;
        ctx.setLineDash([6 / s, 6 / s]); ctx.lineDashOffset = -G.now * 24 / s;
        ctx.beginPath(); ctx.moveTo(lead.x, lead.y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        ctx.beginPath(); ctx.arc(end.x, end.y, 3.5 / s, 0, TAU); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      }
      if (so.type === 'warden' && end && (!so.post || sel)) {
        ctx.strokeStyle = sel ? 'rgba(255,200,103,0.55)' : 'rgba(245,165,36,0.16)'; ctx.lineWidth = 1 / s;
        ctx.setLineDash([2 / s, 6 / s]); ring(end.x, end.y, DS.WARDEN_ENGAGE); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  function drawUnits() {
    const sim = G.sim, k = uk(), pic = sim.sides[ME].pic, S0 = sim.sides[ME];
    // trails
    ctx.lineCap = 'round';
    for (const tr of G.trails.values()) {
      const n = tr.pts.length;
      if (n < 2) continue;
      const col = tr.side ? '91,140,255' : '245,165,36';
      let a = S2(tr.pts[0].x, tr.pts[0].y);
      for (let i = 1; i < n; i++) {
        const b = S2(tr.pts[i].x, tr.pts[i].y);
        ctx.strokeStyle = `rgba(${col},${(i / n) * 0.45})`; ctx.lineWidth = 1.5 * k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        a = b;
      }
    }
    // glow pass
    ctx.globalCompositeOperation = 'lighter';
    for (const u of sim.units) {
      if (u.parked || u.hp <= 0 || u.type === 'heart' || u.type === 'nest') continue;
      let spr = null;
      if (u.side === ME) spr = GLOW.amber;
      else { const c = pic.get(u.id); if (c && c.grade >= 2) spr = GLOW.cobalt; }
      if (!spr) continue;
      const p = S2(u.x, u.y), r = (u.diving ? 19 : u.type === 'raider' ? 15 : 12) * k;
      ctx.globalAlpha = u.diving ? 0.95 : u.side === ME && DS.canopyAt(sim.map, u.x, u.y) ? 0.25 : 0.5;
      ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    for (const h of sim.hearts) drawHeart(h, k);
    // nests: ours, queued sites, and the rival's as we know them
    for (const u of sim.units) if (u.type === 'nest' && u.side === ME && u.hp > 0) drawNest(u.x, u.y, 0, k, 1, u.hp, false);
    for (const q of S0.queue) if (q.site) {
      drawNest(q.site.x, q.site.y, 0, k, 0.55, null, true);
      const p = S2(q.site.x, q.site.y);
      ctx.font = `600 ${9.5 * k}px ${FONT_M}`; ctx.textAlign = 'center'; ctx.fillStyle = COL.amberHi;
      ctx.fillText(q === S0.queue[0] ? `${Math.round((1 - q.t / q.total) * 100)}%` : 'queued', p.x, p.y + 22 * k);
    }
    for (const c of pic.values()) {
      if (c.type !== 'nest' || !c.known) continue;
      const e = sim.byId.get(c.id);
      if (!e) continue;
      drawNest(c.x, c.y, 1, k, c.grade >= 2 ? 1 : 0.55, c.grade >= 2 ? e.hp : null, false);
      if (c.grade >= 3) brackets(S2(c.x, c.y).x, S2(c.x, c.y).y, 15 * k, COL.lock, 1.6, false);
    }

    // perched glints show their reach
    for (const u of sim.units) {
      if (u.side !== ME || u.type !== 'glint' || u.parked || u.moving || u.hp <= 0) continue;
      const p = S2(u.x, u.y), r = DS.reachOf(sim, u) * scale();
      ctx.strokeStyle = 'rgba(245,165,36,0.16)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    // our drones
    const selIds = selSet(), selF = G.sel && G.sel.kind === 'forager' ? G.sel.id : 0;
    for (const u of sim.units) {
      if (u.side !== ME || u.parked || u.hp <= 0 || u.type === 'heart' || u.type === 'nest') continue;
      const p = S2(u.x, u.y), hid = DS.canopyAt(sim.map, u.x, u.y);
      drawGlyph(u.type, p.x, p.y, sAng(u.hdg), u.diving ? COL.amberHi : COL.amber, k, u, hid ? 0.72 : 1);
      if (hid) {   // under canopy: a leaf ring says "hidden"
        ctx.strokeStyle = 'rgba(127,209,164,0.85)'; ctx.lineWidth = 1.1; ctx.setLineDash([2, 2.5]);
        ctx.beginPath(); ctx.arc(p.x, p.y, 9 * k, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      if (G.mode === 'play' && u.spot >= 2) {
        ctx.strokeStyle = `rgba(255,94,77,${0.45 + 0.3 * Math.sin(G.now * 8 + u.id)})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 11 * k, 0, TAU); ctx.stroke();
      }
      if ((u.sortie && selIds.has(u.sortie)) || u.id === selF) {
        ctx.strokeStyle = COL.amberHi; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, 13.5 * k, 0, TAU); ctx.stroke();
      }
    }
    // their drones, as our sensors see them (a decoy shows as a Raider until someone looks closely)
    for (const c of pic.values()) {
      const e = sim.byId.get(c.id);
      if (!e || c.type === 'heart' || c.type === 'nest') continue;
      const look = c.type;
      if (c.grade >= 2) {
        const p = S2(e.x, e.y);
        drawGlyph(look, p.x, p.y, sAng(e.hdg), e.diving ? COL.cobaltHi : COL.cobalt, k, e.side === ME ? null : (look === 'decoy' ? null : e), look === 'decoy' ? 0.55 : 1);
        if (c.grade === 3) brackets(p.x, p.y, 11 * k, COL.lock, 1.6, false);
        else brackets(p.x, p.y, 10.5 * k, 'rgba(163,189,255,0.7)', 1.1, false);
      } else if (c.grade === 1) {
        const p = S2(c.gx, c.gy), fl = 0.32 + 0.22 * Math.sin(G.now * 9 + c.id * 1.3);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fl;
        ctx.drawImage(GLOW.cobalt, p.x - 17 * k, p.y - 17 * k, 34 * k, 34 * k);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      } else if (c.lockUntil > sim.t) {
        const p = S2(c.x, c.y);
        if (c.known) drawGlyph(look, p.x, p.y, sAng(Math.atan2(c.vy, c.vx)), 'rgba(91,140,255,0.55)', k);
        brackets(p.x, p.y, 10 * k, 'rgba(255,94,77,0.75)', 1.2, true);
      } else {
        const a = Math.max(0, 1 - (sim.t - c.seenT) / 6) * 0.4;
        if (a < 0.03) continue;
        const p = c.known ? S2(c.x, c.y) : S2(c.gx, c.gy);
        if (c.known) drawGlyph(look, p.x, p.y, sAng(Math.atan2(c.vy, c.vx)), COL.cobalt, k, null, a);
        else { ctx.globalAlpha = a * 0.6; ctx.drawImage(GLOW.cobalt, p.x - 14 * k, p.y - 14 * k, 28 * k, 28 * k); ctx.globalAlpha = 1; }
      }
    }
  }
  function drawLabels() {
    const sim = G.sim, m = sim.map, s = scale(), k = uk(), C = sim.cfg;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    // canopy names: strong while learning the map or giving orders, quiet otherwise
    const loud = G.mode === 'play' && (sim.phase === 0 || G.armed || G.placing || G.placingPost || (gest && gest.kind === 'route'));
    ctx.font = `600 ${8.5 * k}px ${FONT_D}`;
    ctx.fillStyle = loud ? 'rgba(127,209,164,0.75)' : 'rgba(127,209,164,0.32)';
    for (const pa of m.patches) { const p = S2(pa.x, pa.y); ctx.fillText('CANOPY', p.x, p.y - 4); }
    m.fields.forEach((f, i) => {
      const p = S2(f.x, f.y), open = DS.fieldOpen(sim, i);
      const yy = p.y + f.r * s + 6;
      ctx.font = `600 ${10 * k}px ${FONT_D}`;
      ctx.fillStyle = open ? 'rgba(215,166,255,0.78)' : 'rgba(215,166,255,0.45)';
      ctx.fillText(f.centre ? 'CROWN BLOOM' : f.name.toUpperCase(), p.x, yy);
      if (f.centre) {
        ctx.font = `500 ${9.5 * k}px ${FONT_M}`;
        let sub = '';
        if (G.training) sub = sim.t < C.bloomScore ? 'open' : sim.holder === ME ? 'you hold it' : sim.holder === OP ? 'cobalt holds it' : 'contested';
        else if (!open) sub = `opens at ${clockStr(C.round - C.bloomOpen)}`;
        else if (sim.t < C.bloomScore) sub = `scores from ${clockStr(C.round - C.bloomScore)}`;
        else sub = sim.holder === ME ? 'you hold it' : sim.holder === OP ? 'cobalt holds it' : 'contested';
        ctx.fillStyle = sim.t >= C.bloomScore ? (sim.holder === ME ? COL.amber : sim.holder === OP ? COL.cobaltHi : COL.bloom) : 'rgba(215,166,255,0.55)';
        ctx.fillText(sub, p.x, yy + 13 * k);
      }
    });
    ctx.font = `500 ${9 * k}px ${FONT_M}`;
    ctx.fillStyle = 'rgba(160,205,200,0.42)';
    for (const pk of m.peaks) { const p = S2(pk.x, pk.y); ctx.fillText('▲' + pk.elev, p.x, p.y - 5); }
    ctx.textBaseline = 'alphabetic';
  }
  // A post: a flag-like diamond with one pip per unit it keeps (filled when that unit is on station).
  function postMark(x, y, k, col, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = 'rgba(6,9,12,0.8)'; ctx.strokeStyle = col; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x, y - 9 * k); ctx.lineTo(x + 7 * k, y); ctx.lineTo(x, y + 9 * k); ctx.lineTo(x - 7 * k, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2.2 * k, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawPosts() {
    const sim = G.sim, k = uk(), S0 = sim.sides[ME];
    if (G.mode !== 'play' || !S0.posts.length) return;
    const selP = G.sel && G.sel.kind === 'post' ? G.sel.id : 0;
    for (const p of S0.posts) {
      const q = S2(p.x, p.y), st = staffOf(p), short = isShort(st), moving = G.movingPost === p.id;
      if (p.id === selP) { ctx.strokeStyle = COL.amberHi; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(q.x, q.y, 15 * k, 0, TAU); ctx.stroke(); }
      postMark(q.x, q.y, k, short ? COL.lock : COL.amberHi, moving ? 0.4 : 1);
      // pips
      const pips = [];
      for (const t of DS.POST_TYPES) if (st[t]) for (let i = 0; i < st[t].need; i++) pips.push(i < st[t].on);
      const pw = 5 * k, gap = 2 * k, total = pips.length * pw + (pips.length - 1) * gap;
      let x0 = q.x - total / 2;
      const y0 = q.y + 12 * k;
      for (const on of pips) {
        ctx.fillStyle = on ? COL.amber : 'rgba(6,9,12,0.8)'; ctx.strokeStyle = on ? COL.amber : short ? COL.lock : COL.dim; ctx.lineWidth = 1;
        ctx.fillRect(x0, y0, pw, pw); ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, pw - 1);
        x0 += pw + gap;
      }
      const bloomNamed = sim.map.fields.some(f => (f.centre ? 'Crown' : f.name) === p.name);
      ctx.font = `700 ${8.5 * k}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = short ? 'rgba(255,94,77,0.9)' : 'rgba(255,200,103,0.9)';
      ctx.fillText(bloomNamed ? 'POST' : `POST · ${p.name.toUpperCase()}`, q.x, q.y - 11 * k);
      ctx.textBaseline = 'alphabetic';
    }
  }
  function routeOrigin(pt) {
    const sim = G.sim;
    if (G.armed) return DS.nearestBase(sim, ME, pt.x, pt.y);
    for (const so of selSorties()) for (const id of so.units) { const u = sim.byId.get(id); if (u) return u; }
    return null;
  }
  function drawPreview() {
    const sim = G.sim, s = scale();
    if (gest && gest.kind === 'route') {
      const pts = gest.pts.slice();
      if (gest.cur) pts.push(gest.cur);
      const o = pts.length ? routeOrigin(pts[0]) : null;
      const all = o ? [o].concat(pts) : pts;
      ctx.strokeStyle = COL.amberHi; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
      ctx.beginPath();
      all.forEach((p, i) => { const q = S2(p.x, p.y); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
      ctx.stroke(); ctx.setLineDash([]);
      const end = pts[pts.length - 1];
      if (end) {
        const q = S2(end.x, end.y), types = activeTypes(), has = t => types.includes(t);
        ctx.fillStyle = COL.amberHi; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill();
        const st = structAt(end);
        const notes = [];
        if (has('glint')) {
          const R = T.glint.reach * (DS.ridgeAt(sim.map, end.x, end.y) ? 1.3 : 1) * s;
          ctx.strokeStyle = 'rgba(255,200,103,0.45)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          if (DS.ridgeAt(sim.map, end.x, end.y)) notes.push(['RIDGE PERCH +30%', COL.amberHi]);
        }
        if (has('warden')) {
          ctx.strokeStyle = 'rgba(255,200,103,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.arc(q.x, q.y, DS.WARDEN_ENGAGE * s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          notes.push(['PATROL HERE', COL.amberHi]);
        }
        if (types.some(isStriker) && st) notes.push([st.type === 'heart' ? 'RAID THE HEART' : 'RAID THE NEST', COL.lock]);
        if (has('decoy') && types.some(isStriker)) notes.push(['DECOYS LEAD', COL.amberHi]);
        if (DS.canopyAt(sim.map, end.x, end.y)) notes.push(['UNDER CANOPY: HARD TO SEE', COL.leaf]);
        notes.forEach((n, i) => label(q.x, q.y - 16 - i * 17, n[0], n[1]));
      }
    }
    if (!G.hover || !G.hover.mouse || (gest && gest.kind === 'route')) return;
    if (G.placingPost || G.movingPost) {
      const w = toWorld(G.hover.x, G.hover.y);
      postMark(G.hover.x, G.hover.y, uk(), COL.amberHi, 0.8);
      ctx.strokeStyle = 'rgba(255,200,103,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(G.hover.x, G.hover.y, DS.WARDEN_ENGAGE * s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      label(G.hover.x, G.hover.y - 20, `POST: ${postName(w.x, w.y).toUpperCase()}`, COL.amberHi);
      return;
    }
    if (G.placing) {
      const w = toWorld(G.hover.x, G.hover.y), err = DS.nestSiteError(sim, ME, w.x, w.y);
      drawNest(w.x, w.y, 0, uk(), err ? 0.4 : 0.85, null, true);
      label(G.hover.x, G.hover.y - 22, err ? err.toUpperCase().replace(/\.$/, '') : 'GROW A NEST HERE', err ? COL.lock : COL.amberHi);
      return;
    }
    if (G.armed) {
      const c = hitContact(G.hover.x, G.hover.y);
      const ts = G.group;
      if (c && ts.some(t => t !== 'glint' && t !== 'decoy')) {
        const p = contactScreen(c);
        brackets(p.x, p.y, 14, COL.lock, 2, false);
        const verb = !ts.some(isStriker) ? 'INTERCEPT' : c.static ? 'RAID' : ts.includes('raider') && !ts.includes('sting') ? 'BOMB' : 'STRIKE';
        label(p.x, p.y - 22, verb, COL.lock);
      } else {
        ctx.strokeStyle = 'rgba(255,200,103,0.7)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(G.hover.x, G.hover.y, 7, 0, TAU);
        ctx.moveTo(G.hover.x - 12, G.hover.y); ctx.lineTo(G.hover.x - 4, G.hover.y);
        ctx.moveTo(G.hover.x + 4, G.hover.y); ctx.lineTo(G.hover.x + 12, G.hover.y); ctx.stroke();
      }
      return;
    }
    if (!gest) tooltip(G.hover.x, G.hover.y);
  }
  function label(x, y, text, col) {
    ctx.font = `700 10px ${FONT_D}`; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(6,9,12,0.85)'; ctx.fillRect(x - w / 2, y - 11, w, 15);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  }
  function tooltip(X, Y) {
    const sim = G.sim;
    const c = hitContact(X, Y), post = hitPost(X, Y);
    let text = '';
    if (post) text = `Post ${post.name} · ${PRI[post.pri].toLowerCase()} priority · ${staffText(post)}`;
    else if (c) {
      if (c.type === 'heart') text = `Cobalt Heart · ${sim.hearts[OP].hp} left`;
      else if (c.type === 'nest') { const e = sim.byId.get(c.id); text = c.grade >= 2 && e ? `Cobalt Nest · ${e.hp} left` : 'Cobalt Nest · last seen here'; }
      else {
        const g = c.grade >= 3 ? 'lock' : c.grade === 2 ? 'track' : c.grade === 1 ? 'ghost' : c.lockUntil > sim.t ? 'lock (memory)' : 'last seen';
        text = `${c.known ? T[c.type].name : 'Unknown'} · ${g}`;
      }
    } else {
      const u = hitOwn(X, Y);
      if (u) {
        const sg = DS.sigOf(sim, u);
        text = `${T[u.type].name} · signature ${sg % 1 ? sg.toFixed(1) : sg}`;
        if (u.type === 'decoy') text += ' (reads as 6)';
        if (u.type === 'raider') text += ` · ${pl(u.charges, 'charge')}`;
        if (u.type === 'warden') text += ` · ${pl(u.nets, 'net')}`;
        if (u.type !== 'forager') text += ` · ${Math.ceil(u.battery)} s`;
        if (DS.canopyAt(sim.map, u.x, u.y)) text += ' · under canopy';
        if (u.spot >= 2) text += ' · tracked';
      }
    }
    if (!text) return;
    ctx.font = `500 11px ${FONT_M}`; ctx.textAlign = 'left';
    const w = ctx.measureText(text).width + 12;
    const x = Math.min(VW - w - 8, X + 14), y = Math.max(20, Y - 18);
    ctx.fillStyle = 'rgba(6,9,12,0.9)'; ctx.fillRect(x, y - 13, w, 19);
    ctx.fillStyle = COL.ink; ctx.fillText(text, x + 6, y);
  }

  function draw() {
    setScreen();
    ctx.fillStyle = '#05080b'; ctx.fillRect(0, 0, VW, VH);
    const sim = G.sim;
    if (!sim || !G.terrain) return;
    computeM(true);
    setWorld();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(G.terrain, 0, 0, W, H);
    if (G.now - G.visT > 0.1) { G.visT = G.now; G.vis = computeVis(); }
    drawFog();
    setWorld();
    drawFields();
    drawWorldOverlays();
    setScreen();
    drawLabels();
    drawPosts();
    drawUnits();
    drawFx();
    if (G.mode === 'play') drawPreview();
    if (G.training && G.mode === 'play') drawCoachMark();
  }

  function updateTrails() {
    const sim = G.sim, pic = sim.sides[ME].pic, seen = new Set();
    for (const u of sim.units) {
      if (u.parked || u.hp <= 0 || !DRONES.has(u.type)) continue;
      if (u.side === OP) { const c = pic.get(u.id); if (!c || c.grade < 2) continue; }
      seen.add(u.id);
      let tr = G.trails.get(u.id);
      if (!tr) { tr = { side: vs(u.side), pts: [] }; G.trails.set(u.id, tr); }
      const lp = tr.pts[tr.pts.length - 1];
      if (!lp || Math.hypot(lp.x - u.x, lp.y - u.y) > 5) { tr.pts.push({ x: u.x, y: u.y }); if (tr.pts.length > 9) tr.pts.shift(); }
    }
    for (const id of G.trails.keys()) if (!seen.has(id)) G.trails.delete(id);
  }

  // ---------- events, toasts, banner ----------
  function toast(text, kind) {
    const box = $('toasts'), el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    box.prepend(el);
    while (box.children.length > (VW < 640 ? (G.training ? 2 : 3) : 4)) box.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 3400);
    setTimeout(() => el.remove(), 3900);
  }
  function toastOnce(key, text, kind, gap) {
    const now = G.now;
    if (now - (G.thr[key] || -99) < gap) return;
    G.thr[key] = now;
    toast(text, kind);
  }
  let bannerTimer = 0;
  function banner(title, line, bloom) {
    const b = $('banner');
    b.querySelector('b').textContent = title;
    b.querySelector('span').textContent = line || '';
    b.className = 'show' + (bloom ? ' bloom' : '');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { b.className = bloom ? 'bloom' : ''; }, 2600);
  }
  function placeOf(x, y) {
    const sim = G.sim, m = sim.map;
    let best = null, bd = 150;
    for (const f of m.fields) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
    if (best) return best.centre ? 'at the Crown bloom' : `near ${best.name}`;
    if (DS.ridgeAt(m, x, y)) return 'on a ridge';
    if (DS.canopyAt(m, x, y)) return 'under canopy';
    if (Math.hypot(x - sim.hearts[ME].x, y - sim.hearts[ME].y) < 320) return 'near your Heart';
    if (Math.hypot(x - sim.hearts[OP].x, y - sim.hearts[OP].y) < 320) return 'near their Heart';
    return 'in the open';
  }
  function flushAgg() {
    const a = G.agg;
    if (G.now - a.t < 1.1) return;
    const mine = Object.entries(a.mine), theirs = Object.entries(a.theirs);
    if (mine.length) toast('Lost ' + mine.map(([t, n]) => units(n, t)).join(', '), 'lock');
    if (theirs.length) toast(`Destroyed ${theirs.map(([t, n]) => units(n, t)).join(', ')} · ◆${a.val}`, 'amber');
    a.mine = {}; a.theirs = {}; a.val = 0;
  }
  function onEvent(e, live) {
    const sim = G.sim;
    switch (e.k) {
      case 'boom':
        fx('boom', e.x, e.y, { life: e.on === 'heart' ? 1 : 0.7, side: e.side, hit: e.hit, big: e.on === 'heart' || e.on === 'nest', sparks: sparks(e.on === 'heart' ? 16 : 10) });
        if (live) play('boom', 0.06, onScreen(e.x, e.y) ? (e.on === 'heart' ? 1 : 0.6) : 0.25);
        break;
      case 'bomb':
        fx('bomb', e.x, e.y, { life: 0.9, side: e.side });
        if (live) { play('bomb', 0.08, onScreen(e.x, e.y) ? 1 : 0.35); if (onScreen(e.x, e.y)) G.shake = Math.min(1, G.shake + 0.25); }
        break;
      case 'net':
        fx('net', e.x, e.y, { x2: e.x2, y2: e.y2, side: e.side, life: 0.6 });
        if (live) play('net', 0.08);
        break;
      case 'killed':
        fx('debris', e.x, e.y, { life: 0.8, side: e.side, sparks: sparks(e.type === 'nest' ? 14 : 7), big: e.type === 'nest' });
        if (live && e.type !== 'sting') fx('value', e.x, e.y, { life: 1.2, side: e.side, n: T[e.type].cost });
        if (live) {
          const bag = e.side === ME ? G.agg.mine : G.agg.theirs;
          if (!Object.keys(G.agg.mine).length && !Object.keys(G.agg.theirs).length) G.agg.t = G.now;
          bag[e.type] = (bag[e.type] || 0) + 1;
          if (e.side === OP) G.agg.val += T[e.type].cost;
          if (e.side === ME && e.type === 'forager') toastOnce('lostF', `Forager lost ${placeOf(e.x, e.y)}.`, 'lock', 1.5);
          if (e.side === ME && e.type === 'nest') { toast('Your Nest was destroyed.', 'lock'); play('heart'); }
          if (e.side === OP && e.type === 'nest') toast('Cobalt Nest destroyed.', 'amber');
        }
        break;
      case 'fizzle':
        fx('fizzle', e.x, e.y, { life: 0.6 });
        if (live && e.side === ME && e.type === 'glint' && !e.post) toastOnce('fz', 'A Glint ran out of battery.', '', 4);
        if (live && e.side === ME && (e.type === 'raider' || e.type === 'warden')) toast(`A ${T[e.type].name} ran out of battery before it got home.`, 'lock');
        break;
      case 'flak':
        fx('flak', e.x, e.y, { x2: e.x2, y2: e.y2, hit: e.hit, side: e.side, life: 0.16 });
        if (live) play('flak', 0.05);
        break;
      case 'contact':
        if (e.obs !== ME) break;
        fx('ping', e.x, e.y, { life: 0.7 });
        if (live) {
          play('chirp', 0.12);
          if (e.type !== 'sting') toastOnce('c' + e.type, `Contact: ${e.type === 'nest' ? 'Cobalt Nest' : T[e.type].name} ${placeOf(e.x, e.y)}`, 'cobalt', 5);
        }
        break;
      case 'lock':
        if (e.obs !== ME) break;
        fx('lockping', e.x, e.y, { life: 0.5 });
        if (live) play('lock', 0.3);
        break;
      case 'decoyReveal':
        if (e.obs !== ME) break;
        fx('reveal', e.x, e.y, { life: 0.7 });
        fx('text', e.x, e.y, { life: 1.3, text: 'DECOY', col: COL.cobaltHi });
        if (live) { play('reveal', 0.3); toastOnce('dr', 'That Raider was a decoy.', 'cobalt', 6); }
        break;
      case 'heartHit':
        fx('heart', e.x, e.y, { life: 1.1, side: e.side });
        if (live) {
          play('heart', 0.18);
          if (e.side === ME) { G.shake = Math.min(1.2, G.shake + 0.55); toastOnce('hh0', `Your Heart is hit. ${e.hp} left.`, 'lock', 2); }
          else toastOnce('hh1', `Cobalt Heart hit. ${e.hp} left.`, 'amber', 2);
        }
        break;
      case 'nestHit':
        if (live && e.side === ME) toastOnce('nh', `Your Nest is under attack. ${e.hp} left.`, 'lock', 4);
        break;
      case 'guard':
        if (live && e.side === ME) toastOnce('guard', `Guard: parked Stings intercepting a ${T[e.type].name} near your ${e.at === 'nest' ? 'Nest' : 'Heart'}.`, 'amber', 8);
        break;
      case 'postSent':
        if (live && e.side === ME) {
          const p = postById(e.post);
          if (p && e.type !== 'glint') toastOnce('ps' + e.post + e.type, `${units(e.n, e.type)} on the way to the ${p.name} post.`, '', 25);
        }
        break;
      case 'built':
        if (e.side !== ME) break;
        if (e.type === 'nest') {
          fx('grown', e.x, e.y, { life: 1.2 });
          if (live) {
            play('built');
            toast(G.firstNest ? 'Nest grown. Drones launch from the nearest base, and Raiders and Foragers can land there.' : 'Nest grown.', 'amber');
            G.firstNest = false;
          }
        } else if (live) { play('built', 0.1); flashTile(e.type); }
        break;
      case 'landed':
        if (e.side !== ME) break;
        fx('landed', e.x, e.y, { life: 0.8 });
        if (live) { play('landed', 0.2); toastOnce('land' + e.type, `${T[e.type].name} home, rearming.`, '', 6); }
        break;
      case 'deliver':
        if (e.side === ME) fx('deliver', e.x, e.y, { life: 1.1, n: Math.round(e.n) });
        break;
      case 'phase':
        if (live) { const p = sim.phases[e.i]; banner(p.name, p.line, e.i === 3); play('chime'); }
        break;
      case 'bloomOpen':
        if (live && !G.training) toast(`The Crown bloom is open. It scores from ${clockStr(sim.cfg.round - sim.cfg.bloomScore)}.`, 'bloom');
        break;
      case 'holder':
        if (live) toastOnce('holder', e.side === ME ? 'You hold the Crown.' : e.side === OP ? 'Cobalt holds the Crown.' : 'The Crown is contested.', e.side === ME ? 'amber' : e.side === OP ? 'cobalt' : 'bloom', 3);
        break;
      case 'end':
        if (live) setTimeout(showEnd, 1500);
        else G.overT = G.now;
        break;
    }
  }
  function drainEvents() {
    const ev = G.sim.events;
    if (!ev.length) return;
    const live = G.mode === 'play';
    for (const e of ev) onEvent(e, live);
    ev.length = 0;
  }
  function onScreen(x, y) { const p = S2(x, y); return p.x > -20 && p.y > -20 && p.x < VW + 20 && p.y < VH + 20; }
  function flashTile(type) {
    const els = [];
    G.squads.forEach((q, i) => { if (q.mix[type]) els.push($('sq-' + i)); });
    if (!els.length && $('buy-' + type)) els.push($('buy-' + type));
    for (const t of els) { t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); }
  }

  // ---------- two players ----------
  // The two browsers run the same deterministic battle. Only orders travel: each side sends, every turn of three ticks,
  // what its player ordered, to be applied DELAY turns later by both. A browser steps a turn only once it holds both
  // players' orders for it, so the two stay in lockstep; every few seconds they compare a hash of the battle.
  // Trystero introduces the two browsers through public Nostr relays (several at once, so any one that answers will
  // do); after that they talk directly over WebRTC, or through a TURN relay when their networks will not allow it.
  const PROTO = 1, TURN = 3, DELAY = 2, HASH_EVERY = 20;
  const NET_LIB = 'trystero-0.26.0.js';   // bundled next to the page by build/vendor-trystero.sh
  const APP_ID = 'drone-season.michaelchapman.me';
  // From Trystero's own list of relays that carry its messages. Both players must use the same list.
  const RELAYS = ['nos.lol', 'nostr.robosats.org', 'cdn.satellite.earth', 'relay.layer.systems', 'relay.degmods.com',
    'nostr.stakey.net', 'relay.routstr.com', 'relay.nostr.dev.br', 'relay.flashapp.me', 'relay.piazza.today'].map(h => 'wss://' + h);
  // PeerJS's public TURN servers, for networks that block a direct link between the two browsers
  const TURN_SERVERS = [{ urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }];
  const NET = { role: '', live: false, room: null, chan: null, peerId: '', code: '', out: [], mine: new Map(), theirs: new Map(), hashes: new Map(),
    acc: 0, waiting: false, waitT: 0, lastMsg: 0, round: 'short', seed: 0, rivalPaused: false, rematchAsked: false, lostShown: false, timers: [] };
  const QS = new URLSearchParams(location.search);
  function netConfig() {   // tests point it at a local relay: ?relays=ws://127.0.0.1:7777
    const r = QS.get('relays');
    return { appId: APP_ID, relayConfig: { urls: r ? r.split(',') : RELAYS, warnOnRelayFailure: false }, turnConfig: r ? [] : TURN_SERVERS };
  }
  let netLoad = null;
  function loadNet() {
    if (window.Trystero) return Promise.resolve();
    if (!netLoad) netLoad = new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = NET_LIB; el.async = true;
      el.onload = () => (window.Trystero ? res() : rej(new Error('no Trystero')));
      el.onerror = () => { netLoad = null; rej(new Error('blocked')); };
      document.head.appendChild(el);
    });
    return netLoad;
  }
  const randId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  const send = m => { if (NET.chan && NET.peerId) { try { NET.chan.send(m, { target: NET.peerId }).catch(() => {}); } catch (e) { /* a dropped link shows up as a leave */ } } };
  const later = (ms, f) => NET.timers.push(setTimeout(f, ms));
  function netClose() {
    NET.live = false;
    NET.timers.forEach(clearTimeout); NET.timers = [];
    try { if (NET.room) NET.room.leave(); } catch (e) { /* already left */ }
    NET.room = null; NET.chan = null; NET.peerId = '';
  }
  function netReset() {
    netClose();
    Object.assign(NET, { role: '', code: '', out: [], mine: new Map(), theirs: new Map(), hashes: new Map(), acc: 0, waiting: false, waitT: 0, rivalPaused: false, rematchAsked: false, lostShown: false });
  }
  function dropJoinParam() {
    if (!QS.has('join')) return;
    QS.delete('join');
    try { history.replaceState(null, '', location.pathname + (QS.toString() ? '?' + QS : '') + location.hash); } catch (e) { /* sandboxed */ }
  }

  // the lobby panel on the title screen
  function lobby(h, p, opts) {
    opts = opts || {};
    $('ov-title').classList.add('lobby-on');
    $('lobby').hidden = false;
    setText('lobby-h', h);
    $('lobby-p').innerHTML = p;
    $('invite').hidden = !opts.url;
    if (opts.url) { $('invite-url').value = opts.url; $('btn-share').hidden = !navigator.share; }
    $('btn-lobby-alt').hidden = !opts.alt;
    $('btn-lobby-cancel').hidden = !!opts.alt;
  }
  function closeLobby() {
    $('ov-title').classList.remove('lobby-on');
    $('lobby').hidden = true;
  }
  // The Claude artifact preview runs in a sandbox that cannot hand out a link or reach the relays.
  const IN_PREVIEW = !!window.claude || /claudeusercontent|claude\.ai/.test(location.hostname);
  const NO_LIB = 'The two-player connection could not load here. Open the game at <b>michaelchapman.me/drone-season</b> in a normal browser tab and try again.';
  const NO_RELAY = 'Could not reach any of the services that introduce the two players. Check your connection and try again; some work or school networks block them.';
  const NO_LINK = 'Found your friend, but your two networks would not let the browsers connect. Try again, or try on mobile data or another Wi-Fi.';
  // Join the room both players meet in. The invite link carries its name.
  function openRoom(code) {
    const room = NET.room = window.Trystero.joinRoom(netConfig(), 'ds-' + code, {
      onJoinError: () => { if (!NET.live && NET.role) lobbyFail(NO_LINK); },
    });
    const chan = NET.chan = room.makeAction('ds');
    chan.onMessage = (m, meta) => onNet(m, meta && meta.peerId);
    room.onPeerJoin = id => {
      // a guest says hello to everyone in the room; only the host answers, and only the first guest gets a game
      if (NET.role === 'guest' && !NET.live) chan.send({ t: 'hello', v: PROTO }, { target: id }).catch(() => {});
    };
    room.onPeerLeave = id => { if (id === NET.peerId) netLost('left'); };
    // if no relay has answered after a while, say so rather than wait forever
    later(12000, () => {
      if (!NET.role || NET.live || NET.peerId) return;
      const socks = Object.values(window.Trystero.getRelaySockets() || {});
      if (!socks.some(ws => ws && ws.readyState === 1)) lobbyFail(NO_RELAY);
    });
  }
  async function hostGame() {
    if (IN_PREVIEW) { lobbyFail('Two-player games need the full page at <b>michaelchapman.me/drone-season</b>: this preview cannot connect two browsers.', 'Play a friend on the site'); return; }
    netReset();
    NET.role = 'host';
    lobby('Invite a player', 'Setting up an invite&hellip;');
    try { await loadNet(); } catch (e) { lobbyFail(NO_LIB); return; }
    if (NET.role !== 'host') return;
    NET.code = randId();
    openRoom(NET.code);
    const extra = ['relays', 'debug'].filter(k => QS.has(k)).map(k => '&' + k + '=' + encodeURIComponent(QS.get(k) || '')).join('');
    const url = location.origin + location.pathname + '?join=' + NET.code + extra;
    lobby('Invite a player', `Send this link to a friend. They play the cobalt hive; the round starts as soon as they open it.<br><b>${DS.MODES[G.round].name}</b>, ${DS.MODES[G.round].minutes} minutes, on map ${G.seed}.`, { url });
  }
  async function joinGame(code) {
    netReset();
    NET.role = 'guest';
    lobby('Joining a game', 'Looking for your friend. This can take a few seconds&hellip;');
    try { await loadNet(); } catch (e) { lobbyFail(NO_LIB); return; }
    if (NET.role !== 'guest') return;
    openRoom(String(code).replace(/[^a-z0-9]/gi, '').slice(0, 32));
    later(30000, () => { if (NET.role === 'guest' && !NET.live) lobbyFail('Could not find your friend\'s game. They may have left the title screen or made a new invite: ask them for a fresh link.', 'That invite may have closed'); });
  }
  function lobbyFail(text, heading) {
    netReset(); dropJoinParam();
    if (G.mode !== 'title') toTitle();
    lobby(heading || 'Could not connect', text, { alt: true });
  }
  function onNet(m, from) {
    if (!m || typeof m !== 'object') return;
    // before the game: the host takes the first guest's hello; a guest takes the host's answer
    if (m.t === 'hello') {
      if (NET.role !== 'host' || NET.live) { if (NET.role === 'host' && from !== NET.peerId) NET.chan.send({ t: 'nope', why: 'full' }, { target: from }).catch(() => {}); return; }
      NET.peerId = from;
      if (m.v !== PROTO) { send({ t: 'nope', why: 'version' }); NET.peerId = ''; return; }
      hostStart(false);
      return;
    }
    if (NET.role === 'guest' && !NET.live && (m.t === 'start' || m.t === 'nope')) NET.peerId = from;
    if (from !== NET.peerId) return;
    NET.lastMsg = G.now;
    if (m.t === 'nope') {
      lobbyFail(m.why === 'full' ? 'That game already has two players.' : 'You and your friend have different versions of the game. Both reload the page, then make a fresh invite.', 'Could not join');
    } else if (m.t === 'start' && NET.role === 'guest') {
      netStart(m.seed, m.round, 1);
    } else if (m.t === 'turn') {
      NET.theirs.set(m.k, Array.isArray(m.c) ? m.c : []);
    } else if (m.t === 'hash') {
      checkHash(m.k, 'theirs', m.h);
    } else if (m.t === 'pause') {
      if (G.mode === 'play' && !G.paused) { NET.rivalPaused = true; pause(true); }
    } else if (m.t === 'resume') {
      if (G.paused) resume(true);
    } else if (m.t === 'rematch') {
      if (NET.role === 'host' && G.mode === 'end') { NET.rematchAsked = true; renderEndNet(); }
    } else if (m.t === 'bye') {
      netLost('left');
    }
  }
  function hostStart(fresh) {
    if (fresh) { G.seed = randSeed(); store.set('seed', G.seed); }
    send({ t: 'start', seed: G.seed, round: G.round, v: PROTO });
    netStart(G.seed, G.round, 0);
  }
  function netStart(seed, round, me) {
    Object.assign(NET, { live: true, out: [], mine: new Map(), theirs: new Map(), hashes: new Map(), acc: 0, waiting: false, waitT: 0,
      rivalPaused: false, rematchAsked: false, lostShown: false, round: DS.MODES[round] ? round : 'short', seed });
    for (let k = 0; k < DELAY; k++) { NET.mine.set(k, []); NET.theirs.set(k, []); }
    NET.timers.forEach(clearTimeout); NET.timers = [];
    closeLobby();
    startRound(false, { seed, round: NET.round, me });
  }
  function applyTurn(k) {
    const a = NET.mine.get(k) || [], b = NET.theirs.get(k) || [];
    for (const list of ME === 0 ? [a, b] : [b, a]) {
      for (const c of list) { const f = Array.isArray(c) && ACTS[c[0]]; if (f) f(G.sim, ...(Array.isArray(c[1]) ? c[1] : [])); }
    }
    NET.mine.delete(k); NET.theirs.delete(k);
  }
  function hashSim(sim) {
    let h = sim.tick | 0;
    for (const u of sim.units) {
      h = (Math.imul(h, 31) + u.id) | 0;
      h = (Math.imul(h, 31) + Math.round(u.x * 64)) | 0;
      h = (Math.imul(h, 31) + Math.round(u.y * 64)) | 0;
      h = (Math.imul(h, 31) + u.hp) | 0;
    }
    for (const S of sim.sides) h = (Math.imul(h, 31) + Math.round(S.nectar * 64)) | 0;
    return h;
  }
  function checkHash(k, who, h) {
    const e = NET.hashes.get(k) || {};
    e[who] = h; NET.hashes.set(k, e);
    if (e.mine != null && e.theirs != null) {
      NET.hashes.delete(k);
      if (e.mine !== e.theirs) netProblem('desync');
    }
  }
  // Step the battle in lockstep: at each turn boundary, wait until both players' orders for that turn are here.
  function netAdvance(rdt) {
    const sim = G.sim;
    NET.acc = Math.min(NET.acc + rdt, 0.4);
    let n = 0;
    while (NET.acc >= DS.DT && n < 12 && !sim.over && NET.live) {
      if (sim.tick % TURN === 0) {
        const k = sim.tick / TURN;
        if (!NET.theirs.has(k) || !NET.mine.has(k)) { if (!NET.waiting) { NET.waiting = true; NET.waitT = G.now; } break; }
        NET.waiting = false;
        applyTurn(k);
        const c = NET.out; NET.out = [];
        NET.mine.set(k + DELAY, c);
        send({ t: 'turn', k: k + DELAY, c });
        if (k % HASH_EVERY === 0) { const h = hashSim(sim); send({ t: 'hash', k, h }); checkHash(k, 'mine', h); }
      }
      DS.step(sim, DS.DT); NET.acc -= DS.DT; n++;
    }
    if (sim.over) NET.waiting = false;
  }
  // the link dropped, the rival left, or the two battles no longer match
  function netLost(why) {
    if (!NET.role) return;
    const inRound = NET.live && G.mode === 'play' && G.sim && !G.sim.over;
    if (G.mode === 'title') { lobbyFail(NET.role === 'host' ? 'Your friend disconnected before the round started. Make a fresh invite.' : 'The connection closed. Try a fresh invite.'); return; }
    netClose();
    if (inRound) netProblem(why);
    else if (G.mode === 'end') { NET.role = ''; renderEndNet(); }
  }
  function netProblem(why) {
    if (NET.lostShown) return;
    NET.lostShown = true;
    netClose();
    G.paused = true;
    const desync = why === 'desync', slow = why === 'slow';
    setText('net-h', desync ? 'The two battles fell out of step' : slow ? 'Your rival is not responding' : 'Your rival left the game');
    $('net-p').innerHTML = desync ? 'Something made the two browsers disagree about the battle, so it cannot carry on as a two-player game.' : slow ? 'Nothing has arrived from your rival for a while: their connection may have dropped.' : 'The connection to your rival closed.';
    $('net-btns').innerHTML = '<button class="btn primary" data-act="net-ai">Finish against the computer</button><button class="btn" data-act="net-title">Title screen</button>';
    $('ov-net').hidden = false;
    app.classList.add('overlay-on');
  }
  $('net-btns').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'net-ai') {
      DS.setAI(G.sim, OP, 'normal');
      NET.role = ''; NET.live = false;
      $('ov-net').hidden = true; app.classList.remove('overlay-on');
      G.paused = false; G.last = 0; $('wait').hidden = true;
      toast('The computer has taken over the cobalt hive.', 'cobalt');
    } else if (b.dataset.act === 'net-title') { $('ov-net').hidden = true; leaveGame(); }
  });
  function leaveGame() {
    if (NET.role) { send({ t: 'bye' }); setTimeout(netReset, 150); }
    NET.live = false; NET.role = '';
    dropJoinParam();
    toTitle();
  }
  function renderEndNet() {
    const two = !!NET.seed && G.mode === 'end' && G.wasNet;
    $('btn-again').hidden = $('btn-next').hidden = two;
    $('btn-rematch').hidden = !two || !NET.role;
    setText('btn-title', two ? 'Leave' : 'Title screen');
    if (!two) return;
    const note = $('end-net') || (() => { const p = document.createElement('p'); p.id = 'end-net'; $('end-p').after(p); return p; })();
    note.textContent = !NET.role ? 'Your rival has left.' : NET.role === 'host' ? (NET.rematchAsked ? 'Your rival wants a rematch on a new map.' : 'Rematch starts a new map for you both.') : NET.rematchAsked ? 'Waiting for the host to start the rematch.' : 'Ask for a rematch on a new map.';
  }
  $('btn-rematch').addEventListener('click', () => {
    if (NET.role === 'host') hostStart(true);
    else if (NET.role === 'guest') { send({ t: 'rematch' }); NET.rematchAsked = true; renderEndNet(); }
  });
  $('btn-friend').addEventListener('click', () => { audioInit(); hostGame(); });
  $('btn-lobby-cancel').addEventListener('click', () => { netReset(); dropJoinParam(); closeLobby(); });
  $('btn-lobby-alt').addEventListener('click', () => { netReset(); dropJoinParam(); closeLobby(); });
  $('btn-copy').addEventListener('click', async () => {
    const inp = $('invite-url');
    try { await navigator.clipboard.writeText(inp.value); setText('btn-copy', 'Copied'); }
    catch (e) { inp.select(); try { document.execCommand('copy'); setText('btn-copy', 'Copied'); } catch (e2) { setText('btn-copy', 'Select and copy'); } }
    setTimeout(() => setText('btn-copy', 'Copy link'), 1800);
  });
  $('btn-share').addEventListener('click', () => {
    if (navigator.share) navigator.share({ title: 'Drone Season', text: 'Play Drone Season against me: you are the cobalt hive.', url: $('invite-url').value }).catch(() => {});
  });

  // ---------- orders to the simulation ----------
  // Every change you make to the battle goes through act(). On your own it is applied at once and returns the sim's
  // answer. In a two-player game it is queued, sent, and applied a few ticks later by both browsers at the same tick,
  // so the two simulations stay identical; act() then returns true and the dock catches up a moment later.
  const ACTS = { build: DS.build, cancelBuild: DS.cancelBuild, launch: DS.launch, retask: DS.retask, recall: DS.recall, setStance: DS.setStance,
    assignForager: DS.assignForager, setGuard: DS.setGuard, setPlan: DS.setPlan, setAuto: DS.setAuto, addPost: DS.addPost, editPost: DS.editPost, removePost: DS.removePost };
  function act(name, ...args) {
    if (NET.live) { NET.out.push([name, JSON.parse(JSON.stringify(args))]); return true; }
    return ACTS[name](G.sim, ...args);
  }

  // ---------- orders ----------
  const readyOf = type => DS.parkedCount(G.sim, ME, type);
  const mixTypes = mix => SQUAD_TYPES.filter(t => mix[t] > 0);
  const mixSize = mix => mixTypes(mix).reduce((n, t) => n + mix[t], 0);
  const MIX_ORDER = ['sting', 'raider', 'warden', 'glint', 'decoy'];
  const mixText = (mix, sep) => MIX_ORDER.filter(t => mix[t] > 0).map(t => units(mix[t], t)).join(sep || ' + ');
  function mixReady(mix) {
    let r = 0;
    for (const t of mixTypes(mix)) r += Math.min(mix[t], readyOf(t));
    return r;
  }
  // The armed squads' units, merged into one mix: G.group lists its types, G.armed is set while anything is armed.
  function setMix(mix) {
    G.mix = mix; G.group = mixTypes(mix);
    G.armed = G.group.length ? G.group[G.group.length - 1] : null;
    if (!G.armed) G.armedSq = [];
  }
  function rebuildMix() {
    const mix = {};
    for (const i of G.armedSq) for (const t of mixTypes(G.squads[i].mix)) mix[t] = (mix[t] || 0) + G.squads[i].mix[t];
    setMix(mix);
  }
  const armName = () => G.armedSq.map(i => G.squads[i].name).join(' + ') || 'Squad';
  function disarm() { G.armedSq = []; setMix({}); }
  // The selected sorties: one sortie, or every sortie launched together as a package.
  function selSorties() {
    if (!G.sel || G.sel.kind !== 'sortie') return [];
    const sim = G.sim, out = [];
    for (const so of sim.sorties.values()) if (so.side === ME && so.units.length && (so.id === G.sel.id || (G.sel.pkg && so.pkg === G.sel.pkg))) out.push(so);
    return out;
  }
  const selSet = () => new Set(selSorties().map(so => so.id));
  const activeTypes = () => (G.armed ? G.group.slice() : [...new Set(selSorties().map(so => so.type))]);
  const isStriker = t => t === 'sting' || t === 'raider';
  const busy = () => G.mode !== 'play' || G.paused || !!G.sheet;
  function armSquad(i) {
    if (busy()) return;
    const sq = G.squads[i];
    G.placing = false; G.placingPost = false; G.movingPost = 0; closeMenu();
    if (G.armedSq.includes(i)) { G.armedSq = G.armedSq.filter(k => k !== i); rebuildMix(); play('tick'); return; }
    if (!mixSize(sq.mix)) { openSquadSheet(i); return; }
    if (!mixReady(sq.mix)) {
      play('deny');
      const t = mixTypes(sq.mix)[0], re = DS.rearmingCount(G.sim, ME, t);
      toastOnce('nr' + i, re ? `${sq.name}: ${units(re, t)} rearming. Ready in a few seconds.` : `${sq.name}: nothing ready. Build ${PLURAL[t]} in the Build tab, or turn on Auto.`, '', 2);
      return;
    }
    G.armedSq = G.armedSq.concat([i]); rebuildMix(); G.sel = null; play('tick');
  }
  function cancel() { disarm(); G.sel = null; G.placing = false; G.placingPost = false; G.movingPost = 0; closeMenu(); }
  function contactWorld(c) {
    const e = G.sim.byId.get(c.id);
    if (c.static) return { x: c.x, y: c.y };
    if (c.grade >= 2 && e) return { x: e.x, y: e.y };
    if (c.grade === 1) return { x: c.gx, y: c.gy };
    return { x: c.x, y: c.y };
  }
  function contactScreen(c) { const w = contactWorld(c); return S2(w.x, w.y); }
  function structAt(p, R) {   // an enemy Heart or known Nest near a world point
    const sim = G.sim;
    let best = null, bd = R || 90;
    for (const c of sim.sides[ME].pic.values()) {
      if (!c.static || !c.known) continue;
      const e = sim.byId.get(c.id);
      if (!e || e.hp <= 0) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  const whoS = c => (c.type === 'heart' ? 'Cobalt Heart' : 'Cobalt Nest');
  const cname = c => (c.known ? (c.static ? whoS(c) : T[c.type].name) : 'unknown contact');
  // Turn a gesture into a route and sim options for a unit type.
  function plan(type, pts, c) {
    const end = pts.length ? pts[pts.length - 1] : (c ? contactWorld(c) : null);
    if (!end) return null;
    const st = c && c.static ? c : structAt(end);
    const toSt = () => pts.slice(0, Math.max(0, pts.length - 1)).concat([{ x: st.x, y: st.y }]);
    if (type === 'sting') {
      if (st) return { route: toSt(), opts: { mode: 'raid', target: st.id }, what: `raid on the ${whoS(st)}` };
      if (c) return { route: [], opts: { mode: 'strike', target: c.id }, what: `strike on ${cname(c)}` };
      return { route: pts, opts: { mode: 'hunt' }, what: pts.length > 1 ? 'hunting along the route' : `hunting ${placeOf(end.x, end.y)}` };
    }
    if (type === 'raider') {
      if (st) return { route: toSt(), opts: { mode: 'raid', target: st.id }, what: `bombing run on the ${whoS(st)}` };
      if (c) return { route: [], opts: { mode: 'strike', target: c.id }, what: `bombing run on ${cname(c)}` };
      return { route: pts, opts: { mode: 'route' }, what: pts.length > 1 ? 'bombing along the route' : `bombing ${placeOf(end.x, end.y)}` };
    }
    if (type === 'warden') {
      if (c && !c.static) return { route: [end], opts: { target: c.id }, what: `intercepting ${cname(c)}` };
      return { route: pts.length ? pts : [end], opts: {}, what: `patrolling ${placeOf(end.x, end.y)}` };
    }
    const route = pts.length ? pts : [end];
    return { route, opts: {}, what: type === 'glint' ? `scouting ${placeOf(end.x, end.y)}` : `drawing fire ${placeOf(end.x, end.y)}` };
  }
  // Launch a mix of units along one gesture as one package, so it can be selected and retasked as one.
  function launchMix(mix, planFor, name) {
    const types = mixTypes(mix);
    const strike = types.some(isStriker), lead = strike && types.includes('decoy');
    const pkg = G.pkgSeq++;
    const sent = [];
    let what = '', want = 0, got = 0;
    for (const t of types) {
      want += mix[t];
      const n = Math.min(mix[t], readyOf(t)), p = n ? planFor(t) : null;
      if (!p) continue;
      if (!act('launch', ME, t, n, p.route, Object.assign({ stance: t === 'decoy' && lead ? 'dash' : G.stance, pkg, label: name }, p.opts))) continue;
      got += n;
      sent.push(units(n, t));
      if (!what || isStriker(t)) what = p.what;
    }
    if (!sent.length) { play('deny'); toastOnce('nrg', `${name}: nothing ready to fly.`, '', 2); return false; }
    play('launch');
    toast(`${name}: ${sent.join(' + ')} away, ${what}${got < want ? ` (${got} of ${want} were ready)` : ''}${lead ? '. Decoys lead.' : ''}`, 'amber');
    return true;
  }
  // g is a gesture: a list of route points, or a contact.
  function sendMix(mix, g, name) {
    const ok = launchMix(mix, t => plan(t, g.pts, g.c), name);
    if (ok) G.again = { mix: Object.assign({}, mix), name, pts: g.pts.slice(), cid: g.c ? g.c.id : 0, cpos: g.c ? contactWorld(g.c) : null, stance: G.stance };
    return ok;
  }
  function fireArmed(g) { if (sendMix(G.mix, g, armName())) disarm(); }
  function again() {
    const a = G.again;
    if (!a || busy()) return;
    const sim = G.sim, cc = a.cid ? sim.sides[ME].pic.get(a.cid) : null;
    const c = cc && sim.byId.get(cc.id) ? cc : null;
    const pts = c ? [] : a.pts.length ? a.pts : a.cpos ? [a.cpos] : [];
    if (!c && !pts.length) return;
    const st = G.stance;
    G.stance = a.stance;
    launchMix(a.mix, t => plan(t, pts, c), a.name);
    G.stance = st;
  }
  function retaskSel(planFor) {
    const list = selSorties();
    if (!list.length) { G.sel = null; return; }
    let what = '';
    for (const so of list) {
      const p = planFor(so.type);
      if (!p) continue;
      act('retask', so.id, p.route, p.opts);
      if (!what || isStriker(so.type)) what = p.what;
    }
    play('tick');
    toastOnce('rt' + G.sel.id, `${list.map(so => units(so.units.length, so.type)).join(' + ')}: ${what}`, 'amber', 1);
  }
  function commitRoute(pts) {
    const sim = G.sim;
    if (G.armed && pts.length > 1) { const b = DS.nearestBase(sim, ME, pts[0].x, pts[0].y); if (Math.hypot(pts[0].x - b.x, pts[0].y - b.y) < 70) pts.shift(); }
    if (!pts.length) return;
    if (G.armed) { fireArmed({ pts, c: null }); return; }
    if (G.sel && G.sel.kind === 'sortie') retaskSel(t => plan(t, pts, null));
  }
  function placeNest(w) {
    const sim = G.sim, err = DS.nestSiteError(sim, ME, w.x, w.y);
    if (err) { play('deny'); toastOnce('ne', err, 'lock', 1.2); return false; }
    if (sim.sides[ME].nectar < DS.BUILD.nest.cost) { play('deny'); toast(`Need ◆${DS.BUILD.nest.cost} nectar for a Nest.`, ''); G.placing = false; return false; }
    if (act('build', ME, 'nest', { x: w.x, y: w.y })) { play('tick'); toast('Nest queued. It grows when it reaches the front of the queue.', 'amber'); G.placing = false; return true; }
    return false;
  }
  function tapAt(X, Y) {
    const sim = G.sim, w = toWorld(X, Y);
    if (G.placing) { placeNest(w); return; }
    if (G.placingPost) { G.placingPost = false; openPostSheet(null, w); return; }
    if (G.movingPost) {
      const p = postById(G.movingPost);
      G.movingPost = 0;
      if (p) { const nm = postName(w.x, w.y); act('editPost', ME, p.id, { x: w.x, y: w.y, name: nm }); G.sel = { kind: 'post', id: p.id }; play('tick'); toast(`Post moved to ${nm}.`, 'amber'); }
      return;
    }
    const c = hitContact(X, Y);
    if (G.armed) { fireArmed({ pts: c ? [] : [w], c }); return; }
    if (G.sel && G.sel.kind === 'sortie') {
      const set = selSet();
      if (!set.size) { G.sel = null; return; }
      const own = hitOwn(X, Y);
      if (own && own.sortie && !set.has(own.sortie)) { selectSortie(own.sortie); play('tick'); return; }
      const posted = selSorties().some(so => so.post);
      retaskSel(t => { const useC = c && t !== 'glint' && t !== 'decoy' ? c : null; return plan(t, useC ? [] : [c ? contactWorld(c) : w], useC); });
      if (posted) toastOnce('rel', 'Released from its post. The hive will send another.', '', 3);
      return;
    }
    if (G.sel && G.sel.kind === 'forager') {
      const fi = hitField(w);
      if (fi >= 0) {
        const f = sim.map.fields[fi];
        if (!DS.fieldOpen(sim, fi)) toast('The Crown bloom is still closed.', '');
        else if (sim.units.filter(u => u.side === ME && u.type === 'forager' && u.hp > 0 && u.field === fi && u.id !== G.sel.id).length >= 3) toast(`${f.centre ? 'The Crown bloom' : f.name} already has three of your Foragers.`, '');
        else { act('assignForager', G.sel.id, fi); toast(`Forager heading to ${f.centre ? 'the Crown bloom' : f.name}`, 'amber'); play('tick'); }
        G.sel = null;
        return;
      }
    }
    const post = hitPost(X, Y);
    if (post) { G.sel = { kind: 'post', id: post.id }; play('tick'); return; }
    if (c) { contactMenu(X, Y, c); return; }
    const u = hitOwn(X, Y);
    if (u) {
      if (u.type === 'forager') G.sel = { kind: 'forager', id: u.id };
      else if (u.sortie) selectSortie(u.sortie);
      play('tick');
      return;
    }
    G.sel = null;
  }
  function selectSortie(id) {
    const so = G.sim.sorties.get(id);
    G.sel = { kind: 'sortie', id, pkg: so ? so.pkg || 0 : 0 };
  }
  function hitContact(X, Y) {
    const sim = G.sim, pic = sim.sides[ME].pic;
    let best = null, bd = 26;
    for (const c of pic.values()) {
      const e = sim.byId.get(c.id);
      if (!e) continue;
      if (!c.static && c.grade === 0 && !(c.lockUntil > sim.t)) continue;
      const p = contactScreen(c);
      const d = Math.hypot(p.x - X, p.y - Y) - (c.type === 'heart' ? 12 : c.type === 'nest' ? 6 : 0);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function hitOwn(X, Y) {
    const sim = G.sim;
    let best = null, bd = 20;
    for (const u of sim.units) {
      if (u.side !== ME || u.parked || u.hp <= 0 || u.type === 'heart' || u.type === 'nest') continue;
      const p = S2(u.x, u.y), d = Math.hypot(p.x - X, p.y - Y);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }
  function hitField(w) {
    const m = G.sim.map, s = scale();
    let best = -1, bd = 1e9;
    m.fields.forEach((f, i) => { const d = Math.hypot(f.x - w.x, f.y - w.y); if (d < f.r + 26 / s && d < bd) { bd = d; best = i; } });
    return best;
  }
  function pickForager() {
    if (busy()) return;
    const list = G.sim.units.filter(u => u.side === ME && u.type === 'forager' && u.hp > 0).sort((a, b) => a.id - b.id);
    if (!list.length) { toastOnce('nof', 'No Foragers. Build one in the Build tab.', '', 2); return; }
    disarm(); G.placing = false; G.placingPost = false; closeMenu();
    const cur = G.sel && G.sel.kind === 'forager' ? list.findIndex(u => u.id === G.sel.id) : -1;
    G.sel = { kind: 'forager', id: list[(cur + 1) % list.length].id };
    play('tick');
  }
  function buy(type) {
    if (busy()) return;
    const sim = G.sim, S0 = sim.sides[ME], b = DS.BUILD[type];
    if (S0.queue.length >= DS.QUEUE_MAX) { play('deny'); toastOnce('qf', `The queue is full at ${DS.QUEUE_MAX}. Tap an item in it to cancel.`, '', 2); return; }
    if (S0.nectar < b.cost) { play('deny'); toastOnce('nn', `Need ◆${b.cost} nectar. Foragers bring it home from the blooms.`, '', 2); return; }
    if (type === 'nest') {
      if (DS.nestCount(sim, ME) >= DS.NEST_MAX) { play('deny'); toastOnce('nm', 'You can have two Nests at a time.', '', 2); return; }
      G.placing = !G.placing; G.placingPost = false; G.movingPost = 0; disarm(); G.sel = null; closeMenu(); play('tick');
      return;
    }
    if (act('build', ME, type)) play('tick');
  }
  function cancelQueued(id) {
    const q = G.sim.sides[ME].queue.find(x => x.id === id);
    if (!q) return;
    act('cancelBuild', ME, id);
    const b = DS.BUILD[q.type];
    play('refund');
    toast(`Cancelled ${b.n > 1 ? units(b.n, q.type) : T[q.type].name}. ◆${b.cost} refunded.${q.auto ? ' Auto skips it for now.' : ''}`, '');
  }
  function toggleGuard() {
    if (G.mode !== 'play') return;
    act('setGuard', ME, !G.sim.sides[ME].guard);
    play('tick');
  }
  // Auto as the round has it (training starts with it off whatever you saved); the saved setting is for real rounds.
  const autoOn = () => (G.sim && G.mode === 'play' ? G.sim.sides[ME].auto : G.auto);
  function setAuto(on) {
    if (!G.training) { G.auto = !!on; store.set('auto', G.auto); }
    if (G.sim && G.mode === 'play') act('setAuto', ME, !!on);
    play('tick');
  }
  function setStance(st) {
    G.stance = st;
    for (const so of selSorties()) act('setStance', so.id, so.type === 'decoy' && selSorties().some(o => isStriker(o.type)) ? 'dash' : st);
    play('tick');
  }
  function recallSel() {
    const done = [];
    for (const so of selSorties()) if ((so.type === 'sting' || T[so.type].reuse) && act('recall', so.id)) done.push(so);
    if (!done.length) return;
    toast(`${done.map(so => units(so.units.length, so.type)).join(' + ')} heading home${done.some(so => T[so.type].reuse) ? ' to rearm' : ''}.`, 'amber');
    play('tick'); G.sel = null;
  }

  // ---------- posts ----------
  const postById = id => (G.sim ? G.sim.sides[ME].posts.find(p => p.id === id) : null);
  function postName(x, y) {
    const sim = G.sim, m = sim.map;
    let best = null, bd = 160;
    for (const f of m.fields) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
    if (best) return best.centre ? 'Crown' : best.name;
    for (const pk of m.peaks) if (Math.hypot(pk.x - x, pk.y - y) < 90) return `Ridge ▲${pk.elev}`;
    if (DS.ridgeAt(m, x, y)) return 'Ridge';
    if (DS.canopyAt(m, x, y)) return 'Canopy';
    for (const b of DS.basesOf(sim, ME)) if (Math.hypot(b.x - x, b.y - y) < 200) return b.type === 'heart' ? 'Heart' : 'Nest';
    if (Math.hypot(x - W / 2, y - H / 2) < 260) return 'Midfield';
    bd = 340; best = null;
    for (const f of m.fields) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
    return best ? `${best.centre ? 'Crown' : best.name} approach` : 'Open ground';
  }
  function staffOf(p) { return DS.postStaff(G.sim, ME, p); }
  const isShort = st => Object.values(st).some(v => v.on < v.need);
  function staffText(p, sep) {
    const st = staffOf(p);
    return DS.POST_TYPES.filter(t => st[t]).map(t => `${st[t].need === 1 ? T[t].name : PLURAL[t]} ${st[t].on}/${st[t].need}`).join(sep || ' · ');
  }
  function hitPost(X, Y) {
    if (!G.sim) return null;
    let best = null, bd = 16;
    for (const p of G.sim.sides[ME].posts) { const q = S2(p.x, p.y), d = Math.hypot(q.x - X, q.y - Y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function startPost() {
    if (busy()) return;
    if (G.sim.sides[ME].posts.length >= DS.POST_MAX) { play('deny'); toastOnce('pm', `You can keep ${DS.POST_MAX} posts. Remove one first.`, '', 2); return; }
    disarm(); G.sel = null; G.placing = false; G.movingPost = 0; closeMenu();
    G.placingPost = !G.placingPost; play('tick');
  }
  function removePostSel(id) {
    const p = postById(id);
    if (!p) return;
    act('removePost', ME, id);
    if (G.sel && G.sel.kind === 'post' && G.sel.id === id) G.sel = null;
    toast(`${p.name} post removed. Its Wardens head home.`, '');
    play('tick');
  }

  // ---------- quick menus ----------
  function openMenu(X, Y, title, items) {
    const el = $('qmenu');
    el.innerHTML = `<div class="qm-h">${title}</div>` + items.map((it, i) =>
      `<button role="menuitem" data-i="${i}"${it.off ? ' disabled' : ''}><svg class="i"><use href="#g-${it.icon}"/></svg><span class="qm-l">${it.label}</span><span class="qm-s">${it.sub || ''}</span></button>`).join('');
    el.hidden = false;
    const r = el.getBoundingClientRect(), top = $('top').offsetHeight + 4, bot = VH - $('dock').offsetHeight - 4;
    let x = X + 14, y = Y - r.height / 2;
    if (x + r.width > VW - 8) x = X - 14 - r.width;
    x = clamp(x, 8, Math.max(8, VW - r.width - 8)); y = clamp(y, top, Math.max(top, bot - r.height));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    G.menu = { items, X, Y };
    play('tick');
  }
  function closeMenu() { if (!G.menu) return; G.menu = null; $('qmenu').hidden = true; }
  const readyLine = (n, t) => `${units(n, t)} · ${readyOf(t)} ready`;
  function contactMenu(X, Y, c) {
    const st = !!c.static, look = c.known ? c.type : null;
    const k = st ? 6 : look && T[look].hp >= 2 ? 3 : 2;
    const g = { pts: [], c }, items = [];
    items.push({ icon: 'sting', label: st ? 'Raid' : 'Strike', sub: readyLine(k, 'sting'), off: !readyOf('sting'), run: () => sendMix({ sting: k }, g, st ? 'Raid' : 'Strike') });
    if (st || look === 'forager' || look === 'nest' || !look) items.push({ icon: 'raider', label: 'Bomb', sub: readyLine(1, 'raider'), off: !readyOf('raider'), run: () => sendMix({ raider: 1 }, g, 'Bomb run') });
    if (!st) items.push({ icon: 'warden', label: 'Intercept', sub: readyLine(1, 'warden'), off: !readyOf('warden'), run: () => sendMix({ warden: 1 }, g, 'Intercept') });
    openMenu(X, Y, cname(c), items);
  }
  function groundMenu(X, Y) {
    const sim = G.sim, w = toWorld(X, Y), g = { pts: [w], c: null }, S0 = sim.sides[ME];
    const nestErr = DS.nestSiteError(sim, ME, w.x, w.y) || (S0.nectar < DS.BUILD.nest.cost ? `Need ◆${DS.BUILD.nest.cost}` : '');
    const items = [
      { icon: 'glint', label: 'Scout here', sub: readyLine(1, 'glint'), off: !readyOf('glint'), run: () => sendMix({ glint: 1 }, g, 'Scout') },
      { icon: 'sting', label: 'Hunt here', sub: readyLine(4, 'sting'), off: !readyOf('sting'), run: () => sendMix({ sting: 4 }, g, 'Hunt') },
      { icon: 'warden', label: 'Patrol here', sub: readyLine(1, 'warden'), off: !readyOf('warden'), run: () => sendMix({ warden: 1 }, g, 'Patrol') },
      { icon: 'post', label: 'Post here', sub: S0.posts.length >= DS.POST_MAX ? `${DS.POST_MAX} posts already` : 'the hive keeps it staffed', off: S0.posts.length >= DS.POST_MAX, run: () => openPostSheet(null, w) },
      { icon: 'nest', label: 'Grow a Nest', sub: nestErr ? nestErr.replace(/\.$/, '') : '◆80, joins the queue', off: !!nestErr, run: () => placeNest(w) },
    ];
    openMenu(X, Y, postName(w.x, w.y), items);
  }

  // ---------- training: a guided round on a fixed map with no rival commander ----------
  const TRAIN_SEED = 7729;
  const TR = { i: -1, t: 0, hinted: false, d: {}, hiEl: null };
  const homeAt = () => (cam.portrait ? 'at the bottom' : 'on the left'), cobaltAt = () => (cam.portrait ? 'at the top' : 'on the right');
  const sqName = i => `<b>${G.squads[i].name}</b>`;
  const crown = () => G.sim.map.fields[G.sim.map.fields.length - 1];
  const own = (type, f) => G.sim.units.filter(u => u.side === ME && u.type === type && u.hp > 0 && (!f || f(u)));
  // make sure n of a type are parked and ready (training tops you up rather than making you wait)
  function grant(type, n) {
    const sim = G.sim, h = sim.hearts[ME];
    for (let have = DS.parkedCount(sim, ME, type); have < n; have++) DS.spawnUnit(sim, ME, type, h.x, h.y);
  }
  // put cobalt drones in the air at a point, flying a route
  function cobalt(type, n, from, route, opts) {
    const sim = G.sim, h = sim.hearts[OP];
    for (let have = DS.parkedCount(sim, OP, type); have < n; have++) DS.spawnUnit(sim, OP, type, h.x, h.y);
    const so = DS.launch(sim, OP, type, n, route, Object.assign({ stance: 'quiet' }, opts || {}));
    if (!so) return null;
    for (const id of so.units) {
      const u = sim.byId.get(id), to = route[0] || from;
      u.x = u.px = from.x + (Math.random() - 0.5) * 24; u.y = u.py = from.y + (Math.random() - 0.5) * 24;
      u.hdg = Math.atan2(to.y - u.y, to.x - u.x);
    }
    return so;
  }
  const cobaltAlive = (type, ids) => G.sim.units.some(u => u.side === OP && u.type === type && u.hp > 0 && !u.parked && (!ids || ids.includes(u.id)));
  function ridgeMark() {
    const sim = G.sim, h = sim.hearts[ME];
    const ps = sim.map.peaks.filter(p => p.x < DS.W * 0.45).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    const p = ps[0] || { x: 480, y: 500 };
    return { x: p.x, y: p.y };
  }
  const TSTEPS = [
    { h: 'Your hive', p: () => `You command the amber hive: your Heart is ${homeAt()} and cobalt is ${cobaltAt()}. In this valley whatever is seen is killed, so the first job is seeing. In training the cobalt hive only does what the lesson needs, and there is no clock.`, next: 'Start' },
    { h: 'Scout', p: () => `Tap ${sqName(0)}, then tap the marked ridge. Glints are quiet scouts with long sight.`, hi: '#sq-0',
      enter: d => { d.mark = ridgeMark(); if (!own('glint').length) grant('glint', 1); },
      mark: d => ({ x: d.mark.x, y: d.mark.y, r: 26, label: 'RIDGE' }),
      tick: d => { if (!own('glint').length) grant('glint', 1); },
      check: d => own('glint', u => !u.parked && Math.hypot(u.x - d.mark.x, u.y - d.mark.y) < 45).length > 0,
      hint: 'Missed it? Tap your Glint on the map to select it, then tap the marked ridge.' },
    { h: 'Sight', p: () => 'On a ridge a Glint sees 30% further: the dashed ring is its sight. Ridges block sight unless you stand on one. Green dashed patches are <b>canopy</b>: anything under it is hard to see, yours included.', next: 'Next' },
    { h: 'Contact', p: () => 'A cobalt Glint has come over the ridge. Blue brackets mean your sensors hold it; red means a firing solution. <b>Tap it</b>, then choose <b>Strike</b>.',
      enter: d => {
        grant('sting', 4);
        const g = own('glint', u => !u.parked)[0], m = g ? { x: g.x, y: g.y } : ridgeMark(), h1 = G.sim.hearts[OP];
        const a = Math.atan2(h1.y - m.y, h1.x - m.x), at = r => ({ x: m.x + Math.cos(a) * r, y: m.y + Math.sin(a) * r });
        const so = cobalt('glint', 1, at(300), [at(64)]);
        d.ids = so ? so.units.slice() : [];
      },
      mark: d => { const u = G.sim.byId.get(d.ids[0]); return u && u.hp > 0 ? { x: u.x, y: u.y, r: 22, label: 'CONTACT', lock: true } : null; },
      tick: d => { const u = G.sim.byId.get(d.ids[0]); if (u && u.hp > 0) u.battery = 75; if (!readyOf('sting') && !own('sting', x => !x.parked).length) grant('sting', 2); },
      check: d => !cobaltAlive('glint', d.ids),
      hint: 'Tap the blue diamond inside the brackets. A menu offers Strike, Bomb or Intercept.', hintAfter: 12 },
    { h: 'Build', p: () => '<b>Nectar</b>, top left, pays for everything; Foragers bring it home from the blooms. Tap <b>Stings ×4</b> in the Build tab to queue four more.', hi: '#buy-sting',
      enter: () => { setTab('build'); G.sim.sides[ME].nectar = Math.max(G.sim.sides[ME].nectar, 120); },
      check: () => G.sim.sides[ME].queue.some(q => q.type === 'sting' && !q.auto) },
    { h: 'Auto build', p: () => 'Tapping every build gets busy in a fight. Turn on <b>Auto</b> and the hive keeps two items queued from your plan, rebuilding what you lose.', hi: '#btn-auto',
      check: () => G.sim.sides[ME].auto },
    { h: 'Your plan', p: () => 'Tap <b>Plan</b> to see what Auto builds: it works down the list and builds the first row below its target. The round pauses while the plan is open; tap Done when you have had a look.', hi: '#btn-plan',
      check: d => d.planSeen },
    { h: 'Strike', p: () => `Cobalt Foragers are working the marked bloom. Tap ${sqName(1)}, then drag a route from your Heart to it. Stings hunt along the route and dive on the first thing they find.`, hi: '#sq-1',
      enter: d => { grant('sting', 4); d.f = d.field; },
      mark: d => ({ x: d.f.x, y: d.f.y, r: d.f.r + 12, label: 'COBALT FORAGERS' }),
      check: d => [...G.sim.sorties.values()].some(so => so.side === ME && so.type === 'sting' && so.route.length && Math.hypot(so.route[so.route.length - 1].x - d.f.x, so.route[so.route.length - 1].y - d.f.y) < 130),
      hint: 'Press near your Heart and drag to the marked bloom before letting go. A single tap on the bloom works too.' },
    { h: 'On their way', p: () => 'Stings are spent on impact, so they are cheap to lose. Foragers flare while they harvest, which makes them easy to find. Wait for the hit, or carry on.', next: 'Next',
      enter: d => { d.k0 = G.sim.sides[ME].kills; },
      check: d => G.sim.sides[ME].kills > d.k0 || G.now - TR.t > 30 },
    { h: 'Set a post', p: () => 'A <b>post</b> is a spot the hive keeps staffed. <b>Press and hold</b> on the Crown bloom until a menu opens, choose <b>Post here</b>, then <b>Set post</b>.',
      enter: () => { grant('glint', 1); grant('warden', 2); },
      mark: () => ({ x: crown().x, y: crown().y, r: crown().r + 14, label: 'CROWN BLOOM' }),
      check: () => G.sim.sides[ME].posts.some(p => Math.hypot(p.x - crown().x, p.y - crown().y) < 140),
      hint: 'Hold your finger or the mouse button still on the Crown for half a second. Or open the Posts tab, tap + Post, then tap the Crown.' },
    { h: 'Standing orders', p: () => 'The hive sends a Glint and Wardens to the post and keeps them there, relieving the Glint before its battery fades. Open the <b>Posts</b> tab to see who is on station.', hi: '#tab-posts',
      check: () => G.tab === 'posts' },
    { h: 'Raid', p: () => 'A cobalt raid is heading for your Heart. With <b>Guard</b> on, parked Stings launch at drones that come close and the Heart fires its flak. Watch, or send a squad yourself.', hi: '#btn-guard',
      enter: d => {
        const sim = G.sim, h = sim.hearts[ME];
        grant('sting', 8); DS.setGuard(sim, ME, true);
        // in on a flank, wide of the Crown post so its Wardens leave the raid to the guard
        const side = h.y < DS.H / 2 ? -1 : 1, from = { x: h.x + 520, y: h.y + side * 330 }, mid = { x: h.x + 300, y: h.y + side * 230 };
        const so = cobalt('sting', 5, from, [mid, { x: h.x, y: h.y }], { mode: 'raid', target: h.id });
        d.ids = so ? so.units.slice() : [];
      },
      check: d => !cobaltAlive('sting', d.ids) && G.now - TR.t > 4 },
    { h: 'Hold the Crown', p: () => `In <b>Last Light</b> the Crown scores for whichever hive has more drones on it. It is scoring now and cobalt Stings are moving in: send ${sqName(2)} or ${sqName(1)} to hold it.`,
      enter: d => {
        const sim = G.sim, c = crown();
        sim.cfg.bloomScore = sim.t;
        grant('sting', 10); grant('decoy', 2);
        const so = cobalt('sting', 4, { x: c.x + 300, y: c.y - 60 }, [{ x: c.x + 10, y: c.y }], { mode: 'hunt' });
        d.ids = so ? so.units.slice() : [];
      },
      mark: () => ({ x: crown().x, y: crown().y, r: DS.HOLD_R, label: 'HOLD THE CROWN' }),
      check: () => G.sim.sides[ME].score >= 10,
      hint: 'Tap a squad, then tap the Crown. The score is the amber number at the top right.', hintAfter: 20 },
    { h: 'Ready', p: () => 'That is the hive: see first, strike cheaply, and leave the routine to Auto and your posts. A real round adds a rival that adapts, and a clock that ends in Last Light. Press and hold the map any time for quick orders; the pause menu explains the rest.', final: true,
      enter: () => { store.set('trained', true); syncTitle(); } },
  ];
  function trainStart() {
    TR.d = {};
    const sim = G.sim, m = sim.map, cf = m.fields.length - 1;
    // the cobalt Foragers work the bloom of theirs nearest the centre, away from their Heart's guard
    let fi = -1, bd = 1e9;
    m.fields.forEach((f, i) => { if (f.side === OP) { const d = Math.hypot(f.x - m.fields[cf].x, f.y - m.fields[cf].y); if (d < bd) { bd = d; fi = i; } } });
    for (const u of sim.units) if (u.side === OP && u.type === 'forager') DS.assignForager(sim, u.id, fi);
    TR.d.field = m.fields[fi];
    trainGo(0);
  }
  function trainGo(i) {
    const keep = { field: TR.d.field, planSeen: false };
    TR.i = i; TR.t = G.now; TR.hinted = false; TR.d = keep;
    const st = TSTEPS[i];
    if (st && st.enter) st.enter(TR.d);
    renderCoach();
  }
  function renderCoach() {
    const el = $('coach'), st = G.training ? TSTEPS[TR.i] : null;
    if (TR.hiEl) { TR.hiEl.classList.remove('coach-hi'); TR.hiEl = null; }
    app.classList.toggle('coaching', !!st);
    if (!st) app.classList.remove('coach-low');
    el.hidden = !st;
    if (!st) return;
    setText('coach-n', `Training · ${TR.i + 1} of ${TSTEPS.length}`);
    setText('coach-h', st.h);
    $('coach-p').innerHTML = st.p();
    const hint = $('coach-hint');
    hint.hidden = !TR.hinted || !st.hint;
    hint.textContent = st.hint || '';
    $('coach-btns').innerHTML = st.final ? '<button class="btn primary" data-act="tr-play">Play a short game</button><button class="btn" data-act="tr-title">Title screen</button>'
      : st.next ? `<button class="btn primary" data-act="tr-next">${st.next}</button>` : '';
    $('coach-skip').hidden = !!st.final;
    if (st.hi) { TR.hiEl = document.querySelector(st.hi); if (TR.hiEl) TR.hiEl.classList.add('coach-hi'); }
    requestAnimationFrame(placeCoach);
  }
  // Keep the card off the spot the lesson points at. Work out whether the mark would sit under the card at the top
  // of the map and at its foot, and pick: the top unless only the foot is clear. Deciding from both positions (rather
  // than moving whenever the mark is covered) keeps the card still when the mark is under it in either place.
  function placeCoach() {
    const el = $('coach');
    if (el.hidden) return;
    const dockH = $('dock').offsetHeight;
    app.style.setProperty('--dock-h', `${dockH}px`);
    const st = TSTEPS[TR.i], m = st && st.mark ? st.mark(TR.d) : null;
    let low = false;
    if (m) {
      const p = S2(m.x, m.y), h = el.offsetHeight, x0 = el.offsetLeft, x1 = x0 + el.offsetWidth, pad = 24 + (m.r || 0) * scale();
      const topY = VW <= 640 ? 52 : 56, lowY = VH - dockH - 8 - h;
      const under = y0 => p.x > x0 - pad && p.x < x1 + pad && p.y > y0 - pad && p.y < y0 + h + pad;
      low = under(topY) && !under(lowY);
    }
    if (app.classList.contains('coach-low') !== low) app.classList.toggle('coach-low', low);
    app.style.setProperty('--coach-b', `${low ? 46 : (VW <= 640 ? 52 : 56) + el.offsetHeight}px`);
  }
  function trainTick() {
    if (!G.training || G.mode !== 'play' || G.paused || G.sheet) return;
    const st = TSTEPS[TR.i];
    if (!st) return;
    if (st.tick) st.tick(TR.d);
    if (st.check && st.check(TR.d)) { play('chime'); trainGo(TR.i + 1); return; }
    if (st.hint && !TR.hinted && G.now - TR.t > (st.hintAfter || 15)) { TR.hinted = true; renderCoach(); }
  }
  function drawCoachMark() {
    const st = G.training ? TSTEPS[TR.i] : null;
    if (!st || !st.mark) return;
    const m = st.mark(TR.d);
    if (!m) return;
    const p = S2(m.x, m.y), r = Math.max(14, m.r * scale()), pulse = 0.5 + 0.5 * Math.sin(G.now * 4);
    ctx.strokeStyle = m.lock ? `rgba(255,94,77,${0.55 + 0.4 * pulse})` : `rgba(255,200,103,${0.5 + 0.45 * pulse})`;
    ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -G.now * 20;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 4 * pulse, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    label(p.x, p.y - r - 12, m.label, m.lock ? COL.lock : COL.amberHi);
  }
  $('coach').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'coach-skip') { store.set('trained', true); toTitle(); return; }
    const a = b.dataset.act;
    if (a === 'tr-next') { play('tick'); trainGo(TR.i + 1); }
    else if (a === 'tr-play') startRound(false);
    else if (a === 'tr-title') toTitle();
  });

  // ---------- input ----------
  const ptrs = new Map();
  let gest = null;
  function local(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  const LONG_PRESS = 480;
  function clearHold() { if (gest && gest.hold) { clearTimeout(gest.hold); gest.hold = 0; } }
  cv.addEventListener('pointerdown', e => {
    if (busy()) return;
    audioInit();
    if (G.menu) { closeMenu(); return; }
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
    const p = local(e);
    ptrs.set(e.pointerId, p);
    computeM(false);
    if (ptrs.size === 2) {
      clearHold();
      const [a, b] = [...ptrs.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gest = { kind: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: cam.z, mid, wmid: toWorld(mid.x, mid.y) };
      return;
    }
    if (e.button === 1 || e.button === 2) { gest = { kind: 'pan', lx: p.x, ly: p.y }; return; }
    gest = { kind: 'press', sx: p.x, sy: p.y, lx: p.x, ly: p.y, pts: [toWorld(p.x, p.y)], cur: null, hold: 0 };
    // press and hold with nothing armed or selected: quick orders for that spot or contact
    if (!G.armed && !G.sel && !G.placing && !G.placingPost && !G.movingPost) {
      const g0 = gest;
      g0.hold = setTimeout(() => {
        if (gest !== g0 || g0.kind !== 'press' || ptrs.size !== 1 || busy()) return;
        g0.kind = 'held'; g0.hold = 0;
        computeM(false);
        const c = hitContact(g0.sx, g0.sy);
        if (c) contactMenu(g0.sx, g0.sy, c); else groundMenu(g0.sx, g0.sy);
      }, LONG_PRESS);
    }
  });
  cv.addEventListener('pointermove', e => {
    const p = local(e);
    if (e.pointerType === 'mouse') G.hover = { x: p.x, y: p.y, mouse: true };
    if (!ptrs.has(e.pointerId) || !gest) return;
    ptrs.set(e.pointerId, p);
    computeM(false);
    if (gest.kind === 'pinch') {
      if (ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      cam.z = clamp((gest.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / gest.d0, 1, 3.2);
      clampCam(); computeM(false);
      const w2 = toWorld(mid.x, mid.y);
      const fs = cam.flip ? -1 : 1;
      cam.cx += fs * (gest.wmid.x - w2.x); cam.cy += fs * (gest.wmid.y - w2.y); clampCam();
      return;
    }
    if (gest.kind === 'press' && Math.hypot(p.x - gest.sx, p.y - gest.sy) > 9) {
      clearHold();
      gest.kind = !G.placing && !G.placingPost && (G.armed || (G.sel && G.sel.kind === 'sortie')) ? 'route' : 'pan';
    }
    if (gest.kind === 'pan') { panBy(p.x - gest.lx, p.y - gest.ly); gest.lx = p.x; gest.ly = p.y; return; }
    if (gest.kind === 'route') {
      const w = toWorld(p.x, p.y), lp = gest.pts[gest.pts.length - 1];
      if (Math.hypot(w.x - lp.x, w.y - lp.y) > 28) gest.pts.push(w);
      gest.cur = w;
    }
  });
  function endPtr(e, cancelled) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (!gest) return;
    clearHold();
    if (gest.kind === 'pinch') { if (!ptrs.size) gest = null; return; }
    const p = local(e);
    computeM(false);
    if (!cancelled) {
      if (gest.kind === 'press') tapAt(p.x, p.y);
      else if (gest.kind === 'route') {
        const pts = gest.pts.slice();
        const w = toWorld(p.x, p.y), lp = pts[pts.length - 1];
        if (Math.hypot(w.x - lp.x, w.y - lp.y) > 8) pts.push(w);
        commitRoute(pts);
      }
    }
    gest = null;
  }
  cv.addEventListener('pointerup', e => endPtr(e, false));
  cv.addEventListener('pointercancel', e => endPtr(e, true));
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') G.hover = null; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // Phones start a text selection or a callout on a long press; the map uses its own. Pointer events still arrive.
  cv.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('selectstart', e => {
    const el = e.target && (e.target.nodeType === 1 ? e.target : e.target.parentElement);
    if (!el || !el.closest('input, textarea')) e.preventDefault();
  });
  cv.addEventListener('wheel', e => {
    if (G.mode !== 'play') return;
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, cam.z * (e.deltaY < 0 ? 1.14 : 1 / 1.14));
  }, { passive: false });

  const BUILD_KEYS = { 1: 'forager', 2: 'glint', 3: 'sting', 4: 'decoy', 5: 'warden', 6: 'raider', 7: 'nest' };
  const SQUAD_KEYS = { q: 0, w: 1, e: 2, r: 3, t: 4 };
  window.addEventListener('keydown', e => {
    const tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA') { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeSheet(); } return; }
    if (tg === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (G.mode === 'title') { if (e.key === 'Enter' && $('lobby').hidden) startRound(false); return; }
    if (G.mode !== 'play') return;
    if (G.sheet) { if (e.key === 'Escape') closeSheet(); return; }
    if (e.key === 'Escape') {
      if (G.menu) closeMenu();
      else if (G.paused) resume();
      else if (G.armed || G.sel || G.placing || G.placingPost || G.movingPost) cancel();
      else pause();
      return;
    }
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'p') { G.paused ? resume() : pause(); return; }
    if (G.paused) return;
    if (BUILD_KEYS[k]) buy(BUILD_KEYS[k]);
    else if (k in SQUAD_KEYS) armSquad(SQUAD_KEYS[k]);
    else if (k === 'a') again();
    else if (k === 'b') setAuto(!autoOn());
    else if (k === 'f') pickForager();
    else if (k === 'd') setStance(G.stance === 'dash' ? 'quiet' : 'dash');
    else if (k === 'x') recallSel();
    else if (k === 'g') toggleGuard();
    else return;
  });

  // dock and overlay buttons
  for (let i = 0; i < DEFAULT_SQUADS.length; i++) {
    const el = $('sq-' + i);
    let hold = 0, held = false;
    el.addEventListener('click', () => { if (held) { held = false; return; } armSquad(i); });
    el.addEventListener('contextmenu', e => { e.preventDefault(); if (!busy()) openSquadSheet(i); });
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      held = false; clearTimeout(hold);
      hold = setTimeout(() => { if (!busy()) { held = true; openSquadSheet(i); } }, 520);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(hold));
  }
  for (const t of DS.BUILD_ORDER) $('buy-' + t).addEventListener('click', () => buy(t));
  $('queue').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) cancelQueued(+b.dataset.q); });
  $('btn-guard').addEventListener('click', toggleGuard);
  $('btn-auto').addEventListener('click', () => { if (G.mode === 'play') setAuto(!autoOn()); });
  $('btn-plan').addEventListener('click', () => { if (!busy()) openPlanSheet(); });
  for (const t of ['build', 'posts', 'flying']) $('tab-' + t).addEventListener('click', () => setTab(t));
  $('body-posts').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || busy()) return;
    if (b.dataset.act === 'addpost') { startPost(); return; }
    if (b.dataset.post) { const id = +b.dataset.post; disarm(); G.placing = false; G.sel = G.sel && G.sel.kind === 'post' && G.sel.id === id ? null : { kind: 'post', id }; play('tick'); }
  });
  $('body-flying').addEventListener('click', e => {
    const b = e.target.closest('[data-so]');
    if (!b || busy()) return;
    disarm(); G.placing = false; G.placingPost = false; selectSortie(+b.dataset.so); play('tick');
  });
  app.addEventListener('pointerdown', e => { if (G.menu && e.target !== cv && !e.target.closest('#qmenu')) closeMenu(); }, true);
  $('qmenu').addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (!b || !G.menu) return;
    const it = G.menu.items[+b.dataset.i];
    closeMenu();
    if (it && !it.off) it.run();
  });
  $('btn-sound').addEventListener('click', () => { audioInit(); setMuted(!G.muted); });
  $('btn-pause').addEventListener('click', () => (G.paused ? resume() : pause()));
  $('ctx-main').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'cancel') { cancel(); play('tick'); }
    else if (a === 'recall') recallSel();
    else if (a === 'quiet' || a === 'dash') setStance(a);
    else if (a === 'again') again();
    else if (a === 'edit-sq' && G.armedSq.length) openSquadSheet(G.armedSq[G.armedSq.length - 1]);
    else if (a === 'post-edit' && G.sel && G.sel.kind === 'post') openPostSheet(G.sel.id);
    else if (a === 'post-move' && G.sel && G.sel.kind === 'post') { G.movingPost = G.sel.id; G.sel = null; play('tick'); }
    else if (a === 'post-del' && G.sel && G.sel.kind === 'post') removePostSel(G.sel.id);
  });
  $('seg-diff').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    G.diff = b.dataset.d; store.set('diff', G.diff); syncTitle();
  });
  $('seg-round').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    G.round = b.dataset.r; store.set('round', G.round); syncTitle(); newSim('title');
  });
  $('btn-newmap').addEventListener('click', () => { G.seed = randSeed(); store.set('seed', G.seed); syncTitle(); newSim('title'); });
  $('btn-go').addEventListener('click', () => startRound(false));
  $('btn-train').addEventListener('click', () => startRound(true));
  $('btn-resume').addEventListener('click', resume);
  $('btn-restart').addEventListener('click', () => startRound(G.training));
  $('btn-quit').addEventListener('click', () => (NET.live ? leaveGame() : toTitle()));
  $('btn-again').addEventListener('click', () => startRound(false));
  $('btn-next').addEventListener('click', () => { G.seed = randSeed(); store.set('seed', G.seed); startRound(false); });
  $('btn-title').addEventListener('click', () => (G.wasNet ? leaveGame() : toTitle()));

  // ---------- dock tabs ----------
  function setTab(t) {
    G.tab = t;
    for (const k of ['build', 'posts', 'flying']) {
      $('tab-' + k).setAttribute('aria-selected', String(k === t));
      $('body-' + k).hidden = k !== t;
    }
    G.listKeys = {};
    play('tick');
  }

  // ---------- sheets: the plan, a squad, a post (the round pauses while one is open) ----------
  const glyph = t => `<svg class="i"><use href="#g-${t}"/></svg>`;
  function stepper(act, idx, val, lo, hi) {
    return `<span class="step"><button data-act="${act}-" data-r="${idx}" aria-label="Fewer"${val <= lo ? ' disabled' : ''}>&minus;</button><b>${val}</b><button data-act="${act}+" data-r="${idx}" aria-label="More"${val >= hi ? ' disabled' : ''}>+</button></span>`;
  }
  function openSheet(sheet) {
    closeMenu(); gest = null; ptrs.clear();
    G.sheet = sheet; G.sheetAt = performance.now();
    $('sheet').hidden = false;
    app.classList.add('sheet-on');
    renderSheet();
    $('sheet-done').focus({ preventScroll: true });
  }
  function closeSheet() {
    const sh = G.sheet;
    if (!sh) return;
    if (sh.kind === 'post' && sh.isNew) {
      if (DS.POST_TYPES.some(t => sh.need[t] > 0)) {
        const p = act('addPost', ME, sh.x, sh.y, sh.need, sh.pri, sh.name);
        if (p && p.id) G.sel = { kind: 'post', id: p.id };
        if (p) toast(`Post set at ${sh.name}. The hive keeps it staffed.`, 'amber');
      } else toast('No post set: it needed at least one unit.', '');
    }
    G.sheet = null;
    $('sheet').hidden = true;
    app.classList.remove('sheet-on');
    G.last = 0; G.ctxKey = ''; G.listKeys = {};
    if (sh.kind === 'squad') G.sqKey = '';
    if (sh.kind === 'plan' && G.training) TR.d.planSeen = true;
  }
  function openPlanSheet() { openSheet({ kind: 'plan' }); }
  function openSquadSheet(i) { disarm(); openSheet({ kind: 'squad', i }); }
  function openPostSheet(id, w) {
    if (id) { const p = postById(id); if (!p) return; openSheet({ kind: 'post', id }); return; }
    if (G.sim.sides[ME].posts.length >= DS.POST_MAX) { play('deny'); return; }
    disarm(); G.sel = null;
    const near = Math.hypot(w.x - W / 2, w.y - H / 2) < 160;
    openSheet({ kind: 'post', isNew: true, x: w.x, y: w.y, name: postName(w.x, w.y), need: near ? { glint: 1, warden: 2, decoy: 0 } : { glint: 1, warden: 1, decoy: 0 }, pri: near ? 2 : 1 });
  }
  function savePlan() {
    store.set('plan', G.plan);
    if (G.sim && G.mode === 'play') act('setPlan', ME, G.plan);
  }
  function renderSheet() {
    const sh = G.sheet, sim = G.sim;
    if (!sh) return;
    let k = NET.live ? 'Two players: the battle carries on' : 'Paused while you plan', h = '', body = '', done = 'Done';
    if (sh.kind === 'plan') {
      h = 'Production plan';
      const rows = G.plan.map((r, i) => {
        const now = DS.forceCount(sim, ME, r.type), step = DS.BUILD[r.type].n;
        return `<li${now >= r.want ? ' class="met"' : ''}><span class="pr-i">${i + 1}</span><span class="pr-mv"><button data-act="up" data-r="${i}" aria-label="Move up"${i ? '' : ' disabled'}>&#9650;</button><button data-act="down" data-r="${i}" aria-label="Move down"${i < G.plan.length - 1 ? '' : ' disabled'}>&#9660;</button></span>${glyph(r.type)}<span class="pr-n">${PLURAL[r.type]}<small>up to</small></span>${stepper('w', i, r.want, 0, PLAN_MAX[r.type]).replace(/data-act="w([-+])"/g, (m, sg) => `data-act="w${sg}" data-s="${step}"`)}<span class="pr-now">have ${now}</span><button class="pr-x" data-act="del" data-r="${i}" aria-label="Remove row">&times;</button></li>`;
      }).join('');
      body = `<div class="sh-row"><span class="sh-l">Auto build</span><div class="seg" role="group" aria-label="Auto build"><button data-act="auto1" aria-pressed="${autoOn()}">On</button><button data-act="auto0" aria-pressed="${!autoOn()}">Off</button></div></div>
        <div class="sh-row"><span class="sh-l">Start from</span><div class="chips">${Object.keys(PRESETS).map(n => `<button class="chip" data-act="preset" data-k="${n}">${n}</button>`).join('')}</div></div>
        <p class="sh-note">With Auto on, the hive keeps two items queued: the first row below its target, saving up for it rather than skipping ahead. Units in the air count, so losses are rebuilt. A type can appear twice to build in stages. Posts add what they need above these rows.</p>
        <ol class="plan-rows">${rows || '<li class="empty">No rows. Add a type below or start from a preset.</li>'}</ol>
        <div class="sh-row"><span class="sh-l">Add a row</span><div class="chips">${DS.PLAN_TYPES.map(t => `<button class="chip" data-act="add" data-t="${t}"${G.plan.length >= DS.PLAN_MAX_ROWS ? ' disabled' : ''}>${glyph(t)}${T[t].name}</button>`).join('')}</div></div>`;
    } else if (sh.kind === 'squad') {
      const sq = G.squads[sh.i];
      h = `Squad ${sh.i + 1}: ${sq.name}`;
      body = `<div class="sh-row"><label class="sh-l" for="sq-name">Name</label><input id="sq-name" maxlength="12" value="${sq.name.replace(/"/g, '&quot;')}" autocomplete="off" spellcheck="false"></div>
        <ul class="mix-rows">${SQUAD_TYPES.map(t => `<li>${glyph(t)}<span class="pr-n">${PLURAL[t]}</span>${stepper('m', t, sq.mix[t] || 0, 0, SQUAD_MAX[t])}<span class="pr-now">${readyOf(t)} ready</span></li>`).join('')}</ul>
        <p class="sh-note">One tap on the squad arms the whole mix. If some are not ready, the rest fly. Key ${'QWERT'[sh.i]} arms it from the keyboard.</p>
        <div class="btn-row"><button class="btn" data-act="sq-reset">Reset to ${DEFAULT_SQUADS[sh.i].name}</button></div>`;
    } else if (sh.kind === 'post') {
      const p = sh.isNew ? null : postById(sh.id);
      if (!sh.isNew && !p) { closeSheet(); return; }
      const need = sh.isNew ? sh.need : p.need, pri = sh.isNew ? sh.pri : p.pri, st = p ? staffOf(p) : {};
      h = sh.isNew ? `New post: ${sh.name}` : `Post: ${p.name}`;
      done = sh.isNew ? 'Set post' : 'Done';
      body = `<p class="sh-note">The hive keeps these here, sending ready units and relieving a Glint or Decoy before its battery fades. Wardens that go home to rearm are replaced. With Auto on, it builds what posts are short of first.</p>
        <ul class="mix-rows">${DS.POST_TYPES.map(t => `<li>${glyph(t)}<span class="pr-n">${PLURAL[t]}</span>${stepper('n', t, need[t] || 0, 0, DS.POST_CAP[t])}<span class="pr-now">${st[t] ? `${st[t].on} on station` : `${readyOf(t)} ready`}</span></li>`).join('')}</ul>
        <div class="sh-row"><span class="sh-l">Priority</span><div class="seg" role="group" aria-label="Priority">${[2, 1, 0].map(v => `<button data-act="pri" data-v="${v}" aria-pressed="${pri === v}">${PRI[v]}</button>`).join('')}</div></div>
        <div class="btn-row">${sh.isNew ? '<button class="btn" data-act="post-cancel">Cancel</button>' : '<button class="btn" data-act="post-move">Move</button><button class="btn danger" data-act="post-del">Remove post</button>'}</div>`;
      if (!NET.live) k = 'Paused while you set it';
    }
    setText('sheet-k', k); setText('sheet-h', h); setText('sheet-done', done);
    $('sheet-body').innerHTML = body;
  }
  // A long-press that opened the sheet can end with a stray tap on whatever now sits under the finger.
  const sheetFresh = () => performance.now() - (G.sheetAt || 0) < 350;
  $('sheet-done').addEventListener('click', () => { if (!sheetFresh()) closeSheet(); });
  $('sheet').addEventListener('click', e => { if (e.target === $('sheet') && !sheetFresh()) closeSheet(); });
  $('sheet-body').addEventListener('input', e => {
    if (e.target.id !== 'sq-name' || !G.sheet || G.sheet.kind !== 'squad') return;
    G.squads[G.sheet.i].name = e.target.value.trim().slice(0, 12) || DEFAULT_SQUADS[G.sheet.i].name;
    store.set('squads', G.squads); G.sqKey = '';
    setText('sheet-h', `Squad ${G.sheet.i + 1}: ${G.squads[G.sheet.i].name}`);
  });
  $('sheet-body').addEventListener('click', e => {
    const b = e.target.closest('button');
    const sh = G.sheet;
    if (!b || !sh || b.disabled || sheetFresh()) return;
    const a = b.dataset.act, r = b.dataset.r;
    if (sh.kind === 'plan') {
      const i = +r, P = G.plan;
      if (a === 'auto1' || a === 'auto0') setAuto(a === 'auto1');
      else if (a === 'preset') { G.plan = PRESETS[b.dataset.k].map(([type, want]) => ({ type, want })); toast(`Plan set to ${b.dataset.k}.`, 'amber'); }
      else if (a === 'up' && i > 0) [P[i - 1], P[i]] = [P[i], P[i - 1]];
      else if (a === 'down' && i < P.length - 1) [P[i + 1], P[i]] = [P[i], P[i + 1]];
      else if (a === 'del') P.splice(i, 1);
      else if (a === 'w-' || a === 'w+') { const st = +b.dataset.s || 1; P[i].want = clamp(P[i].want + (a === 'w+' ? st : -st), 0, PLAN_MAX[P[i].type]); }
      else if (a === 'add' && P.length < DS.PLAN_MAX_ROWS) { const t = b.dataset.t, have = DS.forceCount(G.sim, ME, t), st = DS.BUILD[t].n; P.push({ type: t, want: clamp(Math.ceil((have + st) / st) * st, st, PLAN_MAX[t]) }); }
      else return;
      savePlan();
    } else if (sh.kind === 'squad') {
      const sq = G.squads[sh.i];
      if (a === 'm-' || a === 'm+') { const st = SQUAD_STEP[r] || 1; sq.mix[r] = clamp((sq.mix[r] || 0) + (a === 'm+' ? st : -st), 0, SQUAD_MAX[r]); if (!sq.mix[r]) delete sq.mix[r]; }
      else if (a === 'sq-reset') G.squads[sh.i] = copySquads([DEFAULT_SQUADS[sh.i]])[0];
      else return;
      store.set('squads', G.squads); G.sqKey = '';
    } else if (sh.kind === 'post') {
      const p = sh.isNew ? null : postById(sh.id);
      if (a === 'n-' || a === 'n+') {
        const cur = sh.isNew ? sh.need : p.need, v = clamp((cur[r] || 0) + (a === 'n+' ? 1 : -1), 0, DS.POST_CAP[r]);
        if (sh.isNew) sh.need[r] = v; else act('editPost', ME, p.id, { need: { [r]: v } });
      } else if (a === 'pri') { const v = +b.dataset.v; if (sh.isNew) sh.pri = v; else act('editPost', ME, p.id, { pri: v }); }
      else if (a === 'post-cancel') { sh.isNew = false; G.sheet = null; $('sheet').hidden = true; app.classList.remove('sheet-on'); G.last = 0; G.ctxKey = ''; return; }
      else if (a === 'post-move' && p) { closeSheet(); G.movingPost = p.id; G.sel = null; toast('Tap the map where the post should move.', ''); return; }
      else if (a === 'post-del' && p) { closeSheet(); removePostSel(p.id); return; }
      else return;
    }
    play('tick');
    renderSheet();
  });

  // ---------- HUD ----------
  const setText = (id, v) => { const el = $(id); const s = String(v); if (el && el.textContent !== s) el.textContent = s; };
  function clockStr(t) { const s = Math.max(0, Math.ceil(t)); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; }
  const TIPS = [
    'Tap a <b>squad</b>, then tap the map or drag a route. Tap two squads to send them together.',
    '<b>Auto</b> keeps the queue full from your plan. Tap <b>Plan</b> to set what it builds.',
    'Tap a blue contact for quick orders: <b>Strike</b>, <b>Bomb</b> or <b>Intercept</b>.',
    'Press and hold open ground to scout, hunt, patrol, set a <b>post</b> or grow a Nest there.',
    'A <b>post</b> is a spot the hive keeps staffed. Put one on the Crown before Last Light.',
    'Long-press or right-click a squad to change its mix.',
    'Perch a <b>Glint</b> on a ridge to see further. Canopy hides what sits under it.',
    '<b>Decoys</b> look like Raiders to the rival and draw its fire.',
    'A <b>Nest</b> is a forward base. Parked Stings guard it as well as the Heart.',
    'Tap a Forager on the map, then a bloom, to move your harvest.',
  ];
  function ctxKey() {
    const sel = selSorties().map(so => so.type + so.units.length + so.stance).join(',');
    const post = G.sel && G.sel.kind === 'post' && postById(G.sel.id) ? staffText(postById(G.sel.id)) + postById(G.sel.id).pri : '';
    return [G.armedSq.join(','), G.group.map(t => G.mix[t] + ':' + readyOf(t)).join(','), G.placing, G.placingPost, G.movingPost, G.stance, G.sel ? G.sel.kind + G.sel.id : '', sel, post, G.again ? G.again.name : '', G.tipI].join('|');
  }
  function stanceSeg(st) {
    return `<div class="seg" role="group" aria-label="Stance"><button data-act="quiet" aria-pressed="${st === 'quiet'}">Quiet</button><button data-act="dash" aria-pressed="${st === 'dash'}">Dash</button></div>`;
  }
  function cancelBtn(word) { return `<button class="chip cancel" data-act="cancel" aria-label="${word}"><span class="x" aria-hidden="true">&times;</span><span class="w">${word}</span></button>`; }
  function armHint(types) {
    const one = types.length === 1 ? types[0] : null;
    if (one === 'glint') return 'Tap a point or drag a route.';
    if (one === 'warden') return 'Tap where to patrol, or a contact to intercept.';
    if (one === 'decoy') return 'They read as Raiders. Drag a route.';
    if (one === 'raider') return 'Drag a bombing route or tap a target.';
    return types.some(isStriker) ? 'Tap a contact or drag a route.' : 'Tap a point or drag a route.';
  }
  function renderCtx() {
    const key = ctxKey();
    if (key === G.ctxKey) return;
    G.ctxKey = key;
    let html = '';
    if (G.placing) {
      html = `<span class="ctx-text"><b>Placing a Nest.</b> Tap inside the amber rings.</span><span class="ctx-ctl">${cancelBtn('Cancel')}</span>`;
    } else if (G.placingPost || G.movingPost) {
      html = `<span class="ctx-text"><b>${G.movingPost ? 'Moving a post.' : 'Setting a post.'}</b> Tap where the hive should keep watch: a ridge, a bloom, the Crown.</span><span class="ctx-ctl">${cancelBtn('Cancel')}</span>`;
    } else if (G.armed) {
      const n = mixReady(G.mix), tot = mixSize(G.mix), lead = G.group.includes('decoy') && G.group.some(isStriker);
      html = `<span class="ctx-text"><b>${armName()}: ${mixText(G.mix)}${n < tot ? ` (${n} ready)` : ''}.</b> ${armHint(G.group)}${lead ? ' Decoys lead.' : ''}</span><span class="ctx-ctl">${G.group.length === 1 && G.group[0] === 'warden' ? '' : stanceSeg(G.stance)}${G.armedSq.length === 1 ? '<button class="chip" data-act="edit-sq">Edit</button>' : ''}${cancelBtn('Cancel')}</span>`;
    } else if (G.sel && G.sel.kind === 'sortie') {
      const list = selSorties();
      if (list.length) {
        const types = list.map(so => so.type), one = list.length === 1 ? list[0] : null;
        const canRecall = types.some(t => t === 'sting' || T[t].reuse);
        const hint = one && one.type === 'warden' ? 'Tap a new patrol point.' : one && (one.type === 'glint' || one.type === 'decoy') ? 'Drag a new route.' : 'Drag a new route or tap a target.';
        const name = list.slice().sort((a, b) => MIX_ORDER.indexOf(a.type) - MIX_ORDER.indexOf(b.type)).map(so => units(so.units.length, so.type)).join(' + ');
        const lbl = list[0].post ? `${(postById(list[0].post) || {}).name || 'Post'} post: ` : list[0].label && list[0].label !== 'Guard' ? `${list[0].label}: ` : one ? '' : 'Group: ';
        html = `<span class="ctx-text"><b>${lbl}${name} selected.</b> ${hint}</span><span class="ctx-ctl">${one && one.type === 'warden' ? '' : stanceSeg(list.find(so => so.type !== 'decoy') ? list.find(so => so.type !== 'decoy').stance : list[0].stance)}${canRecall ? '<button class="chip" data-act="recall">Recall</button>' : ''}${cancelBtn('Done')}</span>`;
      } else G.sel = null;
    } else if (G.sel && G.sel.kind === 'forager') {
      html = `<span class="ctx-text"><b>Forager selected.</b> Tap a bloom to send it there.</span><span class="ctx-ctl">${cancelBtn('Cancel')}</span>`;
    } else if (G.sel && G.sel.kind === 'post') {
      const p = postById(G.sel.id);
      if (p) html = `<span class="ctx-text"><b>Post ${p.name}, ${PRI[p.pri].toLowerCase()} priority.</b> ${staffText(p)}.</span><span class="ctx-ctl"><button class="chip" data-act="post-edit">Edit</button><button class="chip" data-act="post-move">Move</button><button class="chip" data-act="post-del">Remove</button>${cancelBtn('Done')}</span>`;
      else G.sel = null;
    }
    if (!html) html = `<span class="ctx-text">${TIPS[G.tipI % TIPS.length]}</span>${G.again ? `<span class="ctx-ctl"><button class="chip again" data-act="again" title="Send ${G.again.name} again the same way (A)">Again: ${G.again.name}</button></span>` : ''}`;
    $('ctx-main').innerHTML = html;
  }
  function renderSquads() {
    const key = G.squads.map(q => q.name + JSON.stringify(q.mix)).join('|');
    if (key !== G.sqKey) {
      G.sqKey = key;
      G.squads.forEach((q, i) => {
        const types = mixTypes(q.mix), main = ['raider', 'warden', 'sting', 'glint', 'decoy'].find(t => q.mix[t]) || 'sting';
        const el = $('sq-' + i);
        el.innerHTML = `<svg class="i gly"><use href="#g-${main}"/></svg><span class="nm">${q.name}</span><span class="sub">${types.length ? mixText(q.mix, ' · ') : 'empty: tap to set'}</span><span class="ct" id="sqr-${i}">0</span><span class="meter"><i id="sqm-${i}"></i></span>`;
        el.title = `${q.name}: ${types.length ? mixText(q.mix) : 'empty'} (key ${'QWERT'[i]}). Long-press or right-click to edit.`;
        el.setAttribute('aria-label', `${q.name}: ${types.length ? mixText(q.mix) : 'empty'}. Long-press or right-click to edit.`);
      });
    }
    G.squads.forEach((q, i) => {
      const tot = mixSize(q.mix), r = tot ? mixReady(q.mix) : 0;
      setText('sqr-' + i, r);
      $('sq-' + i).classList.toggle('part', r > 0 && r < tot);
      $('sqm-' + i).style.setProperty('--m', tot ? (r / tot).toFixed(3) : '0');
      const el = $('sq-' + i);
      el.classList.toggle('armed', G.armedSq.includes(i));
      el.classList.toggle('empty', !r);
    });
  }
  function renderQueue() {
    const S0 = G.sim.sides[ME], q = S0.queue;
    const key = q.map(x => x.id + (x.auto ? 'a' : '')).join(',');
    const box = $('queue');
    if (key !== G.qKey) {
      G.qKey = key;
      box.innerHTML = q.map((it, i) => {
        const b = DS.BUILD[it.type], nm = b.n > 1 ? units(b.n, it.type) : T[it.type].name;
        return `<button class="qchip${i === 0 ? ' head' : ''}${it.auto ? ' auto' : ''}" data-q="${it.id}" aria-label="Cancel ${nm}${it.auto ? ' (auto)' : ''}, refund ${b.cost} nectar" title="${it.auto ? 'Queued by Auto. ' : ''}Cancel and refund ◆${b.cost}"><svg class="i"><use href="#g-${it.type}"/></svg>${b.n > 1 ? `<span class="n">×${b.n}</span>` : ''}<span class="x" aria-hidden="true">×</span><i class="qp"></i></button>`;
      }).join('');
      setText('q-count', q.length > 2 ? `${q.length}/${DS.QUEUE_MAX}` : '');
    }
    const head = box.firstElementChild;
    if (head && q[0]) head.style.setProperty('--p', (1 - q[0].t / q[0].total).toFixed(3));
    // what auto build is doing
    let st = '', warn = false;
    if (!S0.auto) st = q.length ? '' : 'Queue empty. Tap a button below, or turn on Auto.';
    else {
      const nx = DS.autoNext(G.sim, ME);
      if (!nx) st = q.length ? 'Auto: plan met' : 'Auto: plan met. Raise a target in Plan to build more.';
      else {
        const nm = DS.BUILD[nx.type].n > 1 ? PLURAL[nx.type] : T[nx.type].name;
        if (q.length >= DS.AUTO_QUEUE) st = `Auto, next: ${nm}${nx.from === 'post' ? ' for a post' : ''}`;
        else {
          const rate = G.rateNow || 0, short = nx.cost - S0.nectar;
          st = `Auto: saving for ${nm} ◆${nx.cost}${rate > 0.2 ? `, about ${Math.ceil(short / rate)} s` : ''}`;
          warn = true;
        }
      }
    }
    setText('q-status', st);
    $('q-status').classList.toggle('wait', warn);
  }
  const SO_STATE = so => {
    const sim = G.sim;
    let lead = null;
    for (const id of so.units) { const u = sim.byId.get(id); if (u) { lead = u; break; } }
    if (!lead) return '';
    if (lead.homing || so.mode === 'home') return 'heading home';
    if (lead.diving) return 'diving';
    if (so.mode === 'raid') return 'raiding';
    if (so.mode === 'strike') return 'striking';
    if (so.mode === 'guard') return 'intercepting';
    if (lead.wp < so.route.length) return 'en route';
    if (so.type === 'warden') return 'patrolling';
    if (so.mode === 'hunt' || so.type === 'sting') return 'hunting';
    if (so.type === 'raider') return 'bombing';
    return so.type === 'glint' ? 'watching' : 'loitering';
  };
  function renderLists() {
    const sim = G.sim, S0 = sim.sides[ME];
    // posts
    const posts = S0.posts;
    let short = 0;
    const pinfo = posts.map(p => { const st = staffOf(p), sh = isShort(st); if (sh) short++; return { p, st, sh }; });
    const tbp = $('tb-posts');
    tbp.textContent = posts.length ? String(posts.length) : '';
    tbp.className = 'tb' + (short ? ' warn' : '');
    // flying: packages in the air on your orders (not guard or posts)
    const pk = new Map();
    for (const so of sim.sorties.values()) {
      if (so.side !== ME || !so.units.length || so.label === 'Guard' || so.post) continue;
      const k = so.pkg ? 'p' + so.pkg : 's' + so.id;
      if (!pk.has(k)) pk.set(k, { id: so.id, label: so.label, mix: {}, born: so.born, list: [] });
      const e = pk.get(k);
      e.mix[so.type] = (e.mix[so.type] || 0) + so.units.length; e.list.push(so);
    }
    const fl = [...pk.values()].sort((a, b) => b.born - a.born);
    setText('tb-flying', fl.length ? String(fl.length) : '');
    if (G.tab === 'posts') {
      const sel = G.sel && G.sel.kind === 'post' ? G.sel.id : 0;
      const key = pinfo.map(({ p, st, sh }) => p.id + p.name + p.pri + JSON.stringify(st) + sh).join('|') + sel + G.placingPost;
      if (key !== G.listKeys.posts) {
        G.listKeys.posts = key;
        const add = `<button class="dcard add${G.placingPost ? ' on' : ''}" data-act="addpost"${posts.length >= DS.POST_MAX ? ' disabled' : ''}><span class="c-n">+ Post</span><span class="c-s">${posts.length >= DS.POST_MAX ? `${DS.POST_MAX} at most` : 'then tap the map'}</span></button>`;
        const cards = pinfo.map(({ p, st, sh }) => `<button class="dcard${sh ? ' short' : ''}${p.id === sel ? ' sel' : ''}" data-post="${p.id}"><span class="c-n">${p.name}<em class="pri p${p.pri}">${PRI[p.pri]}</em></span><span class="c-s">${DS.POST_TYPES.filter(t => st[t]).map(t => `${glyph(t)}${st[t].on}/${st[t].need}`).join(' ')}</span></button>`).join('');
        $('body-posts').innerHTML = add + cards + (posts.length ? '' : '<p class="cards-note">A post is a spot the hive keeps staffed with Glints, Wardens or Decoys. Press and hold the map for <b>Post here</b>.</p>');
      }
    } else if (G.tab === 'flying') {
      const sel = selSet();
      const key = fl.map(e => e.id + JSON.stringify(e.mix) + SO_STATE(e.list[0]) + e.list.some(so => sel.has(so.id))).join('|');
      if (key !== G.listKeys.flying) {
        G.listKeys.flying = key;
        $('body-flying').innerHTML = fl.length ? fl.map(e => `<button class="dcard${e.list.some(so => sel.has(so.id)) ? ' sel' : ''}" data-so="${e.id}"><span class="c-n">${e.label || 'Sortie'}<em>${SO_STATE(e.list.find(so => isStriker(so.type)) || e.list[0])}</em></span><span class="c-s">${mixTypes(e.mix).map(t => `${glyph(t)}${e.mix[t]}`).join(' ')}</span></button>`).join('')
          : '<p class="cards-note">Nothing in the air on your orders. Tap a squad, then the map. Guard and post flights are not listed here.</p>';
      }
    }
  }
  function hud() {
    const sim = G.sim;
    if (!sim || G.mode === 'title') return;
    const S0 = sim.sides[ME], C = sim.cfg;
    setText('nectar', Math.floor(S0.nectar));
    G.rateHist.push({ t: sim.t, h: S0.harvested });
    while (G.rateHist.length > 2 && sim.t - G.rateHist[0].t > 30) G.rateHist.shift();
    const h0 = G.rateHist[0], dt = sim.t - h0.t;
    G.rateNow = dt > 2 ? (S0.harvested - h0.h) / dt : 0;
    setText('rate', `+${G.rateNow.toFixed(1)}/s`);
    setText('clock', G.training ? `${TR.i + 1}/${TSTEPS.length}` : clockStr(C.round - sim.t));
    setText('phase', G.training ? 'Training' : sim.phases[sim.phase].name);
    trainTick();
    if (G.training) placeCoach();
    $('clockbox').classList.toggle('late', sim.phase === 3);
    setText('sc0', Math.floor(S0.score)); setText('sc1', Math.floor(sim.sides[OP].score));
    $('hold').className = 'hold' + (sim.t >= C.bloomScore && sim.holder >= 0 ? ' h' + vs(sim.holder) : '');
    renderSquads();
    // build tab
    let nF = 0;
    for (const u of sim.units) if (u.side === ME && u.type === 'forager' && u.hp > 0) nF++;
    setText('bk-forager', nF);
    setText('bk-nest', `${DS.nestCount(sim, ME)}/${DS.NEST_MAX}`);
    for (const t of DS.BUILD_ORDER) {
      const b = DS.BUILD[t], el = $('buy-' + t);
      el.disabled = S0.nectar < b.cost || S0.queue.length >= DS.QUEUE_MAX || (t === 'nest' && DS.nestCount(sim, ME) >= DS.NEST_MAX && !G.placing);
      if (t === 'nest') el.classList.toggle('armed', G.placing);
    }
    renderQueue();
    const ab = $('btn-auto');
    ab.classList.toggle('on', S0.auto); ab.setAttribute('aria-pressed', String(S0.auto));
    renderLists();
    const gb = $('btn-guard');
    gb.classList.toggle('on', S0.guard); gb.setAttribute('aria-pressed', String(S0.guard));
    setText('guard-l', S0.guard ? 'Guard on' : 'Guard off');
    if (G.now - G.tipT > 9) { G.tipT = G.now; G.tipI++; }
    // two players: show when the battle is held up waiting for the rival's orders; give up after a long silence
    $('wait').hidden = !(NET.live && NET.waiting && !G.paused && G.now - NET.waitT > 0.8);
    if (NET.live && NET.waiting && !G.paused && G.now - NET.waitT > 15) netProblem('slow');
    renderCtx();
    flushAgg();
    if (!G.warnedLL && sim.t > C.bloomScore - 20 && sim.t < C.bloomScore) {
      G.warnedLL = true;
      const onCrown = S0.posts.some(p => Math.hypot(p.x - W / 2, p.y - H / 2) < DS.HOLD_R);
      toast(onCrown ? 'Last Light in 20 seconds. Your Crown post is staffed; add Stings to hold it.' : 'Last Light in 20 seconds. Get drones onto the Crown bloom, or set a post there.', 'bloom');
      play('chime');
    }
    // raid warning
    if (G.now - G.raidT > 12 && !sim.over) {
      const hh = sim.hearts[ME];
      let n = 0;
      for (const c of S0.pic.values()) {
        if (c.static || (c.grade === 0 && !(c.lockUntil > sim.t))) continue;
        if (c.known && c.type !== 'sting' && c.type !== 'raider') continue;
        const p = c.grade === 1 ? { x: c.gx, y: c.gy } : { x: c.x, y: c.y };
        if (Math.hypot(p.x - hh.x, p.y - hh.y) < 480) n++;
      }
      if (n >= 4) { G.raidT = G.now; toast(`Raid inbound: ${n} contacts closing on your Heart`, 'lock'); play('alarm'); }
    }
  }

  // ---------- modes ----------
  function newSim(mode, net) {
    const seed = mode === 'training' ? TRAIN_SEED : net ? net.seed : G.seed;
    G.sim = mode === 'training' ? DS.createSim({ seed, diff: 'normal', mode: 'training', ai: [] })
      : net ? DS.createSim({ seed, diff: 'normal', mode: net.round, ai: [] })     // two players: no computer on either side
      : DS.createSim({ seed, diff: G.diff, mode: G.round, ai: mode === 'title' ? [0, 1] : [1] });
    G.fx = []; G.trails.clear(); G.acc = 0; G.vis = []; G.visT = -1;
    disarm(); G.pkgSeq = 1; G.sel = null; G.placing = false; G.placingPost = false; G.movingPost = 0; G.again = null; closeMenu();
    G.rateHist = []; G.rateNow = 0; G.endShown = false; G.ctxKey = ''; G.qKey = '-'; G.sqKey = ''; G.listKeys = {};
    if (mode === 'play') { act('setPlan', ME, G.plan); act('setAuto', ME, G.auto); }
    if (mode === 'training') DS.setPlan(G.sim, ME, G.plan);   // Auto starts off: the lesson turns it on
    G.agg = { mine: {}, theirs: {}, t: 0, val: 0 }; G.thr = {}; G.raidT = -99; G.overT = 0; G.warnedLL = false; G.firstNest = true;
    if (G.terrainSeed !== seed) { G.terrain = renderTerrain(G.sim.map); G.terrainSeed = seed; }
  }
  function hideOverlays() { $('ov-title').hidden = true; $('ov-pause').hidden = true; $('ov-end').hidden = true; app.classList.remove('overlay-on'); }
  // net = { seed, round, me } for a two-player round; otherwise a round against the computer (or training)
  function startRound(training, net) {
    audioInit();
    if (G.sheet) closeSheet();
    if (!net && NET.role) { send({ t: 'bye' }); netReset(); dropJoinParam(); }
    hideOverlays(); closeLobby(); $('ov-net').hidden = true; $('wait').hidden = true;
    G.mode = 'play'; G.paused = false; G.training = training === true; G.wasNet = !!net;
    ME = net ? net.me : 0; OP = 1 - ME; cam.flip = ME === 1;
    app.className = 'mode-play';
    $('toasts').innerHTML = '';
    newSim(G.training ? 'training' : 'play', net);
    renderSquads(); G.ctxKey = ''; renderCtx();   // fill the dock before measuring it, so the map's orientation is picked right
    cam.z = 1;
    layout();
    G.tipI = 0; G.tipT = G.now; G.tab = 'build'; setTab('build');
    if (G.training) { banner('Training', 'Learn the hive in about five minutes'); play('chime'); trainStart(); return; }
    renderCoach();
    banner('Pollination', G.sim.phases[0].line);
    play('chime');
    setTimeout(() => {
      if (G.mode !== 'play' || G.training) return;
      const mine = cam.portrait ? 'at the bottom' : 'on the left', theirs = cam.portrait ? 'at the top' : 'on the right';
      toast(net ? `Two players: you are amber, ${mine}. Your friend is cobalt, ${theirs}.` : `Your Heart is amber, ${mine}. Cobalt is ${theirs}.`, 'amber');
    }, 900);
    if (G.auto && !store.get('autoTold', false)) {
      store.set('autoTold', true);
      setTimeout(() => { if (G.mode === 'play') toast('Auto build is on: the hive keeps your plan topped up. Tap Plan to change it.', 'amber'); }, 3200);
    }
    store.set('seed', G.seed);
  }
  function toTitle() {
    if (G.sheet) closeSheet();
    hideOverlays(); $('ov-net').hidden = true; $('wait').hidden = true;
    G.mode = 'title'; G.paused = false; G.training = false; G.wasNet = false;
    ME = 0; OP = 1; cam.flip = false;
    renderCoach();
    app.className = 'mode-title';
    $('ov-title').hidden = false;
    newSim('title');
    cam.z = 1;
    layout();
    syncTitle();
  }
  // In a two-player round a pause stops both players; either can resume.
  function pause(fromRival) {
    if (G.mode !== 'play' || G.paused) return;
    if (G.sheet) closeSheet();
    closeMenu();
    G.paused = true; gest = null; ptrs.clear();
    if (NET.live && fromRival !== true) send({ t: 'pause' });
    setText('pause-k', fromRival === true ? 'Paused by your rival' : `Paused at ${clockStr(G.sim.cfg.round - G.sim.t)} left`);
    $('btn-restart').hidden = NET.live;
    setText('btn-quit', NET.live ? 'Leave game' : 'Title screen');
    $('ov-pause').hidden = false;
    app.classList.add('overlay-on');
    $('btn-resume').focus({ preventScroll: true });
  }
  function resume(fromRival) {
    if (!G.paused) return;
    if (NET.live && fromRival !== true) send({ t: 'resume' });
    G.paused = false;
    $('ov-pause').hidden = true;
    app.classList.remove('overlay-on');
    G.last = 0;
  }
  function syncTitle() {
    setText('mapno', String(G.seed));
    $('train-hint').hidden = !!store.get('trained', false);
    for (const b of $('seg-diff').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.d === G.diff));
    for (const b of $('seg-round').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.r === G.round));
    const md = DS.MODES[G.round];
    setText('kick-mode', `${md.name.toLowerCase()}, ${md.minutes} minutes`);
  }
  const topKey = o => { let best = null, bv = 0; for (const [k, v] of Object.entries(o || {})) if (v > bv) { bv = v; best = k; } return best; };
  function verdict(sim) {
    const a = sim.sides[ME], b = sim.sides[OP], won = sim.winner === ME, lost = sim.winner === OP;
    const sa = Math.floor(a.score), sb = Math.floor(b.score), lines = [];
    if (sim.reason === 'heart') {
      if (won) { const k = topKey(a.heartDealtBy); lines.push(`Your ${k ? PLURAL[k] : 'raids'} broke through their flak and guard, which ends the round early.`); }
      else {
        const k = topKey(a.heartTakenBy);
        lines.push(`What beat you: their ${k ? PLURAL[k] : 'raids'} landed ${a.heartTakenBy[k] || 0} of the ${a.heartTaken} hits on your Heart.`);
        lines.push('Keep Stings parked for the guard, and put a Warden on the approach they use.');
      }
    } else if (Math.abs(a.score - b.score) <= 0.5) {
      lines.push(`The Crown finished level at ${sa} to ${sb}, so the cost exchange decided it.`);
    } else if (won) {
      lines.push(`You held the Crown for ${sa} seconds to their ${sb}.`);
    } else {
      lines.push(`What beat you: Cobalt held the Crown for ${sb} seconds to your ${sa}.`);
      lines.push('Have Wardens and Stings on the Crown bloom when Last Light begins.');
    }
    const lt = topKey(a.lostTo);
    if (lost && lt && a.lostTo[lt] >= 60) lines.push(`Your heaviest losses came from their ${PLURAL[lt] || lt}: ◆${a.lostTo[lt]} of units.`);
    return lines;
  }
  function showEnd() {
    if (G.endShown || G.mode !== 'play') return;
    G.endShown = true; G.mode = 'end';
    const sim = G.sim, a = sim.sides[ME], b = sim.sides[OP], won = sim.winner === ME, lost = sim.winner === OP, C = sim.cfg;
    const recKey = G.wasNet ? `2p-${NET.round}` : `${G.diff}-${G.round}`;
    const rec = store.get('record2', {});
    const r = rec[recKey] || { w: 0, l: 0, d: 0 };
    if (!G.training) { if (won) r.w++; else if (lost) r.l++; else r.d++; rec[recKey] = r; store.set('record2', rec); }
    setText('end-k', sim.reason === 'heart' ? `Heart destroyed with ${clockStr(C.round - sim.t)} left` : 'Frost at 0:00');
    const h = $('end-h');
    h.textContent = sim.reason === 'heart' ? (won ? 'Cobalt Heart destroyed' : 'Your Heart has fallen') : won ? 'Amber holds the valley' : lost ? 'Cobalt holds the valley' : 'Stalemate at frost';
    h.className = won ? 'win-a' : lost ? 'win-c' : '';
    $('end-p').innerHTML = verdict(sim).map(l => `<span>${l}</span>`).join(' ');
    const ce = a.destroyed / Math.max(1, a.lost);
    const unseen = a.exposure ? Math.round((a.unseen / a.exposure) * 100) : 100;
    let best = 'No sortie took more than ◆20 of value.';
    if (a.best) {
      const kl = Object.entries(a.best.killed).map(([t, n]) => (t === 'heart' ? pl(n, 'Heart hit') : units(n, t))).join(', ');
      best = `${units(a.best.n, a.best.type)} (◆${a.best.cost}) took ${kl} (◆${a.best.destroyed})`;
    }
    const rows = [
      ['Crown score', `<span class="a-ink">${Math.floor(a.score)}</span> : <span class="c-ink">${Math.floor(b.score)}</span>`],
      ['Cost exchange', `${ce.toFixed(1)} : 1`],
      ['Time unseen', `${unseen}%`],
      ['Nectar harvested', `◆${Math.round(a.harvested)}`],
      ['Destroyed', `${a.kills} · ◆${a.droneDestroyed}`],
      ['Lost', `${a.losses} · ◆${a.droneLost}`],
      ['Heart hits dealt : taken', `${a.heartDealt} : ${a.heartTaken}`],
      ['Brought home to rearm', `${a.returns} · ◆${a.recovered}`],
      ['Decoys drew', pl(a.decoyDrew, 'attack')],
      ['Nests lost', String(a.lostBy.nest || 0)],
    ];
    $('end-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('') +
      `<div class="wide"><dt>Best strike</dt><dd>${best}</dd></div>` +
      `<div class="wide"><dt>Record, ${G.wasNet ? `two players, ${DS.MODES[NET.round].name.toLowerCase()}` : `${DS.MODES[G.round].name.toLowerCase()} on ${G.diff}`}</dt><dd>${pl(r.w, 'win')}, ${r.l} ${r.l === 1 ? 'loss' : 'losses'}${r.d ? ', ' + pl(r.d, 'draw') : ''}</dd></div>`;
    $('ov-end').hidden = false;
    app.classList.add('overlay-on');
    play(won ? 'win' : 'lose');
    const note = $('end-net'); if (note) note.textContent = '';
    renderEndNet();
    (G.wasNet ? $('btn-rematch') : $('btn-again')).focus({ preventScroll: true });
  }

  // ---------- loop ----------
  function frame(ts) {
    requestAnimationFrame(frame);
    const now = ts / 1000;
    let rdt = G.last ? now - G.last : 0;
    G.last = now;
    if (rdt > 0.1) rdt = 0.1;
    G.now = now;
    const sim = G.sim;
    if (sim) {
      const running = !G.paused && !(G.sheet && !NET.live) && !sim.over && (G.mode === 'play' || G.mode === 'title');
      if (running && NET.live && G.mode === 'play') netAdvance(rdt);
      else if (running) {
        G.acc += rdt;
        let n = 0;
        while (G.acc >= DS.DT && n < 8) { DS.step(sim, DS.DT); G.acc -= DS.DT; n++; }
        if (n === 8) G.acc = 0;
      }
      drainEvents();
      updateTrails();
      if (G.mode === 'title' && sim.over && now - G.overT > 4) newSim('title');
    }
    updateFx(rdt);
    draw();
    if (now - G.hudT > 0.1) { G.hudT = now; hud(); audioFrame(); }
  }

  if (/debug/.test(location.search)) window.__ds = { G, DS, cam, TR, TSTEPS, NET, hashSim, get ME() { return ME; }, layout, S2, toWorld, computeM, draw, drawFog, computeVis, drawFields, drawUnits, drawLabels };

  // ---------- boot ----------
  function boot(data) {
    if (data && data.seed) G.seed = data.seed;
    if (data && data.diff && DS.DIFF[data.diff]) G.diff = data.diff;
    if (data && data.round && DS.MODES[data.round]) G.round = data.round;
    setMuted(G.muted);
    syncTitle();
    newSim('title');
    layout();
    if (QS.get('join')) joinGame(QS.get('join'));
    window.addEventListener('resize', layout);
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => layout()); ro.observe($('top')); ro.observe($('dock')); ro.observe(app); }
    document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') pause(); });
    window.addEventListener('pagehide', () => { if (NET.role) send({ t: 'bye' }); });   // closing the tab tells your rival at once
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { G.ctxKey = ''; });
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ seed: G.seed, diff: G.diff, round: G.round }));
    requestAnimationFrame(frame);
  }
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
  else boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
