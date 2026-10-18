(() => {
  const B = window.__brasshaven, R = B.lifeRaw, step = 1 / 30, trail = [];
  const g = R.gulls[0];
  for (let i = 0; i < 30 * 90; i++) { B.sim(step, step); if (i % 3 === 0) trail.push([+(i * step).toFixed(2), +g.x.toFixed(3), +g.y.toFixed(3), +g.z.toFixed(3), g.state]); }
  return JSON.stringify(trail);
})()
