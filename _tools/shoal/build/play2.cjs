const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve('../../../shoal/index.html');
const OUT = process.env.OUT;
(async()=>{
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:780}, deviceScaleFactor:2, hasTouch:true, isMobile:true, permissions:['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>m.type()==='error'&&errors.push(m.text()));
await page.goto(file); await page.waitForTimeout(400);
const rd=()=>page.locator('#readout').innerText();
const box = await page.locator('#board').boundingBox();
const xy=t=>[box.x+box.width*((t%4)+.5)/4,box.y+box.height*((t>>2)+.5)/4];

// messages: bad word, short word, bonus word, duplicates
await page.evaluate(()=>{});
const typeWord=async w=>{await page.keyboard.type(w,{delay:3});await page.keyboard.press('Enter');await page.waitForTimeout(60);return rd()};
const info=await page.evaluate(()=>({b:__shoal.G.pz.bonus,w:__shoal.G.pz.words}));
console.log('short:',await typeWord(info.w[0].slice(0,3)));
console.log('path miss:',(await (async()=>{await page.keyboard.type('zqj',{delay:3});await page.waitForTimeout(50);const r=await rd();await page.keyboard.press('Escape');return r})()));
if(info.b[0]){console.log('bonus:',info.b[0],await typeWord(info.b[0]));console.log('bonus again:',await typeWord(info.b[0]));}
console.log('word:',await typeWord(info.w[0]));console.log('again:',await typeWord(info.w[0]));
// tap: tap-tile, non-linked restart, Enter word button
await page.waitForTimeout(1700);
// reload keeps progress
await page.reload(); await page.waitForTimeout(400);
console.log('after reload', await page.evaluate(()=>({found:__shoal.G.found,bonus:__shoal.G.bonus.length,gone:Object.keys(__shoal.G.width).length})));

// find a clearable order for this board, then play it from scratch
await page.evaluate(()=>{localStorage.clear()}); await page.reload(); await page.waitForTimeout(400);
const order=await page.evaluate(()=>{const pz=__shoal.G.pz;for(let i=0;i<3000;i++){const o=[...pz.words].sort(()=>Math.random()-.5);if(__shoal.canClear(__shoal.layoutOf(o)))return{o,i,counts:[0,1,2,3].map(k=>__shoal.layoutOf(o).filter(l=>l.kind===k).length)}}return null});
console.log('colour counts',order.counts);
// stem finding: find a word with a stem, confirm both land together
const stemCase=await page.evaluate(()=>{const pz=__shoal.G.pz;const w=pz.words.find(w=>__shoal.stemsOf(w).some(x=>pz.words.includes(x)));return w?{w,s:__shoal.stemsOf(w)}:null});
console.log('stem case',stemCase);
if(stemCase){console.log('stem msg:',await typeWord(stemCase.w));console.log('found',await page.evaluate(()=>__shoal.G.found));await page.waitForTimeout(1400);await page.screenshot({path:`${OUT}/s-stem.png`});
 await page.reload();await page.waitForTimeout(400);console.log('stem after reload',await page.evaluate(()=>__shoal.G.found));
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForTimeout(400);}
console.log('clearable order after tries',order&&order.i);
for(const w of order.o){if(await page.evaluate(w=>__shoal.G.found.includes(w),w))continue;await typeWord(w);await page.waitForTimeout(90)}
console.log('layout matches prediction',await page.evaluate(o=>JSON.stringify(__shoal.G.layout?.map(l=>l.kind))===JSON.stringify(__shoal.layoutOf(o).map(l=>l.kind)),order.o));
await page.waitForTimeout(3400);
console.log(await rd());
await page.screenshot({path:`${OUT}/f-fish.png`});
const plan=await page.evaluate(()=>{const G=__shoal.G;const cols=G.grid.map(c=>c.map(f=>f.kind));
 const groups=cs=>{const seen=new Set(),o=[];for(let x=0;x<cs.length;x++)for(let y=0;y<cs[x].length;y++){if(seen.has(x*8+y))continue;const k=cs[x][y],g=[],st=[[x,y]];seen.add(x*8+y);while(st.length){const[a,b]=st.pop();g.push([a,b]);for(const[p,q]of[[a+1,b],[a-1,b],[a,b+1],[a,b-1],[a+1,b+1],[a+1,b-1],[a-1,b+1],[a-1,b-1]])if(cs[p]&&cs[p][q]===k&&!seen.has(p*8+q)){seen.add(p*8+q);st.push([p,q])}}if(g.length>=2)o.push(g)}return o};
 const go=(cs,seq)=>{if(!cs.length)return seq;for(const g of groups(cs)){const n=cs.map(c=>[...c]);[...g].sort((a,b)=>b[1]-a[1]).forEach(([a,b])=>n[a].splice(b,1));const r=go(n.filter(c=>c.length),[...seq,g[0]]);if(r)return r}return null};return go(cols,[])});
console.log('plan',JSON.stringify(plan));
let i=0;for(const [c,h] of plan){await page.touchscreen.tap(box.x+box.width*(c+.5)/4,box.y+box.height*(3-h+.5)/4);await page.waitForTimeout(450);if(i++===0)await page.screenshot({path:`${OUT}/f-pop.png`});await page.waitForTimeout(500)}
await page.waitForTimeout(1200);
console.log(await rd(),await page.evaluate(()=>({left:__shoal.G.fish.length,cl:__shoal.G.cleared})));
await page.screenshot({path:`${OUT}/f-clear.png`});
await page.locator('#a-frenzy').tap({force:true}); await page.waitForTimeout(300);
// Pop Frenzy is the standard
console.log('frenzy style',await page.evaluate(()=>__shoal.Frenzy.mode),'|',await page.locator('#fz-text').innerText(),'|',await page.locator('#fz-mode').innerText());
await page.screenshot({path:`${OUT}/p-intro.png`});
await page.locator('#fz-go').tap(); await page.waitForTimeout(900);
console.log('starts from the shoal',await page.evaluate(()=>{const F=__shoal.Frenzy.state,L=__shoal.G.layout;return F.cols.every((col,x)=>col.every((f,h)=>f.kind===L[(3-h)*4+x].kind))}),'clock waits',await page.evaluate(()=>__shoal.Frenzy.state.left));
await page.screenshot({path:`${OUT}/p-start.png`});
{const t0=Date.now();let taps=0,full=true,shot=false;
 while(Date.now()-t0<25000){
  const t=await page.evaluate(()=>{const F=__shoal.Frenzy.state;if(!F)return null;const b=__shoal.Frenzy.board,cv=document.getElementById('fz'),k=cv.clientWidth/cv.width;
   const full=F.cols.length===4&&F.cols.every(c=>c.length===4);let best=null;
   F.cols.forEach((col,x)=>col.forEach((f,h)=>{let n=0;for(const[d,e]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const o=F.cols[x+d]&&F.cols[x+d][h+e];if(o&&o.kind===f.kind)n++}if(n&&(!best||n>best.n))best={n,x,h}}));
   return{full,left:F.left,x:best&&(b.ox+(best.x+.5)*b.cell)*k,y:best&&(b.oy+(3-best.h+.5)*b.cell)*k}});
  if(!t)break; full=full&&t.full; if(t.x==null){console.log('NO MOVE');break}
  await page.touchscreen.tap(t.x,t.y); taps++; await page.waitForTimeout(110);
  if(!shot&&t.left<7){await page.screenshot({path:`${OUT}/p-mid.png`});shot=true}
 }
 console.log('pop frenzy: taps',taps,'grid stayed full',full,'seconds',((Date.now()-t0)/1000).toFixed(1));}
await page.waitForTimeout(300);
console.log('pop end:',await page.locator('#fz-title').innerText(),'|',await page.locator('#fz-text').innerText(),'|',await page.locator('#fz-go').innerText(),'| hud',await page.locator('#fz-score').innerText(),await page.locator('#fz-time').innerText());
await page.screenshot({path:`${OUT}/p-end.png`});
console.log('best saved',await page.evaluate(()=>({pop:__shoal.G.popFrenzyBest,swim:__shoal.G.frenzyBest})));
// the earlier Frenzy is a setting on the start screen
await page.locator('#fz-mode').tap(); await page.waitForTimeout(200);
console.log('switched to',await page.evaluate(()=>__shoal.Frenzy.mode),'|',await page.locator('#fz-title').innerText(),'|',await page.locator('#fz-mode').innerText());
await page.screenshot({path:`${OUT}/f-intro.png`});
await page.locator('#fz-go').tap(); await page.waitForTimeout(300);
// lead the shoal at the nearest target until time runs out
const start=Date.now();let shots=0;
while(Date.now()-start<45000){
 const t=await page.evaluate(()=>{const F=__shoal.Frenzy.state;if(!F)return null;const cv=document.getElementById('fz');const s=cv.clientWidth/cv.width;const tgt=F.ltr||F.food[0]||F.lead;return {x:tgt.x*s,y:tgt.y*s,left:F.left,sh:!!(F.shark&&F.shark.warn<=0),fish:F.fish.length,score:F.score}});
 if(!t)break;
 await page.mouse.move(t.x,t.y);await page.waitForTimeout(160);
 if(t.left<24&&shots===0){await page.screenshot({path:`${OUT}/f-frenzy1.png`});shots=1}
 if(t.sh&&shots===1){await page.screenshot({path:`${OUT}/f-frenzy2.png`});shots=2}
}
await page.waitForTimeout(300);
console.log('frenzy end:',await page.locator('#fz-title').innerText(),'|',await page.locator('#fz-text').innerText(),'|',await page.locator('#fz-go').innerText());
await page.screenshot({path:`${OUT}/f-end.png`});
await page.locator('#fz-mode').tap(); await page.waitForTimeout(150);
console.log('switched back to',await page.evaluate(()=>__shoal.Frenzy.mode));
await page.locator('#fz-exit').tap();await page.waitForTimeout(300);
await page.locator('#a-copy').tap();await page.waitForTimeout(200);
console.log('share:\n'+await page.evaluate(()=>navigator.clipboard.readText()));
await page.locator('#a-reset').tap();await page.waitForTimeout(800);
console.log('after reset',await page.evaluate(()=>({fish:__shoal.G.fish.length,cleared:__shoal.G.cleared})));

// another board and give up
await page.locator('#a-next').tap();await page.waitForTimeout(400);
await page.evaluate(()=>0);
const w2=await page.evaluate(()=>__shoal.G.pz.words);
for(const w of w2.slice(0,5)){if(await page.evaluate(w=>__shoal.G.found.includes(w),w))continue;await typeWord(w)}
await page.waitForTimeout(1500);
await page.locator('#a-done').tap();await page.waitForTimeout(150);
await page.screenshot({path:`${OUT}/g-confirm.png`});
await page.locator('#a-reveal').tap();await page.waitForTimeout(1500);
await page.screenshot({path:`${OUT}/g-rocks.png`,fullPage:true});
console.log('gave',await page.evaluate(()=>({phase:__shoal.G.phase,kinds:__shoal.G.layout.map(l=>l.kind).join(','),m:__shoal.G.pz.words.length-__shoal.G.found.length})));
await page.locator('#a-today').tap();await page.waitForTimeout(400);
console.log('today restored',await page.evaluate(()=>({phase:__shoal.G.phase,cl:__shoal.G.cleared,best:__shoal.G.frenzyBest})));
await page.locator('#btn-help').tap();await page.waitForTimeout(200);await page.screenshot({path:`${OUT}/h-help.png`});
console.log('errors',errors);
await browser.close();
})();
