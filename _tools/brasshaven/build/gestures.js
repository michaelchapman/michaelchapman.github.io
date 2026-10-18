// Touch: one finger turns the view (locking to a turn or a tilt when the drag is clearly one or the other);
// two fingers drag the ground with them, and pinch or twist about the point between them once the gesture is
// clearly a pinch or a twist. The view follows the fingers directly. A tap builds; holding a block shows a red
// outline and a filling ring, then removes it. Mouse: drag turns, shift or middle drag pans, wheel zooms toward
// the pointer, sideways scroll turns.
const pointers = new Map();
const HOLD_ARM = 420, HOLD_FIRE = 820;
let tap = null, holdTimer = 0, fireTimer = 0, multi = null, multiUsed = false, drag = null, lastMoveT = 0, panT = 0;
const glideV = { x: 0, z: 0 };
let lastInput = performance.now();
function noteInput() { lastInput = performance.now(); }
const touchCount = () => { let n = 0; for (const p of pointers.values()) if (p.type !== 'mouse') n++; return n; };
function pinchState() {
  const [a, b] = [...pointers.values()];
  return { span: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ang: Math.atan2(b.y - a.y, b.x - a.x) };
}
// where a screen point meets the quay level; null near the horizon, where a drag would fling the view away
const _g0 = new THREE.Vector3(), _g1 = new THREE.Vector3();
function groundAt(sx, sy, out) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if (d.y > -0.03) return null;
  const t = (GROUND_TOP - o.y) / d.y;
  if (t < 0 || t > view.dist * 4 + 40) return null;
  return out.set(o.x + d.x * t, GROUND_TOP, o.z + d.z * t);
}
function dragGround(x0, y0, x1, y1) {
  if (!groundAt(x0, y0, _g0) || !groundAt(x1, y1, _g1)) { pan(x1 - x0, y1 - y0); return; }
  let dx = _g1.x - _g0.x, dz = _g1.z - _g0.z;
  const cap = goal.dist * 0.6, l = Math.hypot(dx, dz);
  if (l > cap) { dx *= cap / l; dz *= cap / l; }
  goal.tx -= dx; goal.tz -= dz;
  const now = performance.now(), dt = Math.max(8, now - panT) / 1000; panT = now;
  glideV.x = glideV.x * 0.55 - (dx / dt) * 0.45; glideV.z = glideV.z * 0.55 - (dz / dt) * 0.45;
}
function zoomAbout(sx, sy, f) {
  const d0 = goal.dist, d1 = Math.max(4.5, Math.min(75, d0 * f)), k = d1 / d0;
  goal.dist = d1;
  if (k !== 1 && groundAt(sx, sy, _g0)) { goal.tx = _g0.x + (goal.tx - _g0.x) * k; goal.tz = _g0.z + (goal.tz - _g0.z) * k; }
}
function rotateAbout(sx, sy, dYaw) {
  goal.yaw += dYaw;
  if (!groundAt(sx, sy, _g0)) return;
  const c = Math.cos(dYaw), s = Math.sin(dYaw), dx = goal.tx - _g0.x, dz = goal.tz - _g0.z;
  goal.tx = _g0.x + dx * c + dz * s; goal.tz = _g0.z + dz * c - dx * s;
}
function startMulti() {
  const s = pinchState();
  multi = { span0: s.span, ang0: s.ang, last: s, zoomOn: false, rotOn: false };
  multiUsed = true; drag = null; yawVel = 0;
}
function moveMulti() {
  const s = pinchState(), m = multi, last = m.last;
  dragGround(last.mx, last.my, s.mx, s.my);
  if (!m.zoomOn && Math.abs(Math.log(Math.max(1, s.span) / Math.max(1, m.span0))) > 0.07) m.zoomOn = true;
  if (m.zoomOn && s.span > 10 && last.span > 10) zoomAbout(s.mx, s.my, last.span / s.span);
  if (!m.rotOn && Math.abs(angDiff(m.ang0, s.ang)) > 0.24) m.rotOn = true;
  if (m.rotOn) rotateAbout(s.mx, s.my, -angDiff(last.ang, s.ang));
  m.last = s;
}
function moveOne(p, fx, fy, touch) {
  const dx = p.x - fx, dy = p.y - fy;
  if (p.mode === 'pan') { dragGround(fx, fy, p.x, p.y); return; }
  if (!drag) drag = { lock: null, ax: 0, ay: 0, lx: 0, ly: 0 };
  drag.ax += dx; drag.ay += dy;
  if (touch && !drag.lock && Math.hypot(drag.ax, drag.ay) > 14) {
    const a = Math.atan2(Math.abs(drag.ay), Math.abs(drag.ax));
    drag.lock = a < 0.42 ? 'yaw' : a > 1.15 ? 'pitch' : 'free';
    drag.lx = drag.ax; drag.ly = drag.ay;
  }
  // a locked drag lets go once the finger clearly heads the other way
  if (drag.lock === 'yaw' && Math.abs(drag.ay - drag.ly) > 80) drag.lock = 'free';
  if (drag.lock === 'pitch' && Math.abs(drag.ax - drag.lx) > 80) drag.lock = 'free';
  const W = canvas.clientWidth || 400, H = canvas.clientHeight || 400;
  const ky = touch ? Math.min(0.0075, Math.max(0.0035, 2.8 / W)) : 0.0062;
  const kp = touch ? Math.min(0.0042, Math.max(0.0016, 1.5 / H)) : 0.0042;
  const dYaw = !touch || drag.lock !== 'pitch' ? -dx * ky : 0;
  goal.yaw += dYaw;
  if (!touch || (drag.lock && drag.lock !== 'yaw')) goal.pitch += dy * kp;
  const now = performance.now(), dt = Math.max(8, now - lastMoveT) / 1000; lastMoveT = now;
  yawVel = REDUCED ? 0 : Math.max(-4, Math.min(4, yawVel * 0.6 + (dYaw / dt) * 0.4));
}
// what a finger on this spot would act on, allowing for a finger that slips just off a building
function resolveHit(sx, sy, useTool, ptype) {
  let hit = pickAt(sx, sy);
  if (ptype !== 'mouse' && useTool !== 'build' && (!hit || hit.type === 'water')) hit = ringPick(sx, sy) || hit;
  return hit;
}
const holdEl = $('hold');
function showHoldRing(x, y, ms) {
  holdEl.style.left = x + 'px'; holdEl.style.top = y + 'px'; holdEl.style.setProperty('--d', ms + 'ms');
  holdEl.classList.remove('on'); void holdEl.offsetWidth; holdEl.classList.add('on');
}
function hideHoldRing() { holdEl.classList.remove('on'); }
function clearHold() {
  clearTimeout(holdTimer); clearTimeout(fireTimer); hideHoldRing();
  if (tap && tap.armed && !ghostFade) { ghost.visible = false; ghostKey = ''; }
}
function armRemove(id) {
  if (!tap || tap.id !== id || pcMode) return;
  const plan = planAction(resolveHit(tap.x, tap.y, 'remove', tap.type), 'remove');
  if (!plan || plan.msg) { tap.empty = true; return; }
  tap.armed = true;
  ghostFade = 0; ghostKey = ''; setGhost(plan.removes, 'remove'); ghostMat.opacity = 1;
  showHoldRing(tap.x, tap.y, HOLD_FIRE - HOLD_ARM);
  fireTimer = setTimeout(() => {
    if (!tap || tap.id !== id) return;
    hideHoldRing();
    const done = act(tap.x, tap.y, 'remove', tap.type);
    if (done) { try { navigator.vibrate && navigator.vibrate(14); } catch (err) { /* no vibration */ } }
    tap = null;
  }, HOLD_FIRE - HOLD_ARM);
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// a long press must not start the browser's text selection, magnifier or callout
canvas.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
canvas.addEventListener('pointerdown', (e) => {
  canvas.focus({ preventScroll: true });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  ensureAudio(); noteInput(); closeMenu();
  const touch = e.pointerType !== 'mouse';
  if (touch && !touchCount()) { Object.assign(goal, view); glideV.x = glideV.z = 0; }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType, mode: e.button === 1 || e.shiftKey ? 'pan' : 'orbit' });
  yawVel = 0;
  if (pointers.size === 1) {
    multiUsed = false; drag = null; clearHold();
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), button: e.button, type: e.pointerType };
    if (touch) holdTimer = setTimeout(() => armRemove(e.pointerId), HOLD_ARM);
    else { ghostKey = ''; setGhost([], 'build'); }
  } else {
    clearHold(); tap = null; drag = null;
    if (pointers.size === 2) startMulti();
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse') hover(e.clientX, e.clientY); return; }
  noteInput();
  const px = p.x, py = p.y;
  p.x = e.clientX; p.y = e.clientY;
  const touch = p.type !== 'mouse';
  if (tap && tap.id === e.pointerId) {
    if (Math.hypot(p.x - tap.x, p.y - tap.y) <= (touch ? 10 : 5)) return;
    // it was a drag all along: let go of the tap and catch up with the finger
    clearHold(); tap = null;
    if (pointers.size === 1 && !multiUsed) moveOne(p, p.sx, p.sy, touch);
    return;
  }
  if (pointers.size === 1) { if (!multiUsed) moveOne(p, px, py, touch); }
  else if (pointers.size >= 2 && multi) moveMulti();
});
function endPointer(e) {
  const p = pointers.get(e.pointerId); if (!p) return;
  pointers.delete(e.pointerId);
  if (tap && tap.id === e.pointerId) {
    const held = performance.now() - tap.t, armed = tap.armed, empty = tap.empty;
    clearHold();
    // a quick tap builds; a slow one on open water still builds; a hold that showed the red outline cancels
    const ok = e.type === 'pointerup' && !armed && (p.type === 'mouse' || held < HOLD_ARM || (empty && held < HOLD_FIRE + 400));
    if (ok) act(tap.x, tap.y, tap.button === 2 ? 'remove' : tool, tap.type);
    tap = null;
  }
  if (pointers.size >= 2) startMulti(); else multi = null;
  if (!pointers.size) {
    drag = null;
    const now = performance.now();
    if (now - lastMoveT > 90) yawVel = 0;
    const sp = Math.hypot(glideV.x, glideV.z);
    if (now - panT > 90 || REDUCED || sp < 0.8) glideV.x = glideV.z = 0;
    else if (sp > 30) { glideV.x *= 30 / sp; glideV.z *= 30 / sp; }
  }
  if (p.type === 'mouse') hover(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointers.size) { if (!ghostFade) { ghost.visible = false; ghostKey = ''; } gridLines.material.uniforms.uOn.value = 0; } });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault(); noteInput(); glideV.x = glideV.z = 0;
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  if (e.ctrlKey) { zoomAbout(e.clientX, e.clientY, Math.exp(e.deltaY * unit * 0.01)); return; }
  // a trackpad's sideways swipe turns the view; scrolling zooms toward the pointer
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { goal.yaw -= e.deltaX * unit * 0.004; return; }
  zoomAbout(e.clientX, e.clientY, Math.exp(e.deltaY * unit * 0.0012));
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => { if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault(); });
