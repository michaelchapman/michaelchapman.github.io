(async () => {
  const b = window.__brasshaven;
  const times = async (n) => { const ts = []; for (let i = 0; i < n; i++) ts.push(await new Promise((r) => requestAnimationFrame(r))); return ts.slice(1).map((t, i) => Math.round(t - ts[i])); };
  const g = b.goal; g.dist = 8; g.pitch = 0.32; g.yaw += 0.9; g.ty = 1.6; Object.assign(b.view, g);
  const a = await times(6);
  return { a, info: b.renderer.info.render };
})()
