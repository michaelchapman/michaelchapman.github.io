window.cam = (a) => {
  const B = window.__brasshaven;
  if (a.time !== undefined) B.setTime(a.time, true);
  if (a.sim) B.sim(a.sim);
  for (const k of ['tx', 'ty', 'tz', 'yaw', 'pitch', 'dist']) if (a[k] !== undefined) B.goal[k] = a[k];
  B.syncCam();
  const l = B.life();
  return { walkers: l.walkers, gulls: l.gulls.join(',') };
}, 1
