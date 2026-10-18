// machines need no power: a lone clockwork house turns, engines and mill wheels run, driven gears keep tooth contact
(() => {
  const b = window.__brasshaven, out = {};
  const cx = b.goal.tx, cz = b.goal.tz;
  // find a lone brass house that grows a clockwork panel
  let v = -1;
  for (let k = 0; k < 40 && v < 0; k++) {
    const c = b.nearestVertex(cx + 7 + (k % 5) * 1.3, cz - 4 + Math.floor(k / 5) * 1.3);
    if (b.cols[c] || !b.buildable[c]) continue;
    const g0 = b.gears();
    b.commit([[c, 0, 0], [c, 1, 1]], []);
    if (b.gears() > g0) v = c; else b.undo();
  }
  out.brass = v; out.gears = b.gears();
  const drv = b.dyn().gears.find((g) => g.v === v && !g.parent);
  const a0 = drv.ang; b.sim(2); const d0 = drv.ang - a0; out.loneTurns = d0 > 0.1;
  // an engine house beside it
  let eng = -1;
  for (const w of b.ringW[v]) {
    if (b.cols[w] || !b.buildable[w]) continue;
    const e0 = b.engines();
    b.commit([[w, 0, 0], [w, 1, 3]], []);
    if (b.engines() > e0) { eng = w; break; } else b.undo();
  }
  out.engine = eng;
  const e = b.dyn().engines[0], t0 = e && e.th; b.sim(1); out.engineRuns = !!e && e.th - t0 > 1;
  // the clockwork keeps the same speed with or without the engine
  const drv2 = b.dyn().gears.find((g) => g.v === v && !g.parent);
  const a2 = drv2.ang; b.sim(2); out.sameSpeed = Math.abs(drv2.ang - a2 - d0) < 1e-6;
  out.hint = document.getElementById('hint').textContent;
  out.noKey = !document.getElementById('key-btn');
  // driven gears keep tooth contact (angle relation)
  const kids = b.dyn().gears.filter((g) => g.v === v && g.parent);
  out.kids = kids.map((g) => ({ n: g.teeth, pn: g.parent.teeth, phi: +g.phi.toFixed(2) }));
  b.goal.tx = b.X[v]; b.goal.tz = b.Z[v]; b.goal.ty = 0.9; b.goal.dist = 4; b.goal.pitch = 0.3; Object.assign(b.view, b.goal);
  return out;
})()
