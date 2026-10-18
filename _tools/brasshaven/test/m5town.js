(() => {
  const b = window.__brasshaven;
  b.setTips(false);
  const h = (a, c) => { let x = Math.sin(a * 127.1 + c * 311.7) * 43758.5453; return x - Math.floor(x); };
  const cx = b.goal.tx, cz = b.goal.tz, adds = [], removes = [];
  for (let v = 0; v < b.V; v++) if (b.cols[v]) for (let y = 0; y < 13; y++) if (b.F(v, y)) removes.push([v, y]);
  b.commit([], removes);
  for (let v = 0; v < b.V; v++) {
    if (!b.buildable[v]) continue;
    const d = Math.hypot(b.X[v] - cx, b.Z[v] - cz);
    if (d > 4.6 || (d > 3.6 && h(v, 1) < 0.45)) continue;
    const open = window.__plaza ? (d < 2.3 || h(v, 2) < 0.3) : (h(v, 2) < 0.34 || d < 1.1);
    const r = h(v, 4);
    const m = r < 0.42 ? 0 : r < 0.56 ? 5 : r < 0.68 ? 1 : r < 0.78 ? 2 : r < 0.88 ? 3 : 4;
    adds.push([v, 0, m === 5 && d > 3.4 ? 5 : 0]);
    if (open) continue;
    const n = window.__plaza ? 1 + (h(v, 3) < 0.3 ? 1 : 0) : m === 4 ? 1 : 1 + Math.floor(h(v, 3) * (d < 2.5 ? 3.4 : 2.3));
    for (let y = 1; y <= n; y++) adds.push([v, y, m]);
  }
  // a long pier heading south-east
  let cur = -1, bs = -1e9;
  const filled = new Set(adds.map((a) => a[0]));
  for (let v = 0; v < b.V; v++) if (!filled.has(v) && b.buildable[v] && b.ringW[v].some((w) => filled.has(w))) { const s = b.X[v] * 0.4 + b.Z[v]; if (s > bs) { bs = s; cur = v; } }
  let px = cx, pz = cz;
  for (let k = 0; k < 4 && cur >= 0; k++) {
    adds.push([cur, 0, 5]); filled.add(cur);
    const dx = b.X[cur] - px, dz = b.Z[cur] - pz; px = b.X[cur]; pz = b.Z[cur];
    let nb = -1, ns = 0;
    for (const w of b.ringW[cur]) { if (filled.has(w) || !b.buildable[w]) continue; const s = ((b.X[w] - px) * dx + (b.Z[w] - pz) * dz) / (Math.hypot(dx, dz) * Math.hypot(b.X[w] - px, b.Z[w] - pz) || 1); if (s > ns) { ns = s; nb = w; } }
    cur = nb;
  }
  b.commit(adds, []);
  b.setTime(1, true);
  const g = b.goal; g.dist = 17; g.pitch = 0.45; g.yaw = -1.85; g.ty = 1.9;
  Object.assign(b.view, g);
  b.sim(40);
  const l = b.life();
  return { blocks: b.cellCount(), walkers: l.walkers, doors: l.doors, walkable: l.walkable, gulls: l.gulls.join(','), perches: l.perches };
})()
