(() => {
  const B = window.__brasshaven, out = {};
  const t0 = performance.now(); for (let i = 0; i < 600; i++) B.updateLife(1 / 60, i / 60); out.lifeMs = ((performance.now() - t0) / 600).toFixed(3);
  const t1 = performance.now(); B.sim(10, 1 / 60); out.simAllMs = ((performance.now() - t1) / 600).toFixed(3);

  out.life = B.life().walkers; out.tier = B.tier();
  try { out.amb = B.ambTest(); } catch (e) { out.ambErr = String(e); }
  return out;
})()
