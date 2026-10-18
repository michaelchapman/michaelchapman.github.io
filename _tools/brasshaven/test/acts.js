() => {
  const b = window.__brasshaven;
  const V3 = b.camera.position.constructor;
  const scr = (x,y,z) => { const p = new V3(x,y,z).project(b.camera); return [(p.x+1)/2*innerWidth, (1-p.y)/2*innerHeight]; };
  const out = [];
  const cx = b.goal.tx, cz = b.goal.tz;
  const camx = b.camera.position.x, camz = b.camera.position.z;
  // empty vertices on the camera side of town that the water pick resolves to themselves
  const cands = [];
  for (let v = 0; v < b.V; v++) {
    if (!b.buildable[v] || b.cols[v]) continue;
    const d = Math.hypot(b.X[v]-cx, b.Z[v]-cz); if (d < 2.5 || d > 4.5) continue;
    const [sx, sy] = scr(b.X[v], 0, b.Z[v]);
    const h = b.pickAt(sx, sy);
    if (h && h.type === 'water' && b.nearestVertex(h.x, h.z) === v) cands.push([Math.hypot(b.X[v]-camx, b.Z[v]-camz), v]);
  }
  cands.sort((a,c)=>a[0]-c[0]);
  const v = cands[0][1];
  let [sx, sy] = scr(b.X[v], 0, b.Z[v]);
  out.push(['water', v, b.act(sx, sy, 'build'), b.cols[v]]);
  for (let k = 1; k <= 3; k++) { [sx, sy] = scr(b.X[v], 0.42 + k*0.98 + 0.2, b.Z[v]); out.push(['roof'+k, b.act(sx, sy, 'build'), b.cols[v]]); }
  // neighbours on the water for a terrace
  let row = 0;
  for (const w of b.ringW[v]) {
    if (row >= 2 || !b.buildable[w] || b.cols[w]) continue;
    [sx, sy] = scr(b.X[w], 0, b.Z[w]); const h = b.pickAt(sx, sy);
    if (h && h.type==='water' && b.nearestVertex(h.x,h.z)===w) { out.push(['row', w, b.act(sx, sy, 'build'), b.cols[w]]); row++; }
  }
  [sx, sy] = scr(b.X[v], 0.42 + 4*0.98 + 0.2, b.Z[v]);
  out.push(['remove-top', b.act(sx, sy, 'remove'), b.cols[v]]);
  b.undo(); out.push(['undo', b.cols[v]]);
  return out;
}
