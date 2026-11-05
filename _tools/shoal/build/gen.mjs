import fs from 'fs';
const COUNT = +(process.argv[2]||20), SEED0 = +(process.argv[3]||1), OUT = process.argv[4]||'puzzles.json';
const COLLAPSE = process.env.COLLAPSE!=='0';
let rngS = SEED0*2654435761>>>0;
const rnd=()=>{rngS=(rngS+0x6D2B79F5)>>>0;let t=rngS;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
const ri=n=>Math.floor(rnd()*n), pick=a=>a[ri(a.length)];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};

const raw=JSON.parse(fs.readFileSync('freq.json'));
const STEM=JSON.parse(fs.readFileSync('stems.json'));
const primaries=ws=>{const s=new Set(ws),cov=new Set();for(const w of ws)for(const x of STEM[w]||[])if(s.has(x))cov.add(x);return ws.length-cov.size};
const common=new Map(), extended=new Set();
for(const [w,t,z] of raw){ if(t<=40&&z>=3.0) common.set(w,z); else extended.add(w); }
const mk=()=>({});
const trie=mk(), xtrie=mk();
const add=(T,w)=>{let n=T;for(const c of w)n=n[c]||(n[c]=mk());n.$=w};
for(const w of common.keys()) add(trie,w);
for(const w of extended) add(xtrie,w);
const uses=new Map();const useP=w=>(uses.get(w)||0)*.18;
const brit=new Set(JSON.parse(fs.readFileSync('brit.json')));
const val=w=>Math.min(common.get(w)||3,4.4)+(brit.has(w)?1.4:0)-useP(w);
const stars=[...common].filter(([w,z])=>w.length>=7&&w.length<=9&&z>=3.3&&!/s$/.test(w)&&new Set(w).size>=5).map(x=>x[0]);

// geometry
const N=[...Array(16)].map(()=>[]), eid={}; const EDGES=[];
const ek=(a,b)=>a<b?a*16+b:b*16+a;
for(let a=0;a<16;a++)for(let b=a+1;b<16;b++){const dx=Math.abs(a%4-b%4),dy=Math.abs((a>>2)-(b>>2));if(dx<=1&&dy<=1){N[a].push(b);N[b].push(a);eid[ek(a,b)]=EDGES.length;EDGES.push([a,b])}}
const crossOf={};
for(let r=0;r<3;r++)for(let c=0;c<3;c++){const a=r*4+c,b=a+1,d=a+4,e=a+5;crossOf[ek(a,e)]=ek(b,d);crossOf[ek(b,d)]=ek(a,e)}
const crosses=(E,k)=>crossOf[k]!==undefined&&E.has(crossOf[k]);

function place(word,board,E){ // random path for star
  const tryFrom=(s)=>{const path=[s],used=new Set([s]);const loc=new Set();
    const go=i=>{if(i===word.length)return true;for(const n of shuffle([...N[path[i-1]]])){if(used.has(n))continue;const k=ek(path[i-1],n);if(crosses(loc,k))continue;used.add(n);path.push(n);const had=loc.has(k);loc.add(k);if(go(i+1))return true;if(!had)loc.delete(k);used.delete(n);path.pop()}return false};
    return go(1)?path:null};
  for(const s of shuffle([...Array(16).keys()])){const p=tryFrom(s);if(p)return p}return null}
const commit=(word,path,board,E)=>{path.forEach((c,i)=>{board[c]=word[i];if(i)E.add(ek(path[i-1],c))})};

function candidates(board,E,needEmpty,maxNew,maxLen=8){
  const out=[];let budget=400000;
  const dfs=(cell,node,path,loc,empties,fresh)=>{
    if(budget--<0)return;
    if(node.$&&path.length>=4&&empties>=needEmpty&&!(needEmpty===0&&fresh===0)) out.push({w:node.$,path:[...path],empties,fresh});
    if(path.length>=maxLen)return;
    for(const n of N[cell]){ if(path.includes(n))continue;
      const k=ek(cell,n),isNew=!E.has(k);
      if(isNew&&(fresh>=maxNew||crosses(E,k)||crosses(loc,k)))continue;
      const ch=board[n];
      const opts=ch?(node[ch]?[ch]:[]):Object.keys(node).filter(x=>x!=='$');
      for(const c of opts){path.push(n);if(isNew)loc.add(k);dfs(n,node[c],path,loc,empties+(ch?0:1),fresh+(isNew?1:0));if(isNew)loc.delete(k);path.pop()}
    }};
  for(const s of shuffle([...Array(16).keys()])){const ch=board[s];const opts=ch?(trie[ch]?[ch]:[]):Object.keys(trie).filter(x=>x!=='$');for(const c of opts)dfs(s,trie[c],[s],new Set(),ch?0:1,0)}
  return out}

function closure(board,E,T){const found=new Set();const walk=(c,n,seen)=>{if(n.$&&n.$.length>=4)found.add(n.$);for(const m of N[c]){if(seen&(1<<m))continue;if(!E.has(ek(c,m)))continue;const nx=n[board[m]];if(nx)walk(m,nx,seen|(1<<m))}};
  for(let s=0;s<16;s++){const n=T[board[s]];if(n)walk(s,n,1<<s)}return [...found]}
function traces(word,board,E){const res=[];const go=(p)=>{if(p.length===word.length){res.push([...p]);return}const c=p[p.length-1];for(const m of N[c]){if(p.includes(m)||!E.has(ek(c,m))||board[m]!==word[p.length])continue;p.push(m);go(p);p.pop()}};
  for(let s=0;s<16;s++)if(board[s]===word[0])go([s]);return res}

const colourOf=len=>len<=4?0:len===5?1:len===6?2:3;
// fish solver
function groups(cols){const seen=new Set(),gs=[];for(let x=0;x<cols.length;x++)for(let y=0;y<cols[x].length;y++){const key=x*8+y;if(seen.has(key))continue;const col=cols[x][y];const g=[];const st=[[x,y]];seen.add(key);while(st.length){const [a,b]=st.pop();g.push([a,b]);for(const [p,q] of [[a+1,b],[a-1,b],[a,b+1],[a,b-1],[a+1,b+1],[a+1,b-1],[a-1,b+1],[a-1,b-1]]){if(p<0||p>=cols.length)continue;if(q<0||q>=cols[p].length)continue;if(cols[p][q]!==col)continue;const k=p*8+q;if(seen.has(k))continue;seen.add(k);st.push([p,q])}}if(g.length>=2)gs.push(g)}return gs}
function clearable(cols0){const memo=new Map();const ser=c=>c.map(x=>x.join('')).join('|');
  const go=cols=>{const left=cols.reduce((n,c)=>n+c.length,0);if(!left)return true;const k=ser(cols);if(memo.has(k))return memo.get(k);let ok=false;for(const g of groups(cols)){let nc=cols.map(c=>[...c]);const byCol={};for(const [x,y] of g)(byCol[x]||(byCol[x]=[])).push(y);for(const x in byCol)for(const y of byCol[x].sort((a,b)=>b-a))nc[x].splice(y,1);if(COLLAPSE)nc=nc.filter(c=>c.length);if(go(nc)){ok=true;break}}memo.set(k,ok);return ok};return go(cols0)}
function layoutFromOrder(order,tileWords,inSet){const left=tileWords.map(s=>new Set(s));const col=Array(16).fill(-1);const found=new Set();let n=0;for(const w of order){if(found.has(w))continue;const batch=[w,...(STEM[w]||[]).filter(x=>inSet.has(x)&&!found.has(x))];batch.forEach(x=>found.add(x));for(let t=0;t<16;t++){const had=left[t].size>0;batch.forEach(x=>left[t].delete(x));if(had&&!left[t].size)col[t]=(n++)&3}}return col}
const toCols=col=>{const cols=[];for(let x=0;x<4;x++){const c=[];for(let y=3;y>=0;y--)c.push(col[y*4+x]);cols.push(c)}return cols};

function score(words,board,E){const lens=words.map(w=>w.length);const L=Math.max(...lens);return {L,stars:words.filter(w=>w.length===L).length}}

const puzzles=[];const seenBoards=new Set();let tries=0,rej={};const R=k=>rej[k]=(rej[k]||0)+1;
const t0=Date.now();
while(puzzles.length<COUNT){ tries++;
  const board=Array(16).fill(null),E=new Set();
  const star=pick(stars);const p=place(star,board,E);if(!p){R('place');continue}commit(star,p,board,E);
  let ok=true;
  while(board.some(c=>!c)){
    const cs=candidates(board,E,1,3);
    if(!cs.length){ok=false;break}
    cs.forEach(c=>c.s=val(c.w)+c.empties*1.2-c.fresh*.9+rnd()*1.2-(c.w.length>=star.length?9:0));
    cs.sort((a,b)=>b.s-a.s);const c=cs[0];commit(c.w,c.path,board,E)}
  if(!ok){R('fill');continue}
  let words=closure(board,E,trie);
  for(let i=0;i<12&&primaries(words)<15;i++){const cs=candidates(board,E,0,1).filter(c=>!words.includes(c.w));if(!cs.length)break;cs.forEach(c=>c.s=val(c.w)+rnd()-(c.w.length>=star.length?9:0));cs.sort((a,b)=>b.s-a.s);const c=cs[0];commit(c.w,c.path,board,E);words=closure(board,E,trie)}
  if(primaries(words)<13||words.length>30){R('count');continue}
  const {L,stars:ns}=score(words,board,E);if(ns!==1||L<6){R('star');continue}
  if(E.size>30){R('edges');continue}
  const avgZ=words.reduce((n,w)=>n+common.get(w),0)/words.length;if(avgZ<3.7){R('rare');continue}
  const key=[...board].join('');if(seenBoards.has(key))continue;
  const tileWords=Array.from({length:16},()=>new Set());
  for(const w of words)for(const tr of traces(w,board,E))for(const t of tr)tileWords[t].add(w);
  if(tileWords.some(s=>!s.size)){R('unused');continue}
  if(tileWords.filter(s=>s.size===1).length>4){R('single');continue}
  // does every edge belong to a word
  const liveE=new Set();for(const w of words)for(const tr of traces(w,board,E))for(let i=1;i<tr.length;i++)liveE.add(ek(tr[i-1],tr[i]));
  if(liveE.size!==E.size){R('deadEdge');continue}
  // fish sim
  const inSet=new Set(words);let hits=0,cols4=new Set();const sims=120;
  for(let s=0;s<sims;s++){const order=[...words].sort((a,b)=>(a.length+rnd()*3)-(b.length+rnd()*3));const col=layoutFromOrder(order,tileWords,inSet);col.forEach(c=>cols4.add(c));if(clearable(toCols(col)))hits++}
  const rate=hits/sims;
  if(rate<.3||rate>.92){R('rate');continue}
  seenBoards.add(key);for(const w of words)uses.set(w,(uses.get(w)||0)+1);uses.set(star,(uses.get(star)||0)+40);
  const x=closure(board,E,xtrie).filter(w=>!common.has(w));
  let mask=[0,0];for(const k of E){const i=eid[k];if(i<21)mask[0]|=1<<i;else mask[1]|=1<<(i-21)}
  puzzles.push({b:board.join(''),m:mask.map(n=>n.toString(36)).join('.'),w:words.sort((a,b)=>a.length-b.length||a.localeCompare(b)),x,star:words.find(w=>w.length===L),rate,e:E.size,colours:cols4.size});
  if(puzzles.length%50===0)console.error(puzzles.length,'tries',tries,((Date.now()-t0)/1000).toFixed(0)+'s');
}
fs.writeFileSync(OUT,JSON.stringify(puzzles));
const rs=puzzles.map(p=>p.rate).sort((a,b)=>a-b);
console.log('tries',tries,'rej',rej,'time',((Date.now()-t0)/1000).toFixed(1));
console.log('rate p10/50/90',rs[rs.length*.1|0],rs[rs.length*.5|0],rs[rs.length*.9|0],'avg words',puzzles.reduce((n,p)=>n+p.w.length,0)/puzzles.length,'avg edges',puzzles.reduce((n,p)=>n+p.e,0)/puzzles.length, 'colours',puzzles.reduce((n,p)=>n+p.colours,0)/puzzles.length);
for(const p of puzzles.slice(0,5)){console.log(p.b.match(/.{4}/g).join(' '),p.e,'rate',p.rate.toFixed(2),'star',p.star,'\n  ',p.w.join(' '),'\n  x:',p.x.join(' '))}
