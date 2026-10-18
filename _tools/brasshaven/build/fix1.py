import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # this _tools/brasshaven folder
p=os.path.join(ROOT, 'brasshaven.html'); s=open(p).read()
def rep(a, b, count=1):
    global s
    n = s.count(a)
    assert n == count, (n, a[:110])
    s = s.replace(a, b)

# ---------- gestures ----------
i0 = s.index("const pointers = new Map();\nlet tap = null, longTimer = 0, pinch = null, lastMoveT = 0;")
i1 = s.index("document.addEventListener('gesturestart', (e) => e.preventDefault());") + len("document.addEventListener('gesturestart', (e) => e.preventDefault());")
s = s[:i0] + open(os.path.join(ROOT, 'build', 'gestures.js')).read().rstrip() + s[i1:]

rep("""function updateCamera(dt) {
  if (Math.abs(yawVel) > 1e-4) { goal.yaw += yawVel * dt; yawVel *= Math.exp(-dt * 4.5); }
  clampGoal();
  const k = 1 - Math.exp(-dt * (REDUCED ? 30 : 13));""", """function updateCamera(dt) {
  // a flick keeps turning, and a two-finger drag keeps gliding, only once the fingers are off the glass
  if (!pointers.size) {
    if (Math.abs(yawVel) > 1e-4) { goal.yaw += yawVel * dt; yawVel *= Math.exp(-dt * 4.5); }
    if (glideV.x || glideV.z) {
      goal.tx += glideV.x * dt; goal.tz += glideV.z * dt;
      const k = Math.exp(-dt * 4); glideV.x *= k; glideV.z *= k;
      if (Math.hypot(glideV.x, glideV.z) < 0.05) glideV.x = glideV.z = 0;
    }
  }
  clampGoal();
  // fingers move the view directly; the mouse and buttons ease into place
  const k = touchCount() ? 1 : 1 - Math.exp(-dt * (REDUCED ? 30 : 13));""")

# ---------- hold ring, back-to-town button ----------
rep("""  <div class="flash" id="flash" aria-hidden="true"></div>""", """  <div class="flash" id="flash" aria-hidden="true"></div>
  <div class="hold" id="hold" aria-hidden="true"><svg viewBox="0 0 88 88"><circle cx="44" cy="44" r="38"/></svg></div>
  <button class="home-pill plate off" id="home-pill" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11.2 12 4.6l8 6.6"/><path d="M6.2 9.6v9.6h11.6V9.6"/><path d="M10.2 19.2v-5h3.6v5"/></svg><span>Back to the harbour</span></button>""")
rep("@media (max-height:460px){\n  .side{", """.hold{position:absolute;width:88px;height:88px;margin:-44px 0 0 -44px;pointer-events:none;opacity:0;transition:opacity .12s}
.hold.on{opacity:1}
.hold svg{width:88px;height:88px;display:block;transform:rotate(-90deg)}
.hold circle{fill:rgba(255,122,92,.12);stroke:#ff7a5c;stroke-width:5;stroke-linecap:round;stroke-dasharray:239;stroke-dashoffset:239;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.hold.on circle{animation:holdfill var(--d,400ms) linear forwards}
@keyframes holdfill{to{stroke-dashoffset:0}}
.home-pill{position:absolute;top:calc(env(safe-area-inset-top,0px) + 80px);left:max(16px,calc(env(safe-area-inset-left,0px) + 12px));display:flex;align-items:center;gap:7px;height:42px;padding:0 15px 0 11px;border-radius:21px;font:800 13.5px var(--font-ui);letter-spacing:.02em;color:var(--cream);cursor:pointer;transition:opacity .3s ease,transform .3s ease}
.home-pill svg{width:20px;height:20px;color:var(--brass-hi)}
.home-pill.off{opacity:0;transform:translateY(-6px);pointer-events:none;visibility:hidden;transition:opacity .3s ease,transform .3s ease,visibility 0s .3s}
.home-pill:focus-visible{outline:2px solid var(--brass-hi);outline-offset:2px}
#app.pc .home-pill{display:none}
@media (max-height:460px){
  .side{""")

# ---------- text selection and stray zooming on phones ----------
rep("html,body{height:100%}", "html,body{height:100%}\nhtml{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}\n#app{touch-action:none}\n.menu,.pc-sheet{touch-action:pan-y}")
rep(".hint.gone{opacity:0;transform:translate(-50%,6px)}", ".hint.gone{opacity:0;transform:translate(-50%,6px);visibility:hidden;transition:opacity .45s ease,transform .45s ease,visibility 0s .45s}")

# ---------- explanations once ----------
rep("let hintFlashing = false;\nfunction flashHint(msg, sub) { clearTimeout(hintTimer); hintFlashing = true; showHint(msg, sub); hintTimer = setTimeout(() => { hintFlashing = false; restHint(); }, sub ? 2600 : 2200); }",
"""let hintFlashing = false;
function flashHint(msg, sub, ms) { clearTimeout(hintTimer); hintFlashing = true; showHint(msg, sub); hintTimer = setTimeout(() => { hintFlashing = false; restHint(); }, ms || (sub ? 2600 : 2200)); }
// each explanation is shown once per player; after that the game simply does the thing
const SEEN_BEFORE = ['mat0', 'mat1', 'mat2', 'mat3', 'mat4', 'mat5', 'engine', 'wheel', 'unpowered', 'wound', 'time0', 'time1', 'time2', 'time3'];
const seen = new Set(store.get('seen', null) || (hinted ? SEEN_BEFORE : []));
function firstTime(key) { if (seen.has(key)) return false; seen.add(key); store.set('seen', [...seen]); return true; }""")
rep("  if (announce) { flashHint(MATS[m].name, MATS[m].line.charAt(0).toUpperCase() + MATS[m].line.slice(1)); if (tool === 'remove') setTool('build'); }",
"""  if (announce) {
    if (firstTime('mat' + m)) flashHint(MATS[m].name, MATS[m].line.charAt(0).toUpperCase() + MATS[m].line.slice(1));
    else if (!$('mat-name').offsetWidth) flashHint(MATS[m].name, null, 1100);
    if (tool === 'remove') setTool('build');
  }""")
rep("  flashHint(TIMES[todIndex].name, TIMES[todIndex].line);", "  if (firstTime('time' + todIndex)) flashHint(TIMES[todIndex].name, TIMES[todIndex].line); else flashHint(TIMES[todIndex].name, null, 1100);")
rep("""function hintWind() {
  if (windHinted) return; windHinted = true;
  if (currentTip() && currentTip().id === 'key') return;""", """function hintWind() {
  if (windHinted) return; windHinted = true;
  if (currentTip() && currentTip().id === 'key') { firstTime('wound'); return; }
  if (!firstTime('wound')) return;""")
rep("""function announceMachines(before, gearsBefore) {
  if (srcCount.e > before.e) flashHint('Steam up', 'This engine house powers every building joined to it');
  else if (srcCount.w > before.w) flashHint('The mill wheel turns', 'It powers every building joined to this house');
  else if (gearList.length > gearsBefore && !keyHinted && tension < 0.05 && gearList.some((g) => !g.parent && !isPowered(g.v))) {
    keyHinted = true;
    flashHint('This clockwork has no power', 'Join it to a cast-iron engine house, or wind the key');
  }
}""", """// the first engine, mill wheel and stalled clockwork a player builds are explained, once
function announceMachines(before, gearsBefore) {
  if (srcCount.e > before.e) { if (firstTime('engine')) flashHint('Steam up', 'This engine house powers every building joined to it'); }
  else if (srcCount.w > before.w) { if (firstTime('wheel')) flashHint('The mill wheel turns', 'It powers every building joined to this house'); }
  else if (gearList.length > gearsBefore && tension < 0.05 && !seen.has('unpowered') && gearList.some((g) => !g.parent && !isPowered(g.v))) {
    firstTime('unpowered');
    flashHint('This clockwork has no power', 'Join it to a cast-iron engine house, or wind the key');
  }
}""")
rep("let clusterOf = new Int32Array(V).fill(-1), clusterPowered = [], tension = 0, booted = false, keyHinted = false;", "let clusterOf = new Int32Array(V).fill(-1), clusterPowered = [], tension = 0, booted = false, userEdit = false;")
rep("  if (booted) announceMachines(before, gearsBefore);", "  if (booted && userEdit) announceMachines(before, gearsBefore);")
rep("  commit(plan.adds || [], plan.removes || [], plan.paints || []);\n  const cells = plan.adds || plan.removes || plan.paints;",
    "  userEdit = true;\n  try { commit(plan.adds || [], plan.removes || [], plan.paints || []); } finally { userEdit = false; }\n  const cells = plan.adds || plan.removes || plan.paints;")

# ---------- review fixes ----------
# auto quality must not read the half-speed idle frames as a slow device
rep("    if (quality === 'auto' && tier !== 'lowest' && now > perfStart && !document.hidden && !pcMode) {",
    "    if (quality === 'auto' && tier !== 'lowest' && now > perfStart && !document.hidden && !pcMode && !idle) {")
# a shared link opens once; reloading the page keeps the visitor's edits
rep("decodeTown(location.hash).then(({ c, mt, name }) => { replaceTown(c, mt, name); recentre(); Object.assign(view, goal);",
    "decodeTown(location.hash).then(({ c, mt, name }) => { replaceTown(c, mt, name); recentre(); Object.assign(view, goal); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* framed */ }")
# the last edit is saved even if the page closes within the save delay
rep("function saveNow() { store.set('town2', toB64(packBytes())); }",
    "function saveNow() { clearTimeout(saveTimer); store.set('town2', toB64(packBytes())); }\nwindow.addEventListener('pagehide', () => { if (undoStack.length) saveNow(); });\ndocument.addEventListener('visibilitychange', () => { if (document.hidden && undoStack.length) saveNow(); });")
# a postcard shows the time of day its caption names
rep("""async function snapPostcard() {
  ensureAudio();""", """async function snapPostcard() {
  if (todK < 1) { todK = 1; todState = todTo; applyTod(todState); regenEnv(); }
  ensureAudio();""")
# iOS can leave the audio 'interrupted' after a call or Siri
rep("if (actx.state === 'suspended') actx.resume();", "if (actx.state !== 'running') actx.resume();")
# home is wherever the town now is, at the starting distance and tilt
rep("""function recentre() {
  let sx = 0, sz = 0, n = 0;
  for (let v = 0; v < V; v++) if (cols[v]) { sx += X[v]; sz += Z[v]; n++; }
  if (n) { goal.tx = sx / n; goal.tz = sz / n; }
  homeView = { ...goal };
}""", """function recentre() {
  let sx = 0, sz = 0, n = 0;
  for (let v = 0; v < V; v++) if (cols[v]) { sx += X[v]; sz += Z[v]; n++; }
  if (n) { goal.tx = homeView.tx = sx / n; goal.tz = homeView.tz = sz / n; }
}
function goHome() { glideV.x = glideV.z = 0; yawVel = 0; recentre(); Object.assign(goal, { ty: homeView.ty, dist: homeView.dist, pitch: homeView.pitch }); }""")
rep("$('m-view').addEventListener('click', () => { Object.assign(goal, homeView); closeMenu(); });", "$('m-view').addEventListener('click', () => { goHome(); closeMenu(); });\n$('home-pill').addEventListener('click', () => { goHome(); });")

# back-to-town: shown when no part of the town is in view
rep("let townCX = 0, townCZ = 0, townRad = 6, mastPos = null;", "let townCX = 0, townCZ = 0, townRad = 6, mastPos = null;\nconst townBox = new THREE.Box3();")
rep("""  let rad = 3; for (let v = 0; v < V; v++) if (cols[v]) rad = Math.max(rad, Math.hypot(X[v] - townCX, Z[v] - townCZ));""",
"""  let rad = 3; townBox.makeEmpty();
  for (let v = 0; v < V; v++) if (cols[v]) { rad = Math.max(rad, Math.hypot(X[v] - townCX, Z[v] - townCZ)); townBox.expandByPoint(_v3.set(X[v], 0, Z[v])); }
  if (!townBox.isEmpty()) { townBox.min.x -= 0.6; townBox.min.z -= 0.6; townBox.max.x += 0.6; townBox.max.z += 0.6; townBox.max.y = top + 0.8; }""")
rep("""    renderer.render(scene, camera);
    if (quality === 'auto'""", """    renderer.render(scene, camera);
    if (frame % 20 === 0) checkLost();
    if (quality === 'auto'""")
rep("""function resize() {""", """// a 'Back to the harbour' button appears when no part of the town is on screen
const frustum = new THREE.Frustum(), _pm = new THREE.Matrix4(), homePill = $('home-pill');
let lostShown = false;
function checkLost() {
  let lost = false;
  if (cellCount && !pcMode && !townBox.isEmpty()) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(_pm);
    lost = !frustum.intersectsBox(townBox);
  }
  if (lost === lostShown) return;
  lostShown = lost; homePill.classList.toggle('off', !lost); homePill.tabIndex = lost ? 0 : -1;
}
function resize() {""")
open(p,'w').write(s)
print('fix1 ok')
