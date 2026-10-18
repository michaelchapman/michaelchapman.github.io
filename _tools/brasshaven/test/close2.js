() => {
  const b = window.__brasshaven;
  // a larger harbour: ground over a wide patch, streets left open, terraces of mixed heights,
  // one overhanging house on stilts over the water, and a tall clock-tower stub
  const h = (a, c) => { let x = Math.sin(a * 127.1 + c * 311.7) * 43758.5453; return x - Math.floor(x); };
  const cx = b.goal.tx, cz = b.goal.tz;
  const adds = [];
  for (let v = 0; v < b.V; v++) {
    if (!b.buildable[v] || b.cols[v]) continue;
    const d = Math.hypot(b.X[v] - cx - 2, b.Z[v] - cz + 1);
    if (d > 6.5) continue;
    if (d > 5.2 && h(v, 1) < 0.5) continue;
    adds.push([v, 0]);
    const street = Math.abs(Math.sin((b.X[v] - cx) * 0.9)) < 0.18 || h(v, 2) < 0.22;
    if (street) continue;
    const n = 1 + Math.floor(h(v, 3) * 3.2);
    for (let y = 1; y <= n; y++) adds.push([v, y]);
  }
  b.commit(adds, []);
  // overhang: a house at level 2 out over the water from an edge column
  let over = 0;
  for (let v = 0; v < b.V && over < 2; v++) {
    if (!b.F(v, 2) || b.F(v, 3)) continue;
    for (const w of b.ringW[v]) { if (b.buildable[w] && !b.cols[w] && over < 2) { b.commit([[w, 2]], []); over++; break; } }
  }
  // tall tower
  const t = b.nearestVertex(cx + 4, cz - 3);
  const tw = []; for (let y = 0; y <= 8; y++) if (!b.F(t, y)) tw.push([t, y]); b.commit(tw, []);
  b.goal.dist = 10; b.goal.pitch = 0.32; b.goal.yaw = 1.2; b.goal.tx = cx + 2; b.goal.tz = cz - 1;
  Object.assign(b.view, b.goal);
  return { blocks: b.cellCount() };
}
