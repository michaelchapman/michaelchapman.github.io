const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve('../../../shoal/index.html');
(async()=>{
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:780}, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const page = await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto(file); await page.waitForTimeout(400);
// reach the Frenzy for real: clear the board's fish state, then open it
await page.evaluate(()=>{const G=__shoal.G;G.layout=[...Array(16).keys()].map(i=>({kind:i%4,ch:''}));__shoal.Frenzy.open()});
await page.waitForTimeout(150);
await page.locator('#fz-go').tap(); await page.waitForTimeout(200);
console.log('css',await page.evaluate(()=>{const c=getComputedStyle(document.getElementById('fz'));const h=getComputedStyle(document.querySelector('.hud'));return{canvas:c.webkitUserSelect||c.userSelect,hud:h.webkitUserSelect||h.userSelect,callout:getComputedStyle(document.body).webkitTouchCallout}}));
console.log('touchstart blocked',await page.evaluate(()=>{const c=document.getElementById('fz');const t=new Touch({identifier:1,target:c,clientX:100,clientY:100});const e=new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],targetTouches:[t],changedTouches:[t]});c.dispatchEvent(e);return e.defaultPrevented}));
const cdp=await ctx.newCDPSession(page);
const lead=()=>page.evaluate(()=>{const F=__shoal.Frenzy.state,c=document.getElementById('fz'),s=c.clientWidth/c.width;return F?[Math.round(F.lead.x*s),Math.round(F.lead.y*s)]:null});
console.log('lead before',await lead());
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:80,y:200}]});
await page.waitForTimeout(700); // a long hold, as when steering
for(let i=0;i<8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:80+i*30,y:200+i*40}]});await page.waitForTimeout(30)}
console.log('lead after hold and drag',await lead());
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
console.log('selection',JSON.stringify(await page.evaluate(()=>getSelection().toString())));
console.log('errors',errors);await browser.close();
})();
