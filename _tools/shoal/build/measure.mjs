// How far a set of boards is from "every formable English word counts, each formed one way".
// Needs `npm i word-list` (a 274k list used only as a yardstick here).
import fs from 'fs';
import { createRequire } from 'module';
const require=createRequire(import.meta.url);
const w=require('wordlist-english');
const ps=JSON.parse(fs.readFileSync(process.argv[2]||'puzzles.json'));
const huge=new Set(fs.readFileSync('../node_modules/word-list/words.txt','utf8').split('\n'));
const scowl=new Map();for(const t of [10,20,35,40,50,55,60,70])for(const k of [`english/${t}`,`english/british/${t}`,`english/american/${t}`])for(const x of w[k]||[])if(/^[a-z]+$/.test(x)&&x.length>=4&&!scowl.has(x))scowl.set(x,t);
const N=[...Array(16)].map(()=>[]),EDGE=[],EID={};const ek=(a,b)=>a<b?a*16+b:b*16+a;
for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)if(Math.abs(a%4-b%4)<=1&&Math.abs((a>>2)-(b>>2))<=1){N[a].push(b);N[b].push(a);EID[ek(a,b)]=EDGE.length;EDGE.push([a,b])}
const T={};for(const x of new Set([...scowl.keys(),...huge])){if(x.length<4)continue;let n=T;for(const c of x)n=n[c]||(n[c]={});n.$=x}
let multi=0,multiWords=0,maxWays=0,agg={x:0,s70:0,ghost:0,scowlMiss:0};const ghosts=new Map(),missing=new Map();
for(const p of ps){const [m0,m1]=p.m.split('.').map(s=>parseInt(s,36));const E=new Set();EDGE.forEach((e,i)=>{if((i<21?m0>>i:m1>>(i-21))&1)E.add(i)});
 const cnt=new Map();const walk=(c,n,seen)=>{if(n.$)cnt.set(n.$,(cnt.get(n.$)||0)+1);for(const q of N[c]){if(seen&(1<<q)||!E.has(EID[ek(c,q)]))continue;const nx=n[p.b[q]];if(nx)walk(q,nx,seen|(1<<q))}};
 for(let s=0;s<16;s++){const n=T[p.b[s]];if(n)walk(s,n,1<<s)}
 const acc=new Set([...p.w,...(p.x||[])]);let m=0;for(const x of acc){const k=cnt.get(x)||0;if(k>1){m++;maxWays=Math.max(maxWays,k)}}if(m){multi++;multiWords+=m}
 agg.x+=(p.x||[]).length;
 for(const x of cnt.keys()){if(acc.has(x))continue;if(scowl.has(x)){agg.scowlMiss++;missing.set(x,(missing.get(x)||0)+1)}else{agg.ghost++;ghosts.set(x,(ghosts.get(x)||0)+1)}}}
const n=ps.length;console.log('boards',n,'| boards with a word formed more than one way',multi,'words',multiWords,'max ways',maxWays);
console.log('per board: optional words',(agg.x/n).toFixed(1),'| rejected but in SCOWL<=70',(agg.scowlMiss/n).toFixed(1),'| rejected, only in the 274k list',(agg.ghost/n).toFixed(1));
const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,70).map(([x,k])=>x+':'+k).join(' ');
console.log('REJECTED SCOWL:',top(missing));console.log('REJECTED 274k-only:',top(ghosts));
