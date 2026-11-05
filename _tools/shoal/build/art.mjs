// Draws the home page box, app icons and link preview from the game's own fish, so the art stays in step with it.
// Writes art/cover.svg.html (pasted into the site's index.html), ../../../shoal/icon.svg and art/*.html for rendering.
import fs from 'fs';
const js = fs.readFileSync('../src/game.js','utf8');
const C = { seaA:'#1c4fd0', seaB:'#2b74ea', deep:'#0c2284', foam:'#f7fbff', sand:'#ffdf9e', ink:'#0b1a5e', sun:'#ffc629', coral:'#ff5b3a' };
const FISH = new Function('C', js.slice(js.indexOf('const FISH = ['), js.indexOf('function drawFish(')) + '\nreturn FISH;')(C);
const algaSrc = js.slice(js.indexOf('function alga('), js.indexOf('function paintWater('));
const alga = new Function(algaSrc + '\nreturn alga;')();
const n = v => +v.toFixed(3);
class Rec {                         // a tiny canvas look-alike that writes SVG
  constructor() { this.out = []; this.d = ''; this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.tf = ''; }
  save(){} restore(){} scale(){}
  translate(x,y){ this.tf += `translate(${n(x)} ${n(y)})`; }
  rotate(a){ this.tf += `rotate(${n(a*180/Math.PI)})`; }
  beginPath(){ this.d = ''; }
  closePath(){ this.d += 'Z'; }
  moveTo(x,y){ this.d += `M${n(x)} ${n(y)}`; }
  lineTo(x,y){ this.d += `L${n(x)} ${n(y)}`; }
  quadraticCurveTo(a,b,x,y){ this.d += `Q${n(a)} ${n(b)} ${n(x)} ${n(y)}`; }
  ellipse(cx,cy,rx,ry,rot){ const d = rot*180/Math.PI, c = Math.cos(rot), s = Math.sin(rot), x0 = cx+rx*c, y0 = cy+rx*s, x1 = cx-rx*c, y1 = cy-rx*s;
    this.d += `M${n(x0)} ${n(y0)}A${n(rx)} ${n(ry)} ${n(d)} 1 1 ${n(x1)} ${n(y1)}A${n(rx)} ${n(ry)} ${n(d)} 1 1 ${n(x0)} ${n(y0)}Z`; }
  arc(cx,cy,r){ this.ellipse(cx,cy,r,r,0); }
  fillRect(x,y,w,h){ this.out.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${this.fillStyle}"/>`); }
  fill(){ this.out.push(`<path d="${this.d}" fill="${this.fillStyle}"/>`); }
  stroke(){ this.out.push(`<path d="${this.d}" fill="none" stroke="${this.strokeStyle}" stroke-width="${n(this.lineWidth)}" stroke-linecap="round"/>`); }
  clip(){}
}
function fishSvg(kind, id) {
  const k = FISH[kind], parts = k.parts(.6), body = [];
  for (const [,fn] of parts) { const r = new Rec(); fn(r); body.push(`<path d="${r.d}" fill="${C.foam}" stroke="${C.foam}" stroke-width=".17" stroke-linejoin="round"/>`); }
  for (const [col,fn] of parts) { const r = new Rec(); fn(r); body.push(`<path d="${r.d}" fill="${col}"/>`); }
  const c = new Rec(); k.clip(c);
  const m = new Rec(); k.marks(m);
  const [ex,ey] = k.eye, e = new Rec();
  e.fillStyle = C.foam; e.arc(ex,ey,.125); e.fill(); e.d=''; e.fillStyle = C.ink; e.arc(ex+.025,ey,.07); e.fill();
  return `<g id="${id}f${kind}">${body.join('')}<clipPath id="${id}c${kind}"><path d="${c.d}"/></clipPath><g clip-path="url(#${id}c${kind})">${m.out.join('')}</g>${e.out.join('')}</g>`;
}
const FISHES = id => [0,1,2,3].map(k => fishSvg(k,id)).join('');
const use = (id,k,x,y,s,flip=1,rot=0) => `<use href="#${id}f${k}" transform="translate(${x} ${y})${rot?` rotate(${rot})`:''} scale(${n(s*flip)} ${s})"/>`;
function leaf(x,y,s,rot,fill) { const r = new Rec(); r.fillStyle = fill; r.strokeStyle = fill; alga(r,0,0,s,0); return `<g transform="translate(${x} ${y}) rotate(${rot})">${r.out.join('')}</g>`; }
function water(W,H,cell,y0=0) {
  const out = []; let s = 77;
  const r = () => (s = s*16807 % 2147483647)/2147483647;
  for (let j=0; y0+j*cell<H; j++) for (let i=0; i*cell<W; i++) {
    const light = (i+j)%2, x = i*cell, y = y0+j*cell;
    out.push(`<rect x="${x}" y="${y}" width="${cell+.5}" height="${cell+.5}" fill="${light?C.seaB:C.seaA}"/>`);
    out.push(leaf(x+cell/2,y+cell/2,cell*.74,Math.round(r()*360),light?'#4e8ff2':'#2f66dd'));
  }
  return out.join('');
}
const squircle = (x,y,r) => { const pts = []; for (let i=0;i<16;i++){ const a = i/16*6.2832+.2, c = Math.cos(a), s = Math.sin(a), R = r/Math.pow(c**4+s**4,.25); pts.push([x+c*R,y+s*R]); }
  let m = [(pts[15][0]+pts[0][0])/2,(pts[15][1]+pts[0][1])/2], d = `M${n(m[0])} ${n(m[1])}`;
  pts.forEach((p,i) => { const q = pts[(i+1)%16]; d += `Q${n(p[0])} ${n(p[1])} ${n((p[0]+q[0])/2)} ${n((p[1]+q[1])/2)}`; }); return d+'Z'; };
function tiles(list, links, ribbon, cell, cls) {     // list: [x,y,letter,lit]
  const R = cell*.355, W = cell*.25, xy = i => [list[i][0],list[i][1]];
  const road = (dx,dy,col) => links.map(([a,b]) => { const [x1,y1]=xy(a),[x2,y2]=xy(b); return `<line x1="${x1+dx}" y1="${y1+dy}" x2="${x2+dx}" y2="${y2+dy}" stroke="${col}" stroke-width="${W}" stroke-linecap="round"/>`; }).join('');
  const pads = (dx,dy,col) => list.map(([x,y,,lit]) => `<path d="${squircle(x+dx,y+dy,R)}" fill="${dx?col:lit?C.sun:col}"/>`).join('');
  const rib = ribbon.length ? `<polyline points="${ribbon.map(i => xy(i).join(',')).join(' ')}" fill="none" stroke="${C.coral}" stroke-width="${n(cell*.13)}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  const text = list.map(([x,y,l]) => `<text x="${x}" y="${y+cell*.145}" text-anchor="middle" class="${cls}">${l}</text>`).join('');
  return road(cell*.028,cell*.036,C.deep)+pads(cell*.028,cell*.036,C.deep)+road(0,0,C.sand)+pads(0,0,C.sand)+rib+text;
}
const drops = (x,y,s) => [[-1,-.7,.09],[-.6,-1.1,.06],[.1,-1.25,.08],[.7,-.95,.055],[1,-.5,.07]].map(([a,b,r]) => `<circle cx="${n(x+a*s)}" cy="${n(y+b*s)}" r="${n(r*s)}" fill="${C.foam}"/>`).join('');

/* ---- the box: 300 x 400, same strip and badges as the other covers ---- */
const cx = i => 37.5+i*75, cy = j => 162.5+j*75;
const coverTiles = [[cx(0),cy(0),'R',1],[cx(1),cy(1),'E',1],[cx(2),cy(1),'E',1],[cx(3),cy(2),'F',0],[cx(0),cy(2),'S',0]];
const cover = `<!-- ================= Shoal ================= -->
<li><a href="/shoal/" aria-label="Shoal: a daily word puzzle that frees tropical fish">
  <div class="stage"><div class="box" style="--spine:#ffc629;--spine-ink:#0b1a5e">
    <div class="spine" aria-hidden="true">Shoal</div>
    <div class="face">
<svg viewBox="0 0 300 400" aria-hidden="true" focusable="false">
  <defs>${FISHES('sh-')}<clipPath id="sh-clip"><rect width="300" height="400"/></clipPath></defs>
  <g clip-path="url(#sh-clip)">
    ${water(300,350,75,-25)}
    ${tiles(coverTiles,[[0,1],[1,2],[2,3],[1,4]],[0,1,2],75,'sh-tile')}
    ${use('sh-',2,cx(1),cy(0)+2,26,-1)}${use('sh-',1,cx(2),cy(0)+2,26)}${use('sh-',3,cx(3),cy(0)+2,26,-1)}
    ${use('sh-',0,cx(0),cy(1),27)}${use('sh-',1,cx(3),cy(1),27,-1)}
    ${use('sh-',3,cx(1),cy(2),27)}${use('sh-',0,cx(2),cy(2),27,-1)}
    ${drops(cx(2),cy(0)-4,30)}
  </g>
  <text x="152" y="83" text-anchor="middle" class="sh-title" fill="${C.deep}" transform="translate(3 4)">Shoal</text>
  <text x="152" y="83" text-anchor="middle" class="sh-title" fill="${C.foam}">Shoal</text>
  <rect x="63" y="96" width="174" height="18" rx="4" fill="${C.deep}"/>
  <text x="150" y="109" text-anchor="middle" class="sh-sub">Find the words. Free the fish.</text>
  <rect y="350" width="300" height="50" class="cd-strip"/>
  <use href="#cd-badge" x="28" y="375"/>
  <text x="54" y="373" class="cd-text">PC CD-ROM</text>
  <text x="54" y="388" class="cd-small">FOUR LETTERS OR MORE</text>
  <g transform="translate(260 358)"><rect width="30" height="34" rx="3" class="age"/><text x="15" y="18" text-anchor="middle" class="age-t">8+</text><text x="15" y="28" text-anchor="middle" class="age-s">AGES</text></g>
</svg>
    </div>
    <div class="shadow"></div>
  </div></div>
  <div class="cap"><b>Shoal</b><span>Free a shoal of tropical fish</span></div>
</a></li>
`;
fs.mkdirSync('art',{recursive:true});
fs.writeFileSync('art/cover.svg.html', cover);

/* ---- app icon ---- */
const icon = pad => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
<defs>${FISHES('')}</defs>
<rect width="64" height="64" ${pad?'':'rx="14"'} fill="${C.seaA}"/>
<path d="M32 0H64V32H32zM0 32H32V64H0z" fill="${C.seaB}"/>
${use('',0,33,33,20)}
</svg>`;
fs.writeFileSync('../../../shoal/icon.svg', icon(false).replace(' width="100%" height="100%"',''));
fs.writeFileSync('art/icon-square.html', `<!doctype html><body style="margin:0">${icon(true)}</body>`);

/* ---- 1200 x 630 link preview ---- */
const P = 150, px = i => 750+i*P+P/2, py = j => 90+j*P+P/2;
const previewTiles = [[px(0),py(0),'R',1],[px(1),py(1),'E',1],[px(2),py(1),'E',1],[px(2),py(2),'F',0],[px(0),py(2),'S',0]];
const font = fs.readFileSync('../node_modules/@fontsource/shrikhand/files/shrikhand-latin-400-normal.woff2').toString('base64');
const tile = fs.readFileSync('../node_modules/@fontsource/rammetto-one/files/rammetto-one-latin-400-normal.woff2').toString('base64');
const body = fs.readFileSync('../node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2').toString('base64');
fs.writeFileSync('art/preview.html', `<!doctype html><style>
@font-face{font-family:Shrikhand;src:url(data:font/woff2;base64,${font})}
@font-face{font-family:'Rammetto One';src:url(data:font/woff2;base64,${tile})}
@font-face{font-family:Atk;font-weight:700;src:url(data:font/woff2;base64,${body})}
body{margin:0}.pv-tile{font:${P*.4}px 'Rammetto One';fill:${C.ink}}.t{font:190px Shrikhand}.s{font:700 38px Atk;fill:${C.foam}}
</style><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs>${FISHES('p-')}</defs>
<rect width="1200" height="630" fill="#1231a6"/>
${water(1200,630,P,-60)}
<rect width="750" height="630" fill="#1231a6"/>
${tiles(previewTiles,[[0,1],[1,2],[2,3],[1,4]],[0,1,2],P,'pv-tile')}
${use('p-',2,px(1),py(0),54,-1)}${use('p-',1,px(2),py(0),54)}${use('p-',0,px(0),py(1),54)}${use('p-',3,px(1),py(2),54)}
<text x="66" y="330" class="t" fill="${C.deep}" transform="translate(6 8)">Shoal</text><text x="66" y="330" class="t" fill="${C.foam}">Shoal</text>
<text x="74" y="416" class="s">Find the words. Free the fish.</text>
</svg>`);
console.log('cover', (cover.length/1024).toFixed(1)+'KB');
