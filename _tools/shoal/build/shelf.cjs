const { chromium } = require('playwright'); const path=require('path'),fs=require('fs');
const OUT=process.env.OUT, root=path.resolve('../../..');
const b64=f=>fs.readFileSync(f).toString('base64');
const css=`@font-face{font-family:Shrikhand;src:url(data:font/woff2;base64,${b64('../node_modules/@fontsource/shrikhand/files/shrikhand-latin-400-normal.woff2')})}@font-face{font-family:'Rammetto One';src:url(data:font/woff2;base64,${b64('../node_modules/@fontsource/rammetto-one/files/rammetto-one-latin-400-normal.woff2')})}`;
(async()=>{const br=await chromium.launch();
for(const [n,w,h,dpr] of [['wide',1400,620,1],['mid',1000,1000,1],['ph',390,844,2]]){const p=await br.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});await p.goto('file://'+root+'/index.html');await p.addStyleTag({content:css});await p.waitForTimeout(500);await p.screenshot({path:`${OUT}/home-${n}.png`,fullPage:true});console.log(n,await p.evaluate(()=>({over:document.documentElement.scrollWidth>innerWidth,boxes:document.querySelectorAll('.shelf li').length,w:Math.round(document.querySelector('.box').getBoundingClientRect().width)})));
 if(n==='wide'){const el=await p.$('a[href="/shoal/"] .face');await p.addStyleTag({content:'.box{transform:none!important}.face::after{display:none}'});await p.waitForTimeout(600);await el.screenshot({path:`${OUT}/cover.png`,scale:'css'})}await p.close()}
await br.close()})();
