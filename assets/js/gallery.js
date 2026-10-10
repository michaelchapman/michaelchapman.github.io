/*
 * The Long Gallery.
 *
 * Draws the gallery as SVG from the bays in _data/gallery.yml (passed in as
 * JSON by _layouts/gallery.html). Everything is placed in room coordinates
 * and drawn through one camera, so new things always match:
 *
 *   x  along the wall, left to right (each bay has its own span)
 *   y  height above the floor
 *   z  depth, from the front of the room (0) to the back wall (D)
 *
 * Bays are drawn by templates (TEMPLATES below). Colours come from roles in
 * PALETTE, never from the templates themselves, and the hour and season are
 * applied on top. "Pixel art" redraws the same picture at 320px wide with a
 * limited palette and ordered dithering.
 */
(function () {
  'use strict';

  var dataEl = document.getElementById('gallery-data');
  var scroller = document.getElementById('scroller');
  if (!dataEl || !scroller) return;
  var DATA = JSON.parse(dataEl.textContent);

  // Camera and room. The camera looks slightly to the right, toward the next bay.
  var W = 900, H = 520, EYE = 190, VY = 300, F = 700, D = 340, VX = 760, CEIL = 470;

  // Width of each template along the wall.
  var BAY_W = { 'shelf-and-table': 820, 'frame-wall': 540, 'alcove': 300, 'door': 320, 'curio': 340 };

  var at = 0;
  var bays = DATA.bays.map(function (b) {
    var w = BAY_W[b.template] || 300;
    var bay = Object.assign({}, b, { x0: at, x1: at + w });
    at += w;
    return bay;
  });
  var LEN = at, CX_MIN = -60, CX_MAX = Math.max(CX_MIN, LEN - 840);

  // ---------------------------------------------------------------- colour

  var PALETTE = {
    ceiling: '#3a3431', wall: '#7f8b80', floor: '#6d4f39', floorline: '#5b402d', beamline: '#2c2725',
    wood: '#7d5435', woodDark: '#4b3223', stone: '#a19e94',
    books: ['#7b2d26', '#2f4a5e', '#5d6b3a', '#9a742c', '#3f3152', '#a2532f', '#26443c'],
    paper: '#efe9dc', cert: '#f3eee2', ink: '#444444', frame: '#3b2a1d', gilt: '#b38f3e',
    canvas: '#2d3b34', sitter: '#141b18', door: '#5c3b25', doorDark: '#1f1712', brass: '#bc943b',
    metal: '#2b2b2b', shade: '#ecdcb2', cloth: '#d8d3c6', trunk: '#3a2e25', hill: '#6e8a72', snow: '#ffffff',
    leaf: { spring: '#a9cf86', summer: '#4f7f45', autumn: '#c9772f', winter: '#ffffff' }
  };
  var TOD = {
    morning: { sky: ['#bcd8ea', '#f6e2bd'], tint: '#ffcf8a', a: 0.10, beam: '#fff1cc', ba: 0.22 },
    afternoon: { sky: ['#8dbbe0', '#dcecf4'], tint: '#ffffff', a: 0, beam: '#fffbe8', ba: 0.16 },
    dusk: { sky: ['#2f3c69', '#e88b5c'], tint: '#c4572e', a: 0.22, beam: '#ff9b5c', ba: 0.14 },
    night: { sky: ['#060a1c', '#1b2650'], tint: '#0b1131', a: 0.62, beam: null, ba: 0, lamp: true }
  };

  function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function toHex(c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function shade(h, f) { var c = hex(h); return toHex(f < 1 ? c.map(function (v) { return v * f; }) : c.map(function (v) { return v + (255 - v) * Math.min(1, f - 1); })); }
  function colour(s, o) {
    if (s.role === 'book') return PALETTE.books[s.k % PALETTE.books.length];
    if (s.role === 'leaf') return PALETTE.leaf[o.season];
    if (s.role === 'hill' && o.season === 'winter') return '#e9eef0';
    return PALETTE[s.role];
  }

  // Same seed, same books: variety comes from the bay's id, not chance.
  function seeded(str) {
    var a = 2166136261;
    for (var i = 0; i < str.length; i++) { a ^= str.charCodeAt(i); a = Math.imul(a, 16777619); }
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- scene

  function scene(o) {
    var S = [], labels = [], windows = [], extras = {};
    var group = null, clip = null;
    var camX = VX + o.cx;
    function P(x, y, z) { var s = F / (F + z); return [VX + (x - o.cx - VX) * s, VY - (y - EYE) * s]; }
    function poly(p3, role, f, ex) {
      ex = ex || {};
      S.push({ t: 'poly', pts: p3.map(function (p) { return P(p[0], p[1], p[2]); }), role: role, f: (f || 1) * (ex.tone || 1), k: ex.k, clip: clip, g: group });
    }
    function line(a, b, role, w) { S.push({ t: 'line', a: P(a[0], a[1], a[2]), b: P(b[0], b[1], b[2]), role: role, w: w || 1, clip: clip, g: group }); }
    function outline(p3, role, w) { S.push({ t: 'outline', pts: p3.map(function (p) { return P(p[0], p[1], p[2]); }), role: role, w: w, g: group }); }
    function box(x0, x1, y0, y1, z0, z1, role, ex) {
      if (x0 > camX) poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], role, 0.74, ex);
      if (x1 < camX) poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], role, 0.74, ex);
      if (y1 < EYE) poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], role, 1.12, ex);
      if (y0 > EYE) poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], role, 0.62, ex);
      poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], role, 1, ex);
    }
    function disc(cx, cy, r, z, n) {
      var p = []; n = n || 14;
      for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]); }
      return p;
    }
    function arch(xa, xb, y0, ytop, z) {
      var r = (xb - xa) / 2, c = xa + r, p = [[xa, y0, z], [xb, y0, z]];
      for (var i = 0; i <= 18; i++) { var a = i / 18 * Math.PI; p.push([c + r * Math.cos(a), ytop + r * Math.sin(a), z]); }
      return p;
    }
    function label(x, y, z, text) { var p = P(x, y, z); labels.push({ p: p, t: text }); }
    // An arched window with sky behind it; `view` adds hills and a tree.
    function windowAt(xa, xb, view) {
      var win = arch(xa, xb, 170, 340, D), id = 'win' + windows.length, mid = (xa + xb) / 2;
      windows.push(win.map(function (p) { return P(p[0], p[1], p[2]); }));
      poly(win, 'sky');
      clip = id;
      var hz = D + 320, tz = D + 90;
      poly([[xa - 190, 150, hz], [xa - 70, 205, hz], [xa + 40, 185, hz], [xa + 170, 215, hz], [xa + 330, 170, hz], [xa + 330, 150, hz]], 'hill');
      if (view) {
        poly([[mid + 2, 150, tz], [mid + 16, 150, tz], [mid + 14, 280, tz], [mid + 5, 280, tz]], 'trunk');
        if (o.season === 'winter') {
          line([mid + 10, 270, tz], [mid - 30, 330, tz], 'trunk', 2); line([mid + 10, 265, tz], [mid + 55, 335, tz], 'trunk', 2);
          line([mid + 9, 280, tz], [mid + 12, 360, tz], 'trunk', 2); line([mid - 12, 300, tz], [mid - 25, 345, tz], 'trunk', 1.4);
        } else {
          poly(disc(mid - 18, 312, 52, tz), 'leaf', 0.86); poly(disc(mid + 38, 300, 48, tz), 'leaf', 1); poly(disc(mid + 12, 350, 42, tz), 'leaf', 1.1);
        }
      }
      clip = null;
      line([mid, 170, D], [mid, 400, D], 'woodDark', 3); line([xa, 300, D], [xb, 300, D], 'woodDark', 3);
      outline(win, 'stone', 7);
      box(xa - 12, xb + 12, 158, 172, D - 22, D, 'stone');
      if (o.season === 'winter') box(xa - 10, xb + 10, 172, 178, D - 20, D, 'snow');
    }

    var api = { poly: poly, line: line, box: box, disc: disc, arch: arch, label: label, windowAt: windowAt, P: P, extras: extras,
      setGroup: function (g) { group = g; } };

    // Room shell, running the full length of the gallery.
    var X0 = -400, X1 = LEN + 600;
    poly([[X0, CEIL, -140], [X1, CEIL, -140], [X1, CEIL, D], [X0, CEIL, D]], 'ceiling');
    poly([[X0, 0, D], [X1, 0, D], [X1, CEIL, D], [X0, CEIL, D]], 'wall');
    poly([[X0, 0, -140], [X1, 0, -140], [X1, 0, D], [X0, 0, D]], 'floor');
    for (var fx = X0; fx <= X1; fx += 70) line([fx, 0, -140], [fx, 0, D], 'floorline');
    line([X0, 0, D * 0.5], [X1, 0, D * 0.5], 'floorline');
    for (var bx = X0; bx <= X1; bx += 120) line([bx, CEIL, 0], [bx, CEIL, D], 'beamline', 3);
    box(X0, X1, 0, 14, D - 6, D, 'wood');
    box(X0, X1, CEIL - 22, CEIL, D - 12, D, 'stone');
    var edges = [0].concat(bays.map(function (b) { return b.x1; }));
    edges.forEach(function (e) { box(e - 20, e + 20, 0, CEIL - 22, D - 14, D, 'stone'); });

    // Only draw bays near the camera.
    bays.forEach(function (b) {
      if (b.x1 < o.cx - 200 || b.x0 > o.cx + 1500) return;
      var t = TEMPLATES[b.template];
      if (t) t(api, b, o);
    });

    // Front pillars and lintel, nearest last.
    edges.slice().sort(function (a, b) { return Math.abs(b - camX) - Math.abs(a - camX); })
      .forEach(function (e) { box(e - 20, e + 20, 0, CEIL, 0, 40, 'stone'); });
    box(X0, X1, CEIL - 34, CEIL + 40, 0, 40, 'stone');

    return { shapes: S, labels: labels, windows: windows, beam: extras.beam, lamp: extras.lamp };
  }

  // ---------------------------------------------------------------- bays

  var TEMPLATES = {
    'shelf-and-table': function (g, b, o) {
      var x = b.x0, r = seeded(b.id);
      g.windowAt(x + 390, x + 510, true);
      g.extras.beam = [g.P(x + 390, 170, D), g.P(x + 510, 170, D), g.P(x + 560, 0, D - 210), g.P(x + 420, 0, D - 230)];
      g.setGroup(b);
      g.box(x + 40, x + 300, 0, 320, D - 4, D, 'woodDark');
      g.box(x + 40, x + 54, 0, 320, D - 54, D, 'wood');
      var levels = [0, 80, 160, 240];
      levels.forEach(function (L) { g.box(x + 54, x + 286, L, L + 10, D - 54, D, 'wood'); });
      levels.forEach(function (L) {
        var bx = x + 58;
        while (bx < x + 278) {
          var w = 8 + Math.floor(r() * 9), h = 46 + Math.floor(r() * 20);
          if (bx + w > x + 282) break;
          if (r() < 0.08) { bx += 10; continue; }
          g.box(bx, bx + w, L + 10, L + 10 + h, D - 46, D - 12, 'book', { k: Math.floor(r() * 7), tone: 0.88 + r() * 0.22 });
          bx += w + 1;
        }
      });
      g.box(x + 40, x + 300, 312, 320, D - 54, D, 'wood');
      g.box(x + 286, x + 300, 0, 320, D - 54, D, 'wood');
      [[336, 236], [544, 236], [336, 154], [544, 154]].forEach(function (l) { g.box(x + l[0], x + l[0] + 10, 0, 104, l[1], l[1] + 10, 'wood'); });
      g.box(x + 326, x + 564, 104, 116, 148, 252, 'wood');
      // One sheet on the table per paper (up to eight).
      var n = Math.max(1, Math.min(8, b.count || 1));
      for (var i = 0; i < n; i++) {
        var cx = x + 360 + i * (150 / n) + r() * 8, cz = 205 + (r() - 0.5) * 36, a = (r() - 0.5) * 0.8, ca = Math.cos(a), sa = Math.sin(a);
        g.poly([[-21, -28], [21, -28], [21, 28], [-21, 28]].map(function (d) {
          return [cx + d[0] * ca - d[1] * sa, 116.5 + i * 0.3, cz + d[0] * sa + d[1] * ca];
        }), 'paper', 1.06);
      }
      g.box(x + 508, x + 532, 116, 121, 174, 196, 'metal'); g.box(x + 518, x + 522, 121, 186, 183, 187, 'metal');
      g.box(x + 498, x + 542, 186, 214, 166, 206, 'shade');
      g.extras.lamp = g.P(x + 520, 206, 186);
      g.setGroup(null);
      g.label(x + 170, 336, D, b.label);
    },

    'frame-wall': function (g, b) {
      var n = Math.max(1, b.count || 1), cols = 3, rows = Math.ceil(n / cols);
      var x = b.x0 + 96, top = 304 + (rows > 2 ? 40 : 0);
      g.setGroup(b);
      for (var i = 0; i < n; i++) {
        var fx = x + (i % cols) * 106, y0 = top - Math.floor(i / cols) * 82;
        g.box(fx, fx + 84, y0, y0 + 60, D - 6, D, 'frame');
        g.poly([[fx + 7, y0 + 7, D - 6.2], [fx + 77, y0 + 7, D - 6.2], [fx + 77, y0 + 53, D - 6.2], [fx + 7, y0 + 53, D - 6.2]], 'cert');
        g.line([fx + 18, y0 + 40, D - 6.4], [fx + 66, y0 + 40, D - 6.4], 'ink', 1);
        g.line([fx + 24, y0 + 30, D - 6.4], [fx + 60, y0 + 30, D - 6.4], 'ink', 1);
        g.poly(g.disc(fx + 64, y0 + 16, 5, D - 6.4, 10), 'brass');
      }
      g.setGroup(null);
      g.label(b.x0 + 244, top + 80, D, b.label);
    },

    'alcove': function (g, b) {
      var x = b.x0 + 90;
      g.setGroup(b);
      g.box(x, x + 120, 180, 372, D - 8, D, 'gilt');
      g.poly([[x + 12, 192, D - 8.2], [x + 108, 192, D - 8.2], [x + 108, 360, D - 8.2], [x + 12, 360, D - 8.2]], 'canvas');
      g.poly(g.disc(x + 60, 300, 22, D - 8.4, 16), 'sitter');
      g.poly([[x + 20, 192, D - 8.4], [x + 100, 192, D - 8.4], [x + 94, 236, D - 8.4], [x + 76, 262, D - 8.4], [x + 44, 262, D - 8.4], [x + 26, 236, D - 8.4]], 'sitter');
      g.poly([[x + 48, 322, D - 8.5], [x + 60, 336, D - 8.5], [x + 72, 322, D - 8.5], [x + 66, 330, D - 8.5], [x + 60, 318, D - 8.5], [x + 54, 330, D - 8.5]], 'brass');
      g.setGroup(null);
      g.label(x + 60, 392, D, b.label);
    },

    'door': function (g, b) {
      var x = b.x0 + 90;
      g.setGroup(b);
      g.poly(g.arch(x, x + 140, 0, 250, D - 1), 'doorDark');
      g.poly(g.arch(x + 8, x + 132, 0, 248, D - 3), 'door');
      [39, 70, 101].forEach(function (d) { g.line([x + d, 0, D - 3.2], [x + d, 300, D - 3.2], 'doorDark', 1.4); });
      g.line([x + 8, 60, D - 3.4], [x + 58, 60, D - 3.4], 'metal', 4);
      g.line([x + 8, 210, D - 3.4], [x + 58, 210, D - 3.4], 'metal', 4);
      g.poly(g.disc(x + 114, 124, 4, D - 3.4, 10), 'doorDark');
      g.box(x + 40, x + 100, 330, 348, D - 4, D, 'brass');
      g.setGroup(null);
      g.label(x + 70, 362, D, b.label);
    },

    'curio': function (g, b) {
      var x = b.x0;
      g.windowAt(x + 110, x + 230, false);
      g.setGroup(b);
      g.box(x + 110, x + 230, 0, 120, 170, 250, 'cloth');
      g.poly([[x + 104, 0, 166], [x + 236, 0, 166], [x + 230, 40, 168], [x + 110, 40, 168]], 'cloth', 0.92);
      g.setGroup(null);
      g.label(x + 170, 140, 210, b.label);
    }
  };

  // ---------------------------------------------------------------- render

  function pd(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'Z'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function draw(s, o) {
    var c = s.clip ? ' clip-path="url(#g-' + s.clip + ')"' : '';
    if (s.t === 'poly') {
      if (s.role === 'sky') return '<path d="' + pd(s.pts) + '" fill="url(#g-sky)"/>';
      var col = shade(colour(s, o), s.f);
      return '<path d="' + pd(s.pts) + '" fill="' + col + '" stroke="' + col + '" stroke-width=".6"' + c + '/>';
    }
    if (s.t === 'line') {
      return '<line x1="' + s.a[0].toFixed(1) + '" y1="' + s.a[1].toFixed(1) + '" x2="' + s.b[0].toFixed(1) + '" y2="' + s.b[1].toFixed(1) +
        '" stroke="' + colour(s, o) + '" stroke-width="' + s.w + '" stroke-linecap="round"' + c + '/>';
    }
    if (s.t === 'outline') return '<path d="' + pd(s.pts) + '" fill="none" stroke="' + shade(colour(s, o), 0.9) + '" stroke-width="' + s.w + '"/>';
    return '';
  }

  function labelSvg(l) {
    var w = l.t.length * 7.2 + 18, x = l.p[0] - w / 2, y = l.p[1] - 11;
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="21" rx="10.5" fill="#141414" fill-opacity=".82"/>' +
      '<text x="' + l.p[0].toFixed(1) + '" y="' + (l.p[1] + 4).toFixed(1) + '" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, monospace" font-size="11.5" fill="#f5efe0" letter-spacing=".5">' + esc(l.t.toUpperCase()) + '</text>';
  }

  // opts.size: [w, h] for a fixed-size image (pixel art), else fills its box.
  function render(sc, o, opts) {
    opts = opts || {};
    var t = TOD[o.tod];
    var defs = '<linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + t.sky[0] + '"/><stop offset="1" stop-color="' + t.sky[1] + '"/></linearGradient>' +
      '<radialGradient id="g-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".75"/><stop offset=".45" stop-color="#ff9f40" stop-opacity=".22"/><stop offset="1" stop-color="#ff9f40" stop-opacity="0"/></radialGradient>' +
      sc.windows.map(function (w, i) { return '<clipPath id="g-win' + i + '"><path d="' + pd(w) + '"/></clipPath>'; }).join('');
    var body = '', open = null;
    sc.shapes.forEach(function (s) {
      if (s.g !== open) {
        if (open) body += '</a>';
        open = s.g;
        if (open) {
          body += '<a class="hot" data-bay="' + esc(open.id) + '" href="' + esc(open.href) + '" aria-label="' + esc(open.title) + '"><title>' + esc(open.title) + '</title>';
        }
      }
      body += draw(s, o);
    });
    if (open) body += '</a>';
    var over = '';
    if (t.beam && sc.beam) over += '<path d="' + pd(sc.beam) + '" fill="' + t.beam + '" opacity="' + t.ba + '" style="mix-blend-mode:screen" pointer-events="none"/>';
    if (t.a) over += '<rect width="' + W + '" height="' + H + '" fill="' + t.tint + '" opacity="' + t.a + '" style="mix-blend-mode:multiply" pointer-events="none"/>';
    if (t.lamp && sc.lamp) over += '<circle cx="' + sc.lamp[0].toFixed(1) + '" cy="' + sc.lamp[1].toFixed(1) + '" r="230" fill="url(#g-glow)" style="mix-blend-mode:screen" pointer-events="none"/>';
    var labs = o.labels && !opts.noLabels ? '<g class="labels" pointer-events="none">' + sc.labels.map(labelSvg).join('') + '</g>' : '';
    var size = opts.size ? ' width="' + opts.size[0] + '" height="' + opts.size[1] + '"' : ' width="100%" height="100%"';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + size + ' preserveAspectRatio="xMidYMid slice" role="group" aria-label="The Long Gallery">' +
      '<defs>' + defs + '</defs><rect class="ground" width="' + W + '" height="' + H + '" fill="#2a2421"/>' + body + over + labs + '</svg>';
  }

  // ---------------------------------------------------------------- pixel art

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (v) { return v / 16 - 0.5; });
  var PIX_PAL = (function () {
    var base = [];
    Object.keys(PALETTE).forEach(function (k) {
      var v = PALETTE[k];
      if (typeof v === 'string') base.push(v);
      else if (Array.isArray(v)) base.push.apply(base, v);
      else base.push.apply(base, Object.keys(v).map(function (s) { return v[s]; }));
    });
    Object.keys(TOD).forEach(function (k) { base.push.apply(base, TOD[k].sky); });
    base.push('#ffd27a', '#ff9f40', '#fff1cc', '#000000');
    var out = [], seen = {};
    base.forEach(function (c) {
      [0.32, 0.5, 0.68, 0.85, 1, 1.15].forEach(function (f) { var h = shade(c, f); if (!seen[h]) { seen[h] = 1; out.push(hex(h)); } });
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
  function pixelate(sc, o) {
    if (pixBusy) { pixDirty = true; return; }
    pixBusy = true;
    var cv = document.getElementById('pixels');
    var PW = 320, PH = Math.max(120, Math.round(320 * stH / stW));
    if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
    var url = URL.createObjectURL(new Blob([render(sc, o, { size: [PW, PH], noLabels: true })], { type: 'image/svg+xml;charset=utf-8' }));
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
    if (PALETTE.leaf[q.get('season')]) season = q.get('season');
    return { tod: tod, season: season };
  }
  function pref(k, v) {
    try { if (v === undefined) return localStorage.getItem('gallery-' + k) === '1'; localStorage.setItem('gallery-' + k, v ? '1' : '0'); } catch (e) { return false; }
  }

  var time = clockTime();
  var state = { cx: CX_MIN, tod: time.tod, season: time.season, labels: pref('labels'), pixel: pref('pixel') };
  bays.forEach(function (b) { if (!b.href) b.href = '#bay-' + b.id; });

  var track = document.getElementById('track');
  var stage = document.getElementById('stage');
  var sceneEl = document.getElementById('scene');
  var canvas = document.getElementById('pixels');
  var stW = 900, stH = 520, scale = 1, raf = 0;

  function frame() {
    raf = 0;
    var sc = scene(state);
    sceneEl.innerHTML = render(sc, state);
    if (state.pixel) pixelate(sc, state);
  }
  function queue() { if (!raf) raf = requestAnimationFrame(frame); }

  function measure() {
    stW = scroller.clientWidth;
    stH = stage.clientHeight || 520;
    scale = Math.max(stW / W, stH / H);
    stage.style.width = stW + 'px';
    track.style.width = Math.round(stW + (CX_MAX - CX_MIN) * scale) + 'px';
    state.cx = CX_MIN + scroller.scrollLeft / scale;
    queue();
  }

  function bayAt(cx) {
    var c = cx + 300;
    for (var i = 0; i < bays.length; i++) if (c < bays[i].x1) return bays[i];
    return bays[bays.length - 1];
  }
  function goToBay(id, smooth) {
    var b = bays.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    var cx = Math.max(CX_MIN, Math.min(CX_MAX, (b.x0 + b.x1) / 2 - 300));
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: (cx - CX_MIN) * scale, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }

  var bayButtons = document.querySelectorAll('[data-go]');
  function markBay() {
    var cur = bayAt(state.cx).id;
    bayButtons.forEach(function (btn) {
      if (btn.getAttribute('data-go') === cur) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
    });
  }

  scroller.addEventListener('scroll', function () { state.cx = CX_MIN + scroller.scrollLeft / scale; markBay(); queue(); }, { passive: true });
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

  var clock = document.getElementById('clock');
  if (clock) clock.textContent = state.tod.charAt(0).toUpperCase() + state.tod.slice(1) + ', ' + state.season + '. The light follows your clock.';

  window.addEventListener('resize', measure);
  document.documentElement.classList.add('gallery-ready');
  measure();
  var start = location.hash.replace('#', '');
  if (start) goToBay(start, false);
  markBay();
})();
