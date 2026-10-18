(() => {
  const B = window.__brasshaven, R = B.lifeRaw; B.sim(30);
  const l = B.life(), occ = R.occ();
  const nodes = []; for (let v = 0; v < B.V; v++) if (B.F(v, 0) && !B.F(v, 1)) nodes.push(v);
  const comp = nodes.map((v) => v + ':' + occ[v] + ':' + B.ringW[v].filter((w) => nodes.includes(w)).length);
  return JSON.stringify({ walkable: l.walkable, doors: l.doors, walkers: l.walkers, states: l.walkStates, nodes: comp, night: 0 });
})()
