// Independent audit of every shipped board, re-derived from the page's own data and the dictionary in freq.json
// (run words.mjs and freq.py first). Checks that each board's word list is exactly the accepted words that can be
// traced on it, that each is traceable one way, and that nothing outside the dictionary that looks like a word can be formed.
import fs from 'fs';
const html=fs.readFileSync('../../../shoal/index.html','utf8');
const L=JSON.parse(html.match(/__SHOAL_PUZZLES__=(\[.*?\]);window/s)[1]);
const stemRaw=JSON.parse(html.match(/__SHOAL_STEMS__=(".*?");<\/script>/s)[1]);
const STEM={};for(const e of stemRaw.split(' ')){const [w,l]=e.split(':');STEM[w]=l.split(',')}
const dict=new Map(JSON.parse(fs.readFileSync('freq.json')).map(([w,t,z,f])=>[w,{t,z,f}]));
const T={};for(const w of dict.keys()){let n=T;for(const c of w)n=n[c]||(n[c]={});n.$=w}
const NB=[...Array(16)].map(()=>[]),EDGE=[],EID={};const ek=(a,b)=>a<b?a*16+b:b*16+a;
for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)if(Math.abs(a%4-b%4)<=1&&Math.abs((a>>2)-(b>>2))<=1){NB[a].push(b);NB[b].push(a);EID[ek(a,b)]=EDGE.length;EDGE.push([a,b])}
const bad={},B=(k,v)=>{(bad[k]=bad[k]||[]).push(v)};
const boards=new Set(),all=new Map(),stars=new Map(),counts=[],prim=[],edges=[],hard=new Map(),fringe=new Map();
L.forEach((line,idx)=>{const parts=line.split('|');if(parts.length!==3)B('format',idx);const [b,m,ws]=parts;const [m0,m1]=m.split('.').map(s=>parseInt(s,36));const E=new Set();EDGE.forEach((e,i)=>{if((i<21?m0>>i:m1>>(i-21))&1)E.add(i)});
 if(b.length!==16)B('len',idx);if(boards.has(b))B('dup',idx);boards.add(b);edges.push(E.size);
 const words=ws.split(' '),set=new Set(words);counts.push(words.length);
 // every dictionary string traceable on the board, with the tiles and links each uses
 const ways=new Map(),Tused=new Set(),Eused=new Set();
 const go=(c,n,path)=>{if(n.$){ways.set(n.$,(ways.get(n.$)||0)+1);if(set.has(n.$))path.forEach((t,i)=>{Tused.add(t);if(i)Eused.add(EID[ek(path[i-1],t)])})}
  for(const q of NB[c]){if(path.includes(q)||!E.has(EID[ek(c,q)]))continue;const nx=n[b[q]];if(nx)go(q,nx,[...path,q])}};
 for(let s=0;s<16;s++){const n=T[b[s]];if(n)go(s,n,[s])}
 for(const w of words){const d=dict.get(w);if(!ways.has(w))B('untraceable',idx+':'+w);else if(ways.get(w)!==1)B('more-than-one-way',idx+':'+w+'x'+ways.get(w));
  if(!d||d.f!=='')B('not-accepted',w);else{if(d.z<2.6)hard.set(w,(hard.get(w)||0)+1);if(d.t>=60)B('obscure-tier',w)}
  if(w.length<4)B('short',w);all.set(w,(all.get(w)||0)+1)}
 for(const w of ways.keys()){if(set.has(w))continue;const d=dict.get(w);
  if(d.f==='')B('accepted-word-missing-from-board',idx+':'+w);else if(d.f==='us')B('american-spelling-formable',idx+':'+w);else if(d.f==='block')B('rude-word-formable',idx+':'+w);
  else if(d.z>=1.8)B('familiar-outside-word-formable',idx+':'+w);else fringe.set(w,(fringe.get(w)||0)+1)}
 if(Tused.size!==16)B('unused-tile',idx);if(Eused.size!==E.size)B('dead-link',idx);
 const max=Math.max(...words.map(w=>w.length));if(words.filter(w=>w.length===max).length!==1)B('star',idx);const st=words.find(w=>w.length===max);stars.set(st,(stars.get(st)||0)+1);
 for(let r=0;r<3;r++)for(let c=0;c<3;c++){const a=r*4+c;if(E.has(EID[ek(a,a+5)])&&E.has(EID[ek(a+1,a+4)]))B('cross',idx)}
 const cov=new Set();for(const w of words)for(const x of STEM[w]||[]){if(!w.includes(x))B('stem-not-inside',w+'>'+x);if(set.has(x))cov.add(x)}prim.push(words.length-cov.size);
});
const st=a=>`${Math.min(...a)}/${(a.reduce((x,y)=>x+y)/a.length).toFixed(1)}/${Math.max(...a)}`;
console.log('boards',L.length,'unique',boards.size,'| words per board min/avg/max',st(counts),'| separate finds',st(prim),'| links',st(edges));
console.log('distinct words',all.size,'| distinct stars',stars.size,'| stem entries',Object.keys(STEM).length,'| boards with a harder word',[...hard.values()].reduce((a,b)=>a+b,0));
console.log('problems',JSON.stringify(Object.fromEntries(Object.entries(bad).map(([k,v])=>[k,v.length+': '+v.slice(0,6).join(' ')]))));
console.log('harder words',[...hard].sort((a,b)=>b[1]-a[1]).map(([w,n])=>w+(n>1?':'+n:'')).join(' '));
const fr=[...fringe].sort((a,b)=>b[1]-a[1]);console.log('fringe strings still refused: per board',(fr.reduce((a,b)=>a+b[1],0)/L.length).toFixed(1),'| most frequent',fr.slice(0,60).map(([w,n])=>w+':'+n).join(' '));
console.log('most used words',[...all].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([w,n])=>w+':'+n).join(' '));
fs.writeFileSync('targets.txt',[...all.keys()].sort().join('\n'));
