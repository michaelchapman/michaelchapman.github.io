// Merges generator runs into puzzles.json: one board per star word, richest boards first, 800 kept.
// Run words.mjs and freq.py first.
import fs from 'fs';
const KEEP = 800, all = process.argv.slice(2).flatMap(f => JSON.parse(fs.readFileSync(f)));
// Boards made before a word was blocked are dropped here, so the block list can grow without a full regeneration.
const accepted = new Set(JSON.parse(fs.readFileSync('freq.json')).filter(r => r[3] === '').map(r => r[0]));
const before = all.length;
for (let i = all.length-1; i >= 0; i--) if (all[i].w.some(w => !accepted.has(w))) all.splice(i,1);
console.log('dropped for newly blocked words', before - all.length);
const seen = new Set(), boards = new Set(), out = [];
for (const p of all.sort((a,b) => b.w.length - a.w.length)) { if (seen.has(p.star) || boards.has(p.b)) continue; seen.add(p.star); boards.add(p.b); out.push(p); }
console.log('generated', all.length, 'distinct stars', out.length, 'kept', Math.min(KEEP, out.length));
fs.writeFileSync('puzzles.json', JSON.stringify(out.slice(0, KEEP)));
