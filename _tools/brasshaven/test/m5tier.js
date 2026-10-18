(() => {
  const B = window.__brasshaven, out = {};
  B.sim(20); out.high = B.life();
  B.applyTier('low'); B.sim(30); out.low = B.life();
  B.applyTier('lowest'); B.sim(30); out.lowest = B.life();
  const f = (l) => ({ walkers: l.walkers, boats: l.boats.map((b) => b.kind[0]).join(''), gulls: l.gulls.length });
  return JSON.stringify({ high: f(out.high), low: f(out.low), lowest: f(out.lowest), stops: out.lowest.walkStates.length });
})()
