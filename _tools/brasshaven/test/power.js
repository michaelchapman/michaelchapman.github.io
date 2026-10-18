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
  out.brass = v; out.gears = b.gears(); out.hint1 = document.getElementById('hint').textContent;
  out.powered0 = b.powered(v);
  const drv = b.dyn().gears.find((g) => g.v === v && !g.parent);
  const a0 = drv.ang; b.sim(2); out.turnedUnpowered = +(drv.ang - a0).toFixed(3); const tu = drv.ang - a0;
  b.tension(0.8); const a1 = drv.ang; b.sim(1); out.turnedWound = +(drv.ang - a1).toFixed(3); const tw = drv.ang - a1; b.tension(0);
  // join an engine house
  let eng = -1;
  for (const w of b.ringW[v]) {
    if (b.cols[w] || !b.buildable[w]) continue;
    const e0 = b.engines();
    b.commit([[w, 0, 0], [w, 1, 3]], []);
    if (b.engines() > e0) { eng = w; break; } else b.undo();
  }
  out.engine = eng; out.hint2 = document.getElementById('hint').textContent;
  out.powered1 = b.powered(v);
  const drv2 = b.dyn().gears.find((g) => g.v === v && !g.parent);
  const a2 = drv2.ang; b.sim(2); out.turnedPowered = +(drv2.ang - a2).toFixed(3);
  out.angleKept = Math.abs(a2 - (a0 + tu + tw)) < 1e-6; out.angleGap = a2 - (a0 + tu + tw);
  // mesh check: driven gears keep tooth contact (angle relation)
  const kids = b.dyn().gears.filter((g) => g.v === v && g.parent);
  out.kids = kids.map((g) => ({ n: g.teeth, pn: g.parent.teeth, phi: +g.phi.toFixed(2) }));
  b.goal.tx = b.X[v]; b.goal.tz = b.Z[v]; b.goal.ty = 0.9; b.goal.dist = 4; b.goal.pitch = 0.3; Object.assign(b.view, b.goal);
  return out;
})()
