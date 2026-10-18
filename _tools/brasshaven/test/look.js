(args) => {
  const b = window.__brasshaven;
  const d = b.dyn();
  const list = d[args.kind];
  if (!list || !list.length) return { none: args.kind, counts: { e: d.engines.length, w: d.wheels.length, g: d.gears.length } };
  const it = list[args.idx || 0];
  const c = it.c || it.p, n = it.n;
  b.goal.tx = c[0]; b.goal.ty = c[1] + (args.dy || 0); b.goal.tz = c[2];
  b.goal.yaw = Math.atan2(n[0], n[2]) + (args.yaw || 0); b.goal.pitch = args.pitch ?? 0.25; b.goal.dist = args.dist || 3;
  Object.assign(b.view, b.goal);
  if (args.time !== undefined) b.setTime(args.time, true);
  const parts = b.sim(args.sim || 3);
  return { parts, view: b.goal, emitters: b.emitters(), ships: b.ships() };
}
