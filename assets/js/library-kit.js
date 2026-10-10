/*
 * The library kit: a camera and the furniture of the castle library.
 *
 * Everything is placed in room units of about a centimetre:
 *
 *   x  along the back wall, left to right (the end wall is at x = 0)
 *   y  height above the floor
 *   z  depth, from the front of the room (0) to the back wall (D)
 *
 * A Scene is one frame seen from camera position cx. It collects shapes,
 * drops the ones off screen, and joins runs of same-coloured shapes into one
 * path, so a frame stays small enough to redraw as you walk. Things that sit
 * flat on the back wall and never change, like rows of books, are drawn once
 * as symbols (see Kit.symbol) and placed with <use>.
 */
(function (root) {
  'use strict';

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
  function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function toHex(c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function shade(h, f) { var c = hex(h); return toHex(f < 1 ? c.map(function (v) { return v * f; }) : c.map(function (v) { return v + (255 - v) * Math.min(1, f - 1); })); }
  function mix(a, b, t) { var A = hex(a), B = hex(b); return toHex(A.map(function (v, i) { return v + (B[i] - v) * t; })); }
  function n1(v) { return Math.round(v * 10) / 10; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------------------------------------------------------------- symbols

  // Flat artwork drawn once, in wall units with y up, and reused.
  var SYMBOLS = {}, symbolOrder = [];
  function Plane() { this.byFill = {}; this.extra = []; }
  Plane.prototype.rect = function (x0, x1, y0, y1, fill) {
    (this.byFill[fill] = this.byFill[fill] || []).push('M' + n1(x0) + ' ' + n1(y0) + 'H' + n1(x1) + 'V' + n1(y1) + 'H' + n1(x0) + 'Z');
  };
  Plane.prototype.poly = function (pts, fill) {
    (this.byFill[fill] = this.byFill[fill] || []).push('M' + pts.map(function (p) { return n1(p[0]) + ' ' + n1(p[1]); }).join('L') + 'Z');
  };
  Plane.prototype.svg = function () {
    var self = this;
    return Object.keys(this.byFill).map(function (f) { return '<path fill="' + f + '" d="' + self.byFill[f].join('') + '"/>'; }).join('') + this.extra.join('');
  };
  function symbol(id, draw) {
    if (!SYMBOLS[id]) {
      var pl = new Plane();
      draw(pl);
      SYMBOLS[id] = '<g id="' + id + '">' + pl.svg() + '</g>';
      symbolOrder.push(id);
    }
    return id;
  }

  // ---------------------------------------------------------------- scene

  function Scene(o) {
    var self = this;
    var W = this.W = o.W, H = this.H = o.H;
    var K = o.K, F = o.F, VX = o.VX, VY = o.VY, EYE = o.EYE, cx = this.cx = o.cx;
    this.D = o.D; this.ZF = o.ZF; this.X1 = o.X1; this.id = o.id || 's'; this.EYE = EYE;
    var out = [], defs = [], glows = [], labels = [], usedSymbols = {};
    var clipId = null, nclip = 0, group = null, openGroup = null, seen = {};
    var run = null; // the run of same-styled shapes being joined

    function P(x, y, z) { var s = K * F / (F + z); return [VX + (x - cx) * s, VY - (y - EYE) * s]; }
    function sc(z) { return K * F / (F + z); }
    this.P = P; this.s = sc;

    function flush() {
      if (!run) return;
      out.push(run.open + run.d.join('') + run.close);
      run = null;
    }
    function setGroup() {
      if (group === openGroup) { syncClip(); return; }
      flush();
      var keep = clipId; clipId = null; syncClip(); clipId = keep;
      if (openGroup) out.push('</a>');
      openGroup = group;
      // A bay drawn in several passes is one link; later passes still take
      // the click but stay out of the tab order.
      var again = group && seen[group.id];
      if (group) { seen[group.id] = 1; out.push(again ? '<a class="hot" data-bay="' + esc(group.id) + '" href="' + esc(group.href) + '" tabindex="-1" aria-hidden="true">' : '<a class="hot" data-bay="' + esc(group.id) + '" href="' + esc(group.href) + '" aria-label="' + esc(group.title) + '"><title>' + esc(group.title) + '</title>'); }
      syncClip();
    }
    function emit(key, open, d, close) {
      setGroup();
      if (!run || run.key !== key) { flush(); run = { key: key, open: open, d: [], close: close }; }
      run.d.push(d);
    }
    function offscreen(pts) {
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (var i = 0; i < pts.length; i++) { var p = pts[i]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      return x1 < -10 || x0 > W + 10 || y1 < -10 || y0 > H + 10;
    }
    function d2(pts, close) { return 'M' + pts.map(function (p) { return n1(p[0]) + ' ' + n1(p[1]); }).join('L') + (close ? 'Z' : ''); }
    // Clipped shapes share one <g clip-path>, which is far cheaper to paint
    // than a clip on every path.
    function cl() { return ''; }
    var clipOpen = null;
    function syncClip() {
      if (clipOpen === clipId) return;
      if (clipOpen) out.push('</g>');
      clipOpen = clipId;
      if (clipId) out.push('<g clip-path="url(#' + clipId + ')">');
    }

    this.poly = function (p3, fill, o) {
      o = o || {};
      if (!p3.length) return;
      var pts = p3.map(function (p) { return P(p[0], p[1], p[2]); });
      if (offscreen(pts)) return;
      var st = o.op != null ? ' fill-opacity="' + o.op + '"' : '';
      var key = 'p' + fill + (o.op || '') + (o.blend || '') + clipId;
      emit(key, '<path fill="' + fill + '"' + st + cl() + (o.blend ? ' style="mix-blend-mode:' + o.blend + '"' : '') + ' d="', d2(pts, true), '"/>');
    };
    this.path = function (p3, col, w, o) {
      o = o || {};
      var pts = p3.map(function (p) { return P(p[0], p[1], p[2]); });
      if (pts.length < 2 || offscreen(pts)) return;
      var key = 'l' + col + w + (o.op || '') + clipId;
      emit(key, '<path fill="none" stroke="' + col + '" stroke-width="' + (w || 1) + '" stroke-linecap="round" stroke-linejoin="round"' + (o.op != null ? ' stroke-opacity="' + o.op + '"' : '') + cl() + ' d="', d2(pts, false), '"/>');
    };
    this.line = function (a, b, col, w, o) { self.path([a, b], col, w, o); };
    function ell(px, py, rx, ry) {
      return 'M' + n1(px - rx) + ' ' + n1(py) + 'a' + n1(rx) + ' ' + n1(ry) + ' 0 1 0 ' + n1(rx * 2) + ' 0a' + n1(rx) + ' ' + n1(ry) + ' 0 1 0 ' + n1(-rx * 2) + ' 0Z';
    }
    this.ellipse = function (x, y, z, rx, ry, fill, o) {
      o = o || {};
      var p = P(x, y, z), s = sc(z);
      if (offscreen([[p[0] - rx * s, p[1] - ry * s], [p[0] + rx * s, p[1] + ry * s]])) return;
      if (o.stroke) {
        emit('e' + o.stroke + o.sw + clipId, '<path fill="none" stroke="' + o.stroke + '" stroke-width="' + (o.sw || 1) + '"' + cl() + ' d="', ell(p[0], p[1], rx * s, ry * s), '"/>');
        return;
      }
      emit('p' + fill + (o.op || '') + clipId, '<path fill="' + fill + '"' + (o.op != null ? ' fill-opacity="' + o.op + '"' : '') + cl() + ' d="', ell(p[0], p[1], rx * s, ry * s), '"/>');
    };
    this.circle = function (x, y, z, r, fill, o) {
      o = o || {};
      if (fill === 'none') self.ellipse(x, y, z, r, r, null, { stroke: o.stroke, sw: o.sw });
      else self.ellipse(x, y, z, r, r, fill, o);
    };
    this.glow = function (x, y, z, r, a) { var p = P(x, y, z), rr = r * sc(z); if (!offscreen([[p[0] - rr, p[1] - rr], [p[0] + rr, p[1] + rr]])) glows.push({ p: p, r: rr, a: a || 1 }); };
    this.label = function (x, y, z, text) { var p = P(x, y, z); if (p[0] > -50 && p[0] < W + 50) labels.push({ p: p, t: text }); };
    this.clip = function (p3) {
      flush();
      var id = self.id + '-c' + (nclip++);
      defs.push('<clipPath id="' + id + '"><path d="' + d2(p3.map(function (p) { return P(p[0], p[1], p[2]); }), true) + '"/></clipPath>');
      clipId = id; syncClip();
      return id;
    };
    this.unclip = function () { flush(); clipId = null; syncClip(); };
    this.def = function (s) { defs.push(s); };
    this.group = function (g) { group = g || null; };
    // Place a symbol whose origin is at (x0, y0) on the plane at depth z.
    this.use = function (id, x0, y0, z, w, h) {
      var s = sc(z), p = P(x0, y0, z);
      if (offscreen([p, [p[0] + w * s, p[1] - h * s]])) return;
      setGroup(); flush();
      usedSymbols[id] = 1;
      var k = Math.round(s * 10000) / 10000;
      out.push('<use href="#' + id + '" transform="matrix(' + k + ' 0 0 ' + (-k) + ' ' + n1(p[0]) + ' ' + n1(p[1]) + ')"/>');
    };

    // Planes and solids.
    this.back = function (x0, x1, y0, y1, z, c, o) { self.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], c, o); };
    this.side = function (x, z0, z1, y0, y1, c, o) { self.poly([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], c, o); };
    this.flat = function (x0, x1, z0, z1, y, c, o) { self.poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], c, o); };
    this.box = function (x0, x1, y0, y1, z0, z1, c, o) {
      o = o || {};
      if (x0 > cx) self.side(x0, z0, z1, y0, y1, shade(c, 0.74));
      if (x1 < cx) self.side(x1, z0, z1, y0, y1, shade(c, 0.74));
      if (y1 < EYE) self.flat(x0, x1, z0, z1, y1, shade(c, 1.1));
      if (y0 > EYE) self.flat(x0, x1, z0, z1, y0, shade(c, 0.6));
      if (!o.noFront) self.back(x0, x1, y0, y1, z0, c);
    };

    // Many boxes of one colour that don't overlap on screen (shelves, rails),
    // drawn face by face so each face colour joins into one path.
    this.boxes = function (list, c) {
      var sd = shade(c, 0.74), tp = shade(c, 1.1), bt = shade(c, 0.6);
      list.forEach(function (b) { if (b[0] > cx) self.side(b[0], b[4], b[5], b[2], b[3], sd); if (b[1] < cx) self.side(b[1], b[4], b[5], b[2], b[3], sd); });
      list.forEach(function (b) { if (b[3] < EYE) self.flat(b[0], b[1], b[4], b[5], b[3], tp); });
      list.forEach(function (b) { if (b[2] > EYE) self.flat(b[0], b[1], b[4], b[5], b[2], bt); });
      list.forEach(function (b) { self.back(b[0], b[1], b[2], b[3], b[4], c); });
    };

    // The finished frame. opts.symbols inlines the symbols it uses, for a
    // picture that has to stand on its own (the pixel-art renderer).
    this.finish = function (opts) {
      opts = opts || {};
      group = null; clipId = null; setGroup(); flush();
      var over = '';
      if (opts.tint && opts.tintA) over += '<rect width="' + W + '" height="' + H + '" fill="' + opts.tint + '" opacity="' + opts.tintA + '" style="mix-blend-mode:multiply" pointer-events="none"/>';
      glows.forEach(function (g) {
        over += '<circle cx="' + n1(g.p[0]) + '" cy="' + n1(g.p[1]) + '" r="' + n1(g.r) + '" fill="url(#' + self.id + '-glow)" opacity="' + g.a + '" style="mix-blend-mode:screen" pointer-events="none"/>';
      });
      if (opts.vignette) over += '<rect width="' + W + '" height="' + H + '" fill="url(#' + self.id + '-vig)" pointer-events="none"/>';
      defs.push('<radialGradient id="' + self.id + '-glow"><stop offset="0" stop-color="#ffd690" stop-opacity=".8"/><stop offset=".4" stop-color="#ff9a3c" stop-opacity=".25"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>');
      defs.push('<radialGradient id="' + self.id + '-vig" cx=".5" cy=".55" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="' + (opts.vignette || 0) + '"/></radialGradient>');
      if (opts.symbols) Object.keys(usedSymbols).forEach(function (id) { defs.push(SYMBOLS[id]); });
      var labs = opts.labels ? '<g class="labels" pointer-events="none">' + labels.map(function (l) {
        var w = l.t.length * 7.2 + 18;
        return '<rect x="' + n1(l.p[0] - w / 2) + '" y="' + n1(l.p[1] - 11) + '" width="' + n1(w) + '" height="21" rx="10.5" fill="#141414" fill-opacity=".82"/>' +
          '<text x="' + n1(l.p[0]) + '" y="' + n1(l.p[1] + 4) + '" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, monospace" font-size="11.5" fill="#f5efe0" letter-spacing=".5">' + esc(l.t.toUpperCase()) + '</text>';
      }).join('') + '</g>' : '';
      var size = opts.size ? ' width="' + opts.size[0] + '" height="' + opts.size[1] + '"' : ' width="100%" height="100%"';
      return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + n1(W) + ' ' + H + '"' + size + ' preserveAspectRatio="xMidYMax slice" role="group" aria-label="' + esc(opts.label || '') + '">' +
        '<defs>' + defs.join('') + '</defs><rect width="' + n1(W) + '" height="' + H + '" fill="#1a1512"/>' + out.join('') + over + labs + '</svg>';
    };
  }

  // ---------------------------------------------------------------- kit

  var Kit = {};

  Kit.archPts = function (xa, xb, y0, ytop, z) {
    var w = xb - xa, c = (xa + xb) / 2, p = [[xa, y0, z], [xb, y0, z], [xb, ytop, z]];
    for (var i = 0; i <= 24; i++) { var a = i / 24 * Math.PI; p.push([c + w / 2 * Math.cos(a), ytop + w / 2 * Math.sin(a), z]); }
    p.push([xa, ytop, z]);
    return p;
  };

  // A vertical prism over a footprint of (x, z) points, between heights y0
  // and y1. Only faces turned toward the camera are drawn, so it can stand
  // at any angle.
  Kit.prism = function (S, foot, y0, y1, col) {
    var n = foot.length, fa = 0, i;
    for (i = 0; i < n; i++) { var j = (i + 1) % n; fa += foot[i][0] * foot[j][1] - foot[j][0] * foot[i][1]; }
    if (fa < 0) foot = foot.slice().reverse();
    function area(p3) {
      var p = p3.map(function (q) { return S.P(q[0], q[1], q[2]); }), a = 0;
      for (var k = 0; k < p.length; k++) { var m = (k + 1) % p.length; a += p[k][0] * p[m][1] - p[m][0] * p[k][1]; }
      return a;
    }
    for (i = 0; i < n; i++) {
      var A = foot[i], B = foot[(i + 1) % n];
      var f = [[A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]]];
      if (area(f) < 0) {
        var nx = B[1] - A[1], nz = -(B[0] - A[0]), len = Math.sqrt(nx * nx + nz * nz) || 1;
        S.poly(f, shade(col, 0.78 + 0.22 * ((-nx * 0.6 - nz * 0.8) / len)));
      }
    }
    if (y1 < S.EYE) S.poly(foot.map(function (p) { return [p[0], y1, p[1]]; }), shade(col, 1.12));
    if (y0 > S.EYE) S.poly(foot.map(function (p) { return [p[0], y0, p[1]]; }), shade(col, 0.6));
  };
  Kit.rect = function (x, z, w, d, a, ox, oz) {
    ox = ox || 0; oz = oz || 0;
    var c = Math.cos(a || 0), s = Math.sin(a || 0);
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(function (p) {
      var px = p[0] + ox, pz = p[1] + oz;
      return [x + px * c - pz * s, z + px * s + pz * c];
    });
  };
  Kit.local = function (x, z, a, lx, lz) { var c = Math.cos(a), s = Math.sin(a); return [x + lx * c - lz * s, z + lx * s + lz * c]; };
  Kit.turnedLeg = function (S, x, z, h, col) {
    [[0, 0.08, 3], [0.08, 0.16, 4.4], [0.16, 0.5, 2.6], [0.5, 0.58, 4.2], [0.58, 0.9, 2.8], [0.9, 1, 3.8]].forEach(function (p) {
      Kit.prism(S, Kit.rect(x, z, p[2] * 2, p[2] * 2, 0), p[0] * h, p[1] * h, col);
    });
  };

  // ---- books and bookcases

  // One run of shelves, drawn once: books with gilt bands and labels, gaps,
  // and the odd book leaning into a gap.
  Kit.shelfSymbol = function (seed, w, h, shelf, pal) {
    return symbol('books-' + seed + '-' + Math.round(w) + 'x' + Math.round(h), function (pl) {
      var r = seeded(seed), n = Math.floor((h - 10) / shelf);
      for (var i = 0; i < n; i++) {
        var y = 8 + i * shelf, hMax = shelf - 7, x = 2, lean = 0;
        while (x < w - 4) {
          var bw = 3.5 + r() * 7.5, bh = hMax * (0.62 + r() * 0.36), col = shade(pal.books[Math.floor(r() * pal.books.length)], 0.78 + r() * 0.36);
          if (x + bw > w - 2) break;
          if (r() < 0.05) { lean = 1; x += 6 + r() * 8; continue; }
          if (lean) {
            pl.poly([[x, y], [x + bw, y], [x + bw + bh * 0.3, y + bh * 0.95], [x + bh * 0.3, y + bh * 0.95]], col);
            x += bw + bh * 0.3 + 0.6; lean = 0; continue;
          }
          pl.rect(x, x + bw, y, y + bh, col);
          pl.rect(x + bw - 0.8, x + bw, y, y + bh, shade(col, 0.7));
          if (bw > 5) {
            pl.rect(x + 0.6, x + bw - 0.6, y + bh * 0.82, y + bh * 0.84, pal.gilt);
            pl.rect(x + 0.6, x + bw - 0.6, y + bh * 0.16, y + bh * 0.18, pal.gilt);
            if (r() < 0.5) pl.rect(x + 1, x + bw - 1, y + bh * 0.58, y + bh * 0.7, r() < 0.5 ? '#ddd0b2' : '#1a1410');
          }
          x += bw + 0.4;
        }
      }
    });
  };
  Kit.bookcase = function (S, x0, x1, y0, y1, z, pal, seed, o) {
    o = o || {};
    var shelf = o.shelf || 34, n = Math.floor((y1 - y0 - 10) / shelf);
    S.box(x0, x1, y0, y1, z - 36, z, pal.woodDark, { noFront: true });
    S.back(x0, x1, y0, y1, z - 30, shade(pal.woodDark, 0.6));
    S.use(Kit.shelfSymbol(seed, x1 - x0 - 12, y1 - y0, shelf, pal), x0 + 6, y0, z - 28, x1 - x0 - 12, y1 - y0);
    var shelves = [];
    for (var i = 0; i < n; i++) { var y = y0 + 8 + i * shelf; shelves.push([x0 + 6, x1 - 6, y - 4, y, z - 36, z]); }
    shelves.push([x0, x0 + 6, y0, y1, z - 37, z], [x1 - 6, x1, y0, y1, z - 37, z]);
    S.boxes(shelves, pal.wood);
    S.box(x0 - 4, x1 + 4, y0, y0 + 8, z - 38, z, pal.woodDark);
    S.box(x0 - 6, x1 + 6, y1, y1 + 10, z - 42, z, pal.woodDark);
    S.box(x0 - 4, x1 + 4, y1 + 10, y1 + 14, z - 40, z, shade(pal.wood, 1.1));
  };
  // A stack of books lying flat, page edges showing.
  Kit.stack = function (S, x, y, z, n, r, pal) {
    for (var i = 0; i < n; i++) {
      var w = 18 + r() * 12, d = 13 + r() * 8, t = 2.5 + r() * 3.5, a = (r() - 0.5) * 0.5;
      Kit.prism(S, Kit.rect(x, z, w, d, a), y, y + t, pal.books[Math.floor(r() * pal.books.length)]);
      var pf = Kit.rect(x, z, w - 2, d + 0.4, a);
      S.poly([[pf[0][0], y + t * 0.18, pf[0][1]], [pf[1][0], y + t * 0.18, pf[1][1]], [pf[1][0], y + t * 0.82, pf[1][1]], [pf[0][0], y + t * 0.82, pf[0][1]]], '#ece2c8');
      y += t;
    }
    return y;
  };
  Kit.openBook = function (S, x, y, z, a, col) {
    function L(lx, lz, ly) { var q = Kit.local(x, z, a, lx, lz); return [q[0], y + (ly || 0), q[1]]; }
    S.poly([L(-17, -12), L(17, -12), L(17, 12), L(-17, 12)], shade(col, 0.8));
    S.poly([L(-16, -11, 1.5), L(0, -11, 0.6), L(0, 11, 0.6), L(-16, 11, 1.5)], '#f1e8d2');
    S.poly([L(0, -11, 0.6), L(16, -11, 1.5), L(16, 11, 1.5), L(0, 11, 0.6)], '#e8dec6');
    for (var i = 0; i < 5; i++) { S.line(L(-14, -8 + i * 3.6, 1.5), L(-3, -8 + i * 3.6, 0.8), '#6a6058', 0.3); S.line(L(3, -8 + i * 3.6, 0.8), L(14, -8 + i * 3.6, 1.5), '#6a6058', 0.3); }
  };
  Kit.sheet = function (S, x, y, z, a, col) {
    function L(lx, lz) { var q = Kit.local(x, z, a, lx, lz); return [q[0], y, q[1]]; }
    S.poly([L(-10.5, -14.5), L(10.5, -14.5), L(10.5, 14.5), L(-10.5, 14.5)], col);
    for (var i = 0; i < 6; i++) S.line(L(-7.5, -9.5 + i * 3.6), L(7.5 - (i % 3) * 2, -9.5 + i * 3.6), '#5a5248', 0.35, { op: 0.7 });
  };

  // ---- furniture

  // A buttoned leather armchair, turned by angle a (0 faces the front of the room).
  Kit.chesterfield = function (S, x, z, a, col) {
    function L(lx, lz) { return Kit.local(x, z, a, lx, lz); }
    [[-30, -28], [30, -28], [-30, 28], [30, 28]].forEach(function (p) { var q = L(p[0], p[1]); Kit.prism(S, Kit.rect(q[0], q[1], 6, 6, a), 0, 10, '#2a1a10'); });
    Kit.prism(S, Kit.rect(x, z, 80, 72, a), 10, 40, col);
    var back = L(0, 30); Kit.prism(S, Kit.rect(back[0], back[1], 80, 14, a), 40, 104, col);
    Kit.prism(S, Kit.rect(back[0], back[1], 84, 18, a), 98, 106, shade(col, 1.08));
    var seat = L(0, -4); Kit.prism(S, Kit.rect(seat[0], seat[1], 56, 54, a), 40, 50, shade(col, 1.06));
    [-1, 1].forEach(function (sd) {
      var arm = L(sd * 33, -4);
      Kit.prism(S, Kit.rect(arm[0], arm[1], 14, 66, a), 40, 70, col);
      Kit.prism(S, Kit.rect(arm[0], arm[1], 18, 66, a, sd * 2), 66, 74, shade(col, 1.08));
    });
    for (var r = 0; r < 3; r++) for (var c = 0; c < 4 - (r % 2); c++) {
      var bp = L(-24 + c * 16 + (r % 2) * 8, 22.5);
      S.circle(bp[0], 60 + r * 13, bp[1], 1.2, shade(col, 0.7));
    }
  };
  Kit.table = function (S, x0, x1, z0, z1, pal, o) {
    o = o || {};
    var h = 76, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    [[x0 + 6, z1 - 6], [x1 - 6, z1 - 6]].forEach(function (p) { Kit.turnedLeg(S, p[0], p[1], h - 12, pal.woodDark); });
    Kit.prism(S, Kit.rect(mx, mz, x1 - x0 - 12, z1 - z0 - 12, 0), h - 14, h - 4, shade(pal.wood, 0.9));
    [[x0 + 6, z0 + 6], [x1 - 6, z0 + 6]].forEach(function (p) { Kit.turnedLeg(S, p[0], p[1], h - 12, pal.woodDark); });
    S.back(mx - 40, mx + 40, h - 13, h - 5, z0 + 5.5, shade(pal.wood, 0.8));
    S.circle(mx, h - 9, z0 + 5, 1.6, pal.brass);
    Kit.prism(S, Kit.rect(mx, mz, x1 - x0, z1 - z0, 0), h - 4, h, pal.wood);
    if (o.leather) S.flat(x0 + 8, x1 - 8, z0 + 8, z1 - 8, h + 0.3, o.leather);
  };
  Kit.readingLamp = function (S, x, y, z, pal, lit) {
    Kit.prism(S, Kit.rect(x, z, 16, 12, 0), y, y + 2.5, pal.brass);
    S.line([x, y + 2.5, z], [x, y + 32, z], pal.brass, 2);
    S.poly([[x - 17, y + 28, z - 4], [x + 17, y + 28, z - 4], [x + 13, y + 38, z - 2], [x - 13, y + 38, z - 2]], '#2f6a4a');
    if (lit) S.glow(x, y + 24, z, 120, 0.85);
  };
  Kit.globe = function (S, x, z, pal) {
    [0, 2.1, 4.2].forEach(function (a) { S.line([x + 22 * Math.cos(a), 0, z + 22 * Math.sin(a)], [x, 58, z], pal.woodDark, 2.6); });
    Kit.prism(S, Kit.rect(x, z, 8, 8, 0), 52, 70, pal.woodDark);
    var hz = [];
    for (var i = 0; i <= 32; i++) { var b = i / 32 * Math.PI * 2; hz.push([x + 36 * Math.cos(b), 98, z + 36 * Math.sin(b)]); }
    S.path(hz.filter(function (p) { return p[2] >= z; }), pal.wood, 4);
    S.circle(x, 98, z, 28, '#5c8a8e');
    S.poly([[x - 14, 112, z - 28], [x - 2, 118, z - 28], [x + 6, 106, z - 28], [x - 4, 96, z - 28], [x - 16, 100, z - 28]], '#d2bc84');
    S.poly([[x + 4, 92, z - 28], [x + 16, 96, z - 28], [x + 18, 82, z - 28], [x + 8, 76, z - 28]], '#d2bc84');
    S.ellipse(x - 8, 108, z - 29, 6, 4, '#ffffff', { op: 0.25 });
    var mer = [];
    for (var j = 0; j <= 24; j++) { var c = -Math.PI / 2 + j / 24 * Math.PI * 1.1; mer.push([x + 31 * Math.cos(c) * 0.3, 98 + 31 * Math.sin(c + 1.4), z - 31 * Math.cos(c)]); }
    S.path(mer, pal.brass, 1.8);
    S.path(hz.filter(function (p) { return p[2] < z; }), pal.wood, 4);
  };
  Kit.orrery = function (S, x, y, z, pal, t) {
    Kit.prism(S, Kit.rect(x, z, 20, 20, 0.4), y, y + 4, pal.woodDark);
    Kit.prism(S, Kit.rect(x, z, 3, 3, 0), y + 4, y + 38, pal.brass);
    S.circle(x, y + 44, z, 7, '#f2c14e');
    [[18, 2.2, '#9a8a7a', 0.9], [28, 3, '#c8a060', 2.1], [40, 3.4, '#4a72a8', 3.4], [54, 2.8, '#b05a3a', 4.6]].forEach(function (pl, i) {
      var a = pl[3] + (t || 0) * (1 + i * 0.4), px = x + pl[0] * Math.cos(a), pz = z + pl[0] * Math.sin(a) * 0.9, ring = [];
      for (var k = 0; k <= 24; k++) { var b = k / 24 * Math.PI * 2; ring.push([x + pl[0] * Math.cos(b), y + 38, z + pl[0] * Math.sin(b) * 0.9]); }
      S.path(ring, pal.brass, 0.5, { op: 0.5 });
      S.line([x, y + 38, z], [px, y + 38, pz], pal.brass, 0.9);
      S.line([px, y + 38, pz], [px, y + 42, pz], pal.brass, 0.7);
      S.circle(px, y + 43, pz, pl[1], pl[2]);
    });
  };
  Kit.rug = function (S, x0, x1, z0, z1, a, b, c) {
    S.flat(x0, x1, z0, z1, 0.3, a);
    S.flat(x0 + 8, x1 - 8, z0 + 8, z1 - 8, 0.4, b);
    S.flat(x0 + 14, x1 - 14, z0 + 14, z1 - 14, 0.5, a);
    for (var x = x0 + 18; x < x1 - 18; x += 16) S.poly([[x, 0.45, z0 + 11], [x + 8, 0.45, z0 + 8], [x + 16, 0.45, z0 + 11], [x + 8, 0.45, z0 + 14]], c);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = (x1 - x0) / 2 - 40, rz = (z1 - z0) / 2 - 40;
    S.poly([[cx, 0.6, cz - rz], [cx + rx, 0.6, cz], [cx, 0.6, cz + rz], [cx - rx, 0.6, cz]], b);
    S.poly([[cx, 0.7, cz - rz * 0.5], [cx + rx * 0.5, 0.7, cz], [cx, 0.7, cz + rz * 0.5], [cx - rx * 0.5, 0.7, cz]], c);
    for (var fx = x0 + 2; fx < x1; fx += 4) S.line([fx, 0.3, z0], [fx, 0.3, z0 - 6], shade(b, 1.2), 0.5);
  };
  Kit.cat = function (S, x, z, col) {
    S.ellipse(x, 9, z, 24, 10, col);
    S.ellipse(x + 2, 13, z - 2, 18, 8, shade(col, 1.15));
    S.circle(x - 18, 12, z - 4, 8, col);
    S.poly([[x - 24, 17, z - 4], [x - 21, 26, z - 4], [x - 17, 18, z - 4]], col);
    S.poly([[x - 16, 18, z - 4], [x - 12, 25, z - 4], [x - 10, 16, z - 4]], col);
    S.path([[x + 22, 6, z - 2], [x + 18, 2, z - 10], [x, 2, z - 14], [x - 14, 4, z - 12]], col, 3);
  };
  Kit.fern = function (S, x, z) {
    Kit.prism(S, Kit.rect(x, z, 24, 24, 0.3), 0, 26, '#8a4a2a');
    Kit.prism(S, Kit.rect(x, z, 28, 28, 0.3), 26, 30, '#9a5a3a');
    var r = seeded('fern' + x);
    for (var i = 0; i < 14; i++) {
      var a = i / 14 * Math.PI * 2, len = 40 + r() * 30, pts = [];
      for (var t = 0; t <= 6; t++) { var f = t / 6; pts.push([x + Math.cos(a) * len * f, 30 + len * 0.9 * Math.sin(f * Math.PI * 0.7), z + Math.sin(a) * len * f * 0.6]); }
      S.path(pts, i % 2 ? '#4a7a3a' : '#5a8a44', 2.6);
    }
  };
  Kit.mapChest = function (S, x0, x1, z0, z1, pal) {
    Kit.prism(S, Kit.rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0), 0, 84, pal.wood);
    for (var d = 0; d < 6; d++) {
      S.back(x0 + 4, x1 - 4, 6 + d * 13, 17 + d * 13, z0 - 0.3, shade(pal.wood, 0.9 + (d % 2) * 0.08));
      S.back((x0 + x1) / 2 - 7, (x0 + x1) / 2 + 7, 10 + d * 13, 12 + d * 13, z0 - 0.5, pal.brass);
    }
    S.line([x0 + 10, 88, z0 + 20], [x1 - 6, 88, z0 + 34], '#e6d8b0', 7);
    S.circle(x0 + 10, 88, z0 + 20, 3.5, '#d6c69c');
  };
  Kit.trolley = function (S, x, z, pal, seed) {
    Kit.prism(S, Kit.rect(x, z, 90, 36, 0), 14, 18, pal.wood);
    Kit.prism(S, Kit.rect(x, z, 90, 36, 0), 56, 60, pal.wood);
    [[x - 42, z - 16], [x + 42, z - 16], [x - 42, z + 16], [x + 42, z + 16]].forEach(function (p) { S.line([p[0], 6, p[1]], [p[0], 60, p[1]], pal.brass, 1.6); S.circle(p[0], 4, p[1], 3.5, '#222'); });
    var r = seeded(seed), tx = x - 40;
    while (tx < x + 36) { var bw = 4 + r() * 5; S.back(tx, tx + bw, 60, 82 + r() * 8, z, shade(pal.books[Math.floor(r() * pal.books.length)], 0.9)); tx += bw + 0.5; }
    Kit.stack(S, x - 10, 18, z, 3, r, pal);
  };
  Kit.railLadder = function (S, x, z, top, pal) {
    var foot = z - 76;
    [0, 38].forEach(function (dx) {
      S.line([x + dx, 4, foot], [x + dx, top + 8, z - 6], pal.brass, 2.6);
      S.path([[x + dx, top + 8, z - 6], [x + dx, top + 16, z - 4], [x + dx, top + 14, z - 1]], pal.brass, 2);
      S.circle(x + dx, 4, foot, 4, '#2a2a2a');
    });
    for (var i = 1; i < top / 28; i++) { var t = i * 28 / top, y = 4 + t * (top + 4), zz = foot + (z - 6 - foot) * t; S.line([x, y, zz], [x + 38, y, zz], pal.brass, 1.8); }
  };

  // ---- on the walls

  Kit.certificate = function (S, x0, y0, z, pal) {
    S.box(x0, x0 + 48, y0, y0 + 36, z - 5, z, '#2a1e14');
    S.back(x0 + 3, x0 + 45, y0 + 3, y0 + 33, z - 5.1, '#c8a050');
    S.back(x0 + 5, x0 + 43, y0 + 5, y0 + 31, z - 5.2, '#f1e9d6');
    S.line([x0 + 12, y0 + 26, z - 5.3], [x0 + 36, y0 + 26, z - 5.3], '#3a3028', 1);
    for (var i = 0; i < 3; i++) S.line([x0 + 10, y0 + 20 - i * 4, z - 5.3], [x0 + 38 - i * 3, y0 + 20 - i * 4, z - 5.3], '#6a6058', 0.4);
    S.poly([[x0 + 34, y0 + 6, z - 5.4], [x0 + 32, y0 - 2, z - 5.4], [x0 + 35, y0 + 1, z - 5.4], [x0 + 38, y0 - 2, z - 5.4], [x0 + 36, y0 + 6, z - 5.4]], '#7a1a1a');
    S.circle(x0 + 35, y0 + 8, z - 5.5, 3.6, '#a8262a');
  };
  Kit.portrait = function (S, xc, y0, w, h, z, pal) {
    S.box(xc - w / 2, xc + w / 2, y0, y0 + h, z - 6, z, pal.gilt);
    S.back(xc - w / 2 + 7, xc + w / 2 - 7, y0 + 7, y0 + h - 7, z - 6.2, '#253028');
    S.circle(xc, y0 + h * 0.62, z - 6.5, w * 0.14, '#121714');
    S.poly([[xc - w * 0.36, y0 + 7, z - 6.5], [xc + w * 0.36, y0 + 7, z - 6.5], [xc + w * 0.3, y0 + h * 0.36, z - 6.5], [xc + w * 0.14, y0 + h * 0.5, z - 6.5], [xc - w * 0.14, y0 + h * 0.5, z - 6.5], [xc - w * 0.3, y0 + h * 0.36, z - 6.5]], '#121714');
    S.poly([[xc - 8, y0 + h * 0.76, z - 6.6], [xc, y0 + h * 0.84, z - 6.6], [xc + 8, y0 + h * 0.76, z - 6.6], [xc + 4, y0 + h * 0.8, z - 6.6], [xc, y0 + h * 0.74, z - 6.6], [xc - 4, y0 + h * 0.8, z - 6.6]], pal.gilt);
  };
  Kit.door = function (S, xc, z, pal) {
    var w = 120, h = 220;
    S.poly(Kit.archPts(xc - w / 2 - 14, xc + w / 2 + 14, 0, h - w / 2, z - 0.5), pal.stone);
    var leaf = Kit.archPts(xc - w / 2, xc + w / 2, 0, h - w / 2, z - 1);
    S.poly(leaf, pal.door);
    S.clip(leaf);
    for (var i = 1; i < 4; i++) S.line([xc - w / 2 + i * w / 4, 0, z - 1.2], [xc - w / 2 + i * w / 4, h + 40, z - 1.2], shade(pal.door, 0.6), 0.8);
    S.unclip();
    [40, 150].forEach(function (y) { S.line([xc - w / 2, y, z - 1.4], [xc + 10, y, z - 1.4], '#1d1d1d', 3); });
    for (var s = 0; s < 6; s++) [40, 150].forEach(function (y) { S.circle(xc - w / 2 + 8 + s * 10, y, z - 1.5, 1.2, '#555'); });
    S.circle(xc + 40, 100, z - 1.5, 6, pal.brass);
    S.circle(xc + 40, 86, z - 1.5, 2, '#111');
  };
  Kit.gear = function (S, x, y, z, r, teeth, col, o) {
    o = o || {};
    var p = [], rot = o.rot || 0;
    for (var i = 0; i < teeth; i++) {
      var a = rot + i / teeth * Math.PI * 2, da = Math.PI / teeth;
      [[a - da * 0.55, r * 0.86], [a - da * 0.35, r], [a + da * 0.35, r], [a + da * 0.55, r * 0.86]].forEach(function (q) { p.push([x + q[1] * Math.cos(q[0]), y + q[1] * Math.sin(q[0]), z]); });
    }
    S.poly(p, col);
    S.circle(x, y, z - 0.3, r * 0.72, shade(col, 0.72));
    var sp = o.spokes || 5;
    for (var k = 0; k < sp; k++) { var b = rot + k / sp * Math.PI * 2; S.line([x, y, z - 0.5], [x + r * 0.7 * Math.cos(b), y + r * 0.7 * Math.sin(b), z - 0.5], col, Math.max(2, r * 0.07)); }
    S.circle(x, y, z - 0.6, r * 0.16, shade(col, 1.15));
    S.circle(x, y, z - 0.7, r * 0.06, '#1a1714');
  };
  Kit.pipe = function (S, pts, w, col) {
    S.path(pts, shade(col, 0.6), w + 2);
    S.path(pts, col, w);
    S.path(pts.map(function (p) { return [p[0], p[1] + w * 0.25, p[2] - 0.3]; }), shade(col, 1.3), w * 0.25, { op: 0.7 });
  };
  Kit.gauge = function (S, x, y, z, r, pal, v) {
    S.circle(x, y, z, r + 3, pal.brass);
    S.circle(x, y, z - 0.2, r, '#f1eadb');
    for (var i = 0; i <= 8; i++) { var a = Math.PI * (1.15 - i / 8 * 1.3); S.line([x + r * 0.75 * Math.cos(a), y + r * 0.75 * Math.sin(a), z - 0.3], [x + r * 0.92 * Math.cos(a), y + r * 0.92 * Math.sin(a), z - 0.3], '#333', 0.6); }
    var na = Math.PI * (1.15 - (v || 0.6) * 1.3);
    S.line([x, y, z - 0.4], [x + r * 0.8 * Math.cos(na), y + r * 0.8 * Math.sin(na), z - 0.4], '#a01e1e', 1.2);
  };
  Kit.valve = function (S, x, y, z, r, col) {
    var ring = [];
    for (var i = 0; i <= 20; i++) { var a = i / 20 * Math.PI * 2; ring.push([x + r * Math.cos(a), y + r * Math.sin(a), z]); }
    S.path(ring, col, 2.4);
    for (var k = 0; k < 4; k++) { var b = k / 4 * Math.PI * 2 + 0.4; S.line([x, y, z], [x + r * Math.cos(b), y + r * Math.sin(b), z], col, 1.4); }
  };
  Kit.tubeStation = function (S, x, z, pal) {
    S.box(x - 14, x + 14, 250, 300, z - 16, z, pal.brass);
    S.back(x - 10, x + 10, 256, 290, z - 16.2, shade(pal.brass, 0.6));
    S.ellipse(x, 273, z - 16.5, 5, 13, '#7a8a8a');
  };
  Kit.ironColumn = function (S, x, y0, y1, z, pal) {
    S.box(x - 16, x + 16, y0, y0 + 20, z - 16, z + 16, pal.iron);
    S.box(x - 8, x + 8, y0 + 20, y1 - 30, z - 8, z + 8, shade(pal.iron, 1.1));
    for (var y = y0 + 40; y < y1 - 40; y += 40) S.line([x - 8, y, z - 8.4], [x + 8, y, z - 8.4], pal.brass, 1, { op: 0.6 });
    S.poly([[x - 8, y1 - 30, z - 8.5], [x + 8, y1 - 30, z - 8.5], [x + 22, y1, z - 8.5], [x - 22, y1, z - 8.5]], pal.brass);
  };
  Kit.gasLamp = function (S, x, z, pal, lit) {
    S.line([x, 200, z], [x, 200, z - 26], pal.iron, 2.4);
    S.line([x, 200, z - 26], [x, 212, z - 26], pal.iron, 2);
    S.ellipse(x, 226, z - 26, 9, 13, lit ? '#ffe6a8' : '#e8e4da', { op: lit ? 1 : 0.6 });
    if (lit) S.glow(x, 226, z - 26, 200, 0.9);
  };
  Kit.stove = function (S, zc, pal, top, lit) {
    S.flat(0, 70, zc - 80, zc + 80, 0.5, shade(pal.iron, 1.3));
    S.box(10, 70, 0, 18, zc - 50, zc + 50, pal.iron);
    S.box(14, 66, 18, 110, zc - 44, zc + 44, shade(pal.iron, 1.05));
    S.side(66.5, zc - 26, zc + 26, 34, 80, '#2a1208');
    for (var g = 0; g < 5; g++) S.side(66.8, zc - 22 + g * 10, zc - 18 + g * 10, 36, 78, '#ff9a3c', { op: 0.9 });
    S.box(8, 72, 110, 120, zc - 50, zc + 50, pal.brass);
    // The flue rises, then turns into the chimney breast behind it.
    S.box(30, 50, 120, top, zc - 10, zc + 10, pal.iron);
    S.box(0, 50, top - 20, top, zc - 10, zc + 10, pal.iron);
    S.box(0, 4, top - 26, top + 6, zc - 16, zc + 16, pal.brass);
    S.box(28, 52, 200, 208, zc - 12, zc + 12, pal.brass);
    S.glow(90, 60, zc, lit ? 360 : 220, 1);
  };
  Kit.teapot = function (S, x, y, z, col) {
    S.ellipse(x, y + 9, z, 11, 9, col);
    S.ellipse(x, y + 18, z, 5, 2, shade(col, 0.8));
    S.path([[x + 9, y + 10, z], [x + 17, y + 16, z], [x + 19, y + 19, z]], col, 3);
    S.path([[x - 10, y + 14, z], [x - 16, y + 12, z], [x - 15, y + 6, z], [x - 10, y + 5, z]], col, 2);
  };

  // ---- the castle outside

  // The rest of the castle, laid out once along the whole gallery, so that
  // walking past a window moves the view through it.
  Kit.castle = function (seed, D) {
    var r = seeded(seed), from = -3000, to = 12000;
    function towers(gMin, gMax, wMin, wMax, hMin, hMax, roofs) {
      var t = [];
      for (var x = from + r() * gMax; x < to; x += gMin + r() * (gMax - gMin)) {
        t.push({ x: x, w: wMin + r() * (wMax - wMin), h: hMin + r() * (hMax - hMin), roof: r() < roofs ? 1 + r() * 1.3 : 0, flag: r() < 0.4, lit: [r() < 0.5, r() < 0.5, r() < 0.5, r() < 0.5] });
      }
      return t;
    }
    var hills = [];
    for (var hx = from; hx < to; hx += 300 + r() * 500) hills.push([hx, 1500 + r() * 1300]);
    var stars = [];
    for (var i = 0; i < 1600; i++) stars.push([from + r() * (to - from), 900 + r() * 3600, 3 + r() * 5]);
    var clouds = [];
    for (var c = 0; c < 40; c++) clouds.push([from + r() * (to - from), 2400 + r() * 1400, 300 + r() * 300, 70 + r() * 50]);
    return {
      hills: hills, stars: stars, clouds: clouds,
      ranks: [
        { z: D + 2600, tone: 0.9, towers: towers(800, 1600, 300, 480, 2600, 4200, 0.7) },
        { z: D + 1400, tone: 1, towers: towers(450, 950, 170, 280, 1500, 2700, 0.55), wall: 1200 },
        { z: D + 600, tone: 1.08, towers: towers(900, 1700, 130, 200, 1000, 1500, 0.35), wall: 900 }
      ]
    };
  };
  // What shows through an opening spanning xa..xb, ya..yb on the back wall.
  // The caller sets the clip.
  Kit.outside = function (S, C, xa, xb, ya, yb, sky) {
    var D = S.D, cx = S.cx, E = S.EYE;
    function span(z) { var k = (700 + z) / (700 + D); return [cx + (xa - cx) * k - 80, cx + (xb - cx) * k + 80, E + (ya - E) * k - 80, E + (yb - E) * k + 80]; }
    S.poly([[xa - 10, ya - 10, D + 1], [xb + 10, ya - 10, D + 1], [xb + 10, yb + 400, D + 1], [xa - 10, yb + 400, D + 1]], 'url(#' + S.id + '-sky)');
    if (sky.stars) {
      var zs = D + 1200, sp = span(zs);
      C.stars.forEach(function (st) { if (st[0] > sp[0] && st[0] < sp[1] && st[1] > sp[2] && st[1] < sp[3]) S.circle(st[0], st[1], zs, st[2], '#ffffff', { op: sky.stars }); });
    }
    if (sky.moon) S.circle(sky.moon[0], sky.moon[1], D + 2400, 160, '#f4f1e2');
    var hz = D + 3400, hs = span(hz), hill = [[hs[0], 0, hz]];
    C.hills.forEach(function (h) { if (h[0] > hs[0] - 900 && h[0] < hs[1] + 900) hill.push([h[0], h[1], hz]); });
    hill.push([hs[1], 0, hz]);
    S.poly(hill, mix(sky.hill, sky.haze, 0.45));
    C.ranks.forEach(function (rank) {
      var sp = span(rank.z), base = mix(shade(sky.stone, rank.tone), sky.haze, rank.z > D + 2000 ? 0.55 : rank.z > D + 1000 ? 0.35 : 0.18);
      var roofCol = sky.snow ? mix(mix(sky.roof, '#e8eef2', 0.55), sky.haze, rank.z > D + 2000 ? 0.4 : 0.15) : mix(sky.roof, sky.haze, rank.z > D + 2000 ? 0.5 : 0.25);
      rank.towers.forEach(function (t) {
        if (t.x + t.w < sp[0] || t.x - t.w > sp[1]) return;
        var x0 = t.x - t.w / 2, x1 = t.x + t.w / 2, z = rank.z;
        S.back(x0, x1, 0, t.h, z, base);
        S.back(x1 - t.w * 0.3, x1, 0, t.h, z - 0.5, shade(base, 0.82));
        if (t.roof) {
          var apex = t.h + t.w * t.roof;
          S.poly([[x0 - t.w * 0.12, t.h, z - 1], [x1 + t.w * 0.12, t.h, z - 1], [t.x, apex, z - 1]], roofCol);
          S.line([t.x, apex, z - 1], [t.x, apex + 120, z - 1], shade(base, 0.6), 1);
          if (t.flag) S.poly([[t.x, apex + 120, z - 1], [t.x + 90, apex + 96, z - 1], [t.x, apex + 72, z - 1]], sky.flag);
        } else {
          for (var c = 0; c < 5; c++) S.back(x0 + c * t.w / 5, x0 + c * t.w / 5 + t.w / 10, t.h, t.h + t.w * 0.18, z, base);
          if (sky.snow) S.back(x0, x1, t.h - 10, t.h + 4, z - 1, '#eef2f4');
        }
        t.lit.forEach(function (l, i) {
          var wy = t.h - t.w * 0.9 - i * t.w * 1.4;
          if (wy > 300) S.back(t.x - t.w * 0.08, t.x + t.w * 0.08, wy - t.w * 0.32, wy, z - 1, l && sky.lit ? '#ffcc66' : shade(base, 0.6));
        });
      });
      if (rank.wall) {
        var w0 = sp[0], w1 = sp[1], wc = shade(base, 0.92);
        S.back(w0, w1, 0, rank.wall, rank.z + 1, wc);
        for (var bx = Math.floor(w0 / 80) * 80; bx < w1; bx += 80) S.back(bx, bx + 42, rank.wall, rank.wall + 54, rank.z + 1, wc);
        if (sky.snow) S.back(w0, w1, rank.wall - 10, rank.wall + 4, rank.z, '#eef2f4');
      }
    });
  };
  Kit.skyDef = function (S, sky) {
    S.def('<linearGradient id="' + S.id + '-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="' + S.H + '"><stop offset="0" stop-color="' + sky.top + '"/><stop offset=".55" stop-color="' + sky.bottom + '"/></linearGradient>');
  };
  // A round-headed window on the back wall: the view, then glass and stone.
  Kit.window = function (S, C, xa, xb, y0, ytop, pal, sky) {
    var D = S.D, zg = D + 40, w = xb - xa, top = ytop + w / 2;
    var ap = Kit.archPts(xa, xb, y0, ytop, D);
    S.clip(ap);
    Kit.outside(S, C, xa, xb, y0, top, sky);
    S.unclip();
    if (S.cx > xa) S.side(xa, D, zg, y0, ytop, shade(pal.stone, 0.72));
    if (S.cx < xb) S.side(xb, D, zg, y0, ytop, shade(pal.stone, 0.72));
    S.clip(Kit.archPts(xa, xb, y0, ytop, zg));
    var h = top - y0;
    for (var dd = -h / 1.5; dd < w; dd += 30) {
      S.line([xa + dd, y0, zg], [xa + dd + h / 1.5, top, zg], pal.lead, 0.5, { op: 0.6 });
      S.line([xa + dd + h / 1.5, y0, zg], [xa + dd, top, zg], pal.lead, 0.5, { op: 0.6 });
    }
    S.line([xa + w / 2, y0, zg], [xa + w / 2, ytop + w * 0.25, zg], pal.stone, 4);
    S.unclip();
    S.path(ap.slice(1).concat([ap[0]]), pal.stone, 6);
    S.box(xa - 16, xb + 16, y0 - 14, y0, D - 18, D, pal.stone);
  };

  root.LibraryKit = {
    Scene: Scene, Kit: Kit, seeded: seeded, shade: shade, mix: mix,
    symbols: function () { return symbolOrder.map(function (id) { return SYMBOLS[id]; }).join(''); },
    symbolCount: function () { return symbolOrder.length; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
