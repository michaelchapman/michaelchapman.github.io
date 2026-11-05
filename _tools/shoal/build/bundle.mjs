// Packs puzzles, stems, fonts, styles and script into one file: ../../../shoal/index.html.
// Run from this folder after `npm install`. Fonts come from the @fontsource packages.
import fs from 'fs';
import path from 'path';
const src = '../src', out = '../../../shoal/index.html';
const seedShuffle = (a) => { let s = 20261105; const r = () => (s = (s*48271)%2147483647)/2147483647; for (let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; };
const ps = seedShuffle(JSON.parse(fs.readFileSync('puzzles.json')));
const lines = ps.map(p => [p.b,p.m,p.w.join(' '),p.x.join(' ')].join('|'));
// stems.json is the full table from stems.py (not committed); stems.board.json keeps only the pairs that occur on a board.
let stemLine;
if (fs.existsSync('stems.json')) {
  const STEM = JSON.parse(fs.readFileSync('stems.json'));
  const table = new Map();
  for (const p of ps) { const on = new Set([...p.w,...p.x]); for (const W of on) for (const w of STEM[W]||[]) if (on.has(w)) { if (!table.has(W)) table.set(W,new Set()); table.get(W).add(w); } }
  stemLine = [...table].map(([W,s]) => W+':'+[...s].sort().join(',')).sort().join(' ');
  fs.writeFileSync('stems.board.json', JSON.stringify(stemLine));
} else stemLine = JSON.parse(fs.readFileSync('stems.board.json'));
const fonts = [
  ['Shrikhand',400,'@fontsource/shrikhand/files/shrikhand-latin-400-normal.woff2'],
  ['Rammetto One',400,'@fontsource/rammetto-one/files/rammetto-one-latin-400-normal.woff2'],
  ['Atkinson Hyperlegible',400,'@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2'],
  ['Atkinson Hyperlegible',700,'@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2'],
];
const face = fonts.map(([f,w,p]) => `@font-face{font-family:'${f}';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join('../node_modules',p)).toString('base64')}) format('woff2')}`).join('\n');
const css = fs.readFileSync(`${src}/style.css`,'utf8');
const body = fs.readFileSync(`${src}/body.html`,'utf8');
const js = fs.readFileSync(`${src}/game.js`,'utf8');
const data = `<script>window.__SHOAL_PUZZLES__=${JSON.stringify(lines)};window.__SHOAL_STEMS__=${JSON.stringify(stemLine)};</script>`;
const DESC = 'A daily word puzzle. Connect letters along the paths, wash them away word by word, and free a shoal of tropical fish.';
const head = `<title>Shoal</title>\n<style>\n${css}\n${face}\n</style>`;
const inner = `${body}\n${data}\n<script>\n${js}\n</script>`;
fs.writeFileSync(out, `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1231a6">
<meta name="description" content="${DESC}">
<link rel="canonical" href="https://michaelchapman.me/shoal/">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Michael Chapman">
<meta property="og:title" content="Shoal">
<meta property="og:description" content="${DESC}">
<meta property="og:url" content="https://michaelchapman.me/shoal/">
<meta property="og:image" content="https://michaelchapman.me/shoal/preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Shoal title over a checked blue lagoon, with sand letter tiles and four colours of tropical fish">
<meta name="twitter:card" content="summary_large_image">
${head}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
</head>
<body>
${inner}
</body>
</html>
`);
console.log(lines.length,'puzzles', (fs.statSync(out).size/1024).toFixed(0)+'KB', 'stems', (stemLine.length/1024).toFixed(0)+'KB');
