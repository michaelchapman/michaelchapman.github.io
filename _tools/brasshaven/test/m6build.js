// builds one of each landmark in open water around the starter town; leaves the sites in window.__m6
(() => {
  const b = window.__brasshaven, NV = b.nearestVertex, R = b.ringW;
  const cx = b.goal.tx, cz = b.goal.tz, out = { sites: {}, times: {} };
  const used = new Set();
  // an empty spot whose two rings of neighbours are all open water
  const site = (ang, dist) => {
    for (let k = 0; k < 30; k++) {
      const d = dist + (k % 6) * 0.8, a = ang + Math.floor(k / 6) * 0.15;
      const v = NV(cx + Math.cos(a) * d, cz + Math.sin(a) * d);
      if (v < 0 || !b.buildable[v] || used.has(v)) continue;
      const near = new Set([v]); for (const w of R[v]) { near.add(w); for (const u of R[w]) { near.add(u); for (const t of R[u]) near.add(t); } }
      if ([...near].every((u) => !b.cols[u] && b.buildable[u] && !used.has(u))) { for (const u of near) used.add(u); return v; }
    }
    return -1;
  };
  const col = (adds, v, mats, ground = 0) => { adds.push([v, 0, ground]); mats.forEach((m, i) => adds.push([v, i + 1, m])); };
  const build = (id, adds) => { const t0 = performance.now(); b.userCommit(adds, []); out.times[id] = +(performance.now() - t0).toFixed(1); out[id] = b.landmarks().map((l) => l.id); };
  const straight = (from, to, n) => {
    const chain = [to]; let dx = b.X[to] - b.X[from], dz = b.Z[to] - b.Z[from];
    while (chain.length < n) {
      const cur = chain[chain.length - 1]; let best = -1, bd = 0.6;
      for (const w of R[cur]) { if (w === from || chain.includes(w)) continue; const ex = b.X[w] - b.X[cur], ez = b.Z[w] - b.Z[cur], d = (ex * dx + ez * dz) / (Math.hypot(dx, dz) * Math.hypot(ex, ez)); if (d > bd) { bd = d; best = w; } }
      if (best < 0) break; dx = b.X[best] - b.X[cur]; dz = b.Z[best] - b.Z[cur]; chain.push(best);
    }
    return chain;
  };
  // 1 lighthouse: a lone five-storey tower on a quay in the water
  let a = []; const lh = site(0, 8); col(a, lh, [0, 0, 0, 0, 0]); build('lighthouse', a); out.sites.lighthouse = lh;
  // 2 observatory: six storeys with a brass top
  a = []; const ob = site(0.9, 8); col(a, ob, [0, 0, 0, 0, 0, 1]); build('observatory', a); out.sites.observatory = ob;
  // 3 cathedral: a copper-topped tower and four brick blocks in a straight row
  a = []; const ct = site(1.8, 8); const nave = straight(ct, R[ct][0], 4); col(a, ct, [0, 0, 0, 2, 2]); nave.forEach((u) => col(a, u, [0, 0])); build('cathedral', a); out.sites.cathedral = ct; out.nave = nave.length;
  // 4 town gate: two equal towers and a block bridging the street between them
  a = []; const gu = site(2.7, 8); const ga = R[gu][0], gc = R[gu][2]; col(a, ga, [0, 0, 0]); col(a, gc, [0, 0, 0]); a.push([gu, 0, 0], [gu, 2, 0]); build('gate', a); out.sites.gate = gu;
  // 5 ironworks: four cast-iron houses joined
  a = []; const iw = site(3.6, 8); const iwc = [iw, R[iw][0], R[iw][1], R[R[iw][0]][0] === iw ? R[R[iw][0]][1] : R[R[iw][0]][0]]; const seen = new Set(); iwc.forEach((u, i) => { if (seen.has(u)) return; seen.add(u); col(a, u, i === 0 ? [3, 3, 3] : [3, 3]); }); build('ironworks', a); out.sites.ironworks = iw;
  // 6 gasworks: copper houses all round one open square
  a = []; const gw = site(4.5, 8); a.push([gw, 0, 0]); R[gw].forEach((w) => col(a, w, [2])); build('gasworks', a); out.sites.gasworks = gw;
  // 7 market hall: a square of three cells walled with glasshouses and brick
  a = []; const mk = site(5.4, 8); const sq = straight(R[mk][0], mk, 3); const ring = new Set(); for (const u of sq) for (const w of R[u]) if (!sq.includes(w)) ring.add(w);
  for (const u of sq) a.push([u, 0, 0]); [...ring].forEach((w, i) => col(a, w, [i % 2 ? 4 : 0]));
  build('market', a); out.sites.market = mk; out.square = sq.length;
  out.found = b.found(); out.plate = b.foundShown();
  window.__m6 = out.sites;
  // frame one landmark: __m6look('cathedral', { time: 3, dist: 6, yaw: 0.5, pitch: 0.35, dy: 1, sim: 3 })
  window.__m6look = (id, o = {}) => {
    const v = out.sites[id];
    Object.assign(b.goal, { tx: b.X[v], tz: b.Z[v], ty: o.dy ?? 1.6, dist: o.dist || 6, yaw: o.yaw ?? 0.6, pitch: o.pitch ?? 0.32 });
    Object.assign(b.view, b.goal);
    if (o.time !== undefined) b.setTime(o.time, true);
    b.sim(o.sim ?? 3);
    return { id, v, marks: b.marks().length };
  };
  return out;
})()
