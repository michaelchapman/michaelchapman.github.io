(() => {
  const b = window.__brasshaven;
  b.setTime(3, true);
  const g = b.goal; g.dist = 9; g.pitch = 0.3; g.yaw += 2.4; g.ty = 1.8;
  Object.assign(b.view, g);
  b.sim(8);
  return { p: b.particles() };
})()
