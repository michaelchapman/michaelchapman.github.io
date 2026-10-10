/*
 * The Long Gallery.
 *
 * Draws the gallery as SVG from the bays in _data/gallery.yml (passed in as
 * JSON by _layouts/gallery.html). Everything is placed in room coordinates
 * and drawn through one camera, so new things always match:
 *
 *   x  along the wall, left to right (each bay is one alcove)
 *   y  height above the floor (the room is about 1000 high)
 *   z  depth, from the front of the room (0) to the back wall (D)
 *
 * The room has two tiers, like a college library: below, alcoves between
 * bookcases that project from the wall, holding the things on show; above,
 * tall arched windows looking out over the rest of the castle.
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

  // Camera and room. The picture is always H tall; its width follows the
  // screen, so wide screens see more of the gallery. The vanishing point sits
  // right of centre, so the gallery always recedes toward the next bay.
  var H = 680, W = 900, K = 0.66, F = 700, VY = 568, EYE = 170, VX = W * 0.62;
  var D = 340, CEIL = 1420, CASE = 380, WIN_Y = 470, WIN_TOP = 1080, CORNICE = 1130, OCULUS = 1280;
  var S_BACK = K * F / (F + D); // scale at the back wall

  // Width of each template along the wall (one alcove each).
  var BAY_W = { 'shelf-and-table': 520, 'frame-wall': 440, 'alcove': 360, 'door': 380, 'curio': 400, 'stacks': 380 };

  var at = 0;
  var bays = DATA.bays.map(function (b) {
    var w = BAY_W[b.template] || 380;
    var bay = Object.assign({}, b, { x0: at, x1: at + w });
    at += w;
    return bay;
  });
  var LEN = at;
  // Beyond the last bay the gallery carries on: plain stacks into the distance.
  var all = bays.slice();
  for (var fi = 0; fi < 6; fi++) { all.push({ id: 'stacks-' + fi, template: 'stacks', filler: true, x0: at, x1: at + 380 }); at += 380; }
  var X1 = at;

  function centre(b) { return (b.x0 + b.x1) / 2; }
  // Camera x minus the x of whatever sits mid-screen; set by measure().
  var LOOK = 0, CX_MIN = 0, CX_MAX = 0;
  function fitCamera() {
    VX = W * 0.62;
    LOOK = (VX - W / 2) / S_BACK;
    // Start with the front of the first bay just inside the left edge.
    CX_MIN = (VX - W * 0.02) / (K * F / (F + 150));
    CX_MAX = Math.max(CX_MIN, centre(bays[bays.length - 1]) + LOOK);
  }
  fitCamera();

  // ---------------------------------------------------------------- colour

  var PALETTE = {
    ceiling: '#d2c9b6', coffer: '#a99f8c', wall: '#ddd5c4', stone: '#c9c0ab', stoneDark: '#9a907b',
    tileL: '#e6dfd0', tileD: '#3a3633', oak: '#6e4a2e', oakDark: '#3f2a1a',
    books: ['#7b2d26', '#2f4a5e', '#5d6b3a', '#9a742c', '#3f3152', '#a2532f', '#26443c', '#6b5a3a'],
    paper: '#efe9dc', cert: '#f3eee2', ink: '#444444', frame: '#3b2a1d', gilt: '#c09a42',
    canvas: '#2d3b34', sitter: '#141b18', door: '#5c3b25', doorDark: '#1f1712', brass: '#c39a45',
    metal: '#2b2b2b', shade: '#ecdcb2', cloth: '#d8d3c6', marble: '#ece8e0', lead: '#3d3a36', globe: '#3f6b7a',
    trunk: '#3a2e25', snow: '#ffffff', far: '#8c877d', farRoof: '#4f5866', farDark: '#5e5a54', farLit: '#ffcc66',
    hill: '#6e8a72', star: '#ffffff', moon: '#f4f1e2', flame: '#ffd27a', flag: '#8e2f2a',
    leaf: { spring: '#a9cf86', summer: '#4f7f45', autumn: '#c9772f', winter: '#ffffff' }
  };
  var TOD = {
    morning: { sky: ['#bcd8ea', '#f6e2bd'], tint: '#ffcf8a', a: 0.08, beam: '#fff1cc', ba: 0.22, sun: 0.35 },
    afternoon: { sky: ['#8dbbe0', '#dcecf4'], tint: '#ffffff', a: 0, beam: '#fffbe8', ba: 0.18, sun: -0.25 },
    dusk: { sky: ['#2f3c69', '#e88b5c'], tint: '#c4572e', a: 0.2, beam: '#ff9b5c', ba: 0.14, sun: -0.5 },
    night: { sky: ['#060a1c', '#1b2650'], tint: '#0b1131', a: 0.58, beam: null, ba: 0, lamp: true }
  };

  function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function toHex(c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function shade(h, f) { var c = hex(h); return toHex(f < 1 ? c.map(function (v) { return v * f; }) : c.map(function (v) { return v + (255 - v) * Math.min(1, f - 1); })); }
  function mix(a, b, t) { var A = hex(a), B = hex(b); return toHex(A.map(function (v, i) { return v + (B[i] - v) * t; })); }
  function colour(s, o) {
    var t = TOD[o.tod];
    switch (s.role) {
      case 'book': return PALETTE.books[s.k % PALETTE.books.length];
      case 'leaf': return PALETTE.leaf[o.season];
      case 'hill': return o.season === 'winter' ? '#e9eef0' : mix(PALETTE.hill, t.sky[1], 0.35);
      case 'far': case 'farRoof': case 'farDark': case 'flag':
        return mix(o.season === 'winter' && s.role === 'farRoof' ? '#e6ebee' : PALETTE[s.role], t.sky[1], o.tod === 'night' ? 0.15 : 0.42);
      case 'farLit': return o.tod === 'night' || o.tod === 'dusk' ? PALETTE.farLit : mix(PALETTE.farDark, t.sky[1], 0.42);
    }
    return PALETTE[s.role];
  }

  // Same seed, same books: variety comes from a name, not chance.
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

  // The rest of the castle, as seen from the gallery's windows: laid out
  // once, from a fixed seed, so it is the same castle on every visit.
  var CASTLE = (function () {
    var r = seeded('castle'), from = -4000, to = X1 + 6000;
    function towers(gapMin, gapMax, wMin, wMax, hMin, hMax, roofs) {
      var out = [];
      for (var x = from + r() * gapMax; x < to; x += gapMin + r() * (gapMax - gapMin)) {
        var w = wMin + r() * (wMax - wMin), lit = [];
        for (var i = 0; i < 4; i++) lit.push(r() < 0.5);
        out.push({ x: x, w: w, h: hMin + r() * (hMax - hMin), roof: r() < roofs ? 1.1 + r() * 1.2 : 0, flag: r() < 0.4, lit: lit });
      }
      return out;
    }
    var hills = [];
    for (var hx = from; hx < to; hx += 300 + r() * 500) hills.push([hx, 1400 + r() * 1100]);
    var stars = [];
    for (var si = 0; si < 900; si++) stars.push({ x: from + r() * (to - from), y: 700 + r() * 1800, r: 3 + r() * 4 });
    return {
      hills: hills, stars: stars, moon: { x: 2200, y: 2100 },
      ranks: [
        { z: D + 2100, tone: 0.92, towers: towers(700, 1500, 260, 420, 2200, 3400, 0.7) },
        { z: D + 1200, tone: 1, towers: towers(420, 900, 160, 260, 1300, 2300, 0.5), wall: 1100 },
        { z: D + 560, tone: 1.06, towers: towers(800, 1600, 120, 180, 900, 1300, 0.3), wall: 860 }
      ]
    };
  })();

  // ---------------------------------------------------------------- scene

  function scene(o) {
    var S = [], labels = [], windows = [], glows = [], shafts = [], extras = {};
    var group = null, clip = null, cx = o.cx;
    function P(x, y, z) { var s = K * F / (F + z); return [VX + (x - cx) * s, VY - (y - EYE) * s]; }
    function poly(p3, role, f, ex) {
      ex = ex || {};
      S.push({ t: 'poly', pts: p3.map(function (p) { return P(p[0], p[1], p[2]); }), role: role, f: (f || 1) * (ex.tone || 1), k: ex.k, clip: clip, g: group });
    }
    function line(a, b, role, w, op) { S.push({ t: 'line', a: P(a[0], a[1], a[2]), b: P(b[0], b[1], b[2]), role: role, w: w || 1, op: op, clip: clip, g: group }); }
    function outline(p3, role, w) { S.push({ t: 'outline', pts: p3.map(function (p) { return P(p[0], p[1], p[2]); }), role: role, w: w, g: group }); }
    function rect(x0, x1, y0, y1, z, role, f, ex) { poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], role, f, ex); }
    function box(x0, x1, y0, y1, z0, z1, role, ex) {
      if (x0 > cx) poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], role, 0.74, ex);
      if (x1 < cx) poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], role, 0.74, ex);
      if (y1 < EYE) poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], role, 1.12, ex);
      if (y0 > EYE) poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], role, 0.62, ex);
      rect(x0, x1, y0, y1, z0, role, 1, ex);
    }
    function disc(cx0, cy, r, z, n) {
      var p = []; n = n || 14;
      for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; p.push([cx0 + r * Math.cos(a), cy + r * Math.sin(a), z]); }
      return p;
    }
    function arch(xa, xb, y0, ytop, z) {
      var r = (xb - xa) / 2, c = xa + r, p = [[xa, y0, z], [xb, y0, z]];
      for (var i = 0; i <= 20; i++) { var a = i / 20 * Math.PI; p.push([c + r * Math.cos(a), ytop + r * Math.sin(a), z]); }
      return p;
    }
    function label(x, y, z, text) { labels.push({ p: P(x, y, z), t: text }); }

    // What the windows look out on: hills, then the rest of the castle in
    // three ranks. It is laid out once along the whole gallery, so walking
    // past a window moves the view through it, and neighbouring windows
    // show neighbouring towers.
    function outside(xa, xb, ya, yb) {
      // The slice of the world at depth z that shows through an opening
      // spanning xa..xb, ya..yb on the back wall.
      function span(z) {
        var k = (F + z) / (F + D);
        return [cx + (xa - cx) * k - 60, cx + (xb - cx) * k + 60, EYE + (ya - EYE) * k - 60, EYE + (yb - EYE) * k + 60];
      }
      var t = TOD[o.tod], night = o.tod === 'night';
      if (night) {
        var zs = D + 900, sp = span(zs);
        CASTLE.stars.forEach(function (st) {
          if (st.x > sp[0] && st.x < sp[1] && st.y > sp[2] && st.y < sp[3]) poly(disc(st.x, st.y, st.r, zs, 4), 'star');
        });
        var mz = D + 1600, ms = span(mz);
        if (CASTLE.moon.x > ms[0] - 80 && CASTLE.moon.x < ms[1] + 80) poly(disc(CASTLE.moon.x, CASTLE.moon.y, 80, mz, 18), 'moon');
      }
      var hz = D + 2600, hs = span(hz), hill = [[hs[0], 0, hz]];
      CASTLE.hills.forEach(function (h) { if (h[0] > hs[0] - 900 && h[0] < hs[1] + 900) hill.push([h[0], h[1], hz]); });
      hill.push([hs[1], 0, hz]);
      poly(hill, 'hill');
      CASTLE.ranks.forEach(function (rank) {
        var sp = span(rank.z);
        rank.towers.forEach(function (tw) {
          if (tw.x + tw.w < sp[0] || tw.x - tw.w > sp[1]) return;
          tower(tw, rank.z, rank.tone);
        });
        if (rank.wall) {
          var wx0 = Math.max(sp[0], -4000), wx1 = sp[1];
          rect(wx0, wx1, 0, rank.wall, rank.z + 1, 'far', rank.tone * 0.92);
          for (var bx = Math.floor(wx0 / 70) * 70; bx < wx1; bx += 70) rect(bx, bx + 36, rank.wall, rank.wall + 46, rank.z + 1, 'far', rank.tone * 0.92);
          if (o.season === 'winter') rect(wx0, wx1, rank.wall - 10, rank.wall + 4, rank.z, 'snow');
        }
      });
    }
    function tower(tw, z, tone) {
      var x0 = tw.x - tw.w / 2, x1 = tw.x + tw.w / 2, top = tw.h;
      rect(x0, x1, 0, top, z, 'far', tone);
      rect(x1 - tw.w * 0.28, x1, 0, top, z - 0.5, 'farDark', tone);
      if (tw.roof) {
        poly([[x0 - tw.w * 0.12, top, z - 1], [x1 + tw.w * 0.12, top, z - 1], [tw.x, top + tw.w * tw.roof, z - 1]], 'farRoof', tone);
        line([tw.x, top + tw.w * tw.roof, z - 1], [tw.x, top + tw.w * tw.roof + 90, z - 1], 'farDark', 1);
        if (tw.flag) poly([[tw.x, top + tw.w * tw.roof + 90, z - 1], [tw.x + 70, top + tw.w * tw.roof + 70, z - 1], [tw.x, top + tw.w * tw.roof + 50, z - 1]], 'flag');
      } else {
        for (var ci = 0; ci < 5; ci++) rect(x0 + ci * tw.w / 5, x0 + ci * tw.w / 5 + tw.w / 10, top, top + tw.w * 0.18, z, 'far', tone);
        if (o.season === 'winter') rect(x0, x1, top - 8, top + 4, z - 1, 'snow');
      }
      tw.lit.forEach(function (lit, i) {
        var wy = top - tw.w * 0.9 - i * tw.w * 1.3;
        if (wy > 260) rect(tw.x - tw.w * 0.08, tw.x + tw.w * 0.08, wy - tw.w * 0.3, wy, z - 1, lit ? 'farLit' : 'farDark', tone);
      });
    }

    // Glass in the wall: the outside, clipped to the opening, then leading
    // in small diamond panes.
    function glazed(ap, xa, xb, ya, yb) {
      var id = 'win' + windows.length;
      windows.push(ap.map(function (p) { return P(p[0], p[1], p[2]); }));
      poly(ap, 'sky');
      clip = id;
      outside(xa, xb, ya, yb);
      clip = null;
      return id;
    }
    function quarries(id, xa, xb, ya, yb, z, q) {
      clip = id;
      var h = yb - ya, sl = 1.5;
      for (var d = -h / sl; d < xb - xa; d += q) {
        line([xa + d, ya, z], [xa + d + h / sl, yb, z], 'lead', 0.45, 0.55);
        line([xa + d + h / sl, ya, z], [xa + d, yb, z], 'lead', 0.45, 0.55);
      }
      clip = null;
    }

    // A tall arched window, two lights under a round head.
    function tallWindow(c, w) {
      var xa = c - w / 2, xb = c + w / 2, r = w / 2, ytop = WIN_TOP - r, zg = D + 40;
      var ap = arch(xa, xb, WIN_Y, ytop, D);
      var id = glazed(ap, xa, xb, WIN_Y, WIN_TOP);
      // Reveals: the wall is thick, so the opening has depth.
      if (cx > xa) poly([[xa, WIN_Y, D], [xa, WIN_Y, zg], [xa, ytop, zg], [xa, ytop, D]], 'stone', 0.78);
      if (cx < xb) poly([[xb, WIN_Y, D], [xb, WIN_Y, zg], [xb, ytop, zg], [xb, ytop, D]], 'stone', 0.78);
      quarries(id, xa, xb, WIN_Y, WIN_TOP, zg, 26);
      clip = id;
      // Mullion, transoms, and tracery in the head.
      line([c, WIN_Y, zg], [c, ytop, zg], 'stone', 4.5);
      [0.36, 0.7].forEach(function (f) { line([xa, WIN_Y + (ytop - WIN_Y) * f, zg], [xb, WIN_Y + (ytop - WIN_Y) * f, zg], 'stone', 3); });
      var hd = arch(xa + 8, c - 2, ytop, ytop, zg).slice(2), hd2 = arch(c + 2, xb - 8, ytop, ytop, zg).slice(2);
      for (var i = 1; i < hd.length; i++) { line(hd[i - 1], hd[i], 'stone', 2.6); line(hd2[i - 1], hd2[i], 'stone', 2.6); }
      var ring = disc(c, ytop + r * 0.56, r * 0.26, zg, 16);
      for (var j = 0; j < ring.length; j++) line(ring[j], ring[(j + 1) % ring.length], 'stone', 2.6);
      clip = null;
      outline(ap, 'stone', 10);
      outline(arch(xa - 14, xb + 14, WIN_Y, ytop, D - 0.5), 'stoneDark', 2);
      poly([[c - 18, WIN_TOP - 8, D - 2], [c + 18, WIN_TOP - 8, D - 2], [c + 25, WIN_TOP + 36, D - 2], [c - 25, WIN_TOP + 36, D - 2]], 'stoneDark');
      box(xa - 20, xb + 20, WIN_Y - 18, WIN_Y, D - 20, D, 'stone');
      if (o.season === 'winter') box(xa - 18, xb + 18, WIN_Y, WIN_Y + 6, D - 18, D, 'snow');
      // Sunlight falling through it onto the floor.
      var t = TOD[o.tod];
      if (t.beam) {
        var top = WIN_Y + (ytop - WIN_Y) * 0.6;
        var hit = function (x, y) { return [x + t.sun * y, 0, D - 0.5 * y]; };
        shafts.push({
          beam: [P(xa, top, D), P(xb, top, D), P.apply(null, hit(xb, WIN_Y)), P.apply(null, hit(xa, WIN_Y))],
          floor: [P.apply(null, hit(xa, WIN_Y)), P.apply(null, hit(xb, WIN_Y)), P.apply(null, hit(xb, top)), P.apply(null, hit(xa, top))]
        });
      }
    }

    // A round window high in the clerestory.
    function oculus(c, r) {
      var ap = disc(c, OCULUS, r, D, 24);
      var id = glazed(ap, c - r, c + r, OCULUS - r, OCULUS + r);
      clip = id;
      for (var a = 0; a < 4; a++) {
        var an = a / 4 * Math.PI;
        line([c - r * Math.cos(an), OCULUS - r * Math.sin(an), D + 20], [c + r * Math.cos(an), OCULUS + r * Math.sin(an), D + 20], 'stone', 2.2);
      }
      clip = null;
      outline(ap, 'stone', 8);
      outline(disc(c, OCULUS, r + 10, D - 0.5, 24), 'stoneDark', 2);
    }

    // A bookcase standing out from the wall between two alcoves, with a
    // bust on top. Books show on whichever side faces the camera.
    function projectingCase(e) {
      var x0 = e - 20, x1 = e + 20, z0 = D - 210, z1 = D - 2, r = seeded('case' + e);
      box(x0, x1, 0, CASE, z0, z1, 'oak');
      var side = x0 > cx ? x0 - 0.6 : (x1 < cx ? x1 + 0.6 : null);
      if (side !== null) {
        for (var L = 0; L < 6; L++) {
          var y0 = 14 + L * 61;
          poly([[side, y0, z0 + 6], [side, y0, z1 - 4], [side, y0 + 54, z1 - 4], [side, y0 + 54, z0 + 6]], 'oakDark');
          var z = z0 + 8;
          while (z < z1 - 14) {
            var w = 7 + r() * 7, h = 36 + r() * 16;
            if (r() < 0.06) { z += 10; continue; }
            poly([[side, y0, z], [side, y0, z + w], [side, y0 + h, z + w], [side, y0 + h, z]], 'book', 1, { k: Math.floor(r() * 8), tone: 0.86 + r() * 0.24 });
            z += w + 0.8;
          }
        }
      }
      box(x0 - 6, x1 + 6, CASE, CASE + 18, z0 - 6, z1, 'oakDark');
      box(e - 13, e + 13, CASE + 18, CASE + 52, z0 + 4, z0 + 30, 'stone');
      poly([[e - 21, CASE + 52, z0 + 17], [e + 21, CASE + 52, z0 + 17], [e + 15, CASE + 76, z0 + 17], [e - 15, CASE + 76, z0 + 17]], 'marble', 0.94);
      poly(disc(e, CASE + 92, 14, z0 + 17, 12), 'marble');
    }

    // A full bookcase against the back wall of an alcove.
    function wallCase(xa, xb, seed) {
      var r = seeded('wall' + seed);
      box(xa, xb, 0, CASE, D - 44, D, 'oakDark');
      for (var L = 0; L < 6; L++) {
        var y0 = 14 + L * 61, x = xa + 6;
        box(xa, xb, y0 - 8, y0, D - 44, D, 'oak');
        while (x < xb - 12) {
          var w = 7 + r() * 8, h = 38 + r() * 16;
          if (x + w > xb - 6) break;
          if (r() < 0.05) { x += 12; continue; }
          rect(x, x + w, y0, y0 + h, D - 38, 'book', 1, { k: Math.floor(r() * 8), tone: 0.86 + r() * 0.24 });
          x += w + 0.8;
        }
      }
      box(xa, xb, CASE - 10, CASE, D - 44, D, 'oak');
    }

    // Oak panelling on the back wall of an alcove.
    function panelling(xa, xb) {
      rect(xa, xb, 0, CASE, D - 1, 'oak');
      var n = Math.max(2, Math.round((xb - xa) / 110)), pw = (xb - xa) / n;
      for (var i = 0; i < n; i++) {
        outline([[xa + i * pw + 10, 30, D - 1.2], [xa + (i + 1) * pw - 10, 30, D - 1.2], [xa + (i + 1) * pw - 10, CASE - 30, D - 1.2], [xa + i * pw + 10, CASE - 30, D - 1.2]], 'oakDark', 1.6);
      }
      box(xa, xb, CASE - 14, CASE, D - 8, D, 'oakDark');
    }

    var api = {
      poly: poly, line: line, rect: rect, box: box, disc: disc, arch: arch, outline: outline, label: label,
      wallCase: wallCase, panelling: panelling, P: P, extras: extras, glows: glows,
      setGroup: function (g) { group = g; }
    };

    // ---- the room shell
    var X0 = -40, ZF = -320;
    // The stretch of wall in view, with some to spare.
    var vx0 = cx - VX / S_BACK - 300, vx1 = cx + (W - VX) / S_BACK + 300;
    poly([[X0, CEIL, ZF], [X1, CEIL, ZF], [X1, CEIL, D], [X0, CEIL, D]], 'ceiling');
    for (var cz = D; cz > ZF; cz -= 90) line([X0, CEIL, cz], [X1, CEIL, cz], 'coffer', 2);
    for (var cxl = X0; cxl < X1; cxl += 140) line([cxl, CEIL, ZF], [cxl, CEIL, D], 'coffer', 2);
    rect(X0, X1, 0, CEIL, D, 'wall');
    // Chequered marble floor, only where it can be seen.
    var T = 80, fx0 = Math.max(X0, Math.floor((vx0 + 300) / T) * T), fx1 = Math.min(X1, vx1 - 200);
    for (var tz = D; tz > ZF; tz -= T) {
      for (var tx = fx0; tx < fx1; tx += T) {
        var dark = ((Math.round(tx / T) + Math.round(tz / T)) & 1) === 0;
        poly([[tx, 0, tz - T], [tx + T, 0, tz - T], [tx + T, 0, tz], [tx, 0, tz]], dark ? 'tileD' : 'tileL');
      }
    }
    // The end wall where the gallery begins, with the way in.
    poly([[X0, 0, ZF], [X0, 0, D], [X0, CEIL, D], [X0, CEIL, ZF]], 'wall', 0.86);
    poly([[X0 + 0.5, 0, 40], [X0 + 0.5, 0, 230], [X0 + 0.5, 300, 230], [X0 + 0.5, 300, 40]], 'doorDark');
    outline([[X0 + 0.6, 0, 30], [X0 + 0.6, 0, 240], [X0 + 0.6, 312, 240], [X0 + 0.6, 312, 30]], 'stone', 8);

    var visible = all.filter(function (b) { return b.x1 > vx0 && b.x0 < vx1; });
    var lit = o.tod === 'night' || o.tod === 'dusk';

    // ---- back wall, from the top: clerestory, entablature, windows,
    // pilasters, then each alcove's own wall.
    box(X0, X1, CEIL - 34, CEIL, D - 18, D, 'stone');
    box(X0, X1, OCULUS - 78, OCULUS - 68, D - 8, D, 'stone');
    visible.forEach(function (b) {
      var c = centre(b), hw = (b.x1 - b.x0) / 2;
      oculus(c, 52);
      // Sunk panels either side of the round window.
      [-1, 1].forEach(function (sd) {
        var p0 = c + sd * 74, p1 = c + sd * (hw - 34);
        if (Math.abs(p1 - p0) > 30) outline([[p0, OCULUS - 44, D - 0.5], [p1, OCULUS - 44, D - 0.5], [p1, OCULUS + 44, D - 0.5], [p0, OCULUS + 44, D - 0.5]], 'stoneDark', 1.6);
      });
    });
    visible.forEach(function (b) { tallWindow(centre(b), Math.min(210, (b.x1 - b.x0) * 0.5)); });
    visible.forEach(function (b) {
      var e = b.x0;
      box(e - 30, e + 30, CASE + 20, CORNICE, D - 12, D, 'stone');
      [-15, 0, 15].forEach(function (d) { line([e + d, CASE + 60, D - 12.5], [e + d, CORNICE - 40, D - 12.5], 'stoneDark', 1.2); });
      box(e - 36, e + 36, CORNICE - 30, CORNICE, D - 16, D, 'stoneDark');
      box(e - 40, e + 40, CORNICE - 36, CORNICE - 30, D - 18, D, 'stone');
      box(e - 36, e + 36, CASE + 20, CASE + 44, D - 16, D, 'stoneDark');
      // A pedestal in the clerestory over each pilaster, carrying a pair of
      // brackets up to the ceiling cornice.
      box(e - 22, e + 22, OCULUS - 68, CEIL - 34, D - 8, D, 'stone', { tone: 0.95 });
      box(e - 6, e + 6, 520, 560, D - 22, D - 12, 'brass');
      poly(disc(e, 572, 4, D - 17, 8), lit ? 'flame' : 'shade');
      if (lit) glows.push({ p: P(e, 572, D - 17), r: 70 });
    });
    box(X0, X1, CORNICE, CORNICE + 54, D - 28, D, 'stone');
    box(X0, X1, CORNICE + 54, CORNICE + 64, D - 32, D, 'stone', { tone: 1.05 });
    for (var dx = Math.max(X0, Math.floor(vx0 / 22) * 22); dx < Math.min(X1, vx1); dx += 22) rect(dx, dx + 11, CORNICE - 14, CORNICE, D - 28.5, 'stoneDark');
    visible.forEach(function (b) {
      var t = TEMPLATES[b.template];
      group = b.filler ? null : b;
      if (t && t.wall) t.wall(api, b, o);
      group = null;
    });

    // ---- the floor level: projecting cases and what stands in each alcove,
    // drawn far to near so nearer things cover farther ones.
    var items = [];
    visible.forEach(function (b) {
      items.push({ x: b.x0, draw: function () { projectingCase(b.x0); } });
      var t = TEMPLATES[b.template];
      if (t && t.floor) items.push({ x: centre(b), draw: function () { group = b.filler ? null : b; t.floor(api, b, o); group = null; } });
    });
    var last = visible[visible.length - 1];
    if (last) items.push({ x: last.x1, draw: function () { projectingCase(last.x1); } });
    items.sort(function (a, b) { return Math.abs(b.x - cx) - Math.abs(a.x - cx); }).forEach(function (it) { it.draw(); });

    return { shapes: S, labels: labels, windows: windows, shafts: shafts, glows: glows, lamp: extras.lamp };
  }

  // ---------------------------------------------------------------- bays

  var TEMPLATES = {
    'shelf-and-table': {
      wall: function (g, b) { g.wallCase(b.x0 + 26, b.x1 - 26, b.id); },
      floor: function (g, b) {
        var c = centre(b), r = seeded(b.id + 'table'), z0 = D - 190, z1 = D - 92;
        [[c - 104, z1 - 10], [c + 94, z1 - 10], [c - 104, z0], [c + 94, z0]].forEach(function (l) { g.box(l[0], l[0] + 10, 0, 104, l[1], l[1] + 10, 'oak'); });
        g.box(c - 116, c + 116, 104, 116, z0 - 4, z1 + 4, 'oak');
        var n = Math.max(1, Math.min(8, b.count || 1));
        for (var i = 0; i < n; i++) {
          var px = c - 80 + i * (150 / n) + r() * 8, pz = (z0 + z1) / 2 + (r() - 0.5) * 30, a = (r() - 0.5) * 0.8, ca = Math.cos(a), sa = Math.sin(a);
          g.poly([[-20, -26], [20, -26], [20, 26], [-20, 26]].map(function (d) {
            return [px + d[0] * ca - d[1] * sa, 116.5 + i * 0.3, pz + d[0] * sa + d[1] * ca];
          }), 'paper', 1.06);
        }
        g.box(c + 82, c + 102, 116, 120, z0 + 20, z0 + 40, 'metal'); g.box(c + 90, c + 94, 120, 180, z0 + 28, z0 + 32, 'metal');
        g.box(c + 74, c + 110, 180, 204, z0 + 12, z0 + 48, 'shade');
        g.extras.lamp = g.P(c + 92, 198, z0 + 30);
        // A globe on a stand beside the table.
        g.box(c - 168, c - 160, 0, 120, z0 + 40, z0 + 48, 'oakDark');
        g.poly(g.disc(c - 164, 150, 30, z0 + 44, 18), 'globe');
        g.line([c - 194, 150, z0 + 43], [c - 134, 150, z0 + 43], 'brass', 1.6);
        g.label(c, CASE + 30, D - 20, b.label);
      }
    },

    'frame-wall': {
      wall: function (g, b) {
        var xa = b.x0 + 24, xb = b.x1 - 24, c = centre(b);
        g.panelling(xa, xb);
        var n = Math.max(1, b.count || 1), cols = Math.min(3, n), rows = Math.ceil(n / cols), fw = 100, fh = 72, gap = 16;
        var left = c - (cols * fw + (cols - 1) * gap) / 2, top = 300;
        for (var i = 0; i < n; i++) {
          var fx = left + (i % cols) * (fw + gap), y0 = top - Math.floor(i / cols) * (fh + gap);
          g.box(fx, fx + fw, y0, y0 + fh, D - 8, D - 1, 'frame');
          g.rect(fx + 8, fx + fw - 8, y0 + 8, y0 + fh - 8, D - 8.2, 'cert');
          g.line([fx + 22, y0 + 48, D - 8.4], [fx + fw - 22, y0 + 48, D - 8.4], 'ink', 1);
          g.line([fx + 28, y0 + 38, D - 8.4], [fx + fw - 28, y0 + 38, D - 8.4], 'ink', 1);
          g.line([fx + 34, y0 + 28, D - 8.4], [fx + fw - 34, y0 + 28, D - 8.4], 'ink', 1);
          g.poly(g.disc(fx + fw - 18, y0 + 18, 6, D - 8.4, 10), 'brass');
        }
        g.label(c, CASE + 30, D - 20, b.label);
      }
    },

    'alcove': {
      wall: function (g, b) {
        var c = centre(b);
        g.panelling(b.x0 + 24, b.x1 - 24);
        g.box(c - 82, c + 82, 70, 350, D - 10, D - 1, 'gilt');
        g.rect(c - 68, c + 68, 84, 336, D - 10.2, 'canvas');
        g.poly(g.disc(c, 250, 28, D - 10.4, 16), 'sitter');
        g.poly([[c - 60, 84, D - 10.4], [c + 60, 84, D - 10.4], [c + 52, 160, D - 10.4], [c + 30, 196, D - 10.4], [c - 30, 196, D - 10.4], [c - 52, 160, D - 10.4]], 'sitter');
        g.poly([[c - 16, 280, D - 10.5], [c, 300, D - 10.5], [c + 16, 280, D - 10.5], [c + 9, 290, D - 10.5], [c, 274, D - 10.5], [c - 9, 290, D - 10.5]], 'brass');
        g.box(c - 30, c + 30, 40, 56, D - 10, D - 1, 'brass');
        g.label(c, CASE + 30, D - 20, b.label);
      }
    },

    'door': {
      wall: function (g, b) {
        var c = centre(b);
        g.panelling(b.x0 + 24, b.x1 - 24);
        g.poly(g.arch(c - 92, c + 92, 0, 248, D - 1.4), 'stone');
        g.poly(g.arch(c - 78, c + 78, 0, 244, D - 1.6), 'doorDark');
        g.poly(g.arch(c - 70, c + 70, 0, 242, D - 2), 'door');
        [-35, 0, 35].forEach(function (d) { g.line([c + d, 0, D - 2.2], [c + d, 300, D - 2.2], 'doorDark', 1.4); });
        g.line([c - 70, 60, D - 2.4], [c - 10, 60, D - 2.4], 'metal', 4);
        g.line([c - 70, 200, D - 2.4], [c - 10, 200, D - 2.4], 'metal', 4);
        g.poly(g.disc(c + 50, 120, 5, D - 2.4, 10), 'doorDark');
        g.poly(g.disc(c + 50, 140, 9, D - 2.4, 12), 'brass');
        g.label(c, CASE + 30, D - 20, b.label);
      }
    },

    'curio': {
      wall: function (g, b) { g.panelling(b.x0 + 24, b.x1 - 24); g.label(centre(b), CASE + 30, D - 20, b.label); },
      floor: function (g, b) {
        var c = centre(b), z0 = D - 180, z1 = D - 80;
        g.box(c - 70, c + 70, 0, 150, z0, z1, 'cloth');
        g.poly([[c - 78, 0, z0 - 4], [c + 80, 0, z0 - 4], [c + 72, 60, z0 - 2], [c + 20, 40, z0 - 2], [c - 30, 70, z0 - 2], [c - 72, 50, z0 - 2]], 'cloth', 0.9);
        g.line([c - 40, 150, z0 - 0.5], [c - 50, 20, z0 - 0.5], 'stoneDark', 1);
        g.line([c + 30, 150, z0 - 0.5], [c + 40, 30, z0 - 0.5], 'stoneDark', 1);
      }
    },

    'stacks': {
      wall: function (g, b) { g.wallCase(b.x0 + 26, b.x1 - 26, b.id); }
    }
  };

  // ---------------------------------------------------------------- render

  function pd(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'Z'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function draw(s, o) {
    var c = s.clip ? ' clip-path="url(#g-' + s.clip + ')"' : '';
    if (s.t === 'poly') {
      if (!s.pts.length) return '';
      if (s.role === 'sky') return '<path d="' + pd(s.pts) + '" fill="url(#g-sky)"/>';
      var col = shade(colour(s, o), s.f);
      return '<path d="' + pd(s.pts) + '" fill="' + col + '" stroke="' + col + '" stroke-width=".5"' + c + '/>';
    }
    if (s.t === 'line') {
      return '<line x1="' + s.a[0].toFixed(1) + '" y1="' + s.a[1].toFixed(1) + '" x2="' + s.b[0].toFixed(1) + '" y2="' + s.b[1].toFixed(1) +
        '" stroke="' + colour(s, o) + '" stroke-width="' + s.w + '"' + (s.op ? ' stroke-opacity="' + s.op + '"' : '') + ' stroke-linecap="round"' + c + '/>';
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
      '<linearGradient id="g-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (t.beam || '#fff') + '" stop-opacity=".9"/><stop offset="1" stop-color="' + (t.beam || '#fff') + '" stop-opacity=".15"/></linearGradient>' +
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
    if (t.beam) sc.shafts.forEach(function (sh) {
      over += '<path d="' + pd(sh.beam) + '" fill="url(#g-beam)" opacity="' + t.ba + '" style="mix-blend-mode:screen" pointer-events="none"/>' +
        '<path d="' + pd(sh.floor) + '" fill="' + t.beam + '" opacity="' + (t.ba * 1.4).toFixed(2) + '" style="mix-blend-mode:screen" pointer-events="none"/>';
    });
    if (t.a) over += '<rect width="' + W + '" height="' + H + '" fill="' + t.tint + '" opacity="' + t.a + '" style="mix-blend-mode:multiply" pointer-events="none"/>';
    sc.glows.forEach(function (gl) { over += '<circle cx="' + gl.p[0].toFixed(1) + '" cy="' + gl.p[1].toFixed(1) + '" r="' + gl.r + '" fill="url(#g-glow)" style="mix-blend-mode:screen" pointer-events="none"/>'; });
    if (t.lamp && sc.lamp) over += '<circle cx="' + sc.lamp[0].toFixed(1) + '" cy="' + sc.lamp[1].toFixed(1) + '" r="200" fill="url(#g-glow)" style="mix-blend-mode:screen" pointer-events="none"/>';
    var labs = o.labels && !opts.noLabels ? '<g class="labels" pointer-events="none">' + sc.labels.map(labelSvg).join('') + '</g>' : '';
    var size = opts.size ? ' width="' + opts.size[0] + '" height="' + opts.size[1] + '"' : ' width="100%" height="100%"';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + size + ' preserveAspectRatio="xMidYMax slice" role="group" aria-label="The Long Gallery">' +
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
  var stW = 900, stH = 640, scale = 1, raf = 0;

  function frame() {
    raf = 0;
    var sc = scene(state);
    sceneEl.innerHTML = render(sc, state);
    if (state.pixel) pixelate(sc, state);
  }
  function queue() { if (!raf) raf = requestAnimationFrame(frame); }

  function step() { return scale * S_BACK; }
  function measure() {
    stW = scroller.clientWidth;
    stH = stage.clientHeight || 600;
    W = Math.max(420, Math.min(1500, H * stW / stH));
    fitCamera();
    scale = Math.max(stW / W, stH / H);
    stage.style.width = stW + 'px';
    track.style.width = Math.round(stW + (CX_MAX - CX_MIN) * step()) + 'px';
    state.cx = CX_MIN + scroller.scrollLeft / step();
    queue();
  }

  function bayAt(cx) {
    if (cx <= CX_MIN + 40) return bays[0];
    var c = cx - LOOK;
    for (var i = 0; i < bays.length; i++) if (c < bays[i].x1) return bays[i];
    return bays[bays.length - 1];
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

  scroller.addEventListener('scroll', function () { state.cx = CX_MIN + scroller.scrollLeft / step(); markBay(); queue(); }, { passive: true });
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
