(() => {
  const b = window.__brasshaven; b.dockNow();
  const log = []; let docked = null;
  for (let i = 0; i < 80; i++) {
    b.sim(1, 0.05);
    const s = b.shipsRaw[0];
    log.push(s.state[0] + ' ' + s.grp.position.toArray().map((x) => x.toFixed(1)).join(','));
    if (s.state === 'docked' && !docked) {
      const m = b.mastPos(), yaw = s.yaw;
      const nose = [s.grp.position.x + Math.cos(yaw) * 1.135, s.grp.position.y, s.grp.position.z - Math.sin(yaw) * 1.135];
      docked = { t: i, nose, m };
      const g = b.goal; g.tx = m[0]; g.ty = m[1] - 0.6; g.tz = m[2]; g.dist = 6; g.pitch = 0.25; g.yaw = yaw + 1.2;
      Object.assign(b.view, g);
      break;
    }
  }
  return { docked, log: log.join(' | ') };
})()
