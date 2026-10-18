(() => {
  const B = window.__brasshaven, r = B.renderer, out = {};
  B.sim(20); B.syncCam();
  const meas = (label) => { r.render(B.scene, B.camera); const t0 = performance.now(); for (let i = 0; i < 4; i++) r.render(B.scene, B.camera); const ms = (performance.now() - t0) / 4; r.info.autoReset = false; r.info.reset(); r.render(B.scene, B.camera); out[label] = { ms: ms.toFixed(1), calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; };
  B.lifeShow(false); meas('without');
  B.lifeShow(true); meas('with');
  B.applyTier('low'); B.sim(5); B.syncCam(); B.lifeShow(false); meas('lowWithout'); B.lifeShow(true); meas('lowWith');
  return JSON.stringify(out);
})()
