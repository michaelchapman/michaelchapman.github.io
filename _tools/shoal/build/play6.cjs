// The word rules: every word on a board is accepted and formed one way, nothing is optional, and streaks carry over.
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve('../../../shoal/index.html');
(async()=>{
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:780}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const page = await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
// a returning player: old progress, a streak and the Swim setting saved under the previous version
await page.addInitScript(()=>{if(!localStorage.getItem('seeded')){localStorage.setItem('seeded','1');localStorage.setItem('shoal.v2',JSON.stringify({p:{3:{f:['date'],t:40}},streak:6,last:9,n:12,c:4,fzm:'swim',seen:1}))}});
await page.goto(file); await page.waitForTimeout(400);
console.log('carried over',await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('shoal.v3')||'null');return{old:localStorage.getItem('shoal.v2'),streak:s&&s.streak,boards:s&&Object.keys(s.p).length,mode:__shoal.Frenzy.mode,found:__shoal.G.found.length}}));
await page.reload(); await page.waitForTimeout(300);
console.log('after reload',await page.evaluate(()=>({streak:JSON.parse(localStorage.getItem('shoal.v3')).streak,mode:__shoal.Frenzy.mode})));
const rd=()=>page.locator('#readout').innerText();
const type=async w=>{await page.keyboard.type(w,{delay:2});await page.keyboard.press('Enter');await page.waitForTimeout(50);return rd()};
// across 40 boards: every listed word is accepted, typed once each, and the board finishes
let boards=0,words=0,auto=0,bad=[];
for(let i=0;i<40;i++){
  await page.evaluate(i=>__shoal.loadPuzzle(i*20),i);
  const list=await page.evaluate(()=>__shoal.G.pz.words);
  for(const w of [...list].reverse()){ if(await page.evaluate(w=>__shoal.G.found.includes(w),w)){auto++;continue} const m=await type(w); words++; if(/Not in|No path|Four letters/.test(m)) bad.push(i*20+':'+w+':'+m); }
  const st=await page.evaluate(()=>({f:__shoal.G.found.length,t:__shoal.G.pz.words.length,one:__shoal.G.pz.words.every(w=>{const L=__shoal.G.pz.letters;let n=0;const go=p=>{if(p.length===w.length){n++;return}const c=p[p.length-1];for(let q=0;q<16;q++)if(!p.includes(q)&&q!==c&&Math.abs(q%4-c%4)<=1&&Math.abs((q>>2)-(c>>2))<=1&&__shoal.G.pz.linked(Math.min(c,q),Math.max(c,q))&&L[q]===w[p.length])go([...p,q])};for(let s=0;s<16;s++)if(L[s]===w[0])go([s]);return n===1})}));
  if(st.f!==st.t||!st.one) bad.push('board '+i*20+JSON.stringify(st)); boards++;
}
console.log('boards',boards,'typed',words,'found through stems',auto,'problems',bad);
await page.evaluate(()=>__shoal.loadPuzzle(7));
console.log('non-word:',await (async()=>{const L=await page.evaluate(()=>{const G=__shoal.G,w=G.pz.words[0];return w.slice(0,3)});await page.keyboard.type(L,{delay:2});await page.keyboard.press('Enter');await page.waitForTimeout(50);return rd()})());
await page.screenshot({path:`${process.env.OUT||'.'}/w-board.png`});
console.log('side panel mentions bonus',/bonus/i.test(await page.locator('#side').innerText()),'| help',(await page.locator('#help li').nth(1).innerText()));
console.log('errors',errors);await browser.close();
})();
