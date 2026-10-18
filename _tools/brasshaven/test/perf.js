(async () => {
  const b = window.__brasshaven;
  const times = async (n) => { const ts = []; for (let i = 0; i < n; i++) ts.push(await new Promise((r) => requestAnimationFrame(r))); return ts.slice(1).map((t, i) => Math.round(t - ts[i])); };
  const a = await times(6);
  const g = b.goal; g.yaw += 2.2; Object.assign(b.view, g);
  const c = await times(6);
  b.tension(1); b.sim(4);
  const d = await times(6);
  return { a, c, d, p: b.particles() };
})()
