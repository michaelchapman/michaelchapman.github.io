const { chromium } = require('playwright');
const path = require('path');
(async()=>{
const file = 'file://' + path.resolve('../../../shoal/index.html');
const OUT = process.env.OUT || '.';
const browser = await chromium.launch();
async function run(name, ctxOpts, touch) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type()==='error' && errors.push(m.text()));
  await page.goto(file); await page.waitForTimeout(500);
  await page.screenshot({ path:`${OUT}/${name}-1-start.png` });
  const wordsOf = () => page.evaluate(() => { const G=__shoal.G; return { words:G.pz.words, letters:G.pz.letters, star:G.pz.star }; });
  const { words, letters, star } = await wordsOf();
  // trace with real pointer input along a live path
  const pathFor = w => page.evaluate(w => { const G=__shoal.G; const NB=(a,b)=>Math.abs(a%4-b%4)<=1&&Math.abs((a>>2)-(b>>2))<=1&&a!==b;
    const L=G.pz.letters; const live=(a,b)=>{ const k=[a,b].sort((x,y)=>x-y); return G.pz.linked(k[0],k[1]) };
    const walk=p=>{ if(p.length===w.length) return p; const c=p[p.length-1]; for(let n=0;n<16;n++) if(NB(c,n)&&!p.includes(n)&&G.tiles[n].on&&live(c,n)&&L[n]===w[p.length]){const r=walk([...p,n]); if(r) return r} return null };
    for(let s=0;s<16;s++) if(L[s]===w[0]&&G.tiles[s].on){const r=walk([s]); if(r) return r} return null }, w);
  const box = await page.locator('#board').boundingBox();
  const xy = t => [box.x+box.width*((t%4)+.5)/4, box.y+box.height*((t>>2)+.5)/4];
  const drag = async p => { const [x,y]=xy(p[0]); await page.mouse.move(x,y); await page.mouse.down(); for(const t of p.slice(1)){const [a,b]=xy(t); await page.mouse.move(a,b,{steps:6});} await page.mouse.up(); };
  const tapSeq = async p => { for(const t of [...p,p[p.length-1]]){const [a,b]=xy(t); if(touch) await page.touchscreen.tap(a,b); else {await page.mouse.click(a,b)} await page.waitForTimeout(30);} };
  // wrong guess: first
  // midway
  let i=0;
  const order=[...words].sort((a,b)=>a.length-b.length);
  for(const w of order){ if(await page.evaluate(w=>__shoal.G.found.includes(w),w)) continue; const p=await pathFor(w); if(!p){errors.push('no path '+w);continue}
    if(touch||i%3===1) await tapSeq(p); else if(i%3===2){ await page.keyboard.type(w,{delay:5}); await page.keyboard.press('Enter'); } else await drag(p);
    await page.waitForTimeout(120); i++;
    if(i===Math.floor(order.length*.6)){ await page.waitForTimeout(1600); await page.screenshot({ path:`${OUT}/${name}-2-mid.png` });
       const nxt=await page.evaluate(o=>o.find(w=>!__shoal.G.found.includes(w)),order); const p2=await pathFor(nxt); const [x,y]=xy(p2[0]); await page.mouse.move(x,y); await page.mouse.down(); const [a,b]=xy(p2[1]); await page.mouse.move(a,b,{steps:5}); const [c,d]=xy(p2[2]); await page.mouse.move(c,d,{steps:5}); await page.waitForTimeout(100); await page.screenshot({ path:`${OUT}/${name}-3-trace.png` }); const [e,f]=xy(p2[0]); await page.mouse.move(box.x-40,box.y+box.height+60); await page.mouse.up(); await page.waitForTimeout(100); await page.keyboard.press('Escape');}
  }
  await page.waitForTimeout(3000);
  const st = await page.evaluate(()=>{const G=__shoal.G;return {phase:G.phase,found:G.found.length,total:G.pz.words.length,fish:G.fish.length,kinds:G.layout&&G.layout.map(l=>l.kind).join(''),can:G.layout&&__shoal.canClear(G.layout)}});
  console.log(name,st);
  await page.screenshot({ path:`${OUT}/${name}-4-fish.png`, fullPage:true });
  // play the fish greedily using the real board: DFS for a clearing sequence, then tap it
  const plan = await page.evaluate(()=>{const G=__shoal.G; const cols=G.grid.map(c=>c.map(f=>f.kind));
    const groups=cs=>{const seen=new Set(),o=[];for(let x=0;x<cs.length;x++)for(let y=0;y<cs[x].length;y++){if(seen.has(x*8+y))continue;const k=cs[x][y],g=[],st=[[x,y]];seen.add(x*8+y);while(st.length){const[a,b]=st.pop();g.push([a,b]);for(const[p,q]of[[a+1,b],[a-1,b],[a,b+1],[a,b-1],[a+1,b+1],[a+1,b-1],[a-1,b+1],[a-1,b-1]])if(cs[p]&&cs[p][q]===k&&!seen.has(p*8+q)){seen.add(p*8+q);st.push([p,q])}}if(g.length>=2)o.push(g)}return o};
    const go=(cs,seq)=>{if(!cs.length)return seq;for(const g of groups(cs)){const n=cs.map(c=>[...c]);[...g].sort((a,b)=>b[1]-a[1]).forEach(([a,b])=>n[a].splice(b,1));const r=go(n.filter(c=>c.length),[...seq,g[0]]);if(r)return r}return null};
    return go(cols,[])});
  console.log(name,'plan',JSON.stringify(plan));
  if(plan){ for(const [c,h] of plan){ const x=box.x+box.width*(c+.5)/4,y=box.y+box.height*(3-h+.5)/4; if(touch) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y); await page.waitForTimeout(900);} }
  else { for(let n=0;n<12;n++){ const m=await page.evaluate(()=>{const G=__shoal.G;for(let c=0;c<G.grid.length;c++)for(let h=0;h<G.grid[c].length;h++){const f=G.grid[c][h];const nb=[G.grid[c+1]&&G.grid[c+1][h],G.grid[c][h+1],G.grid[c+1]&&G.grid[c+1][h+1],G.grid[c+1]&&G.grid[c+1][h-1]];if(f.kind>=0&&nb.some(o=>o&&o.kind===f.kind))return [c,h]}return null}); if(!m)break; await page.mouse.click(box.x+box.width*(m[0]+.5)/4,box.y+box.height*(3-m[1]+.5)/4); await page.waitForTimeout(900);} }
  await page.waitForTimeout(1200);
  const st2 = await page.evaluate(()=>{const G=__shoal.G;return {left:G.fish.length,cleared:G.cleared,stuck:G.stuck,score:G.popScore}});
  console.log(name,st2, await page.locator('#readout').innerText());
  await page.screenshot({ path:`${OUT}/${name}-5-after.png`, fullPage:true });
  console.log(name,'errors',errors);
  const over = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  console.log(name,'h-overflow',over);
  return { page, ctx, box, errors };
}
const d = await run('desk',{ viewport:{width:1200,height:820}, deviceScaleFactor:1 },false);
const m = await run('phone',{ viewport:{width:390,height:780}, deviceScaleFactor:2, hasTouch:true, isMobile:true },true);
await d.ctx.close(); await m.ctx.close(); await browser.close();

})();
