import fs from 'fs';
const ps=JSON.parse(fs.readFileSync('puzzles.json')), STEM=JSON.parse(fs.readFileSync('stems.json'));
const N=[...Array(16)].map(()=>[]),EDGE=[],EID={};const ek=(a,b)=>a<b?a*16+b:b*16+a;
for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)if(Math.abs(a%4-b%4)<=1&&Math.abs((a>>2)-(b>>2))<=1){N[a].push(b);N[b].push(a);EID[ek(a,b)]=EDGE.length;EDGE.push([a,b])}
function tilesOf(p){const [m0,m1]=p.m.split('.').map(s=>parseInt(s,36));const E=new Set();EDGE.forEach((e,i)=>{if((i<21?m0>>i:m1>>(i-21))&1)E.add(i)});const out={};
 for(const w of p.w){const T=new Set();const go=q=>{if(q.length===w.length){q.forEach(t=>T.add(t));return}const c=q[q.length-1];for(const n of N[c])if(!q.includes(n)&&E.has(EID[ek(c,n)])&&p.b[n]===w[q.length])go([...q,n])};for(let s=0;s<16;s++)if(p.b[s]===w[0])go([s]);out[w]=T}return out}
function clearable(cols0,diag){const memo=new Map();const dirs=diag?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,0],[-1,0],[0,1],[0,-1]];
 const go=cs=>{if(!cs.length)return true;const k=cs.map(c=>c.join('')).join('|');if(memo.has(k))return memo.get(k);const seen=new Set();let ok=false;
  for(let x=0;x<cs.length&&!ok;x++)for(let y=0;y<cs[x].length&&!ok;y++){if(seen.has(x*8+y))continue;const c=cs[x][y],g=[],st=[[x,y]];seen.add(x*8+y);while(st.length){const[a,b]=st.pop();g.push([a,b]);for(const[d,e]of dirs){const p=a+d,q=b+e;if(cs[p]&&cs[p][q]===c&&!seen.has(p*8+q)){seen.add(p*8+q);st.push([p,q])}}}if(g.length<2)continue;const n=cs.map(c=>[...c]);g.sort((m,o)=>o[1]-m[1]).forEach(([a,b])=>n[a].splice(b,1));if(go(n.filter(c=>c.length)))ok=true}
  memo.set(k,ok);return ok};return go(cols0)}
function play(p,T,order,rule){const left=[...Array(16)].map(()=>new Set());for(const w of p.w)T[w].forEach(t=>left[t].add(w));const found=new Set();const kind=Array(16).fill(-1);let n=0;
 for(const w of order){if(found.has(w))continue;const batch=[w,...(STEM[w]||[]).filter(x=>T[x]&&!found.has(x))];batch.forEach(x=>found.add(x));const fr=[];for(let t=0;t<16;t++){let had=left[t].size>0;batch.forEach(x=>left[t].delete(x));if(had&&!left[t].size)fr.push(t)}
  for(const t of fr){kind[t]=rule==='Q'?(n>>2):(n&3);n++}}
 return kind}
const toCols=k=>{const c=[];for(let x=0;x<4;x++){const a=[];for(let y=3;y>=0;y--)a.push(k[y*4+x]);c.push(a)}return c};
const R=(a)=>a.sort((x,y)=>x-y);let res={};
for(const rule of ['Q','R'])for(const diag of [false,true]){const rates=[];for(const p of ps.slice(0,150)){const T=tilesOf(p);let hit=0;const S=60;for(let i=0;i<S;i++){const o=[...p.w].sort((a,b)=>(a.length+Math.random()*3)-(b.length+Math.random()*3));if(clearable(toCols(play(p,T,o,rule)),diag))hit++}rates.push(hit/S)}R(rates);console.log(rule,'diag',diag,'p10',rates[15].toFixed(2),'p50',rates[75].toFixed(2),'p90',rates[135].toFixed(2),'mean',(rates.reduce((a,b)=>a+b)/rates.length).toFixed(2))}
let prim=[];for(const p of ps){const s=new Set(p.w);const cov=new Set();for(const w of p.w)for(const x of STEM[w]||[])if(s.has(x))cov.add(x);prim.push(p.w.length-cov.size)}R(prim);console.log('separate finds p10/50/90',prim[80],prim[400],prim[720],'min',prim[0]);
