// Renders preview.jpg and the PNG icons from art.mjs's output.
const { chromium } = require('playwright'); const path = require('path');
const out = path.resolve('../../../shoal');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1200, height:630 } });
  await p.goto('file://'+path.resolve('art/preview.html')); await p.waitForTimeout(300);
  await p.screenshot({ path:`${out}/preview.jpg`, type:'jpeg', quality:88 });
  for (const [name,s] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]) {
    const q = await b.newPage({ viewport:{ width:s, height:s } });
    await q.goto('file://'+path.resolve('art/icon-square.html')); await q.waitForTimeout(100);
    await q.screenshot({ path:`${out}/${name}` }); await q.close();
  }
  await b.close();
})();
