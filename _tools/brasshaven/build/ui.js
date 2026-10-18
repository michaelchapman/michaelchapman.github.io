
// time of day dial: cycles morning, golden hour, dusk and night
const TIME_ICONS = [
  '<circle cx="12" cy="12" r="4"/><path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M5.8 18.2l1.5-1.5M16.7 7.3l1.5-1.5"/>',
  '<circle cx="12" cy="12.5" r="3.6"/><path d="M3 18.5h18M12 4.6v2M6.2 7l1.4 1.4M17.8 7l-1.4 1.4M4 12.5h2M18 12.5h2"/>',
  '<path d="M6.6 16.2a5.4 5.4 0 0 1 10.8 0"/><path d="M3 16.2h18M5.5 19.6h13M12 6.6v2.2M6.4 9.2l1.4 1.4M17.6 9.2l-1.4 1.4"/>',
  '<path d="M14.6 4.2a7.8 7.8 0 1 0 5.4 12.9 6.4 6.4 0 0 1-5.4-12.9z"/><path d="M18.6 3.6v2.6M17.3 4.9h2.6"/>',
];
const timeBtn = $('time-btn');
function renderTime() {
  $('time-ico').innerHTML = TIME_ICONS[todIndex];
  timeBtn.setAttribute('aria-label', 'Time of day: ' + TIMES[todIndex].name);
}
function cycleTime() {
  setTime(todIndex + 1); renderTime();
  flashHint(TIMES[todIndex].name, TIMES[todIndex].line);
  plink(todIndex === 3 ? 2 : 6 + todIndex, 0.35);
}
timeBtn.addEventListener('click', () => { ensureAudio(); noteInput(); cycleTime(); });
renderTime();

// the wind-up key: hold to wind every machine faster; a tap gives a quarter turn
const keyBtn = $('key-btn'), keyIco = $('key-ico'), tensionEl = $('tension');
let winding = false, windStart = 0, keyAng = 0, keyShown = -1, keyLabel = '', windHinted = false;
function ratchet() { noise(0.022, 3600, 0.08, 'bandpass'); }
function addTension(x) {
  ensureAudio(); noteInput();
  const before = tension;
  tension = Math.min(1, tension + x); keyAng += 1.7;
  ratchet(); setTimeout(ratchet, 70); setTimeout(ratchet, 140);
  if (tension >= 1 && before < 1) plink(10, 0.3);
  hintWind();
}
function hintWind() {
  if (windHinted) return; windHinted = true;
  flashHint('Wound up', 'Every machine runs faster, and clockwork turns even without an engine');
}
keyBtn.addEventListener('pointerdown', (e) => {
  ensureAudio(); noteInput();
  winding = true; windStart = performance.now(); keyBtn.classList.add('winding');
  try { keyBtn.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  e.preventDefault();
});
function stopWind(tap) {
  if (!winding) return;
  winding = false; keyBtn.classList.remove('winding');
  if (tap && performance.now() - windStart < 220) addTension(0.2);
}
keyBtn.addEventListener('pointerup', () => stopWind(true));
keyBtn.addEventListener('pointercancel', () => stopWind(false));
keyBtn.addEventListener('lostpointercapture', () => stopWind(false));
keyBtn.addEventListener('click', (e) => { if (e.detail === 0) addTension(0.2); });
keyBtn.addEventListener('contextmenu', (e) => e.preventDefault());
function tickKey(dt) {
  if (winding && performance.now() - windStart > 220) {
    noteInput();
    const before = tension;
    tension = Math.min(1, tension + dt * 0.55);
    if (tension < 1) keyAng += dt * 7;
    if (Math.floor(tension / 0.05) > Math.floor(before / 0.05)) ratchet();
    if (tension >= 1 && before < 1) plink(10, 0.3);
    if (tension > 0.1) hintWind();
  } else tension = Math.max(0, tension - dt / 45);
  const shown = Math.round(tension * 200);
  if (shown !== keyShown) { keyShown = shown; tensionEl.style.setProperty('--t', (shown / 200).toFixed(3)); }
  keyIco.style.transform = `scaleX(${Math.max(0.18, Math.abs(Math.cos(keyAng))).toFixed(3)})`;
  const label = tension > 0.02 ? `Wind the key (wound ${Math.round(tension * 10) * 10}%)` : 'Wind the key';
  if (label !== keyLabel) { keyLabel = label; keyBtn.setAttribute('aria-label', label); }
}
