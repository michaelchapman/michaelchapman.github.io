// milestone 7 performance: a densely built harbour at a chosen size, then triangles, draw calls and tap time
// from three views. Run: python3 test/run2.py 1280 800 m7perf.js, with window.__m7size = 0..4 set first
// (the default builds the largest harbour); see test/m7perf.py.
(() => {
  const b = window.__brasshaven, size = window.__m7size ?? 4;
  const h = (a, c) => { let x = Math.sin(a * 127.1 + c * 311.7) * 43758.5453; return x - Math.floor(x); };
  // ground on most cells, band by band until the harbour reaches the size asked for
  for (let k = 0; k < 8; k++) {
    const adds = [];
    for (let v = 0; v < b.V; v++) if (b.buildable[v] && !b.cols[v] && b.edgeBand[v] <= size && h(v, 1) > 0.22) adds.push([v, 0, h(v, 5) < 0.12 ? 5 : 0]);
    if (!adds.length) break;
    b.commit(adds, []);
  }
  // houses of one to four storeys, open streets, a tower now and then, iron engine houses
  const adds = [];
  for (let v = 0; v < b.V; v++) {
    if (!b.F(v, 0) || b.M(v, 0) === 5) continue;
    if (Math.abs(Math.sin(b.X[v] * 0.9)) < 0.18 || h(v, 2) < 0.2) continue;
    const tower = h(v, 4) < 0.03, n = tower ? 6 + Math.floor(h(v, 6) * 4) : 1 + Math.floor(h(v, 3) * 3.6);
    const m = h(v, 7) < 0.1 ? 3 : h(v, 7) < 0.2 ? 4 : h(v, 7) < 0.3 ? 1 : h(v, 7) < 0.36 ? 2 : 0;
    for (let y = 1; y <= n; y++) adds.push([v, y, tower && y > n - 2 ? 2 : m]);
  }
  b.commit(adds, []);
  const views = {};
  const shot = (name, o) => { Object.assign(b.goal, o); b.syncCam(); views[name] = b.renderInfo(); };
  const home = { tx: 0, tz: 0, ty: 1.9, pitch: 0.5, yaw: 0.6 };
  shot('street', { ...home, dist: 12 });
  shot('home', { ...home, dist: 19 });
  shot('wide', { ...home, dist: 40 });
  shot('far', { ...home, dist: 75, pitch: 1.0 });
  // a tap: add one storey somewhere in the middle, then take it away
  const v = b.nearestVertex(1, 1), ts = [];
  for (let i = 0; i < 6; i++) { let y = 1; while (b.F(v, y)) y++; const t = performance.now(); b.commit([[v, y, 0]], []); ts.push(performance.now() - t); b.undo(); }
  ts.sort((a, c) => a - c);
  let n = 0; for (let x = 0; x < b.V; x++) n += b.buildable[x];
  return { size: b.reach(), cells: n, blocks: b.cellCount(), views, tapMs: +ts[3].toFixed(1), shadowR: b.shadowR() };
})()
