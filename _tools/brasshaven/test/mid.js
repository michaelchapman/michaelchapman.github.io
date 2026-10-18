(() => {
  const b = window.__brasshaven;
  b.setTime(1, true);
  const g = b.goal; g.dist = 8; g.pitch = 0.32; g.yaw += 0.9; g.ty = 1.6;
  Object.assign(b.view, g);
  b.sim(8);
  return { p: b.particles(), e: b.emitters() };
})()
