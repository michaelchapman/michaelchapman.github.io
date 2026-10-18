(() => {
  const b = window.__brasshaven;
  b.setTips(false);
  const h = (a, c) => { let x = Math.sin(a * 127.1 + c * 311.7) * 43758.5453; return x - Math.floor(x); };
  const cx = b.goal.tx, cz = b.goal.tz, adds = [];
  for (let v = 0; v < b.V; v++) {
    if (!b.buildable[v] || b.cols[v]) continue;
    const d = Math.hypot(b.X[v] - cx, b.Z[v] - cz);
    if (d > 4.6 || (d > 3.6 && h(v, 1) < 0.45)) continue;
    const open = h(v, 2) < 0.22;
    const r = h(v, 4);
    const m = r < 0.42 ? 0 : r < 0.56 ? 5 : r < 0.68 ? 1 : r < 0.78 ? 2 : r < 0.88 ? 3 : 4;
    adds.push([v, 0, m === 5 && d > 3.4 ? 5 : 0]);
    if (open) continue;
    const n = m === 4 ? 1 : 1 + Math.floor(h(v, 3) * (d < 2.5 ? 3.4 : 2.3));
    for (let y = 1; y <= n; y++) adds.push([v, y, m]);
  }
  b.commit(adds, []);
  b.setTime(1, true);
  const g = b.goal; g.dist = 15.5; g.pitch = 0.4; g.yaw = -1.85 + Number(window.__dyaw || 0); g.ty = 1.9;
  Object.assign(b.view, g);
  b.sim(14);
  return { blocks: b.cellCount(), engines: b.engines(), wheels: b.wheels(), gears: b.gears(), mast: b.mast() };
})()
