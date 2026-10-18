() => {
  const b = window.__brasshaven;
  const V3 = b.camera.position.constructor;
  const cx = b.goal.tx, cz = b.goal.tz;
  // pick an edge house and push two blocks out over the water at level 2 and 3
  let made = [];
  for (let v = 0; v < b.V && made.length < 1; v++) {
    if (!b.F(v, 2)) continue;
    const ws = b.ringW[v].filter(w => b.buildable[w] && !b.cols[w]);
    if (ws.length < 2) continue;
    b.commit([[ws[0], 2], [ws[0], 3]], []); made.push(ws[0]);
    const nxt = b.ringW[ws[0]].find(w => b.buildable[w] && !b.cols[w]);
    if (nxt !== undefined) { b.commit([[nxt, 3]], []); made.push(nxt); }
  }
  const m = made[0];
  b.goal.tx = b.X[m]; b.goal.tz = b.Z[m]; b.goal.ty = 1.4; b.goal.dist = 8; b.goal.pitch = 0.18;
  // look from the water side: put the camera beyond m, away from the town centre
  b.goal.yaw = Math.atan2(b.X[m] - cx, b.Z[m] - cz);
  Object.assign(b.view, b.goal);
  return made;
}
