(() => {
  const b = window.__brasshaven;
  b.sim(1.3);
  const key = (p) => p.map((x) => Math.round(x * 400)).join(':');
  const before = new Map();
  const d = b.dyn();
  for (const g of d.gears) if (!g.parent) before.set('g' + key(g.p), g.ang);
  for (const e of d.engines) before.set('e' + key(e.c), e.th);
  for (const w of d.wheels) before.set('w' + key(w.c), w.ang);
  // an edit right next to the engine house rebuilds its chunk
  const e0 = d.engines[0];
  const nb = b.ringW[e0.v].find((w) => !b.cols[w] && b.buildable[w]);
  b.commit([[nb, 0, 0]], []);
  const d2 = b.dyn(); let same = 0, diff = [];
  for (const g of d2.gears) if (!g.parent) { const k = 'g' + key(g.p); if (before.has(k)) (Math.abs(before.get(k) - g.ang) < 1e-9 ? same++ : diff.push(k)); }
  for (const e of d2.engines) { const k = 'e' + key(e.c); if (before.has(k)) (Math.abs(before.get(k) - e.th) < 1e-9 ? same++ : diff.push(k)); }
  for (const w of d2.wheels) { const k = 'w' + key(w.c); if (before.has(k)) (Math.abs(before.get(k) - w.ang) < 1e-9 ? same++ : diff.push(k)); }
  return { tracked: before.size, same, diff, engines: d2.engines.length };
})()
