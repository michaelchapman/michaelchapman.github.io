(() => {
  const B = window.__brasshaven, R = B.lifeRaw, out = { maxVy: 0, maxV: 0, maxJump: 0, states: {}, maxCell: 0, maxNear: 0, samples: 0, perchedAt: 0 };
  const prev = new Map();
  const step = 1 / 30;
  for (let i = 0; i < 30 * 150; i++) {
    B.sim(step, step);
    for (const g of R.gulls) {
      const p = prev.get(g);
      if (p && g.state !== 'perch' && p.state !== 'perch') {
        out.maxVy = Math.max(out.maxVy, Math.abs(g.y - p.y) / step);
        out.maxV = Math.max(out.maxV, Math.hypot(g.x - p.x, g.z - p.z) / step);
      }
      if (p) out.maxJump = Math.max(out.maxJump, Math.hypot(g.x - p.x, g.y - p.y, g.z - p.z));
      prev.set(g, { x: g.x, y: g.y, z: g.z, state: g.state });
      out.states[g.state] = (out.states[g.state] || 0) + 1;
    }
    if (i % 30 === 0) {
      const ws = R.walkers.filter((w) => w.state !== 'fade' && w.state !== 'gone');
      const occ = R.occ(); let mc = 0; for (let v = 0; v < B.V; v++) mc = Math.max(mc, occ[v]);
      out.maxCell = Math.max(out.maxCell, mc);
      let mn = 0; for (const a of ws) { let n = 0; for (const b of ws) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 1.0) n++; mn = Math.max(mn, n); }
      out.maxNear = Math.max(out.maxNear, mn); out.samples++;
      out.walkers = ws.length;
    }
  }
  for (const k in out) if (typeof out[k] === 'number') out[k] = +out[k].toFixed(3);
  const l = B.life(); out.walkable = l.walkable; out.doors = l.doors; out.perches = l.perches;
  return JSON.stringify(out);
})()
