(() => {
'use strict';
const PUZZLES = window.__SHOAL_PUZZLES__;
const STEMS = {};
for (const e of window.__SHOAL_STEMS__.split(' ')) { const [w,list] = e.split(':'); STEMS[w] = list.split(','); }
delete window.__SHOAL_PUZZLES__; delete window.__SHOAL_STEMS__;
const EPOCH = Date.UTC(2026, 10, 5);          // No. 1
const STORE = 'shoal.v2';
const $ = id => document.getElementById(id);
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { seaA:cssv('--sea-a'), seaB:cssv('--sea-b'), deep:cssv('--deep'), foam:cssv('--foam'), sand:cssv('--sand'), ink:cssv('--ink'), sun:cssv('--sun'), coral:cssv('--coral') };
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- storage: progress only, the game works without it ---------- */
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { saved = {}; }
saved.p = saved.p || {};
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) {} };

/* ---------- board geometry and puzzle decoding ---------- */
const NB = [...Array(16)].map(() => []), EDGE = [], EID = {};
const ek = (a,b) => a < b ? a*16+b : b*16+a;
for (let a=0;a<16;a++) for (let b=a+1;b<16;b++) {
  if (Math.abs(a%4-b%4) <= 1 && Math.abs((a>>2)-(b>>2)) <= 1) { NB[a].push(b); NB[b].push(a); EID[ek(a,b)] = EDGE.length; EDGE.push([a,b]); }
}
function decode(line) {
  const [b,m,w,x] = line.split('|');
  const [m0,m1] = m.split('.').map(s => parseInt(s,36));
  const edges = new Set();
  EDGE.forEach((e,i) => { if ((i<21 ? m0>>i : m1>>(i-21)) & 1) edges.add(i); });
  const words = w.split(' '), bonus = x ? x.split(' ') : [];
  const linked = (p,q) => edges.has(EID[ek(p,q)]);
  const info = {};
  for (const word of words) {
    const tiles = new Set(), used = new Set(), walk = path => {
      if (path.length === word.length) { path.forEach((t,i) => { tiles.add(t); if (i) used.add(EID[ek(path[i-1],t)]); }); return; }
      const c = path[path.length-1];
      for (const n of NB[c]) if (!path.includes(n) && linked(c,n) && b[n] === word[path.length]) walk([...path,n]);
    };
    for (let s=0;s<16;s++) if (b[s] === word[0]) walk([s]);
    info[word] = { tiles, used };
  }
  const star = words.reduce((a,c) => c.length > a.length ? c : a, '');
  return { letters:b, edges, words, bonus, info, star, linked };
}
// The secret: fish are freed in a fixed colour rotation, so a finished board always has four of each colour.
// The rotation's starting order changes from board to board.
function paletteFor(idx) {
  const p = [0,1,2,3]; let s = idx*2654435761 % 2147483647 + 1;
  for (let i=3;i>0;i--) { s = s*48271 % 2147483647; const j = s % (i+1); [p[i],p[j]] = [p[j],p[i]]; }
  return p;
}
const WORD_PTS = len => ({4:10,5:20,6:35,7:50,8:70,9:90}[len] || 110);

/* ---------- state ---------- */
const G = {};
let today = 0, pending = [], downAt = 0;

function liveSets(found) {
  const left = G.pz.words.filter(w => !found.has(w));
  const tiles = new Set(), edges = new Set();
  for (const w of left) { G.pz.info[w].tiles.forEach(t => tiles.add(t)); G.pz.info[w].used.forEach(e => edges.add(e)); }
  return { tiles, edges };
}
function freshTile(i) { return { ch:G.pz.letters[i], on:true, sink:0, fish:null, hop:-1, shake:-1 }; }
function newFish(i, kind, born) {
  const x = i%4, y = i>>2;
  return { kind, ch:'', x, y, tx:x, ty:y, born, wob:Math.random()*6.28, flip:(i*7+3)%3 ? 1 : -1, pop:-1, jolt:-1 };
}
function loadPuzzle(idx) {
  pending.forEach(clearTimeout); pending = [];
  Object.assign(G, { idx, pz:decode(PUZZLES[idx]), found:[], bonus:[], log:[], palette:paletteFor(idx), freed:0, fresh:new Set(), path:[], typed:'', phase:'words', start:0, spent:0, starAt:null, gave:false,
    tiles:[], width:{}, dying:{}, flash:null, popping:false, spawnEnd:0, fish:[], grid:null, layout:null, popScore:0, popBest:0, cleared:false, frenzyBest:0, armed:false, msg:null, confirm:false, stuck:null, hover:null });
  for (let i=0;i<16;i++) G.tiles.push(freshTile(i));
  G.pz.edges.forEach(e => G.width[e] = 1);
  const s = saved.p[idx];
  if (s) {
    G.spent = s.t || 0; G.starAt = s.st ?? null; G.gave = !!s.gave;
    G.popBest = s.pop || 0; G.cleared = !!s.clr; G.frenzyBest = s.fz || 0;
    for (const w of s.f || []) enterWord(w, true);
    if (s.done) enterFish(true);
  }
  fx.length = 0; ripples.length = 0;
  sizeBoard(); renderAll();
}
function save() {
  saved.p[G.idx] = { f:G.log, t:Math.round(elapsed()), st:G.starAt, gave:G.gave||undefined, done:G.phase!=='words'||undefined, pop:G.popBest||undefined, clr:G.cleared||undefined, fz:G.frenzyBest||undefined };
  persist();
}
function elapsed() { return G.spent + (G.start && G.phase==='words' ? (performance.now()-G.start)/1000 : 0); }
function touchClock() { if (!G.start && G.phase==='words') G.start = performance.now(); }
function freezeClock() { if (G.start) { G.spent += (performance.now()-G.start)/1000; G.start = 0; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) { freezeClock(); if (G.phase==='words' && G.pz) save(); } });

/* ---------- finding words ---------- */
function stemsOf(word) {
  const pz = G.pz;
  return (STEMS[word] || []).filter(w => pz.words.includes(w) || pz.bonus.includes(w));
}
// Finding a word also finds the shorter words inside it that share its stem.
function enterWord(word, quiet) {
  const pz = G.pz, names = [word, ...stemsOf(word)];
  const targets = names.filter(w => pz.words.includes(w) && !G.found.includes(w));
  const bonus = names.filter(w => pz.bonus.includes(w) && !G.bonus.includes(w));
  G.log.push(word);
  G.bonus.push(...bonus);
  if (targets.length) applyWords(targets, quiet);
  return { targets, bonus };
}
function applyWords(words, quiet) {
  const was = liveSets(new Set(G.found));
  G.found.push(...words);
  const now = liveSets(new Set(G.found));
  const t0 = performance.now();
  was.edges.forEach(e => { if (!now.edges.has(e)) { if (quiet) delete G.width[e]; else G.dying[e] = t0; } });
  let n = 0;
  [...was.tiles].sort((a,b) => a-b).forEach(t => {
    if (now.tiles.has(t)) return;
    const tile = G.tiles[t], delay = quiet ? 0 : 360 + 110*n++;
    const kind = G.palette[G.freed++ % 4];
    tile.on = false; tile.kind = kind;
    if (quiet) { tile.sink = 1; tile.fish = newFish(t, kind, -1e6); G.fish.push(tile.fish); return; }
    tile.sinkAt = t0 + delay;
    G.spawnEnd = delay + 120;
    pending.push(setTimeout(() => {
      if (tile.fish || G.phase !== 'words') return;
      tile.fish = newFish(t, kind, performance.now()); G.fish.push(tile.fish);
      splash(t); Sound.splash();
    }, delay + 120));
  });
}
const joinWords = list => { const up = list.map(w => w.toUpperCase()); return up.length < 2 ? up[0] : up.slice(0,-1).join(', ') + ' and ' + up[up.length-1]; };
function trySubmit() {
  const path = G.path, word = path.map(t => G.pz.letters[t]).join('');
  if (!word) return;
  if (word.length < 4) return refuse('Four letters or more');
  const isTarget = G.pz.words.includes(word), isBonus = G.pz.bonus.includes(word);
  if (!isTarget && !isBonus) return refuse('Not in this puzzle');
  if (G.found.includes(word) || G.bonus.includes(word)) return refuse('Already found');
  touchClock();
  const t0 = performance.now();
  G.spawnEnd = 0;
  const { targets, bonus } = enterWord(word, false);
  G.fresh = new Set([...targets, ...bonus]);
  const extras = [...targets, ...bonus].filter(w => w !== word);
  if (targets.length) {
    path.forEach((t,i) => G.tiles[t].hop = t0 + i*55);
    G.flash = { path:[...path], t:t0 };
  }
  const gotStar = targets.includes(G.pz.star);
  if (gotStar) G.starAt = elapsed();
  G.path = []; G.typed = ''; G.confirm = false;
  if (targets.length) Sound.word(word.length); else Sound.bubble();
  const praise = !isTarget ? 'Bonus word' : gotStar ? 'The star word!' : ({4:'Nice',5:'Good one',6:'Lovely'}[word.length] || 'Superb');
  say(extras.length ? `${praise}, plus ${joinWords(extras)}` : praise, 'good', extras.length ? 2600 : 1500);
  save(); renderAll();
  if (G.found.length === G.pz.words.length) { freezeClock(); pending.push(setTimeout(() => enterFish(false), G.spawnEnd + 900)); }
}
function refuse(text) {
  const t0 = performance.now();
  G.fresh = new Set();
  G.path.forEach(t => G.tiles[t].shake = t0);
  G.path = []; G.typed = '';
  Sound.nope(); say(text, 'bad'); renderAll();
}
function say(text, cls, ms = 1500) {
  G.msg = { text, cls }; renderReadout();
  clearTimeout(G.msgT); G.msgT = setTimeout(() => { G.msg = null; renderReadout(); }, ms);
}
function giveUp() {
  freezeClock(); G.gave = true; G.path = []; G.typed = '';
  enterFish(false);
}

/* ---------- pointer tracing ---------- */
const B = { cv:$('board'), ctx:null, S:0, cell:0, bg:null };
B.ctx = B.cv.getContext('2d');
function tileAt(px, py, radius) {
  const c = Math.floor(px/B.cell), r = Math.floor(py/B.cell);
  if (c<0||c>3||r<0||r>3) return -1;
  const dx = px-(c+.5)*B.cell, dy = py-(r+.5)*B.cell;
  return Math.hypot(dx,dy) <= radius*B.cell ? r*4+c : -1;
}
const P = { down:false, moved:false, submitOnUp:false, id:null };
const tileLive = t => G.tiles[t].on;
const edgeLive = (a,b) => { const e = EID[ek(a,b)]; return e !== undefined && G.width[e] !== undefined && !(e in G.dying); };
function local(e) { const r = B.cv.getBoundingClientRect(); return [(e.clientX-r.left)*B.S/r.width, (e.clientY-r.top)*B.S/r.height]; }

B.cv.addEventListener('pointerdown', e => {
  Sound.wake(); e.preventDefault();
  const [x,y] = local(e);
  if (G.phase === 'fish') { tapFish(x,y); return; }
  if (G.phase !== 'words') return;
  const t = tileAt(x,y,.46);
  const f = fishAt(x,y);
  if (f && !G.path.length) { f.jolt = performance.now(); Sound.bubble(); burst(f.x, f.y, 3); }
  G.typed = ''; G.msg = null;
  if (t < 0 || !tileLive(t)) { if (G.path.length) { G.path = []; renderReadout(); renderActions(); } return; }
  touchClock();
  P.down = true; P.moved = false; P.submitOnUp = false; P.id = e.pointerId;
  try { B.cv.setPointerCapture(e.pointerId); } catch (err) {}
  const path = G.path, tail = path[path.length-1];
  if (!path.length) { path.push(t); Sound.step(0); }
  else if (t === tail) P.submitOnUp = true;
  else if (path.includes(t)) path.length = path.indexOf(t)+1;
  else if (edgeLive(tail,t)) { path.push(t); Sound.step(path.length-1); }
  else { G.path = [t]; Sound.step(0); }
  renderReadout(); renderActions();
});
B.cv.addEventListener('pointermove', e => {
  const [x,y] = local(e);
  if (G.phase === 'fish' && !P.down) { updateHover(x,y); return; }
  if (!P.down || e.pointerId !== P.id) return;
  const t = tileAt(x,y,.36);
  const path = G.path, tail = path[path.length-1];
  if (t < 0 || t === tail || !tileLive(t)) return;
  if (path.length > 1 && t === path[path.length-2]) { path.pop(); P.moved = true; P.submitOnUp = false; renderReadout(); renderActions(); return; }
  if (!path.includes(t) && edgeLive(tail,t)) { path.push(t); P.moved = true; P.submitOnUp = false; Sound.step(path.length-1); renderReadout(); renderActions(); }
});
function pointerEnd(e) {
  if (!P.down || e.pointerId !== P.id) return;
  P.down = false;
  if (P.moved && G.path.length >= 2) trySubmit();
  else if (P.submitOnUp) { if (G.path.length === 1) { G.path = []; renderReadout(); renderActions(); } else trySubmit(); }
}
B.cv.addEventListener('pointerup', pointerEnd);
B.cv.addEventListener('pointercancel', () => { P.down = false; });
B.cv.addEventListener('pointerleave', () => { if (G.hover) G.hover = null; });

/* ---------- typing ---------- */
function pathFor(word) {
  const L = G.pz.letters, start = G.path;
  const walk = p => {
    if (p.length === word.length) return p;
    const c = p[p.length-1];
    for (const n of NB[c]) if (!p.includes(n) && tileLive(n) && edgeLive(c,n) && L[n] === word[p.length]) { const r = walk([...p,n]); if (r) return r; }
    return null;
  };
  if (start.length && start.length <= word.length && start.every((t,i) => L[t] === word[i])) { const r = walk([...start]); if (r) return r; }
  for (let s=0;s<16;s++) if (L[s] === word[0] && tileLive(s)) { const r = walk([s]); if (r) return r; }
  return null;
}
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!$('help').hidden) { if (e.key === 'Escape') closeHelp(); return; }
  if (!$('frenzy').hidden) { Frenzy.key(e, true); return; }
  if (G.phase !== 'words') return;
  if (e.key === 'Enter') { if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; e.preventDefault(); trySubmit(); return; }
  if (e.key === 'Escape') { G.path = []; G.typed = ''; renderReadout(); renderActions(); return; }
  if (e.key === 'Backspace') {
    e.preventDefault();
    G.typed = G.path.map(t => G.pz.letters[t]).join('').slice(0,-1);
    G.path = G.typed ? pathFor(G.typed) || [] : [];
    renderReadout(); renderActions(); return;
  }
  if (/^[a-zA-Z]$/.test(e.key)) {
    Sound.wake(); touchClock();
    const word = G.path.map(t => G.pz.letters[t]).join('') + e.key.toLowerCase();
    const p = pathFor(word);
    if (p) { G.path = p; G.msg = null; Sound.step(p.length-1); renderReadout(); renderActions(); }
    else { Sound.nope(); say('No path spells ' + word.toUpperCase(), 'bad'); }
  }
});

/* ---------- fish phase ---------- */
function enterFish(quiet) {
  const t0 = performance.now();
  G.fresh = new Set();
  G.phase = 'fish'; G.path = [];
  for (let i=0;i<16;i++) {
    const tile = G.tiles[i];
    if (tile.on) { tile.on = false; tile.sink = 1; const r = newFish(i, -1, -1e6); r.ch = tile.ch; tile.fish = r; G.fish.push(r); }
    else if (!tile.fish) { tile.sink = 1; tile.fish = newFish(i, tile.kind, -1e6); G.fish.push(tile.fish); }
  }
  if (G.gave) { for (const e in G.width) delete G.width[e]; }
  G.layout = G.tiles.map(t => ({ kind:t.fish ? t.fish.kind : -1, ch:t.fish ? t.fish.ch : '' }));
  resetFish(quiet);
  if (!quiet) {
    G.fish.forEach((f,i) => f.bounce = t0 + i*45);
    Sound.fanfare();
    recordFinish();
  }
  save(); renderAll();
}
function recordFinish() {
  saved.n = (saved.n||0)+1;
  if (G.idx === today && !G.gave) {
    const day = dayNumber();
    if (saved.last !== day) { saved.streak = saved.last === day-1 ? (saved.streak||0)+1 : 1; saved.last = day; }
  }
  persist();
}
function resetFish(quiet) {
  G.fish = []; G.grid = [[],[],[],[]]; G.popScore = 0; G.stuck = null; G.hover = null;
  for (let c=0;c<4;c++) for (let r=3;r>=0;r--) {
    const i = r*4+c, l = G.layout[i], f = newFish(i, l.kind, -1e6);
    f.ch = l.ch; f.row = r; G.fish.push(f); G.grid[c].push(f); G.tiles[i].fish = null;
  }
  if (!quiet) G.fish.forEach((f,i) => f.bounce = performance.now() + i*25);
  if (!hasMove()) checkEnd();
}
const AROUND = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];   // diagonals count
function fishCell(c,h) { return G.grid[c] && G.grid[c][h]; }
function groupAt(c,h) {
  const f0 = fishCell(c,h);
  if (!f0 || f0.kind < 0 || f0.pop >= 0) return [];
  const seen = new Set([f0]), st = [[c,h]], out = [];
  while (st.length) {
    const [x,y] = st.pop(); out.push(fishCell(x,y));
    for (const [p,q] of AROUND.map(([d,e]) => [x+d,y+e])) {
      const f = fishCell(p,q);
      if (f && f.kind === f0.kind && !seen.has(f)) { seen.add(f); st.push([p,q]); }
    }
  }
  return out;
}
function locate(px,py) {
  const c = Math.floor(px/B.cell), row = Math.floor(py/B.cell);
  if (c<0||c>3||row<0||row>3) return null;
  return [c, 3-row];
}
function fishAt(px,py) {
  const c = Math.floor(px/B.cell), r = Math.floor(py/B.cell);
  return G.fish.find(f => Math.round(f.x) === c && Math.round(f.y) === r && f.pop < 0);
}
function updateHover(x,y) { const l = locate(x,y); const g = l ? groupAt(l[0],l[1]) : []; G.hover = g.length >= 2 ? new Set(g) : null; B.cv.style.cursor = G.hover ? 'pointer' : 'default'; }
function tapFish(x,y) {
  if (G.popping) return;
  const l = locate(x,y); if (!l) return;
  const g = groupAt(l[0],l[1]);
  if (g.length < 2) {
    const f = fishCell(l[0],l[1]);
    if (f) { f.jolt = performance.now(); Sound.nope(); }
    if (f && f.kind >= 0) say('This fish needs a neighbour of the same colour', 'bad');
    return;
  }
  G.popping = true; G.hover = null;
  const t0 = performance.now();
  g.forEach((f,i) => { f.pop = t0 + i*70; pending.push(setTimeout(() => { burst(f.x,f.y,9,f.kind); Sound.pop(i); }, i*70)); });
  const gain = g.length*g.length*3;
  G.popScore += gain;
  pending.push(setTimeout(() => {
    const set = new Set(g);
    G.grid = G.grid.map(col => col.filter(f => !set.has(f))).filter(col => col.length);
    G.grid.forEach((col,cx) => col.forEach((f,h) => { f.tx = cx; f.ty = 3-h; }));
    G.fish = G.fish.filter(f => !set.has(f));
    G.popping = false;
    checkEnd(); save(); renderAll();
  }, g.length*70 + 180));
  say('+' + gain, 'good');
}
function hasMove() { for (let c=0;c<G.grid.length;c++) for (let h=0;h<G.grid[c].length;h++) if (groupAt(c,h).length >= 2) return true; return false; }
function checkEnd() {
  if (hasMove()) return;
  const left = G.fish.length;
  if (!left) {
    G.popScore += 100; G.popBest = Math.max(G.popBest, G.popScore);
    if (!G.cleared) saved.c = (saved.c||0)+1;
    G.cleared = true; Sound.fanfare();
    const t0 = performance.now();
    for (let i=0;i<26;i++) pending.push(setTimeout(() => burst(Math.random()*3, Math.random()*3, 4, i%4), i*40));
    G.flashAll = t0;
    G.stuck = null; persist(); return;
  }
  G.popBest = Math.max(G.popBest, G.popScore);
  const rocks = G.fish.some(f => f.kind < 0);
  G.stuck = { left, can: !rocks && canClear(G.layout), rocks };
}
function canClear(layout) {
  let cols = []; for (let c=0;c<4;c++) { const col = []; for (let r=3;r>=0;r--) col.push(layout[r*4+c].kind); cols.push(col); }
  const memo = new Map();
  const go = cs => {
    if (!cs.length) return true;
    const key = cs.map(c => c.join('')).join('|');
    if (memo.has(key)) return memo.get(key);
    const seen = new Set(); let ok = false;
    for (let x=0;x<cs.length && !ok;x++) for (let y=0;y<cs[x].length && !ok;y++) {
      if (seen.has(x*8+y)) continue;
      const k = cs[x][y], g = [], st = [[x,y]]; seen.add(x*8+y);
      while (st.length) {
        const [a,b] = st.pop(); g.push([a,b]);
        for (const [p,q] of AROUND.map(([d,e]) => [a+d,b+e])) if (cs[p] && cs[p][q] === k && !seen.has(p*8+q)) { seen.add(p*8+q); st.push([p,q]); }
      }
      if (g.length < 2 || k < 0) continue;
      const next = cs.map(c => [...c]);
      g.sort((m,n) => n[1]-m[1]).forEach(([a,b]) => next[a].splice(b,1));
      if (go(next.filter(c => c.length))) ok = true;
    }
    memo.set(key, ok); return ok;
  };
  return go(cols);
}
function totalScore() {
  const w = G.found.reduce((n,x) => n + WORD_PTS(x.length), 0);
  const star = G.found.includes(G.pz.star) ? 50 : 0;
  const speed = G.gave ? 0 : Math.max(0, Math.round(300 - elapsed()/2));
  return w + star + speed + G.bonus.length*5 + (G.popBest||G.popScore) + (G.frenzyBest||0);
}

/* ---------- drawing ---------- */
function alga(c,x,y,s,rot) {
  c.save(); c.translate(x,y); c.rotate(rot); c.beginPath();
  for (let i=0;i<5;i++) {
    const t = i/4, len = s*(.42-.26*t), yy = s*(.5-t*.95);
    for (const d of [-1,1]) { c.moveTo(0,yy); c.ellipse(d*len*.55,yy-s*.05,len*.62,s*.075,d*-.45,0,6.3); }
  }
  c.moveTo(0,-s*.5); c.ellipse(0,-s*.56,s*.08,s*.15,0,0,6.3);
  c.fill(); c.lineWidth = s*.05; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(0,s*.55); c.lineTo(0,-s*.5); c.stroke();
  c.restore();
}
function paintWater(c, W, H, cell, seed) {
  let s = seed;
  const r = () => (s = (s*16807)%2147483647)/2147483647;
  const cols = Math.ceil(W/cell), rows = Math.ceil(H/cell);
  for (let y=0;y<rows;y++) for (let x=0;x<cols;x++) {
    const light = (x+y)%2;
    c.fillStyle = light ? C.seaB : C.seaA;
    c.fillRect(x*cell, y*cell, cell+1, cell+1);
    c.fillStyle = light ? '#4e8ff2' : '#2f66dd';
    c.lineCap = 'round';
    alga(c, (x+.5)*cell, (y+.5)*cell, cell*.74, r()*6.28);
  }
}
const shapeOf = i => { // cut-paper wobble, fixed per tile
  const o = []; let s = (i+1)*9973;
  for (let k=0;k<20;k++) { s = (s*48271)%2147483647; o.push((s/2147483647-.5)*.055); }
  return o;
};
const SHAPES = [...Array(16).keys()].map(shapeOf);
function blob(c,cx,cy,r,off) {
  const n = off.length, pts = [];
  for (let i=0;i<n;i++) {
    const a = i/n*6.2832+.2, ca = Math.cos(a), sa = Math.sin(a);
    const R = r*(1+off[i])/Math.pow(ca*ca*ca*ca+sa*sa*sa*sa,.25);
    pts.push([cx+ca*R, cy+sa*R]);
  }
  c.beginPath();
  const mid = (p,q) => [(p[0]+q[0])/2,(p[1]+q[1])/2];
  let m = mid(pts[n-1],pts[0]); c.moveTo(m[0],m[1]);
  for (let i=0;i<n;i++) { m = mid(pts[i],pts[(i+1)%n]); c.quadraticCurveTo(pts[i][0],pts[i][1],m[0],m[1]); }
  c.closePath();
}
const FISH = [
  { // flame angelfish: deep body, swept fins, dark bars
    name:'angelfish', emoji:'🟥',
    parts:w => [
      ['#ffb02e', c => { c.moveTo(.32,-.42); c.quadraticCurveTo(-.1,-.98,-.82,-.9); c.quadraticCurveTo(-.6,-.5,-.6,-.22); c.closePath(); }],
      ['#ffb02e', c => { c.moveTo(.32,.42); c.quadraticCurveTo(-.1,.98,-.82,.9); c.quadraticCurveTo(-.6,.5,-.6,.22); c.closePath(); }],
      ['#ffb02e', c => { c.moveTo(-.55,0); c.lineTo(-1.04,-.42+w*.1); c.quadraticCurveTo(-.9,w*.2,-1.04,.42+w*.1); c.closePath(); }],
      ['#ff4a2e', c => { c.ellipse(.06,0,.76,.58,0,0,6.3); }],
    ],
    marks:(c) => { c.fillStyle = '#9c1838'; for (const x of [-.42,-.1,.22]) { c.beginPath(); c.moveTo(x,-.62); c.quadraticCurveTo(x+.1,0,x,.62); c.lineTo(x+.13,.62); c.quadraticCurveTo(x+.23,0,x+.13,-.62); c.closePath(); c.fill(); } },
    clip:c => c.ellipse(.06,0,.76,.58,0,0,6.3), eye:[.5,-.14],
  },
  { // butterflyfish: round disc, pointed snout, eye bar
    name:'butterflyfish', emoji:'🟨',
    parts:w => [
      ['#ffe36b', c => { c.moveTo(-.5,-.3); c.lineTo(-.96,-.32+w*.1); c.quadraticCurveTo(-1.06,w*.15,-.96,.32+w*.1); c.lineTo(-.5,.3); c.closePath(); }],
      ['#ffc629', c => { c.moveTo(.1,-.64); c.quadraticCurveTo(-.5,-.86,-.78,-.42); c.lineTo(-.4,-.3); c.closePath(); c.moveTo(.1,.64); c.quadraticCurveTo(-.5,.86,-.78,.42); c.lineTo(-.4,.3); c.closePath(); }],
      ['#ffc629', c => { c.arc(-.02,0,.68,0,6.3); c.moveTo(.42,-.3); c.quadraticCurveTo(.76,-.12,.98,0); c.quadraticCurveTo(.76,.12,.42,.3); c.closePath(); }],
    ],
    marks:(c) => { c.fillStyle = C.ink; c.fillRect(.24,-.8,.17,1.6); c.beginPath(); c.arc(-.42,-.26,.13,0,6.3); c.fill(); },
    clip:c => { c.arc(-.02,0,.68,0,6.3); }, eye:[.33,-.14], eyeOnBar:true,
  },
  { // anthias: slim body with a long lyre tail
    name:'anthias', emoji:'🟪',
    parts:w => [
      ['#ffc2e2', c => { c.moveTo(-.5,0); c.quadraticCurveTo(-.9,-.2+w*.1,-1.26,-.56+w*.2); c.quadraticCurveTo(-1,-.05+w*.1,-1.0,w*.1); c.quadraticCurveTo(-1,.05+w*.1,-1.26,.56+w*.2); c.quadraticCurveTo(-.9,.2+w*.1,-.5,0); c.closePath(); }],
      ['#c21fb0', c => { c.moveTo(.42,-.28); c.lineTo(.3,-.82); c.lineTo(.08,-.42); c.quadraticCurveTo(-.3,-.56,-.62,-.3); c.lineTo(-.2,-.2); c.closePath(); }],
      ['#c21fb0', c => { c.moveTo(.1,.32); c.quadraticCurveTo(-.1,.66,-.42,.62); c.lineTo(-.4,.24); c.closePath(); }],
      ['#ff4da6', c => { c.ellipse(.04,0,.8,.37,0,0,6.3); }],
    ],
    marks:(c) => { c.strokeStyle = '#ffe36b'; c.lineWidth = .085; c.lineCap = 'round'; c.beginPath(); c.moveTo(.74,.04); c.quadraticCurveTo(.42,.2,.08,.08); c.stroke(); },
    clip:c => c.ellipse(.04,0,.8,.37,0,0,6.3), eye:[.5,-.1],
  },
  { // wrasse: long torpedo with lengthwise stripes
    name:'wrasse', emoji:'🟩',
    parts:w => [
      ['#16b8a6', c => { c.moveTo(-.68,0); c.lineTo(-1.1,-.34+w*.14); c.quadraticCurveTo(-.98,w*.12,-1.1,.34+w*.14); c.closePath(); }],
      ['#16b8a6', c => { c.moveTo(.3,-.28); c.quadraticCurveTo(-.2,-.5,-.72,-.2); c.lineTo(-.2,-.1); c.closePath(); }],
      ['#3fe07f', c => { c.moveTo(.98,.02); c.quadraticCurveTo(.76,-.33,.2,-.33); c.quadraticCurveTo(-.5,-.33,-.82,0); c.quadraticCurveTo(-.5,.33,.2,.33); c.quadraticCurveTo(.76,.33,.98,.02); c.closePath(); }],
    ],
    marks:(c) => {
      c.lineCap = 'round'; c.lineWidth = .09;
      c.strokeStyle = '#ff4da6'; c.beginPath(); c.moveTo(.6,-.13); c.quadraticCurveTo(0,-.21,-.72,-.03); c.stroke();
      c.strokeStyle = '#1c4fd0'; c.beginPath(); c.moveTo(.56,.1); c.quadraticCurveTo(0,.18,-.72,.04); c.stroke();
    },
    clip:c => { c.moveTo(.98,.02); c.quadraticCurveTo(.76,-.33,.2,-.33); c.quadraticCurveTo(-.5,-.33,-.82,0); c.quadraticCurveTo(-.5,.33,.2,.33); c.quadraticCurveTo(.76,.33,.98,.02); c.closePath(); }, eye:[.62,-.06],
  },
];
function drawFish(c, kind, x, y, size, flip, wag, rot) {
  const k = FISH[kind], parts = k.parts(wag);
  c.save(); c.translate(x,y); if (rot) c.rotate(rot); c.scale(flip*size, size);
  c.lineJoin = 'round';
  // white paper edge behind the whole silhouette
  c.fillStyle = C.foam; c.strokeStyle = C.foam; c.lineWidth = .17;
  for (const [,fn] of parts) { c.beginPath(); fn(c); c.fill(); c.stroke(); }
  for (const [col,fn] of parts) { c.fillStyle = col; c.beginPath(); fn(c); c.fill(); }
  c.save(); c.beginPath(); k.clip(c); c.clip(); k.marks(c); c.restore();
  const [ex,ey] = k.eye;
  c.fillStyle = C.foam; c.beginPath(); c.arc(ex,ey,.125,0,6.3); c.fill();
  c.fillStyle = C.ink; c.beginPath(); c.arc(ex+.025,ey,.07,0,6.3); c.fill();
  c.restore();
}
function drawRock(c,x,y,size,ch) {
  c.fillStyle = '#6f83b8'; blob(c,x,y,size*.74,SHAPES[ch.charCodeAt(0)%16]); c.fill();
  c.fillStyle = C.deep; c.font = `${size*.72}px ${tileFont}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ch.toUpperCase(), x, y+size*.04);
}
const tileFont = "'Rammetto One','Arial Black',sans-serif";
const fx = [], ripples = [];
function splash(t) {
  const x = t%4, y = t>>2;
  ripples.push({ x, y, t:performance.now() });
  for (let i=0;i<10;i++) { const a = i/10*6.28; fx.push({ x:x, y:y, vx:Math.cos(a)*(1.1+Math.random()), vy:Math.sin(a)*(1.1+Math.random())-.7, g:3, r:.022+Math.random()*.03, life:.5+Math.random()*.2, age:0, col:C.foam }); }
}
function burst(cx, cy, n, kind) {
  const cols = kind === undefined || kind < 0 ? [C.foam] : [FISH[kind].parts(0).slice(-1)[0][0], C.foam, C.sun];
  for (let i=0;i<n;i++) { const a = Math.random()*6.28, v = .6+Math.random()*1.5; fx.push({ x:cx, y:cy, vx:Math.cos(a)*v, vy:Math.sin(a)*v-.6, g:-1, r:.03+Math.random()*.05, life:.45+Math.random()*.4, age:0, col:cols[i%cols.length], ring:i%3===0 }); }
}
function sizeBoard() {
  const dpr = Math.min(window.devicePixelRatio||1, 3);
  const css = B.cv.clientWidth || 360;
  const S = Math.round(css*dpr);
  if (B.cv.width !== S) { B.cv.width = S; B.cv.height = S; }
  B.S = S; B.cell = S/4;
  const off = document.createElement('canvas'); off.width = off.height = S;
  paintWater(off.getContext('2d'), S, S, B.cell, (G.idx||0)*131+7);
  B.bg = off;
}
const easeOutBack = t => { const k = 1.70158; t -= 1; return 1+(k+1)*t*t*t+k*t*t; };
function draw(now, dt) {
  const c = B.ctx, S = B.S, cell = B.cell;
  if (!S || !G.pz) return;
  c.clearRect(0,0,S,S);
  c.drawImage(B.bg,0,0);
  const cen = i => [((i%4)+.5)*cell, ((i>>2)+.5)*cell];

  for (let i=ripples.length-1;i>=0;i--) {
    const r = ripples[i], t = (now-r.t)/700;
    if (t >= 1) { ripples.splice(i,1); continue; }
    c.strokeStyle = C.foam; c.globalAlpha = .7*(1-t); c.lineWidth = cell*.03*(1-t)+1;
    c.beginPath(); c.arc((r.x+.5)*cell,(r.y+.5)*cell,cell*(.2+.45*t),0,6.3); c.stroke();
  }
  c.globalAlpha = 1;

  // advance wash-aways
  const R = cell*.355, W0 = cell*.25;
  for (const e in G.dying) {
    const t = (now-G.dying[e])/420;
    if (t >= 1) { delete G.dying[e]; delete G.width[e]; }
    else G.width[e] = 1-t*t;
  }
  const tileScale = t => {
    const tile = G.tiles[t];
    if (tile.on) return 1;
    if (tile.sinkAt === undefined) return tile.sink >= 1 ? 0 : 1;
    const k = clamp((now-tile.sinkAt)/260,0,1);
    if (k >= 1) { tile.sink = 1; return 0; }
    return 1-k*k;
  };
  const eachEdge = fn => { for (const e in G.width) { const [a,b] = EDGE[e], [ax,ay] = cen(a), [bx,by] = cen(b), w = G.width[e]; fn(ax,ay,bx,by,w); } };
  const layer = (dx,dy,col) => {
    c.strokeStyle = col; c.lineCap = 'round';
    eachEdge((ax,ay,bx,by,w) => {
      c.lineWidth = W0*(.4+.6*w);
      const mx = (ax+bx)/2, my = (ay+by)/2;
      c.globalAlpha = Math.min(1,w*2);
      c.beginPath(); c.moveTo(ax+dx,ay+dy); c.lineTo(ax+dx+(mx-ax)*w,ay+dy+(my-ay)*w); c.moveTo(bx+dx,by+dy); c.lineTo(bx+dx+(mx-bx)*w,by+dy+(my-by)*w); c.stroke();
    });
    c.globalAlpha = 1;
    c.fillStyle = col;
    for (let i=0;i<16;i++) {
      const s = tileScale(i); if (s <= 0) continue;
      const [x,y] = cen(i); blob(c,x+dx,y+dy,R*s,SHAPES[i]); c.fill();
    }
  };
  layer(cell*.028,cell*.036,C.deep);
  layer(0,0,C.sand);

  // live tiles, trace, letters
  const inPath = new Set(G.path), offset = i => {
    const t = G.tiles[i]; let dx = 0, dy = 0;
    if (t.hop >= 0) { const k = (now-t.hop)/300; if (k >= 0 && k < 1) dy = -Math.sin(k*3.1416)*cell*.13; else if (k >= 1) t.hop = -1; }
    if (t.shake >= 0) { const k = (now-t.shake)/260; if (k < 1) dx = Math.sin(k*18)*cell*.03*(1-k); else t.shake = -1; }
    return [dx,dy];
  };
  for (const i of G.path) {
    const [x,y] = cen(i); c.fillStyle = C.sun; blob(c,x,y,R*1.02,SHAPES[i]); c.fill();
  }
  const ribbon = (path,col) => {
    if (path.length < 2) return;
    c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = cell*.13;
    c.beginPath(); path.forEach((t,i) => { const [x,y] = cen(t); i ? c.lineTo(x,y) : c.moveTo(x,y); }); c.stroke();
  };
  ribbon(G.path, C.coral);
  if (G.flash) {
    const t = (now-G.flash.t)/380;
    if (t >= 1) G.flash = null;
    else { c.globalAlpha = 1-t; ribbon(G.flash.path, C.sun); c.globalAlpha = 1; }
  }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${cell*.4}px ${tileFont}`;
  for (let i=0;i<16;i++) {
    const s = tileScale(i); if (s <= 0) continue;
    const [x,y] = cen(i), [dx,dy] = offset(i);
    c.save(); c.translate(x+dx,y+dy+cell*.015); c.scale(s,s);
    c.fillStyle = inPath.has(i) && G.path[G.path.length-1] === i ? '#7a1420' : C.ink;
    c.fillText(G.tiles[i].ch.toUpperCase(),0,0);
    c.restore();
  }

  // fish
  const ease = Math.min(1, dt*11);
  const sorted = [...G.fish].sort((p,q) => p.y-q.y);
  for (const f of sorted) {
    f.x += (f.tx-f.x)*ease;
    const fall = f.ty-f.y; f.vy = (f.vy||0) + 26*dt;
    if (fall > .002) { f.y = Math.min(f.ty, f.y + f.vy*dt); if (f.y >= f.ty) f.vy = -f.vy*.22; } else { f.y += fall*ease; f.vy = 0; }
    let sc = 1, bob = 0, ang = 0;
    const size = cell*.36;
    if (f.born > 0) { const k = clamp((now-f.born)/420,0,1); sc *= k >= 1 ? 1 : Math.max(0,easeOutBack(k)); bob -= (1-k)*cell*.35*Math.sin(k*3.14); }
    if (f.bounce) { const k = (now-f.bounce)/520; if (k > 0 && k < 1) { bob -= Math.abs(Math.sin(k*6.28))*cell*.16*(1-k); } else if (k >= 1) f.bounce = 0; }
    if (f.jolt >= 0) { const k = (now-f.jolt)/320; if (k < 1) ang = Math.sin(k*20)*.3*(1-k); else f.jolt = -1; }
    if (f.pop >= 0) { const k = (now-f.pop)/170; if (k >= 1) continue; if (k > 0) sc *= 1+k*.5; }
    if (G.hover && G.hover.has(f)) sc *= 1.1;
    if (!calm) bob += Math.sin(now/620+f.wob)*cell*.02;
    const x = (f.x+.5)*cell, y = (f.y+.5)*cell+bob;
    if (f.kind < 0) { drawRock(c,x,y,cell*.5,f.ch); continue; }
    const wag = calm ? 0 : Math.sin(now/170+f.wob*3);
    drawFish(c,f.kind,x,y,size*sc*(f.kind===3?1.02:f.kind===2?.95:1),f.flip,wag,ang);
  }
  c.globalAlpha = 1;

  // particles
  for (let i=fx.length-1;i>=0;i--) {
    const p = fx[i]; p.age += dt;
    if (p.age >= p.life) { fx.splice(i,1); continue; }
    p.vy += p.g*dt; p.x += p.vx*dt; p.y += p.vy*dt;
    const k = 1-p.age/p.life, x = (p.x+.5)*cell, y = (p.y+.5)*cell, r = p.r*cell*(.5+k*.5);
    c.globalAlpha = Math.min(1,k*2);
    if (p.ring) { c.strokeStyle = p.col; c.lineWidth = cell*.012; c.beginPath(); c.arc(x,y,r,0,6.3); c.stroke(); }
    else { c.fillStyle = p.col; c.beginPath(); c.arc(x,y,r,0,6.3); c.fill(); }
  }
  c.globalAlpha = 1;
}
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(.05,(now-lastT)/1000); lastT = now;
  if ($('frenzy').hidden) { draw(now,dt); tickClock(); } else Frenzy.step(now,dt);
  requestAnimationFrame(frame);
}
let clockShown = '';
function tickClock() {
  const el = $('clock'); if (!el) return;
  const s = fmt(elapsed());
  if (s !== clockShown) { el.textContent = s; clockShown = s; }
}
new ResizeObserver(() => { if (G.pz) sizeBoard(); }).observe(B.cv);

/* ---------- DOM panels ---------- */
function renderReadout() {
  const el = $('readout');
  if (G.path.length && !(G.msg && G.msg.cls === 'bad')) {
    const letters = G.path.map(t => G.pz.letters[t]);
    el.innerHTML = `<div class="trail${letters.length>8?' long':''}">${letters.map(l => `<span>${l}</span>`).join('')}</div>`;
    return;
  }
  if (G.msg) { el.innerHTML = `<div class="msg ${G.msg.cls}">${esc(G.msg.text)}</div>`; return; }
  el.innerHTML = `<div class="msg">${esc(restingLine())}</div>`;
}
function restingLine() {
  if (G.phase === 'words') {
    if (!G.found.length) return 'Trace along the paths to spell words of four letters or more';
    const left = G.pz.words.length - G.found.length;
    return left === 1 ? 'One word left' : `${left} words left`;
  }
  if (G.cleared && !G.fish.length) return 'Shoal cleared. You unlocked the Frenzy';
  if (G.stuck) {
    if (G.stuck.rocks) return 'Rocks stay put, so this shoal cannot be cleared';
    const n = G.stuck.left, f = n === 1 ? '1 fish left' : `${n} fish left`;
    return G.stuck.can ? `${f}. This shoal can be cleared, so try another order` : `${f}. No order clears this shoal. The fish depend on how you solve the board`;
  }
  return 'Tap two or more touching fish of the same colour. Diagonals count';
}
function renderActions() {
  const el = $('actions'), html = [];
  if (G.phase === 'words') {
    if (G.confirm) {
      html.push(`<button class="btn go" id="a-reveal">Reveal the remaining words</button><button class="btn quiet" id="a-keep">Keep playing</button>`);
    } else {
      if (G.path.length >= 4 && !P.down) html.push(`<button class="btn go" id="a-enter">Enter word</button>`);
      else if (G.path.length) html.push(`<button class="btn quiet" id="a-clear">Clear</button>`);
      else html.push(`<button class="btn quiet" id="a-done">I’m done</button>`);
    }
  } else {
    if (G.cleared) html.push(`<button class="btn frenzy" id="a-frenzy">Play the Frenzy</button>`);
    if ((G.fish.length < 16 || G.stuck) && G.layout.some(l => l.kind >= 0)) html.push(`<button class="btn" id="a-reset">Put the fish back</button>`);
  }
  el.innerHTML = html.join('');
}
function renderSide() {
  const el = $('side'), pz = G.pz, foundSet = new Set(G.found);
  const byLen = {};
  pz.words.forEach(w => { const b = byLen[w.length] || (byLen[w.length] = { all:0, left:0 }); b.all++; if (!foundSet.has(w)) b.left++; });
  const dots = [...pz.words].sort((a,b) => (a===pz.star)-(b===pz.star)).map(w => w);
  const fCount = G.found.length;
  const nonStarFound = G.found.filter(w => w !== pz.star).length;
  const bubbles = dots.map((w,i) => {
    if (w === pz.star) return `<li class="star${foundSet.has(w)?' on':''}"></li>`;
    return `<li class="${i < nonStarFound ? 'on' : ''}"></li>`;
  }).join('');
  const lens = Object.keys(byLen).map(Number).sort((a,b) => a-b).map(l => {
    const b = byLen[l];
    return `<li class="${b.left?'':'done'}">${l} letters: <b>${b.left}</b></li>`;
  }).join('');
  const shown = [...G.found].reverse().map(w => `<li class="${[w===pz.star?'star':'', G.fresh.has(w)?'fresh':''].join(' ').trim()}">${w}</li>`);
  const missed = G.phase === 'fish' ? pz.words.filter(w => !foundSet.has(w)).map(w => `<li class="missed">${w}</li>`) : [];
  let top = '';
  if (G.phase === 'words') {
    top = `<div>
      <div class="count"><strong>${fCount} of ${pz.words.length}</strong> words<span class="clock" id="clock">${fmt(elapsed())}</span></div>
      <ul class="bubbles" aria-hidden="true">${bubbles}</ul>
    </div>
    <ul class="lens" aria-label="Words left by length">${lens}</ul>`;
  } else {
    const allFound = fCount === pz.words.length;
    const heading = G.cleared ? 'Shoal cleared' : allFound ? `All ${fCount} words found` : `${fCount} of ${pz.words.length} words`;
    const streak = saved.streak > 1 && G.idx === today ? `<p>${saved.streak} days in a row.</p>` : '';
    top = `<div class="card" id="results">
      <h2>${heading}</h2>
      <dl class="stats">
        <div><dt>Time</dt><dd>${G.gave ? 'Gave up' : fmt(elapsed())}</dd></div>
        <div><dt>Star word</dt><dd>${G.starAt != null ? fmt(G.starAt) : 'Missed'}</dd></div>
        <div><dt>Score</dt><dd id="score">${totalScore()}</dd></div>
      </dl>
      ${G.frenzyBest ? `<p>Best Frenzy: ${G.frenzyBest}.</p>` : ''}${streak}
      <div class="row">
        <button class="btn" id="a-copy">Copy result</button>
        <button class="btn" id="a-next">Another board</button>
        ${G.idx !== today ? '<button class="btn" id="a-today">Today’s board</button>' : ''}
      </div>
    </div>`;
  }
  const empty = !shown.length && !missed.length ? `<p class="empty">Words you find land here. The longest gets a star.</p>` : '';
  const bonus = G.bonus.length ? `<div class="words"><h2>Bonus words</h2><ul class="chips bonus">${[...G.bonus].reverse().map(w => `<li>${w}</li>`).join('')}</ul></div>` : '';
  el.innerHTML = `${top}<div class="words"><h2>${G.phase==='fish' && missed.length ? 'Words' : 'Found'}</h2>${empty}<ul class="chips">${shown.join('')}${missed.join('')}</ul></div>${bonus}`;
}
function renderHeader() {
  const dayN = dayNumber() + 1;
  const part = o => new Intl.DateTimeFormat('en-GB',{ timeZone:'Europe/London', ...o }).format(new Date());
  $('dateline').innerHTML = G.idx === today ? `<b>No. ${dayN}</b><span class="wd">${part({ weekday:'long' })} </span>${part({ day:'numeric', month:'long' })}` : `<b>Extra board</b>Board E${G.idx+1}`;
}
function renderAll() { renderHeader(); renderReadout(); renderActions(); renderSide(); clockShown = ''; }

function shareText() {
  const pz = G.pz, rows = [];
  for (let r=0;r<4;r++) rows.push(G.layout.slice(r*4,r*4+4).map(l => l.kind < 0 ? '⬜' : FISH[l.kind].emoji).join(''));
  const label = G.idx === today ? `Shoal No. ${dayNumber()+1}` : 'Shoal extra board';
  const lines = [label, `${G.found.length}/${pz.words.length} words${G.gave ? '' : ' in ' + fmt(elapsed())}`];
  if (G.starAt != null) lines.push(`⭐ at ${fmt(G.starAt)}`);
  lines.push(...rows);
  if (G.cleared) lines.push(G.frenzyBest ? `Shoal cleared, Frenzy ${G.frenzyBest}` : 'Shoal cleared');
  return lines.join('\n');
}
document.addEventListener('click', async e => {
  const id = e.target.id; if (!id) return;
  Sound.wake();
  if (id === 'a-enter') trySubmit();
  else if (id === 'a-clear') { G.path = []; renderReadout(); renderActions(); }
  else if (id === 'a-done') { G.confirm = true; renderActions(); }
  else if (id === 'a-keep') { G.confirm = false; renderActions(); }
  else if (id === 'a-reveal') { G.confirm = false; giveUp(); }
  else if (id === 'a-reset') { resetFish(false); renderAll(); }
  else if (id === 'a-frenzy') Frenzy.open();
  else if (id === 'a-next') loadPuzzle(pickExtra());
  else if (id === 'a-today') loadPuzzle(today);
  else if (id === 'a-copy') {
    const btn = e.target, text = shareText();
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; }
    catch (err) { btn.textContent = 'Copy failed'; const p = document.createElement('pre'); p.textContent = text; p.style.cssText = 'margin:0;-webkit-user-select:all;user-select:all;white-space:pre-wrap'; btn.closest('.card').append(p); }
  }
});
function dayNumber() {
  const p = new Intl.DateTimeFormat('en-GB',{ timeZone:'Europe/London', year:'numeric', month:'numeric', day:'numeric' }).formatToParts(new Date());
  const g = t => +p.find(x => x.type === t).value;
  return Math.max(0, Math.round((Date.UTC(g('year'),g('month')-1,g('day'))-EPOCH)/864e5));
}
function pickExtra() {
  const n = PUZZLES.length; let i = 0, tries = 0;
  do { i = Math.floor(Math.random()*n); tries++; } while ((saved.p[i] || i === today || Math.abs(i-today) < 30) && tries < 400);
  return i;
}
const openHelp = () => { $('help').hidden = false; $('help-close').focus(); };
const closeHelp = () => { $('help').hidden = true; saved.seen = 1; persist(); };
$('btn-help').onclick = openHelp;
$('help-close').onclick = closeHelp;
$('help').addEventListener('click', e => { if (e.target === $('help')) closeHelp(); });

/* ---------- sound: everything is synthesised after the first tap ---------- */
const Sound = (() => {
  let ac = null, on = saved.mute ? false : true;
  const notes = [392,440,523.3,587.3,659.3,784,880,1046.5,1174.7];
  const tone = (f,d,type='sine',g=.12,when=0,to=0) => {
    if (!ac || !on) return;
    const t = ac.currentTime+when, o = ac.createOscillator(), a = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f,t); if (to) o.frequency.exponentialRampToValueAtTime(to,t+d);
    a.gain.setValueAtTime(0,t); a.gain.linearRampToValueAtTime(g,t+.008); a.gain.exponentialRampToValueAtTime(.0008,t+d);
    o.connect(a).connect(ac.destination); o.start(t); o.stop(t+d+.02);
  };
  const noise = (d,g,freq) => {
    if (!ac || !on) return;
    const n = Math.floor(ac.sampleRate*d), buf = ac.createBuffer(1,n,ac.sampleRate), data = buf.getChannelData(0);
    for (let i=0;i<n;i++) data[i] = (Math.random()*2-1)*(1-i/n);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), a = ac.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; a.gain.value = g;
    s.connect(f).connect(a).connect(ac.destination); s.start();
  };
  return {
    wake() { if (ac) { if (ac.state === 'suspended') ac.resume(); return; } const A = window.AudioContext || window.webkitAudioContext; if (A) try { ac = new A(); } catch (e) {} },
    step(i) { tone(notes[Math.min(i,8)],.1,'triangle',.1); },
    word(len) { [0,2,4,5,7].slice(0,Math.min(5,len-1)).forEach((n,i) => tone(notes[n]*1.0,.16,'triangle',.11,i*.07)); },
    nope() { tone(170,.14,'sine',.08,0,120); },
    bubble() { tone(420,.12,'sine',.11,0,900); },
    pop(i) { tone(320+i*60,.09,'sine',.14,0,1200+i*90); },
    splash() { noise(.22,.12,1700); tone(240,.14,'sine',.06,0,620); },
    fanfare() { [0,2,4,5,7,8].forEach((n,i) => tone(notes[n],.2,'triangle',.11,i*.09)); },
    toggle() { on = !on; saved.mute = !on; persist(); return on; },
    get on() { return on; },
  };
})();
function syncSound() {
  $('btn-sound').setAttribute('aria-label', Sound.on ? 'Turn sound off' : 'Turn sound on');
  $('snd-path').setAttribute('d', Sound.on ? 'M4 9v6h4l5 4V5L8 9H4zm12.5 3a4 4 0 0 0-2-3.5v7a4 4 0 0 0 2-3.5z' : 'M4 9v6h4l5 4V5L8 9H4zm11.6.2-1.4 1.4 1.8 1.8-1.8 1.8 1.4 1.4 1.8-1.8 1.8 1.8 1.4-1.4-1.8-1.8 1.8-1.8-1.4-1.4-1.8 1.8z');
}
$('btn-sound').onclick = () => { Sound.wake(); Sound.toggle(); syncSound(); };
syncSound();

/* ---------- the Frenzy ---------- */
const Frenzy = (() => {
  const cv = $('fz'), c = cv.getContext('2d');
  let W=0, H=0, U=0, bg=null, F=null, last=0;
  const DUR = 30;
  function size() {
    const dpr = Math.min(window.devicePixelRatio||1,2.5);
    W = Math.round(cv.clientWidth*dpr); H = Math.round(cv.clientHeight*dpr); U = Math.min(W,H);
    cv.width = W; cv.height = H;
    bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    paintWater(bg.getContext('2d'),W,H,Math.max(U/4,120*dpr),4242);
  }
  addEventListener('resize', () => { if (!$('frenzy').hidden) size(); });
  function card(title, text, go) {
    $('fz-title').textContent = title; $('fz-text').textContent = text; $('fz-go').textContent = go;
    $('fz-card').hidden = false; $('fz-go').focus();
  }
  function open() {
    try { getSelection().removeAllRanges(); } catch (e) {}
    $('frenzy').hidden = false; size(); F = null;
    $('fz-score').textContent = '0'; $('fz-time').textContent = DUR; $('fz-bar').style.transform = 'scaleX(1)';
    speller();
    card('The Frenzy', `Your whole shoal is hungry. Drag to lead it to the food for ${DUR} seconds. Eat the letters of the star word in order for bonus time, and swerve away from the barracuda.`, 'Start the Frenzy');
  }
  function speller() {
    $('fz-spell').innerHTML = G.pz.star.split('').map(l => `<span>${l}</span>`).join('');
  }
  function start() {
    $('fz-card').hidden = true; Sound.wake();
    speller();
    const kinds = G.layout.filter(l => l.kind >= 0).map(l => l.kind);
    const s = clamp(U*.044,17*Math.min(devicePixelRatio||1,2.5),40*Math.min(devicePixelRatio||1,2.5));
    F = { t:0, left:DUR, s, score:0, eaten:0, combo:0, comboT:0, lead:{ x:W/2, y:H/2 }, fish:[], food:[], bits:[], nextFood:0, nextShark:7, shark:null, ltr:null, li:0, keys:{}, over:false, pops:[] };
    kinds.forEach((kind,i) => { const a = i/kinds.length*6.28; F.fish.push({ kind, x:W/2+Math.cos(a)*s*3, y:H/2+Math.sin(a)*s*3, vx:0, vy:0, wob:Math.random()*6.28, face:1 }); });
    for (let i=0;i<10;i++) addFood();
    addLetter(); last = performance.now();
  }
  function addFood() { const m = F.s*2; F.food.push({ x:m+Math.random()*(W-2*m), y:m*1.6+Math.random()*(H-2.6*m), r:F.s*.26, wob:Math.random()*6.28, gold:Math.random()<.12 }); }
  function addLetter() {
    if (F.li >= G.pz.star.length) { F.ltr = null; return; }
    const m = F.s*3.2; let x, y, n = 0;
    do { x = m+Math.random()*(W-2*m); y = m*1.3+Math.random()*(H-2.3*m); n++; } while (Math.hypot(x-F.lead.x,y-F.lead.y) < U*.3 && n < 20);
    F.ltr = { x, y, ch:G.pz.star[F.li], t:0 };
  }
  function bits(x,y,n,col) { for (let i=0;i<n;i++) { const a = Math.random()*6.28, v = F.s*(2+Math.random()*7); F.bits.push({ x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:F.s*(.08+Math.random()*.14),life:.5,age:0,col }); } }
  function floater(x,y,text) { F.pops.push({ x,y,text,age:0 }); }
  function update(dt) {
    const L = F.lead, s = F.s;
    F.t += dt; F.left -= dt;
    if (F.keys.ArrowLeft) L.x -= U*1.2*dt; if (F.keys.ArrowRight) L.x += U*1.2*dt;
    if (F.keys.ArrowUp) L.y -= U*1.2*dt; if (F.keys.ArrowDown) L.y += U*1.2*dt;
    L.x = clamp(L.x,0,W); L.y = clamp(L.y,0,H);
    const maxV = U*1.05, fish = F.fish;
    for (const f of fish) {
      let ax = (L.x-f.x)*7, ay = (L.y-f.y)*7;
      for (const o of fish) {
        if (o === f) continue;
        const dx = f.x-o.x, dy = f.y-o.y, d = Math.hypot(dx,dy)||1;
        if (d < s*2.3) { const k = (s*2.3-d)/d*42; ax += dx*k; ay += dy*k; }
      }
      f.wob += dt*8;
      ax += Math.cos(f.wob*.37)*U*.5; ay += Math.sin(f.wob*.29)*U*.5;
      f.vx = (f.vx+ax*dt)*(1-3.2*dt); f.vy = (f.vy+ay*dt)*(1-3.2*dt);
      const v = Math.hypot(f.vx,f.vy); if (v > maxV) { f.vx *= maxV/v; f.vy *= maxV/v; }
      f.x += f.vx*dt; f.y += f.vy*dt;
      if (Math.abs(f.vx) > s*.6) f.face = f.vx > 0 ? 1 : -1;
    }
    // food
    F.nextFood -= dt;
    if (F.nextFood <= 0 && F.food.length < 26) { addFood(); F.nextFood = .22; }
    F.comboT -= dt; if (F.comboT <= 0) F.combo = 0;
    for (let i=F.food.length-1;i>=0;i--) {
      const p = F.food[i]; p.wob += dt*2;
      for (const f of fish) if (Math.hypot(f.x-p.x,f.y-p.y) < s*1.15) {
        F.food.splice(i,1); F.combo = Math.min(F.combo+1,8); F.comboT = 1;
        const pts = (p.gold?25:5)*Math.ceil(F.combo/2); F.score += pts; F.eaten++;
        Sound.pop(Math.min(F.combo,7)); bits(p.x,p.y,5,p.gold?C.sun:C.foam);
        if (p.gold || F.combo >= 4) floater(p.x,p.y,'+'+pts);
        break;
      }
    }
    // letters of the star word
    if (F.ltr) {
      F.ltr.t += dt;
      for (const f of fish) if (Math.hypot(f.x-F.ltr.x,f.y-F.ltr.y) < s*2) {
        const sp = $('fz-spell').children[F.li]; if (sp) sp.className = 'on';
        F.li++; F.score += 30; F.left = Math.min(F.left+1.5, DUR+10); bits(F.ltr.x,F.ltr.y,14,C.sun); Sound.word(5); floater(F.ltr.x,F.ltr.y,'+30');
        if (F.li >= G.pz.star.length) { F.score += 120; F.left += 5; floater(W/2,H/2,G.pz.star.toUpperCase()+' +120'); Sound.fanfare(); }
        addLetter(); break;
      }
    }
    // barracuda
    F.nextShark -= dt;
    if (!F.shark && F.nextShark <= 0) {
      const dir = Math.random()<.5 ? 1 : -1;
      F.shark = { dir, y:clamp(L.y,s*5,H-s*3), warn:.95, bites:0, x:dir>0 ? -s*9 : W+s*9 };
      F.nextShark = Math.max(2.6,6-F.t*.09);
    }
    if (F.shark) {
      const b = F.shark;
      if (b.warn > 0) { b.warn -= dt; }
      else {
        b.x += b.dir*U*1.75*dt;
        for (let i=fish.length-1;i>=0;i--) {
          const f = fish[i], dx = (f.x-b.x)*b.dir, dy = f.y-b.y;
          if (b.bites < 5 && dx > -s*4.6 && dx < s*4.6 && Math.abs(dy) < s*(dx>0?1.0:.7)) { bits(f.x,f.y,10,C.coral); fish.splice(i,1); b.bites++; Sound.nope(); }
          else if (Math.abs(dx) < s*9 && Math.abs(dy) < s*5) f.vy += (dy >= 0 ? 1 : -1)*U*5*dt;   // the rest scatter
        }
        if (b.x < -s*10 || b.x > W+s*10) F.shark = null;
      }
    }
    for (let i=F.bits.length-1;i>=0;i--) { const p = F.bits[i]; p.age += dt; if (p.age >= p.life) { F.bits.splice(i,1); continue; } p.x += p.vx*dt; p.y += p.vy*dt; }
    for (let i=F.pops.length-1;i>=0;i--) { const p = F.pops[i]; p.age += dt; if (p.age >= .9) F.pops.splice(i,1); }
    $('fz-score').textContent = F.score;
    $('fz-time').textContent = Math.max(0,Math.ceil(F.left));
    $('fz-bar').style.transform = `scaleX(${clamp(F.left/DUR,0,1)})`;
    if (F.left <= 0 || !fish.length) finish();
  }
  function finish() {
    F.over = true;
    const home = F.fish.length, bonus = home*10, total = F.score+bonus;
    const prev = G.frenzyBest||0;
    G.frenzyBest = Math.max(prev,total); save();
    const first = home === 16 ? 'Every fish made it home' : home === 0 ? 'The barracuda got the whole shoal' : `${home} of 16 fish made it home`;
    card(total > prev ? 'New best Frenzy' : 'Frenzy over', `${first}. ${F.eaten} bites and ${F.li} of ${G.pz.star.length} star letters. You scored ${total}${home ? `, including ${bonus} for the fish still swimming` : ''}.`, 'Swim again');
    Sound.fanfare(); F = null; renderSide();
  }
  function draw(now) {
    c.drawImage(bg,0,0);
    if (!F) return;
    const s = F.s;
    // lead marker
    c.strokeStyle = C.foam; c.globalAlpha = .4; c.lineWidth = s*.1; c.setLineDash([s*.3,s*.3]); c.beginPath(); c.arc(F.lead.x,F.lead.y,s*1.1,0,6.3); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    for (const p of F.food) {
      const y = p.y+Math.sin(p.wob)*s*.25;
      c.fillStyle = C.foam; c.beginPath(); c.arc(p.x,y,p.r*1.45,0,6.3); c.fill();
      c.fillStyle = p.gold ? C.sun : C.coral; c.beginPath(); c.arc(p.x,y,p.r,0,6.3); c.fill();
    }
    if (F.ltr) {
      const l = F.ltr, r = s*1.5*(1+Math.sin(l.t*5)*.06);
      c.fillStyle = C.deep; c.beginPath(); c.arc(l.x+s*.12,l.y+s*.16,r,0,6.3); c.fill();
      c.fillStyle = C.sun; c.beginPath(); c.arc(l.x,l.y,r,0,6.3); c.fill();
      c.fillStyle = C.ink; c.font = `${s*1.6}px ${tileFont}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(l.ch.toUpperCase(),l.x,l.y+s*.06);
    }
    for (const f of F.fish) {
      const wag = calm ? 0 : Math.sin(now/90+f.wob);
      const tilt = clamp(f.vy/(U*1.05),-.7,.7)*f.face;
      drawFish(c,f.kind,f.x,f.y,s,f.face,wag,tilt);
    }
    if (F.shark) {
      const b = F.shark;
      if (b.warn > 0) {
        c.fillStyle = C.coral; c.globalAlpha = (Math.sin(now/55)+1)/2*.6+.4;
        const x = b.dir>0 ? s*.3 : W-s*.3, d = b.dir;
        c.beginPath(); c.moveTo(x+d*s*2,b.y); c.lineTo(x,b.y-s*1.2); c.lineTo(x,b.y+s*1.2); c.closePath(); c.fill(); c.globalAlpha = 1;
      } else barracuda(b.x,b.y,s,b.dir);
    }
    for (const p of F.bits) { c.globalAlpha = 1-p.age/p.life; c.fillStyle = p.col; c.beginPath(); c.arc(p.x,p.y,p.r,0,6.3); c.fill(); }
    c.globalAlpha = 1;
    c.font = `${s*1.05}px 'Shrikhand',Georgia,serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of F.pops) { c.globalAlpha = 1-p.age/.9; c.lineWidth = s*.22; c.strokeStyle = C.deep; c.lineJoin = 'round'; c.strokeText(p.text,p.x,p.y-p.age*s*2.6); c.fillStyle = C.foam; c.fillText(p.text,p.x,p.y-p.age*s*2.6); }
    c.globalAlpha = 1;
    if (F.t < 2.4) { c.fillStyle = C.foam; c.font = `${s*1.05}px 'Atkinson Hyperlegible',sans-serif`; c.globalAlpha = clamp(2.4-F.t,0,1); c.fillText('Drag to lead your shoal',W/2,H-s*2.6); c.globalAlpha = 1; }
  }
  function barracuda(x,y,s,dir) {
    c.save(); c.translate(x,y); c.scale(dir*s,s); c.lineJoin = 'round';
    const body = () => { c.beginPath(); c.moveTo(4.6,.15); c.quadraticCurveTo(2.6,-.82,-.8,-.72); c.quadraticCurveTo(-3,-.56,-3.9,0); c.quadraticCurveTo(-3,.56,-.8,.72); c.quadraticCurveTo(2.6,.82,4.6,.15); c.closePath(); };
    const tail = () => { c.beginPath(); c.moveTo(-3.6,0); c.lineTo(-4.8,-1); c.quadraticCurveTo(-4.3,0,-4.8,1); c.closePath(); };
    const fin = () => { c.beginPath(); c.moveTo(-.4,-.7); c.lineTo(-1.4,-1.4); c.lineTo(-1.8,-.62); c.closePath(); };
    c.fillStyle = C.foam; c.strokeStyle = C.foam; c.lineWidth = .3;
    for (const p of [tail,fin,body]) { p(); c.fill(); c.stroke(); }
    c.fillStyle = '#4b5a86'; tail(); c.fill(); fin(); c.fill(); body(); c.fill();
    c.save(); body(); c.clip(); c.fillStyle = '#c9d4ee'; c.fillRect(-5,.12,10,1); c.restore();
    c.strokeStyle = C.foam; c.lineWidth = .12; c.beginPath(); c.moveTo(4.4,.2); for (let i=0;i<6;i++) c.lineTo(4.1-i*.3,i%2 ? .2 : .42); c.stroke();
    c.fillStyle = C.sun; c.beginPath(); c.arc(2.5,-.25,.24,0,6.3); c.fill();
    c.fillStyle = C.ink; c.beginPath(); c.arc(2.56,-.25,.12,0,6.3); c.fill();
    c.restore();
  }
  const move = e => {
    if (!F) return;
    const r = cv.getBoundingClientRect();
    F.lead.x = (e.clientX-r.left)*W/r.width; F.lead.y = (e.clientY-r.top)*H/r.height;
  };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); move(e); });
  cv.addEventListener('pointermove', move);
  document.addEventListener('keyup', e => { if (F) F.keys[e.key] = false; });
  $('fz-go').onclick = start;
  $('fz-exit').onclick = () => { $('frenzy').hidden = true; F = null; $('fz-card').hidden = true; renderAll(); };
  return {
    open,
    step(now,dt) { if (F && !$('fz-card').hidden) return; if (F) update(dt); draw(now); },
    key(e) { if (F && e.key.startsWith('Arrow')) { e.preventDefault(); F.keys[e.key] = true; } },
    get state() { return F; },
  };
})();

/* ---------- no long-press menus: iOS would otherwise offer Translate and Copy while a finger is held down ---------- */
for (const el of [B.cv, $('frenzy')]) {
  el.addEventListener('touchstart', e => { if (!e.target.closest('button')) e.preventDefault(); }, { passive:false });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
document.addEventListener('selectstart', e => { if (!(e.target.closest && e.target.closest('pre'))) e.preventDefault(); });
document.addEventListener('gesturestart', e => e.preventDefault());

/* ---------- start ---------- */
window.__shoal = { G, Frenzy, loadPuzzle, canClear, stemsOf,
  layoutOf(log) {   // what a given solving order would produce, without touching the game
    const pz = G.pz, left = pz.words.map(w => w), done = new Set(), out = Array(16).fill(-1); let n = 0;
    const uses = t => pz.words.filter(w => !done.has(w) && pz.info[w].tiles.has(t)).length;
    for (const w of log) {
      if (done.has(w)) continue;
      const before = [...Array(16).keys()].filter(t => uses(t) > 0);
      [w, ...stemsOf(w)].forEach(x => done.add(x));
      for (const t of before) if (!uses(t)) out[t] = G.palette[n++ % 4];
    }
    return out.map(kind => ({ kind }));
  } };
today = dayNumber() % PUZZLES.length;
const begin = () => {
  loadPuzzle(today);
  lastT = performance.now();
  requestAnimationFrame(frame);
};
(document.fonts && document.fonts.load ? Promise.all([document.fonts.load("40px 'Rammetto One'"),document.fonts.load("40px 'Shrikhand'")]).catch(() => {}) : Promise.resolve()).then(begin);
})();
