() => {
  const b = window.__brasshaven;
  const NV = b.nearestVertex;
  const adds = [];
  const col = (v, n, m, gm) => { adds.push([v, 0, gm === undefined ? 0 : gm]); for (let y = 1; y <= n; y++) adds.push([v, y, Array.isArray(m) ? m[y - 1] : m]); };
  const xc = 6, zc = -9;
  // 1. a row of lone towers, one per material (domes, onion, spire...)
  const row = [];
  for (let j = 0; j < 6; j++) { const v = NV(xc - 6 + j * 2.4, zc); row.push(v); col(v, 2 + (j % 2), j, j === 5 ? 5 : 0); }
  // 2. a courtyard: one open ground cell walled in by houses
  const c2 = NV(xc - 3, zc + 5);
  adds.push([c2, 0, 0]);
  b.ringW[c2].forEach((w, i) => col(w, 1 + (i % 3), [0, 3, 4, 5, 0, 1][i % 6] === 4 ? 0 : [0, 3, 0, 5, 0, 1][i % 6]));
  // 3. a girder bridge between two brick blocks
  const a = NV(xc + 4, zc + 5);
  const w = b.ringW[a][0];
  const far = b.ringW[w].find((u) => u !== a && !b.ringW[a].includes(u));
  col(a, 3, 0); col(far, 3, 3); adds.push([w, 2, 0]);
  // 4. a terrace mixing materials, with a glass conservatory and a timber pier
  const t0 = NV(xc + 1, zc + 9);
  const terr = [t0, ...b.ringW[t0].slice(0, 3)];
  terr.forEach((v, i) => col(v, 2, [[0, 0], [1, 1], [0, 2], [3, 3]][i]));
  const gl = b.ringW[t0][4]; col(gl, 1, 4);
  const p = NV(xc + 4, zc + 11); col(p, 1, 5, 5);
  b.commit(adds.filter((c, i, arr) => !b.F(c[0], c[1]) && arr.findIndex((d) => d[0] === c[0] && d[1] === c[1]) === i), []);
  b.goal.tx = b.X[c2]; b.goal.tz = b.Z[c2]; b.goal.ty = 0.8; b.goal.dist = 7.5; b.goal.pitch = 0.85; b.goal.yaw = -1.2;
  Object.assign(b.view, b.goal);
  return { gears: b.gears(), clocks: b.clocks(), bridges: b.bridges(), yards: b.yards() };
}
