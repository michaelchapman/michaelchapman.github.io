(async () => {
  const B = window.__brasshaven; B.sim(5); B.enterPostcard();
  await new Promise((r) => setTimeout(r, 500));
  const t0 = performance.now(); await B.snapPostcard(); const a = performance.now() - t0;
  B.lifeShow(false); B.exitPostcard(); B.enterPostcard();
  const t1 = performance.now(); await B.snapPostcard(); const b = performance.now() - t1;
  return { withLifeMs: Math.round(a), withoutLifeMs: Math.round(b), blob: B.pcBlob() && B.pcBlob().size };
})()
