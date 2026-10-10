/*
 * The Long Gallery: an iron-and-glass reading room in the castle.
 *
 * Draws the gallery from the bays in _data/gallery.yml (passed in as JSON by
 * _layouts/gallery.html), using the camera and furniture in library-kit.js.
 * The room runs left to right: the end wall with the stove and chairs, then
 * one bay per entry in gallery.yml, then plain stacks into the distance.
 *
 * Each bay is drawn by a template (TEMPLATES below). Two storeys of shelves
 * line the back wall behind an iron gallery; above them, a glass roof on iron
 * arches looks out on the rest of the castle. The hour and season come from
 * the visitor's clock. "Pixel art" redraws the same picture at 320px wide
 * with a limited palette and ordered dithering.
 */
(function () {
  'use strict';

  var dataEl = document.getElementById('gallery-data');
  var scroller = document.getElementById('scroller');
  if (!dataEl || !scroller || !window.LibraryKit) return;
  var DATA = JSON.parse(dataEl.textContent);
  var LK = window.LibraryKit, Kit = LK.Kit, seeded = LK.seeded, shade = LK.shade;

  // Camera and room. The picture is H tall; its width follows the screen.
  var H = 620, W = 1000, K = 0.62, F = 700, VY = 470, EYE = 160, VX = W * 0.62;
  var D = 420, ZF = -300, SPRING = 880, R = 360, ZC = D - R, GAL = 430;
  var S_BACK = K * F / (F + D);

  // Width of each template along the wall.
  var BAY_W = { 'shelf-and-table': 380, 'frame-wall': 380, 'alcove': 360, 'door': 380, 'curio': 380, 'stacks': 360 };
  var at = 420; // the fireside takes the first stretch, by the end wall
  var bays = DATA.bays.map(function (b) {
    var w = BAY_W[b.template] || 360, bay = Object.assign({}, b, { x0: at, x1: at + w });
    at += w;
    return bay;
  });
  var all = bays.slice();
  for (var fi = 0; fi < 6; fi++) { all.push({ id: 'stacks-' + fi, template: 'stacks', filler: true, x0: at, x1: at + 360 }); at += 360; }
  var X1 = at;
  function centre(b) { return (b.x0 + b.x1) / 2; }

  var LOOK = 0, CX_MIN = 0, CX_MAX = 0;
  function fitCamera() {
    VX = W * 0.62;
    LOOK = (VX - W / 2) / S_BACK;
    CX_MIN = -460 + VX / S_BACK; // the end wall and fireside just in view
    CX_MAX = Math.max(CX_MIN, centre(bays[bays.length - 1]) + LOOK);
  }
  fitCamera();

  // ---------------------------------------------------------------- colour

  var BOOKS = ['#7b2d26', '#2f4a5e', '#5d6b3a', '#9a742c', '#3f3152', '#a2532f', '#26443c', '#6b5a3a', '#8b3a4a', '#2e3a2a', '#b08a4a'];
  var PAL = {
    wood: '#6e4529', woodDark: '#3a2416', stone: '#b9b4a6', wall: '#cdc3ae', gilt: '#c8963e', brass: '#c8963e', copper: '#b0623a',
    iron: '#2c3838', lead: '#2c3838', books: BOOKS, door: '#3e4a48', panel: '#3e4a48', brick: '#8a5a44', tile: '#8a6a4a', tileDark: '#6a4a34'
  };
  var TOD = {
    morning: { top: '#9cc4e4', bottom: '#f6e2bd', haze: '#efdcc0', tint: '#ffcf8a', a: 0.08, lit: false, cloud: '#fff6e8' },
    afternoon: { top: '#7fb2dc', bottom: '#e6eef0', haze: '#d4e2ea', tint: '#ffe6b8', a: 0.04, lit: false, cloud: '#ffffff' },
    dusk: { top: '#2e3c6e', bottom: '#f0a070', haze: '#d89a7a', tint: '#ff9a5a', a: 0.16, lit: true, cloud: '#f4b090', stars: 0.35 },
    night: { top: '#060a1c', bottom: '#1b2650', haze: '#1b2650', tint: '#16204a', a: 0.48, lit: true, cloud: '#2a3256', stars: 0.9, moon: true }
  };
  var HILL = { spring: '#8db07a', summer: '#6e8a5e', autumn: '#a8804a', winter: '#dfe6ea' };
  var CASTLE = Kit.castle('iron', D);

  // ---------------------------------------------------------------- bays

  // Each template draws its bay's lower wall (wall) and what stands in front
  // of it (floor). The upper storey is the same everywhere except the door,
  // which gets the clock window.
  var TEMPLATES = {
    'shelf-and-table': {
      wall: function (S, b) { Kit.bookcase(S, b.x0 + 14, b.x1 - 14, 0, 380, D, PAL, 'low' + b.id); },
      floor: function (S, b, o) {
        var c = centre(b), z0 = D - 260, z1 = D - 160, r = seeded(b.id + 'papers');
        Kit.chesterfield(S, c, D - 118, 0, '#5a2a1e');
        Kit.table(S, c - 130, c + 130, z0, z1, PAL, { leather: '#2f5a44' });
        var n = Math.max(1, Math.min(12, b.count || 1));
        for (var i = 0; i < n; i++) Kit.sheet(S, c - 110 + r() * 200, 76.4 + i * 0.1, z0 + 15 + r() * 70, (r() - 0.5) * 1.2, '#efe6cf');
        Kit.openBook(S, c - 40, 76.6, z1 - 30, 0.1, '#5a2a2a');
        Kit.orrery(S, c + 80, 76.5, z0 + 35, PAL, o.t);
        Kit.stack(S, c - 100, 76.5, z0 + 25, 5, seeded(b.id + 's1'), PAL);
        Kit.readingLamp(S, c + 40, 76.5, z0 + 15, PAL, o.lit);
        Kit.globe(S, b.x1 - 45, D - 200, PAL);
        S.label(c, 130, z0, b.label);
      }
    },
    'frame-wall': {
      wall: function (S, b) {
        var c = centre(b);
        S.back(b.x0 + 10, b.x1 - 10, 0, 400, D - 1, PAL.panel);
        for (var pn = 0; pn < 4; pn++) {
          var px = b.x0 + 22 + pn * 84;
          S.path([[px, 18, D - 1.2], [px + 72, 18, D - 1.2], [px + 72, 380, D - 1.2], [px, 380, D - 1.2], [px, 18, D - 1.2]], '#2e3a38', 1.2);
        }
        var n = Math.max(1, Math.min(9, b.count || 1)), cols = 3;
        for (var i = 0; i < n; i++) Kit.certificate(S, c - 80 + (i % cols) * 56, 290 - Math.floor(i / cols) * 48, D - 2, PAL);
        // Pinned drawings and a gauge: a wall someone works at.
        S.back(c + 104, c + 164, 200, 280, D - 1.6, '#e9dcb8');
        S.path([[c + 112, 216, D - 1.7], [c + 128, 250, D - 1.7], [c + 154, 240, D - 1.7], [c + 144, 220, D - 1.7]], '#2a4a7a', 0.8);
        S.circle(c + 134, 276, D - 1.8, 1.6, '#a01e1e');
        S.back(c - 170, c - 120, 150, 200, D - 1.6, '#e6dcc4');
        Kit.gauge(S, c - 144, 320, D - 2, 18, PAL, 0.7);
        // A glazed specimen cabinet below.
        S.box(c - 110, c + 110, 0, 96, D - 70, D - 2, PAL.wood);
        S.back(c - 104, c + 104, 54, 92, D - 70.5, '#cfe2e0', { op: 0.3 });
        [-70, -20, 30, 80].forEach(function (dx, k) { S.ellipse(c + dx, 66, D - 40, 8, 8, ['#b8862a', '#5a7a5a', '#8a3a2a', '#c8c0a8'][k]); });
        S.label(c, 360, D - 20, b.label);
      }
    },
    'alcove': {
      wall: function (S, b) { Kit.bookcase(S, b.x0 + 14, b.x1 - 14, 0, 380, D, PAL, 'low' + b.id); },
      floor: function (S, b) {
        var c = centre(b);
        // The portrait on an articulated brass arm.
        S.box(c - 70, c + 70, 0, 8, D - 150, D - 130, PAL.iron);
        S.line([c, 8, D - 140], [c - 40, 140, D - 140], PAL.brass, 5);
        S.line([c - 40, 140, D - 140], [c, 200, D - 145], PAL.brass, 5);
        Kit.gear(S, c - 40, 140, D - 141, 14, 8, PAL.brass);
        Kit.portrait(S, c, 170, 110, 150, D - 150, PAL);
        S.label(c, 340, D - 150, b.label);
      }
    },
    'door': {
      upper: function (S, b, o) {
        // The clock window: a round window whose leading is a clock face.
        var cc = centre(b), cy = 700, rr = 120, cw = [];
        for (var k = 0; k <= 48; k++) { var ak = k / 48 * Math.PI * 2; cw.push([cc + rr * Math.cos(ak), cy + rr * Math.sin(ak), D]); }
        S.clip(cw); Kit.outside(S, CASTLE, cc - rr, cc + rr, cy - rr, cy + rr, o.sky); S.unclip();
        var now = o.now;
        for (var hh = 0; hh < 12; hh++) {
          var ah = hh / 12 * Math.PI * 2;
          S.line([cc, cy, D + 10], [cc + rr * Math.cos(ah), cy + rr * Math.sin(ah), D + 10], PAL.iron, 2);
          S.back(cc + (rr - 14) * Math.cos(ah) - 4, cc + (rr - 14) * Math.cos(ah) + 4, cy + (rr - 14) * Math.sin(ah) - 6, cy + (rr - 14) * Math.sin(ah) + 6, D + 9, PAL.gilt);
        }
        var ring = [];
        for (var q = 0; q <= 40; q++) { var aq = q / 40 * Math.PI * 2; ring.push([cc + rr * 0.5 * Math.cos(aq), cy + rr * 0.5 * Math.sin(aq), D + 10]); }
        S.path(ring, PAL.iron, 1.6);
        // Its hands keep the visitor's time.
        var mins = now.getMinutes(), hrs = now.getHours() % 12 + mins / 60;
        var am = Math.PI / 2 - mins / 60 * Math.PI * 2, ahr = Math.PI / 2 - hrs / 12 * Math.PI * 2;
        S.line([cc, cy, D + 8], [cc + 96 * Math.cos(am), cy + 96 * Math.sin(am), D + 8], '#151210', 4);
        S.line([cc, cy, D + 8], [cc + 66 * Math.cos(ahr), cy + 66 * Math.sin(ahr), D + 8], '#151210', 6);
        S.path(cw, PAL.brass, 12);
        var turn = o.t;
        Kit.gear(S, cc - 150, cy + 70, D - 2, 52, 16, PAL.brass, { rot: turn });
        Kit.gear(S, cc - 168, cy - 30, D - 3, 30, 10, PAL.copper, { rot: -turn * 1.6 });
        Kit.gear(S, cc + 150, cy - 60, D - 2, 44, 14, PAL.brass, { rot: -turn * 1.2 });
        Kit.gear(S, cc + 160, cy + 50, D - 3, 26, 9, PAL.copper, { rot: turn * 2 });
      },
      wall: function (S, b) {
        var c = centre(b), lx = c + 90;
        S.back(b.x0 + 10, b.x1 - 10, 0, 400, D - 1, PAL.panel);
        Kit.door(S, c - 70, D - 2, PAL);
        // A book lift on chains, up to the gallery.
        S.back(lx - 32, lx + 32, 0, 420, D - 3, '#1e2626');
        for (var cb = 0; cb < 7; cb++) S.line([lx - 32 + cb * 10.6, 0, D - 60], [lx - 32 + cb * 10.6, 420, D - 60], PAL.iron, 1.2);
        S.box(lx - 32, lx + 32, 0, 6, D - 62, D - 2, PAL.iron);
        S.box(lx - 28, lx + 28, 170, 176, D - 58, D - 6, PAL.brass);
        Kit.stack(S, lx, 176, D - 30, 5, seeded('lift'), PAL);
        S.line([lx - 12, 176, D - 30], [lx - 12, 470, D - 30], PAL.iron, 1);
        S.line([lx + 12, 176, D - 30], [lx + 12, 470, D - 30], PAL.iron, 1);
        S.box(lx + 36, lx + 46, 260, 320, D - 20, D - 10, '#4a4a48');
        S.label(c - 70, 250, D - 10, b.label);
      }
    },
    'curio': {
      wall: function (S, b) { Kit.bookcase(S, b.x0 + 14, b.x1 - 14, 0, 380, D, PAL, 'low' + b.id); },
      floor: function (S, b) {
        var c = centre(b);
        S.box(c - 70, c + 40, 0, 120, D - 250, D - 170, '#d9d3c4');
        S.poly([[c - 78, 0, D - 252], [c + 48, 0, D - 252], [c + 40, 44, D - 252], [c, 24, D - 252], [c - 60, 52, D - 252]], '#cbc4b3');
        S.line([c - 40, 118, D - 251], [c - 50, 20, D - 252], '#a8a294', 1);
        S.line([c + 10, 118, D - 251], [c + 20, 30, D - 252], '#a8a294', 1);
        S.label(c - 15, 150, D - 250, b.label);
      }
    },
    'stacks': {
      wall: function (S, b) { Kit.bookcase(S, b.x0 + 14, b.x1 - 14, 0, 380, D, PAL, 'low' + b.id); }
    }
  };

  // ---------------------------------------------------------------- scene

  function scene(o) {
    var t = TOD[o.tod];
    var S = new LK.Scene({ W: W, H: H, K: K, F: F, VX: VX, VY: VY, EYE: EYE, cx: o.cx, D: D, ZF: ZF, X1: X1, id: 'g' });
    var cx = o.cx;
    var sky = {
      top: t.top, bottom: t.bottom, haze: t.haze, hill: o.season === 'winter' ? HILL.winter : HILL[o.season], stone: o.tod === 'night' ? '#2a3044' : '#9c968c',
      roof: '#3e4a60', flag: '#9e2f2a', stars: t.stars, lit: t.lit, snow: o.season === 'winter', moon: t.moon ? [cx + 900, 3600] : null
    };
    o.sky = sky; o.lit = t.lit;
    Kit.skyDef(S, sky);
    // The stretch of the room in view, with some to spare.
    var vx0 = cx - VX / S_BACK - 300, vx1 = cx + (W - VX) / S_BACK + 300;
    var visible = all.filter(function (b) { return b.x1 > vx0 && b.x0 < vx1; });
    var edges = visible.map(function (b) { return b.x0; }).concat(visible.length ? [visible[visible.length - 1].x1] : []);
    function vault(a) { return [ZC + R * Math.cos(a), SPRING + R * Math.sin(a)]; }
    var rx0 = Math.max(0, vx0), rx1 = Math.min(X1, vx1);

    // ---- the glass roof, and the castle beyond it
    S.clip([[rx0, SPRING, D], [rx1, SPRING, D], [rx1, SPRING + R, ZC], [rx0, SPRING + R, ZC]]);
    Kit.outside(S, CASTLE, rx0 - 600, rx1 + 600, SPRING, 4600, sky);
    CASTLE.clouds.forEach(function (c) { S.ellipse(c[0], c[1], D + 2400, c[2], c[3], t.cloud, { op: o.tod === 'night' ? 0.35 : 0.75 }); });
    // An airship, drifting slowly along the gallery.
    var ax = 1500 + o.t * 40, ay = 3000, az = D + 1800;
    S.ellipse(ax, ay, az, 440, 120, o.tod === 'night' ? '#3a3430' : '#8a7a66');
    for (var rb = -3; rb <= 3; rb++) S.ellipse(ax + rb * 110, ay, az - 1, 6, 118 - Math.abs(rb) * 12, '#675b4c', { op: 0.6 });
    S.poly([[ax - 420, ay, az], [ax - 540, ay + 120, az], [ax - 520, ay, az], [ax - 540, ay - 120, az]], '#6a5a48');
    S.back(ax - 90, ax + 90, ay - 200, ay - 150, az, '#4a3a2a');
    for (var rg = -2; rg <= 2; rg++) S.line([ax + rg * 80, ay - 110, az], [ax + rg * 40, ay - 150, az], '#3a2e24', 1);
    if (t.lit) for (var gw = 0; gw < 5; gw++) S.back(ax - 76 + gw * 32, ax - 60 + gw * 32, ay - 190, ay - 166, az - 1, '#ffcc66');
    S.unclip();
    for (var g = 1; g <= 10; g++) { var vg = vault(g / 10 * Math.PI / 2); S.line([rx0, vg[1], vg[0]], [rx1, vg[1], vg[0]], PAL.iron, 1.6); }
    for (var gx = Math.floor(rx0 / 60) * 60; gx < rx1; gx += 60) {
      var bar = [];
      for (var j = 0; j <= 12; j++) { var vb = vault(j / 12 * Math.PI / 2); bar.push([gx, vb[1], vb[0]]); }
      S.path(bar, PAL.iron, 0.9, { op: 0.8 });
    }
    if (o.season === 'winter') S.poly([[rx0, SPRING + 2, D - 2], [rx1, SPRING + 2, D - 2], [rx1, SPRING + 30, D - 30], [rx0, SPRING + 30, D - 30]], '#f2f5f7', { op: 0.85 });
    edges.forEach(function (x) {
      var arc = [], inner = [];
      for (var k = 0; k <= 16; k++) {
        var a = k / 16 * Math.PI / 2, va = vault(a);
        arc.push([x, va[1], va[0] - 2]);
        inner.push([x, SPRING - 40 + (R - 60) * Math.sin(a), ZC + (R - 60) * Math.cos(a) - 2]);
      }
      S.path(arc, PAL.iron, 9);
      S.path(inner, PAL.iron, 4);
      for (var q = 2; q < 16; q += 3) { var aq = q / 16 * Math.PI / 2; S.circle(x, SPRING - 20 + (R - 30) * Math.sin(aq), ZC + (R - 30) * Math.cos(aq) - 2, 9, 'none', { stroke: PAL.iron, sw: 2 }); }
    });

    // ---- the end wall: brick, shelves, and a clock with its works showing
    if (vx0 < 400) {
      var ew = [[0, 0, ZF], [0, 0, D], [0, SPRING, D]];
      for (var e = 0; e <= 24; e++) { var ve = vault(e / 24 * Math.PI); ew.push([0, ve[1], ve[0]]); }
      S.poly(ew, PAL.brick);
      for (var by = 10; by < SPRING + R; by += 10) S.line([0.3, by, ZF], [0.3, by, D], '#74493a', 0.4, { op: 0.7 });
      var CY = 1010, CZ = 250, clock = [];
      for (var ck = 0; ck <= 32; ck++) { var at2 = ck / 32 * Math.PI * 2; clock.push([0.6, CY + 120 * Math.sin(at2), CZ + 120 * Math.cos(at2)]); }
      S.poly(clock, '#2a2420');
      [[40, 30, 46, 14, PAL.brass], [-50, -20, 38, 11, PAL.copper], [10, -60, 30, 9, PAL.brass]].forEach(function (gg, i) {
        var gp = [], n = gg[3] * 4, rot = o.t * (i % 2 ? -1 : 1) * (40 / gg[2]);
        for (var k = 0; k < n; k++) { var a = rot + k / n * Math.PI * 2, r = k % 4 < 2 ? gg[2] : gg[2] * 0.86; gp.push([0.7, CY + gg[1] + r * Math.sin(a), CZ + gg[0] + r * Math.cos(a)]); }
        S.poly(gp, gg[4]);
      });
      S.poly(clock.map(function (p) { return [0.9, p[1], p[2]]; }), '#efe6cf', { op: 0.35 });
      S.path(clock, PAL.brass, 7);
      for (var h = 0; h < 12; h++) { var ah = h / 12 * Math.PI * 2; S.line([1, CY + 98 * Math.sin(ah), CZ + 98 * Math.cos(ah)], [1, CY + 112 * Math.sin(ah), CZ + 112 * Math.cos(ah)], '#efe6cf', 2.4); }
      var mins = o.now.getMinutes(), hrs = o.now.getHours() % 12 + mins / 60;
      S.line([1.1, CY, CZ], [1.1, CY + 92 * Math.cos(mins / 60 * Math.PI * 2), CZ + 92 * Math.sin(mins / 60 * Math.PI * 2)], '#1a1714', 2);
      S.line([1.1, CY, CZ], [1.1, CY + 62 * Math.cos(hrs / 12 * Math.PI * 2), CZ + 62 * Math.sin(hrs / 12 * Math.PI * 2)], '#1a1714', 3);
      [[-200, 80], [360, 410]].forEach(function (zz) {
        S.side(0.6, zz[0], zz[1], 0, 600, shade(PAL.woodDark, 0.8));
        var er = seeded('end' + zz[0]);
        for (var ey = 10; ey < 580; ey += 34) {
          var ez = zz[0] + 6;
          while (ez < zz[1] - 10) { var bw = 4 + er() * 6; S.side(1, ez, ez + bw, ey, ey + 20 + er() * 9, shade(BOOKS[Math.floor(er() * BOOKS.length)], 0.75 + er() * 0.3)); ez += bw + 0.6; }
          S.side(1.2, zz[0], zz[1], ey - 4, ey, PAL.wood);
        }
      });
    }

    // ---- the floor: encaustic tiles
    S.poly([[rx0, 0, ZF], [rx1, 0, ZF], [rx1, 0, D], [rx0, 0, D]], PAL.tile);
    var T = 40;
    for (var fz = D; fz > ZF; fz -= T) {
      var s = S.s(fz - T / 2), fx0 = Math.max(0, Math.floor((cx - VX / s - 40) / T) * T), fx1 = Math.min(X1, cx + (W - VX) / s + 40);
      for (var fx = fx0; fx < fx1; fx += T) if (((fx + fz) / T & 1) === 0) S.flat(fx, fx + T, fz - T, fz, 0.2, PAL.tileDark);
    }
    // The inlays go in a second pass so each colour is one path.
    for (fz = D; fz > ZF; fz -= T) {
      s = S.s(fz - T / 2); fx0 = Math.max(0, Math.floor((cx - VX / s - 40) / T) * T); fx1 = Math.min(X1, cx + (W - VX) / s + 40);
      for (fx = fx0; fx < fx1; fx += T) if (((fx + fz) / T & 1) !== 0) S.poly([[fx + 20, 0.25, fz - 32], [fx + 28, 0.25, fz - 20], [fx + 20, 0.25, fz - 8], [fx + 12, 0.25, fz - 20]], '#a8865c');
    }

    // ---- the back wall: upper storey, then lower
    S.back(rx0, rx1, 0, SPRING, D, PAL.wall);
    if (vx0 < 420) Kit.bookcase(S, 20, 400, 0, 380, D, PAL, 'corner');
    if (vx0 < 420) {
      Kit.window(S, CASTLE, 150, 270, 640, 760, PAL, sky);
      Kit.bookcase(S, 20, 130, GAL, 810, D, PAL, 'cornerU');
      Kit.bookcase(S, 290, 410, GAL, 810, D, PAL, 'cornerU2');
      Kit.bookcase(S, 130, 290, GAL, 610, D, PAL, 'cornerU3');
    }
    visible.forEach(function (b) {
      var c = centre(b), tp = TEMPLATES[b.template] || TEMPLATES.stacks;
      S.group(b.filler ? null : b);
      if (tp.upper) tp.upper(S, b, o);
      else {
        Kit.window(S, CASTLE, c - 60, c + 60, 640, 760, PAL, sky);
        Kit.bookcase(S, b.x0 + 10, c - 80, GAL, 810, D, PAL, 'u' + b.id);
        Kit.bookcase(S, c + 80, b.x1 - 10, GAL, 810, D, PAL, 'v' + b.id);
        Kit.bookcase(S, c - 80, c + 80, GAL, 610, D, PAL, 'w' + b.id);
      }
      tp.wall(S, b, o);
      S.group(null);
      S.box(b.x0 + 10, b.x1 - 10, 340, 344, D - 44, D - 40, PAL.brass);
    });
    // Pneumatic tubes, a station in each bay, and a capsule on its way.
    Kit.pipe(S, [[rx0, 406, D - 2], [rx1, 406, D - 2]], 5, PAL.copper);
    Kit.pipe(S, [[rx0, 418, D - 2], [rx1, 418, D - 2]], 5, PAL.copper);
    visible.forEach(function (b) { Kit.pipe(S, [[b.x0 + 36, 418, D - 3], [b.x0 + 36, 300, D - 3]], 4, PAL.copper); Kit.tubeStation(S, b.x0 + 36, D - 2, PAL); });
    S.ellipse(((o.t * 600) % (X1 + 400)) - 200, 406, D - 6, 14, 4, '#b8c0c0');
    // The iron gallery, with a gear train along its front.
    S.box(rx0, rx1, GAL - 12, GAL + 8, D - 90, D, PAL.iron);
    visible.forEach(function (b) {
      Kit.gear(S, b.x0 + 90, GAL - 2, D - 91, 22, 12, PAL.brass, { rot: o.t });
      Kit.gear(S, b.x0 + 126, GAL - 2, D - 91, 14, 8, PAL.copper, { rot: -o.t * 1.6 });
    });
    for (var bx = Math.floor(rx0 / 30) * 30 + 6; bx < rx1; bx += 30) { S.line([bx, GAL + 8, D - 88], [bx, GAL + 90, D - 88], PAL.iron, 1.4); S.circle(bx + 15, GAL + 50, D - 88, 9, 'none', { stroke: PAL.iron, sw: 1.4 }); }
    S.box(rx0, rx1, GAL + 90, GAL + 96, D - 92, D - 84, PAL.brass);
    // A telescope on the gallery, aimed at the roof.
    var tsc = all[bays.length].x0 + 120;
    S.line([tsc, GAL + 8, D - 50], [tsc + 10, GAL + 80, D - 50], PAL.iron, 2); S.line([tsc + 30, GAL + 8, D - 30], [tsc + 10, GAL + 80, D - 50], PAL.iron, 2);
    S.poly([[tsc - 20, GAL + 70, D - 50], [tsc + 70, GAL + 150, D - 50], [tsc + 76, GAL + 144, D - 50], [tsc - 10, GAL + 62, D - 50]], PAL.brass);
    // Steam pipes along the top of the wall, with valves and gauges.
    Kit.pipe(S, [[rx0, SPRING - 30, D - 4], [rx1, SPRING - 30, D - 4]], 10, PAL.copper);
    visible.forEach(function (b) {
      Kit.pipe(S, [[b.x0 + 24, SPRING - 30, D - 6], [b.x0 + 24, GAL + 100, D - 6]], 6, PAL.copper);
      Kit.valve(S, b.x0 + 24, 700, D - 12, 12, '#8a2a1a');
      Kit.gauge(S, b.x0 + 24, 640, D - 10, 10, PAL, 0.4 + 0.2 * Math.sin(o.t + b.x0));
    });
    var puff = (o.t * 0.7) % 1;
    [0, 1, 2].forEach(function (i) { var f = (puff + i / 3) % 1; S.ellipse(all[bays.length - 1].x0 + 40 + f * 30, SPRING + f * 90, D - 20, 30 + f * 40, 14 + f * 16, '#ffffff', { op: 0.32 * (1 - f) }); });
    // Columns, and gas lamps at hand height.
    edges.forEach(function (x) { Kit.ironColumn(S, x, 0, SPRING, D - 60, PAL); });
    visible.forEach(function (b) { Kit.gasLamp(S, b.x0 + 12, D - 60, PAL, t.lit || o.labels); });

    // ---- what stands on the floor, far to near
    var items = [];
    visible.forEach(function (b, i) {
      var tp = TEMPLATES[b.template];
      if (tp && tp.floor) items.push({ x: centre(b), draw: function () { S.group(b.filler ? null : b); tp.floor(S, b, o); S.group(null); } });
      if (b.template === 'stacks' || b.template === 'shelf-and-table') items.push({ x: b.x0 + 100, draw: function () { Kit.railLadder(S, b.x0 + 70 + (Math.round(b.x0) * 53) % 140, D - 40, 342, PAL); } });
    });
    items.push({ x: all[bays.length].x0 + 180, draw: function () { var b = all[bays.length]; Kit.trolley(S, b.x0 + 180, D - 120, PAL, 'trolley'); } });
    items.push({ x: all[bays.length + 1].x0 + 200, draw: function () { var b = all[bays.length + 1]; Kit.mapChest(S, b.x0 + 140, b.x0 + 240, D - 220, D - 150, PAL); Kit.fern(S, b.x0 + 60, D - 110); } });
    items.push({ x: bays[1].x0 + 120, draw: function () { Kit.stack(S, bays[1].x0 + 60, 0, D - 110, 8, seeded('floor1'), PAL); Kit.stack(S, bays[1].x0 + 86, 0, D - 92, 4, seeded('floor2'), PAL); } });
    items.filter(function (it) { return it.x > vx0 - 200 && it.x < vx1 + 200; })
      .sort(function (a, b) { return Math.abs(b.x - cx) - Math.abs(a.x - cx); })
      .forEach(function (it) { it.draw(); });

    // ---- the fireside: stove, teapot, chairs, rug, a cat
    if (vx0 < 600) {
      Kit.stove(S, 220, PAL, 400, t.lit);
      Kit.teapot(S, 40, 120, 190, '#3a5a5a');
      Kit.rug(S, 50, 400, 60, 400, '#5a2e3e', '#c8963e', '#2e4a5a');
      Kit.chesterfield(S, 270, 330, -1.15, '#6a2a1e');
      Kit.chesterfield(S, 270, 110, -2.0, '#4a3424');
      Kit.turnedLeg(S, 300, 220, 56, PAL.woodDark);
      Kit.prism(S, Kit.rect(300, 220, 30, 30, 0.4), 0, 4, PAL.woodDark);
      Kit.prism(S, [[324, 220], [317, 237], [300, 244], [283, 237], [276, 220], [283, 203], [300, 196], [317, 203]], 56, 60, PAL.wood);
      Kit.openBook(S, 304, 60.3, 214, 0.6, '#2a3a5a');
      S.ellipse(290, 63, 230, 4, 4, '#efe6dc');
      Kit.stack(S, 360, 0, 50, 6, seeded('fire1'), PAL);
      Kit.stack(S, 330, 0, 400, 4, seeded('fire2'), PAL);
      Kit.cat(S, 150, 220, '#2b2420');
    }

    return S;
  }

  // ---------------------------------------------------------------- pixel art

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (v) { return v / 16 - 0.5; });
  var PIX_PAL = (function () {
    var base = [PAL.wood, PAL.woodDark, PAL.stone, PAL.wall, PAL.brass, PAL.copper, PAL.iron, PAL.brick, PAL.tile, PAL.tileDark, PAL.panel, '#2f5a44', '#5a2a1e', '#efe6cf', '#d9d3c4', '#5c8a8e', '#ffcc66', '#ffd27a', '#ff9f40', '#000000', '#ffffff']
      .concat(BOOKS);
    Object.keys(TOD).forEach(function (k) { base.push(TOD[k].top, TOD[k].bottom, TOD[k].haze); });
    Object.keys(HILL).forEach(function (k) { base.push(HILL[k]); });
    var out = [], seen = {};
    base.forEach(function (c) {
      [0.32, 0.5, 0.68, 0.85, 1, 1.15].forEach(function (f) { var h = shade(c, f); if (!seen[h]) { seen[h] = 1; out.push([0, 2, 4].map(function (i) { return parseInt(h.substr(1 + i, 2), 16); })); } });
    });
    return out;
  })();
  var nearest = {};
  function quantise(r, g, b) {
    var key = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2), hit = nearest[key];
    if (hit) return hit;
    var bd = 1e9;
    for (var i = 0; i < PIX_PAL.length; i++) {
      var p = PIX_PAL[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b, d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bd) { bd = d; hit = p; }
    }
    nearest[key] = hit;
    return hit;
  }

  var pixBusy = false, pixDirty = false;
  function pixelate(S, o) {
    if (pixBusy) { pixDirty = true; return; }
    pixBusy = true;
    var cv = document.getElementById('pixels');
    var PW = 320, PH = Math.max(120, Math.round(320 * stH / stW));
    if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
    var url = URL.createObjectURL(new Blob([S.finish({ size: [PW, PH], symbols: true, tint: TOD[o.tod].tint, tintA: TOD[o.tod].a })], { type: 'image/svg+xml;charset=utf-8' }));
    var img = new Image();
    function done() {
      URL.revokeObjectURL(url);
      pixBusy = false;
      if (pixDirty) { pixDirty = false; queue(); }
    }
    img.onload = function () {
      var ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, PW, PH);
      var id = ctx.getImageData(0, 0, PW, PH), d = id.data;
      for (var y = 0; y < PH; y++) {
        for (var x = 0; x < PW; x++) {
          var i = (y * PW + x) * 4, n = BAYER[(y & 3) * 4 + (x & 3)] * 20;
          var p = quantise(Math.max(0, Math.min(255, d[i] + n)), Math.max(0, Math.min(255, d[i + 1] + n)), Math.max(0, Math.min(255, d[i + 2] + n)));
          d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
        }
      }
      ctx.putImageData(id, 0, 0);
      done();
    };
    img.onerror = done;
    img.src = url;
  }

  // ---------------------------------------------------------------- state

  function clockTime() {
    var now = new Date(), h = now.getHours(), m = now.getMonth();
    var tod = h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'afternoon' : h >= 17 && h < 20 ? 'dusk' : 'night';
    var season = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][m];
    var q = new URLSearchParams(location.search);
    if (TOD[q.get('hour')]) tod = q.get('hour');
    if (HILL[q.get('season')]) season = q.get('season');
    return { tod: tod, season: season };
  }
  function pref(k, v) {
    try { if (v === undefined) return localStorage.getItem('gallery-' + k) === '1'; localStorage.setItem('gallery-' + k, v ? '1' : '0'); } catch (e) { return false; }
  }

  var time = clockTime();
  var state = { cx: CX_MIN, tod: time.tod, season: time.season, labels: pref('labels'), pixel: pref('pixel'), t: 0, now: new Date() };
  bays.forEach(function (b) { if (!b.href) b.href = '#bay-' + b.id; });

  var track = document.getElementById('track');
  var stage = document.getElementById('stage');
  var sceneEl = document.getElementById('scene');
  var canvas = document.getElementById('pixels');
  // Symbols (rows of books and the like) live in one hidden SVG, drawn once.
  var symbolHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  symbolHost.setAttribute('aria-hidden', 'true');
  symbolHost.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  stage.appendChild(symbolHost);
  var symbolsShown = 0;
  var stW = 1000, stH = 620, scale = 1, raf = 0;

  function frame() {
    raf = 0;
    state.now = new Date();
    var S = scene(state);
    if (LK.symbolCount() !== symbolsShown) { symbolHost.innerHTML = '<defs>' + LK.symbols() + '</defs>'; symbolsShown = LK.symbolCount(); }
    var t = TOD[state.tod];
    sceneEl.innerHTML = S.finish({ tint: t.tint, tintA: t.a, vignette: state.tod === 'night' ? 0.5 : 0.3, labels: state.labels, label: 'The Long Gallery' });
    if (state.pixel) pixelate(scene(state), state);
  }
  function queue() { if (!raf) raf = requestAnimationFrame(frame); }

  function step() { return scale * S_BACK; }
  function measure() {
    stW = scroller.clientWidth;
    stH = stage.clientHeight || 620;
    W = Math.max(440, Math.min(1600, H * stW / stH));
    fitCamera();
    scale = Math.max(stW / W, stH / H);
    stage.style.width = stW + 'px';
    track.style.width = Math.round(stW + (CX_MAX - CX_MIN) * step()) + 'px';
    state.cx = CX_MIN + scroller.scrollLeft / step();
    queue();
  }

  function bayAt(cx) {
    if (cx <= CX_MIN + 40) return bays[0];
    var c = cx - LOOK, best = bays[0];
    bays.forEach(function (b) { if (Math.abs(centre(b) - c) < Math.abs(centre(best) - c)) best = b; });
    return best;
  }
  function goToBay(id, smooth) {
    var b = bays.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    var cx = Math.max(CX_MIN, Math.min(CX_MAX, centre(b) + LOOK));
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: (cx - CX_MIN) * step(), behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }

  var bayButtons = document.querySelectorAll('[data-go]');
  function markBay() {
    var cur = bayAt(state.cx).id;
    bayButtons.forEach(function (btn) {
      if (btn.getAttribute('data-go') === cur) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
    });
  }

  // Walking turns the gears: the mechanisms move with you, and stop when you do.
  var lastCx = state.cx;
  scroller.addEventListener('scroll', function () {
    state.cx = CX_MIN + scroller.scrollLeft / step();
    state.t += (state.cx - lastCx) / 400;
    lastCx = state.cx;
    markBay(); queue();
  }, { passive: true });
  // A vertical mouse wheel walks along the gallery until you reach either end.
  scroller.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    var before = scroller.scrollLeft;
    scroller.scrollLeft += e.deltaY;
    if (scroller.scrollLeft !== before) e.preventDefault();
  }, { passive: false });
  bayButtons.forEach(function (btn) { btn.addEventListener('click', function () { goToBay(btn.getAttribute('data-go'), true); }); });

  // Hotspots: bays with a dialog open it; anything else is an ordinary link.
  sceneEl.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.hot');
    if (!a) return;
    var dlg = document.getElementById('bay-' + a.getAttribute('data-bay'));
    if (dlg && dlg.showModal && a.getAttribute('href').charAt(0) === '#') { e.preventDefault(); dlg.showModal(); }
  });
  sceneEl.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('a.hot');
    if (a) goToBay(a.getAttribute('data-bay'), true);
  });
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  var optLabels = document.getElementById('opt-labels');
  var optPixel = document.getElementById('opt-pixel');
  function applyPixel() {
    stage.classList.toggle('pixel', state.pixel);
    canvas.hidden = !state.pixel;
  }
  if (optLabels) { optLabels.checked = state.labels; optLabels.addEventListener('change', function () { state.labels = optLabels.checked; pref('labels', state.labels); queue(); }); }
  if (optPixel) { optPixel.checked = state.pixel; optPixel.addEventListener('change', function () { state.pixel = optPixel.checked; pref('pixel', state.pixel); applyPixel(); queue(); }); }
  applyPixel();

  var clockEl = document.getElementById('clock');
  if (clockEl) clockEl.textContent = state.tod.charAt(0).toUpperCase() + state.tod.slice(1) + ', ' + state.season + '. The light follows your clock.';
  // Keep the clocks right.
  setInterval(queue, 30000);

  window.addEventListener('resize', measure);
  document.documentElement.classList.add('gallery-ready');
  measure();
  var start = location.hash.replace('#', '');
  if (start) goToBay(start, false);
  markBay();
})();
