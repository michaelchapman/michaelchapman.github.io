// Independent audit of every shipped board: re-derives everything from the page's encoded data.
import fs from 'fs';
import { createRequire } from 'module';
const require=createRequire(import.meta.url);
const w=require('wordlist-english');
const html=fs.readFileSync('../../../shoal/index.html','utf8');
const L=JSON.parse(html.match(/__SHOAL_PUZZLES__=(\[.*?\]);window/s)[1]);
const stemRaw=JSON.parse(html.match(/__SHOAL_STEMS__=(".*?");<\/script>/s)[1]);
const STEM={};for(const e of stemRaw.split(' ')){const [w,l]=e.split(':');STEM[w]=l.split(',')}
let prim=[];
const us=new Set();for(const t of [10,20,35,40,50,55,60,70])for(const x of w[`english/american/${t}`])us.add(x);
const gen=new Set();for(const t of [10,20,35,40,50,55,60,70]){for(const x of w[`english/${t}`])gen.add(x);for(const x of w[`english/british/${t}`])gen.add(x)}
const raw=new Map(JSON.parse(fs.readFileSync('freq.json')).map(([x,t,z])=>[x,[t,z]]));
const NB=[...Array(16)].map(()=>[]),EDGE=[],EID={};const ek=(a,b)=>a<b?a*16+b:b*16+a;
for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)if(Math.abs(a%4-b%4)<=1&&Math.abs((a>>2)-(b>>2))<=1){NB[a].push(b);NB[b].push(a);EID[ek(a,b)]=EDGE.length;EDGE.push([a,b])}
let bad={},boards=new Set(),all=new Map(),counts=[],stars=new Map(),x=new Set();const B=(k,v)=>{(bad[k]=bad[k]||[]).push(v)};
L.forEach((line,idx)=>{const [b,m,ws,xs]=line.split('|');const [m0,m1]=m.split('.').map(s=>parseInt(s,36));const E=new Set();EDGE.forEach((e,i)=>{if(((i<21?m0>>i:m1>>(i-21))&1))E.add(i)});
 if(b.length!==16)B('len',idx);if(boards.has(b))B('dup',idx);boards.add(b);
 const words=ws.split(' ');counts.push(words.length);
 {const set=new Set(words),cov=new Set();for(const w of words)for(const x of STEM[w]||[]){if(!w.includes(x))B('stem-not-inside',w+'>'+x);if(set.has(x))cov.add(x)}prim.push(words.length-cov.size)}const linked=(p,q)=>E.has(EID[ek(p,q)]);
 const T=new Set(),U=new Set();
 for(const w of words){let n=0;const go=p=>{if(p.length===w.length){n++;p.forEach((t,i)=>{T.add(t);if(i)U.add(EID[ek(p[i-1],t)])});return}const c=p[p.length-1];for(const q of NB[c])if(!p.includes(q)&&linked(c,q)&&b[q]===w[p.length])go([...p,q])};for(let s=0;s<16;s++)if(b[s]===w[0])go([s]);
  if(!n)B('untraceable',idx+':'+w);if(us.has(w))B('us',w);if(!gen.has(w))B('notdict',w);if(w.length<4)B('short',w);all.set(w,(all.get(w)||0)+1)}
 if(T.size!==16)B('unused-tile',idx);if(U.size!==E.size)B('dead-edge',idx);
 const max=Math.max(...words.map(w=>w.length));if(words.filter(w=>w.length===max).length!==1)B('star',idx);const st=words.find(w=>w.length===max);stars.set(st,(stars.get(st)||0)+1);
 for(let r=0;r<3;r++)for(let c=0;c<3;c++){const a=r*4+c;if(E.has(EID[ek(a,a+5)])&&E.has(EID[ek(a+1,a+4)]))B('cross',idx)}
 for(const y of (xs?xs.split(' '):[])){x.add(y);if(us.has(y))B('us-bonus',y)}
});
console.log('boards',L.length,'unique',boards.size,'words/board min/avg/max',Math.min(...counts),(counts.reduce((a,b)=>a+b)/counts.length).toFixed(1),Math.max(...counts));
console.log('separate finds min/avg/max',Math.min(...prim),(prim.reduce((a,b)=>a+b)/prim.length).toFixed(1),Math.max(...prim),'stem entries',Object.keys(STEM).length);
console.log('distinct target',all.size,'bonus',x.size,'distinct stars',stars.size,'repeat stars',[...stars].filter(([,n])=>n>1).length);
console.log('problems',Object.fromEntries(Object.entries(bad).map(([k,v])=>[k,v.length+' '+v.slice(0,6)])));
const brit=[...all.keys()].filter(w=>w.match(/our$|ours$|tre$|tres$|ise$|ised$|ogue$/)).filter(w=>JSON.parse(fs.readFileSync('brit.json')).includes(w));
console.log('British-only spellings used',brit.length,brit.slice(0,24).join(' '));
const words=[...all.keys()];
console.log('most used',[...all].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([w,n])=>w+':'+n).join(' '));
console.log('sens',words.filter(w=>/^(sex|nud|gay|lesb|porn|drug|dope|gun|shot|dead|die|hate|slav|race|raci|jew|isla|musl|chris|god|hell|drunk|booz|beer|arab|blac|whit|fat|ugly|poor|stab|gore|bleed|blood|torture|terror|war|nuke|abort|suic|anal|arse|ass|tit|bum|poo|wee|fart|bra|gas)/.test(w)).join(' '));
fs.writeFileSync('targets.txt',words.sort().join('\n'));
