// Pop Frenzy at desktop and landscape-phone sizes, with mouse clicks: layout, refill, scoring and the saved style.
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve('../../../shoal/index.html');
const OUT = process.env.OUT || '.';
(async()=>{
const browser = await chromium.launch();
for (const [name,vp] of [['desk',{width:1200,height:820}],['land',{width:740,height:360}]]) {
  const page = await browser.newPage({ viewport:vp });
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(file); await page.waitForTimeout(400);
  await page.evaluate(()=>{const G=__shoal.G;G.layout=[...Array(16).keys()].map(i=>({kind:(i+(i>>2))%4,ch:''}));G.cleared=true;__shoal.Frenzy.open()});
  await page.locator('#fz-go').click(); await page.waitForTimeout(300);
  const geo=await page.evaluate(()=>{const b=__shoal.Frenzy.board,cv=document.getElementById('fz'),k=cv.clientWidth/cv.width;return{left:b.ox*k,top:b.oy*k,size:b.S*k,w:innerWidth,h:innerHeight}});
  console.log(name,'board fits',geo.left>=16&&geo.top>=50&&geo.left+geo.size<=geo.w-16&&geo.top+geo.size<=geo.h-8,JSON.stringify(geo));
  // a lone fish does nothing and does not start the clock
  await page.evaluate(()=>{const F=__shoal.Frenzy.state;F.cols.forEach((c,x)=>c.forEach((f,h)=>f.kind=(x+2*h)%4));F.cols[0][0].kind=F.cols[1][0].kind=F.cols[0][1].kind=F.cols[1][1].kind;F.cols[3][3].kind=0;F.cols[2][3].kind=1;F.cols[2][2].kind=2;F.cols[3][2].kind=3});
  const cell=(x,h)=>[geo.left+geo.size*(x+.5)/4,geo.top+geo.size*(3-h+.5)/4];
  let lone=null;for(let x=0;x<4&&!lone;x++)for(let h=0;h<4&&!lone;h++){const n=await page.evaluate(([x,h])=>{const F=__shoal.Frenzy.state,f=F.cols[x][h];let n=0;for(const[d,e]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const o=F.cols[x+d]&&F.cols[x+d][h+e];if(o&&o.kind===f.kind)n++}return n},[x,h]);if(!n)lone=[x,h]}
  if(lone){await page.mouse.click(...cell(...lone));await page.waitForTimeout(150);console.log(name,'lone fish tap',await page.evaluate(()=>({running:__shoal.Frenzy.state.running,score:__shoal.Frenzy.state.score})))}
  // a group of four scores 16 and four new fish fall in
  await page.mouse.click(...cell(0,0)); await page.waitForTimeout(60);
  console.log(name,'after group of 4',await page.evaluate(()=>{const F=__shoal.Frenzy.state;return{score:F.score,fish:F.fish,running:F.running,full:F.cols.every(c=>c.length===4),falling:F.cols.flat().filter(f=>f.y<f.ty).length}}));
  await page.screenshot({path:`${OUT}/p5-${name}.png`});
  await page.waitForTimeout(700);
  console.log(name,'settled',await page.evaluate(()=>__shoal.Frenzy.state.cols.flat().every(f=>f.y===f.ty)));
  await page.waitForTimeout(12200);
  console.log(name,'ended',await page.evaluate(()=>__shoal.Frenzy.state===null),'|',await page.locator('#fz-text').innerText());
  // taps after time is up do nothing, and the style choice survives a reload
  await page.locator('#fz-mode').click(); await page.reload(); await page.waitForTimeout(300);
  console.log(name,'style after reload',await page.evaluate(()=>__shoal.Frenzy.mode),'errors',errors);
  await page.close();
}
await browser.close();
})();
