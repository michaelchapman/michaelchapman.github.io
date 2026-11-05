const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve('../../../shoal/index.html');
const OUT = process.env.OUT;
(async()=>{
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:780}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const page = await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>m.type()==='error'&&errors.push(m.text()));
await page.goto(file); await page.waitForTimeout(400);
const rd=()=>page.locator('#readout').innerText();
const type=async w=>{await page.keyboard.type(w,{delay:3});await page.keyboard.press('Enter');await page.waitForTimeout(70);return rd()};
const pick=await page.evaluate(()=>{for(let i=0;i<800;i++){__shoal.loadPuzzle(i);const pz=__shoal.G.pz;const hits=pz.words.filter(w=>__shoal.stemsOf(w).filter(x=>pz.words.includes(x)).length>=2);if(hits.length)return{i,w:hits[0],s:__shoal.stemsOf(hits[0]),total:pz.words.length}}return null});
console.log('board',pick);
await page.evaluate(i=>__shoal.loadPuzzle(i),pick.i);
await page.keyboard.type('zz',{delay:3});await page.waitForTimeout(40);console.log('typing miss shows:',await rd());await page.keyboard.press('Escape');
console.log('finding',pick.w,'->',await type(pick.w));
await page.waitForTimeout(250);await page.screenshot({path:`${OUT}/s-stem.png`});
console.log('found',await page.evaluate(()=>__shoal.G.found),'gauge',await page.locator('.count').innerText());
for(const x of pick.s) console.log('retry',x,'->',await type(x));
// saved progress replays the same state
const before=await page.evaluate(()=>JSON.stringify({f:__shoal.G.found,b:__shoal.G.bonus,w:Object.keys(__shoal.G.width).sort(),fr:__shoal.G.freed}));
await page.waitForTimeout(1600);
await page.evaluate(i=>__shoal.loadPuzzle(i),pick.i);await page.waitForTimeout(150);
const after=await page.evaluate(()=>JSON.stringify({f:__shoal.G.found,b:__shoal.G.bonus,w:Object.keys(__shoal.G.width).sort(),fr:__shoal.G.freed}));
console.log('restore same',before===after);
// finish in random order; layout must match prediction and hold four of each
await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForTimeout(300);
await page.evaluate(i=>__shoal.loadPuzzle(i),pick.i);
const words=await page.evaluate(()=>[...__shoal.G.pz.words].sort(()=>Math.random()-.5));
const log=[];for(const w of words){if(await page.evaluate(w=>__shoal.G.found.includes(w),w))continue;log.push(w);await type(w)}
await page.waitForTimeout(3600);
console.log('prediction',await page.evaluate(l=>({same:JSON.stringify(__shoal.G.layout.map(x=>x.kind))===JSON.stringify(__shoal.layoutOf(__shoal.G.log).map(x=>x.kind)),counts:[0,1,2,3].map(k=>__shoal.G.layout.filter(x=>x.kind===k).length),phase:__shoal.G.phase}),log));
await page.screenshot({path:`${OUT}/s-fish.png`});
// a group joined only by a diagonal must pop together
const diag=await page.evaluate(()=>{const G=__shoal.G,g=G.grid;for(const col of g)for(const f of col)f.kind=3;g[0][0].kind=0;g[1][1].kind=0;g[1][0].kind=1;g[0][1].kind=2;g[2][0].kind=1;g[2][1].kind=2;g[0][2].kind=1;g[1][2].kind=2;g[2][2].kind=1;return{c:0,h:0,kind:0}});
console.log('diagonal pair',diag);
if(diag){const box=await page.locator('#board').boundingBox();const n=await page.evaluate(()=>__shoal.G.fish.length);await page.touchscreen.tap(box.x+box.width*(diag.c+.5)/4,box.y+box.height*(3-diag.h+.5)/4);await page.waitForTimeout(1200);console.log('fish before/after diagonal tap',n,await page.evaluate(()=>__shoal.G.fish.length))}
console.log('errors',errors);await browser.close();
})();
