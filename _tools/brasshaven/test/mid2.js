(() => {
  const b = window.__brasshaven;
  const g = b.goal; g.yaw += 2.2;
  Object.assign(b.view, g);
  b.tension(1);
  b.sim(4);
  return { p: b.particles() };
})()
