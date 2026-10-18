#!/usr/bin/env python3
"""Milestone 5: splice the harbour's life (build/life.js) into brasshaven.html."""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'brasshaven.html'
dst = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else src
s = src.read_text()
life = (ROOT / 'build' / 'life.js').read_text().strip('\n') + '\n\n'


def rep(a, b, cnt=1):
    global s
    n = s.count(a)
    if n != cnt:
        sys.exit(f'expected {cnt} of {a[:90]!r}, found {n}')
    s = s.replace(a, b)


# perches for gulls: roof apexes, finial tips, chimney pots
rep("this.dyn = { gears: [], clocks: [], engines: [], wheels: [], emit: [], lamps: [], mains: [], mast: null }; }",
    "this.dyn = { gears: [], clocks: [], engines: [], wheels: [], emit: [], lamps: [], mains: [], mast: null, perches: [] }; }")
rep("""      g.ball([vx, h0 + (big ? 0.15 : 0.1), vz], big ? 0.045 : 0.032, C_BRASS, S_BRASS);
    }
  }""", """      g.ball([vx, h0 + (big ? 0.15 : 0.1), vz], big ? 0.045 : 0.032, C_BRASS, S_BRASS);
      g.dyn.perches.push([vx, h0 + (big ? 0.42 : 0.24) + 0.02, vz]);
    } else g.dyn.perches.push([vx, top + Hv + 0.03, vz]);
  }""")
rep("""      g.dyn.emit.push({ p: [s.px + s.ax[0] * 0.05, y1 + 0.16, s.pz + s.ax[2] * 0.05], kind: 'chimney', v });""",
    """      g.dyn.emit.push({ p: [s.px + s.ax[0] * 0.05, y1 + 0.16, s.pz + s.ax[2] * 0.05], kind: 'chimney', v });
      g.dyn.perches.push([s.px - s.ax[0] * 0.05, y1 + 0.156, s.pz - s.ax[2] * 0.05]);""")

# the life module goes after section 7, before the chunked meshes
rep("""/* ============================================================
   8. Chunked town meshes""", life + """/* ============================================================
   8. Chunked town meshes""")

# keep life in step with every change to the town
rep("""  syncShips();
  if (booted && userEdit) announceMachines(before, gearsBefore);""", """  syncShips();
  const docksBefore = docks.length;
  syncLife();
  if (booted && userEdit) {
    announceMachines(before, gearsBefore);
    if (docks.length > docksBefore && !hintFlashing && firstTime('pier')) flashHint('A pier for the launches', 'Steam launches call here; three blocks long brings the paddle steamer', 3200);
  }""")

# a new harbour starts with a short pier so boats have somewhere to call
rep("""    for (let y = 1; y <= storeys; y++) set(v, y, v === tower ? (y >= 5 ? M_COPPER : M_BRICK) : m);
  }
  return c0;""", """    for (let y = 1; y <= storeys; y++) set(v, y, v === tower ? (y >= 5 ? M_COPPER : M_BRICK) : m);
  }
  {
    let cur = -1, bs = -1e9;
    for (let v = 0; v < V; v++) if (!cols[v] && buildable[v] && ringW[v].some((w) => cols[w] & 1)) { const sc = Z[v] * 0.53 - X[v] * 0.85; if (sc > bs) { bs = sc; cur = v; } }
    let px = X[c0], pz = Z[c0];
    for (let k = 0; k < 3 && cur >= 0; k++) {
      set(cur, 0, M_TIMBER);
      const dx = X[cur] - px, dz = Z[cur] - pz; px = X[cur]; pz = Z[cur];
      let nb = -1, ns = 0;
      for (const w of ringW[cur]) { if (cols[w] || !buildable[w]) continue; const sc = ((X[w] - px) * dx + (Z[w] - pz) * dz) / (Math.hypot(dx, dz) * Math.hypot(X[w] - px, Z[w] - pz) || 1); if (sc > ns) { ns = sc; nb = w; } }
      cur = nb;
    }
  }
  return c0;""")

# gulls lift off when you build beside them
rep("""  flashGhost(cells, plan.adds ? 'build' : plan.removes ? 'remove' : 'paint');""",
    """  flashGhost(cells, plan.adds ? 'build' : plan.removes ? 'remove' : 'paint');
  if (cells && cells.length) scatterGulls(X[cells[0][0]], Z[cells[0][0]]);""")

# engine beats join the ambience
rep("if (dd < 7 && view.dist < 28) { noise(0.13, 420, 0.05 * (1 - dd / 7), 'lowpass'); chuffClock = 0.22; }",
    "if (dd < 7 && view.dist < 28) { chuff(0.05 * (1 - dd / 7)); chuffClock = 0.22; }")

# sound: off really is silent, the master follows the switch, audio sleeps with the page
rep("function bus() { if (!master) { master = actx.createGain(); master.gain.value = volGain();",
    "function bus() { if (!master) { master = actx.createGain(); master.gain.value = soundOn ? volGain() : 0;")
rep("function setVolume(v) { volume = v; store.set('volume', v); if (master && actx) master.gain.setTargetAtTime(volGain(), actx.currentTime, 0.02); }",
    "function setVolume(v) { volume = v; store.set('volume', v); if (master && actx) master.gain.setTargetAtTime(soundOn ? volGain() : 0, actx.currentTime, 0.02); }")
rep("$('m-sound').addEventListener('click', () => { soundOn = !soundOn; store.set('sound', soundOn); renderSound(); if (soundOn) { ensureAudio(); plink(5); } });",
    """$('m-sound').addEventListener('click', () => {
  soundOn = !soundOn; store.set('sound', soundOn); renderSound();
  if (master && actx) master.gain.setTargetAtTime(soundOn ? volGain() : 0, actx.currentTime, 0.04);
  if (soundOn) { ensureAudio(); plink(5); } else if (actx) setTimeout(() => { if (!soundOn) actx.suspend().catch(() => {}); }, 200);
});
document.addEventListener('visibilitychange', () => {
  if (!actx) return;
  if (document.hidden) { lastHour = null; actx.suspend().catch(() => {}); } else if (soundOn) actx.resume().catch(() => {});
});""")

# the Ambience slider, beside Volume
rep("""    <label class="seg"><span>Volume</span><input type="range" id="m-vol" min="0" max="100" step="5" value="70"></label>""",
    """    <label class="seg"><span>Volume</span><input type="range" id="m-vol" min="0" max="100" step="5" value="70"></label>
    <label class="seg"><span>Ambience</span><input type="range" id="m-amb" min="0" max="100" step="5" value="60" aria-label="Ambience: the harbour's own sounds"></label>""")
rep("""volIn.addEventListener('change', () => { ensureAudio(); plink(6, 0.7); });
renderVol();""", """volIn.addEventListener('change', () => { ensureAudio(); plink(6, 0.7); });
renderVol();
const ambIn = $('m-amb');
function renderAmb() { ambIn.value = String(ambVolume); ambIn.style.setProperty('--v', ambVolume + '%'); }
ambIn.addEventListener('input', () => { setAmbience(+ambIn.value); renderAmb(); });
ambIn.addEventListener('change', () => ensureAudio());
renderAmb();""")

# quality tiers: life's shadows on high only, fewer boats lower down
rep("for (const m of [townMat, waterMat, brassMat, steelMat, redMat, wheelMat, handMat]) m.needsUpdate = true; }",
    "for (const m of [townMat, waterMat, brassMat, steelMat, redMat, wheelMat, handMat, ...LIFE_MATS]) m.needsUpdate = true; }")
rep("""  for (const im of dynMeshes) im.castShadow = castsFor(im.userData.shadow, t);
  syncShips();""", """  for (const im of dynMeshes) im.castShadow = castsFor(im.userData.shadow, t);
  setLifeShadows(t === 'high');
  syncShips();
  if (lifeReady) syncBoats();""")

# frame loop and the test simulator
rep("""    updateShips(dt, now / 1000);
""", """    updateShips(dt, now / 1000);
    updateLife(dt, now / 1000);
    tickAmbience(dt);
""")
rep("updateSteam(step); updateShips(step, t0 + t); } return pN; }",
    "updateSteam(step); updateShips(step, t0 + t); updateLife(step, t0 + t); } return pN; }")
rep("bridges: () => bridgeSet.size, yards: () => courtyard.reduce((a, b) => a + b, 0) };",
    """bridges: () => bridgeSet.size, yards: () => courtyard.reduce((a, b) => a + b, 0),
  life: () => ({ walkers: walkers.length, walkStates: walkers.map((w) => w.state), doors: doors.length, walkable: walkNodes.length, boats: boats.map((b) => ({ kind: b.kind, state: b.state, x: b.x, z: b.z, h: b.heading, dock: b.dock && b.dock.key })), docks: docks.length, piers: piers.map((p) => p.size), berth: steamerBerth, gulls: gulls.map((g) => g.state), perches: perchList.length, amb: !!amb, ambience: ambVolume }),
  lifeRaw: { walkers, boats, gulls, docks: () => docks, perches: () => perchList }, scatterGulls, syncBoats, startAmbience, tickAmbience, seaPath, nearestSeaNode, planLaunch, updateLife, seaNode: () => seaNode,
  lifeShow: (on) => { for (const im of [...Object.values(walkIM), gullIM, wingIM, lifeHalo]) im.visible = on; for (const b of boats) b.grp.visible = on; }, scene,
  ambTest: () => { ensureAudio(); startAmbience(); if (!amb) return 'no ambience'; gullCry(0.05); creak(0.03); horn(0.05, true); horn(0.03, false); bell(actx.currentTime, 0.05); chuff(0.05); envNoise(0.3, 'bandpass', 700, 0.8, 0.05); lastHour = -1; ambT = 0; tickAmbience(1); return actx.state; } };""")

# how to play
rep("the dial above it changes the time of day, and the camera takes a postcard of your harbour.'",
    "the dial above it changes the time of day, and the camera takes a postcard of your harbour. Clockwork townsfolk walk the open quays; steam launches call at timber piers, and a pier three blocks long brings the paddle steamer.'")
rep("the dial above it (T) changes the time of day, and the camera (C) takes a postcard of your harbour.'",
    "the dial above it (T) changes the time of day, and the camera (C) takes a postcard of your harbour. Clockwork townsfolk walk the open quays; steam launches call at timber piers, and a pier three blocks long brings the paddle steamer.'")

dst.write_text(s)
print('patched', len(s))
