
// ---------- postcard mode: frame the harbour, take a captioned picture, save or share it ----------
const appEl = $('app'), pcFrame = $('pc-frame'), pcBar = $('pc-bar'), pcSheet = $('pc-sheet'), flashEl = $('flash');
let pcMode = false, pcBlob = null, pcUrl = null, pcLink = null, dlPromise = null;
// the viewer's save prompt, when this page runs inside Claude; elsewhere an ordinary download
function getDownloads() {
  if (!dlPromise) dlPromise = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  return dlPromise;
}
getDownloads();
function pcCrop() {
  const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
  const ar = H > W * 1.05 ? 4 / 5 : 3 / 2;
  const barTop = pcBar.hidden ? H - 96 : pcBar.getBoundingClientRect().top;
  const x0 = 16, y0 = 16, x1 = W - 16, y1 = Math.max(y0 + 120, barTop - 16);
  let w = x1 - x0, h = w / ar;
  if (h > y1 - y0) { h = y1 - y0; w = h * ar; }
  return { x: (W - w) / 2, y: y0 + (y1 - y0 - h) / 2, w, h };
}
function layoutFrame() { const c = pcCrop(); Object.assign(pcFrame.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px' }); }
function renderPcTime() { $('pc-time-ico').innerHTML = TIME_ICONS[todIndex]; $('pc-cap').textContent = TIMES[todIndex].name; $('pc-time').setAttribute('aria-label', 'Time of day: ' + TIMES[todIndex].name); }
function enterPostcard() {
  if (pcMode) return;
  pcMode = true; closeMenu();
  appEl.classList.add('pc'); pcBar.hidden = false; pcFrame.hidden = false; pcSheet.hidden = true;
  ghost.visible = false; ghostKey = ''; gridLines.visible = false;
  renderPcTime(); layoutFrame(); restHint();
  $('pc-snap').focus({ preventScroll: true });
}
function exitPostcard() {
  if (!pcMode) return;
  pcMode = false;
  appEl.classList.remove('pc'); pcBar.hidden = true; pcFrame.hidden = true; pcSheet.hidden = true;
  gridLines.visible = true; restHint();
  $('pc-btn').focus({ preventScroll: true });
}
async function snapPostcard() {
  ensureAudio(); noise(0.035, 3200, 0.12, 'bandpass'); setTimeout(() => noise(0.07, 1500, 0.09, 'bandpass'), 70);
  const crop = pcCrop(), W = canvas.clientWidth, H = canvas.clientHeight;
  const prevPR = renderer.getPixelRatio(), prevBump = townUniforms.uBump.value;
  // render once at print resolution: the long side of the photograph near 1600 pixels
  const pr = Math.max(prevPR, Math.min(3, 1600 / Math.max(crop.w, crop.h), Math.sqrt(9e6 / (W * H))));
  renderer.setPixelRatio(pr); updatePointScale(); townUniforms.uBump.value = 1;
  renderer.render(scene, camera);
  const k = renderer.getPixelRatio();
  const shot = document.createElement('canvas');
  shot.width = Math.round(crop.w * k); shot.height = Math.round(crop.h * k);
  shot.getContext('2d').drawImage(canvas, Math.round(crop.x * k), Math.round(crop.y * k), shot.width, shot.height, 0, 0, shot.width, shot.height);
  renderer.setPixelRatio(prevPR); updatePointScale(); townUniforms.uBump.value = prevBump;
  flashEl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => flashEl.classList.remove('on')));
  const card = await composePostcard(shot);
  pcBlob = await new Promise((res) => card.toBlob(res, 'image/jpeg', 0.92));
  if (!pcBlob) { flashHint('That picture did not develop', 'Try again'); return; }
  if (pcUrl) URL.revokeObjectURL(pcUrl);
  pcUrl = URL.createObjectURL(pcBlob);
  pcLink = FRAMED ? null : `${location.origin}${location.pathname}#${await encodeTown()}`;
  await showSheet();
  tipEvent('postcard');
}
// the card: cream stock, the photograph, a caption, a stamp and a postmark
async function composePostcard(photo) {
  try { await Promise.all([document.fonts.load('64px "IM Fell English SC"'), document.fonts.load('700 24px "Alegreya Sans"')]); } catch (e) { /* serif fallback */ }
  const pw = photo.width, ph = photo.height;
  const m = Math.round(Math.max(pw, ph) * 0.04), capH = Math.round(Math.max(ph * 0.17, m * 3.4));
  const W = pw + 2 * m, H = ph + m + capH;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const CARD = '#efe3c6';
  x.fillStyle = CARD; x.fillRect(0, 0, W, H);
  let seed = 1887; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0, n = (W * H) / 700; i < n; i++) { x.fillStyle = rnd() < 0.55 ? `rgba(120,88,48,${0.03 + rnd() * 0.06})` : `rgba(255,251,238,${0.05 + rnd() * 0.08})`; x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
  const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  vg.addColorStop(0, 'rgba(130,86,34,0)'); vg.addColorStop(1, 'rgba(130,86,34,0.24)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(92,62,32,.5)'; x.lineWidth = Math.max(1, m * 0.05); x.strokeRect(m * 0.4, m * 0.4, W - m * 0.8, H - m * 0.8);
  x.save(); x.shadowColor = 'rgba(40,24,8,.4)'; x.shadowBlur = m * 0.35; x.shadowOffsetY = m * 0.08; x.fillStyle = '#20160e'; x.fillRect(m, m, pw, ph); x.restore();
  x.drawImage(photo, m, m);
  x.strokeStyle = 'rgba(36,24,12,.85)'; x.lineWidth = Math.max(1, m * 0.035); x.strokeRect(m, m, pw, ph);
  // stamp, right of the caption
  const sh = capH * 0.7, sw = sh * 0.8, sx = W - m - sw, sy = m + ph + (capH - m * 0.4 - sh) / 2 + m * 0.1;
  x.save(); x.shadowColor = 'rgba(60,40,16,.25)'; x.shadowBlur = m * 0.15; x.fillStyle = '#fbf6e8'; x.fillRect(sx, sy, sw, sh); x.restore();
  const hole = sw * 0.045, gap = hole * 2.7; x.fillStyle = CARD;
  const dot = (px, py) => { x.beginPath(); x.arc(px, py, hole, 0, Math.PI * 2); x.fill(); };
  for (let px = sx + gap / 2; px < sx + sw; px += gap) { dot(px, sy); dot(px, sy + sh); }
  for (let py = sy + gap / 2; py < sy + sh; py += gap) { dot(sx, py); dot(sx + sw, py); }
  const ix = sx + sw * 0.11, iy = sy + sw * 0.11, iw = sw * 0.78, ih = sh - sw * 0.22;
  x.fillStyle = '#7b2a1c'; x.fillRect(ix, iy, iw, ih);
  x.strokeStyle = '#e3b85e'; x.lineWidth = Math.max(1, iw * 0.02); x.strokeRect(ix + iw * 0.05, iy + iw * 0.05, iw * 0.9, ih - iw * 0.1);
  drawGear(x, ix + iw / 2, iy + ih * 0.47, iw * 0.26, 12, '#e3b85e', '#7b2a1c');
  x.fillStyle = '#f3e2b8'; x.textAlign = 'center';
  x.font = `700 ${Math.round(iw * 0.13)}px "Alegreya Sans", sans-serif`; x.fillText('BRASSHAVEN', ix + iw / 2, iy + ih * 0.2, iw * 0.84);
  x.font = `${Math.round(iw * 0.2)}px "IM Fell English SC", Georgia, serif`; x.fillText('1d', ix + iw / 2, iy + ih * 0.9);
  // postmark over the stamp's left edge, cancellation lines across it
  const pr = sh * 0.4, pcx = sx - pr * 0.15, pcy = sy + sh * 0.5;
  x.strokeStyle = 'rgba(46,34,64,.62)'; x.fillStyle = 'rgba(46,34,64,.7)'; x.lineWidth = Math.max(1, pr * 0.06);
  x.beginPath(); x.arc(pcx, pcy, pr, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(pcx, pcy, pr * 0.66, 0, Math.PI * 2); x.stroke();
  x.font = `700 ${Math.round(pr * 0.22)}px "Alegreya Sans", sans-serif`;
  arcText(x, 'BRASSHAVEN', pcx, pcy, pr * 0.83, -Math.PI / 2, 2.3, 1);
  arcText(x, 'HARBOUR', pcx, pcy, pr * 0.83, Math.PI / 2, 1.6, -1);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  x.font = `700 ${Math.round(pr * 0.19)}px "Alegreya Sans", sans-serif`; x.textAlign = 'center';
  x.fillText(date, pcx, pcy + pr * 0.07, pr * 1.2);
  for (let j = 0; j < 4; j++) {
    const wy = pcy - pr * 0.45 + j * pr * 0.3;
    x.beginPath();
    for (let u = 0; u <= 1.001; u += 0.05) { const wx = pcx + pr * 1.05 + u * (sx + sw + m * 0.35 - pcx - pr * 1.05); const yy = wy + Math.sin(u * Math.PI * 4) * pr * 0.07; if (u === 0) x.moveTo(wx, yy); else x.lineTo(wx, yy); }
    x.stroke();
  }
  // caption
  const room = pcx - pr * 1.25 - m;
  const big = Math.round(capH * 0.29), small = Math.round(capH * 0.125);
  const base = m + ph + (capH - m * 0.4) * 0.5 + big * 0.18;
  x.textAlign = 'left'; x.fillStyle = '#3a2817';
  x.font = `${big}px "IM Fell English SC", Georgia, serif`; x.fillText('Greetings from Brasshaven', m * 1.05, base, room);
  x.fillStyle = '#80592f'; x.font = `700 ${small}px "Alegreya Sans", sans-serif`;
  if ('letterSpacing' in x) x.letterSpacing = `${Math.round(small * 0.14)}px`;
  x.fillText(`${shownName().toUpperCase()}  ·  ${TIMES[todIndex].name.toUpperCase()}`, m * 1.1, base + small * 1.75, room);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  return c;
}
function drawGear(x, cx, cy, r, n, col, hole) {
  x.beginPath();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, s = (Math.PI * 2) / n;
    const pts = [[r * 0.8, a - s * 0.3], [r, a - s * 0.15], [r, a + s * 0.15], [r * 0.8, a + s * 0.3]];
    pts.forEach(([rr, aa], j) => { const px = cx + rr * Math.cos(aa), py = cy + rr * Math.sin(aa); if (!k && !j) x.moveTo(px, py); else x.lineTo(px, py); });
  }
  x.closePath(); x.fillStyle = col; x.fill();
  x.fillStyle = hole;
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; x.beginPath(); x.arc(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48, r * 0.14, 0, Math.PI * 2); x.fill(); }
  x.beginPath(); x.arc(cx, cy, r * 0.12, 0, Math.PI * 2); x.fill();
}
function arcText(x, str, cx, cy, r, mid, span, dir) {
  const ch = [...str], n = ch.length;
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const a = mid + dir * (-span / 2 + (span * (i + 0.5)) / n);
    x.save(); x.translate(cx + r * Math.cos(a), cy + r * Math.sin(a)); x.rotate(a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2)); x.fillText(ch[i], 0, 0); x.restore();
  }
  x.restore();
}
const pcName = () => `brasshaven-postcard-${new Date().toISOString().slice(0, 10)}.jpg`;
async function showSheet() {
  $('pc-img').src = pcUrl;
  pcSheet.hidden = false; pcBar.hidden = true; pcFrame.hidden = true;
  const msg = $('pc-msg'); msg.className = 'msg'; msg.textContent = '';
  const dl = await getDownloads();
  let canShare = false;
  try { canShare = !FRAMED && !!navigator.canShare && navigator.canShare({ files: [new File([pcBlob], pcName(), { type: 'image/jpeg' })] }); } catch (e) { canShare = false; }
  const canSave = !!dl || !FRAMED;
  $('pc-share').hidden = !canShare; $('pc-save').hidden = !canSave;
  if (!canSave) msg.textContent = COARSE ? 'Press and hold the postcard to save it.' : 'Right-click the postcard to save it.';
  $(canSave ? 'pc-save' : 'pc-again').focus({ preventScroll: true });
}
function hideSheet() {
  pcSheet.hidden = true;
  if (pcMode) { pcBar.hidden = false; pcFrame.hidden = false; layoutFrame(); $('pc-snap').focus({ preventScroll: true }); }
}
$('pc-btn').addEventListener('click', () => { ensureAudio(); noteInput(); enterPostcard(); });
$('pc-cancel').addEventListener('click', exitPostcard);
$('pc-snap').addEventListener('click', () => { noteInput(); snapPostcard(); });
$('pc-time').addEventListener('click', () => { ensureAudio(); noteInput(); cycleTime(); });
$('pc-again').addEventListener('click', hideSheet);
$('pc-done').addEventListener('click', exitPostcard);
$('pc-save').addEventListener('click', async () => {
  const msg = $('pc-msg'); msg.className = 'msg';
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename: pcName(), data: pcBlob }); msg.textContent = 'Postcard saved.'; }
    catch (e) {
      const code = e && e.code;
      msg.textContent = code === 'declined' ? '' : code === 'rate_limited' ? 'A save is already waiting for your answer.' : COARSE ? 'Saving is not available here. Press and hold the postcard instead.' : 'Saving is not available here. Right-click the postcard instead.';
    }
    return;
  }
  const a = document.createElement('a'); a.href = pcUrl; a.download = pcName(); document.body.append(a); a.click(); a.remove();
  msg.textContent = 'Postcard saved to your downloads.';
});
$('pc-share').addEventListener('click', async () => {
  try { await navigator.share({ files: [new File([pcBlob], pcName(), { type: 'image/jpeg' })], title: 'Brasshaven', text: `Greetings from ${shownName()}${pcLink ? ' ' + pcLink : ''}` }); }
  catch (e) { /* the viewer closed the share sheet */ }
});

// ---------- first-run tips: one at a time, each done by doing it ----------
const TIPS = [
  { id: 'build', main: COARSE ? 'Tap the water to build a house' : 'Click the water to build a house', sub: 'Choose a material from the coins below' },
  { id: 'storey', main: COARSE ? 'Tap a roof to add a storey' : 'Click a roof to add a storey', sub: COARSE ? 'Tap a wall to build beside it; hold to remove' : 'Click a wall to build beside it; right-click removes' },
  { id: 'material', main: 'Try another material', sub: 'Each coin builds a different kind of house', beckon: () => $('palette') },
  { id: 'iron', main: 'Build in cast iron', sub: 'An iron house holds a steam engine that powers its neighbours', beckon: () => coins[M_IRON] },
  { id: 'key', main: 'Hold the key', sub: 'Winding it speeds up every machine in town', beckon: () => $('key-btn') },
  { id: 'time', main: 'Turn the dial to dusk', sub: 'Gaslight comes on after sundown', beckon: () => $('time-btn') },
  { id: 'postcard', main: 'Take a postcard', sub: 'Frame your harbour and keep the picture', beckon: () => $('pc-btn') },
];
// players from before the tips existed already know everything but the postcard
const tipsDone = new Set(store.get('tipsDone', null) || (hinted ? TIPS.slice(0, -1).map((t) => t.id) : []));
let tipsOn = store.get('tips', true), tipTimer = 0, beckoning = null;
function currentTip() { return tipsOn ? TIPS.find((t) => !tipsDone.has(t.id)) || null : null; }
function tipEvent(id) {
  if (tipsDone.has(id)) return;
  const was = currentTip();
  tipsDone.add(id); store.set('tipsDone', [...tipsDone]);
  if (was && was.id === id) { if (!hintFlashing) hideHint(); setBeckon(null); clearTimeout(tipTimer); tipTimer = setTimeout(restHint, 1400); }
}
function setBeckon(el) {
  if (beckoning === el) return;
  if (beckoning) beckoning.classList.remove('beckon');
  beckoning = el; if (el) el.classList.add('beckon');
}
function showTip(t) {
  hintEl.textContent = ''; hintEl.classList.add('tip');
  const st = document.createElement('span'); st.className = 'step'; st.textContent = 'Tip';
  const s = document.createElement('span'); s.textContent = t.sub;
  const xb = document.createElement('button'); xb.className = 'hint-x'; xb.type = 'button'; xb.textContent = '×'; xb.setAttribute('aria-label', 'Hide tips');
  xb.addEventListener('click', () => setTips(false));
  hintEl.append(st, document.createTextNode(t.main), s, xb);
  hintEl.classList.remove('gone');
}
function restHint() {
  if (hintFlashing) return;
  const t = pcMode ? null : currentTip();
  if (t) { showTip(t); setBeckon(t.beckon ? t.beckon() : null); }
  else { hideHint(); setBeckon(null); }
}
function setTips(on) {
  tipsOn = on; store.set('tips', on);
  if (on && !currentTip()) { tipsDone.clear(); store.set('tipsDone', []); }
  renderTips(); restHint();
}
function renderTips() { $('m-tips').setAttribute('aria-pressed', String(tipsOn)); $('m-tips-val').textContent = tipsOn ? 'On' : 'Off'; }
$('m-tips').addEventListener('click', () => setTips(!tipsOn));
renderTips();

// ---------- settings: volume, motion, the harbour's name ----------
const volIn = $('m-vol');
function renderVol() { volIn.value = String(volume); volIn.style.setProperty('--v', volume + '%'); }
volIn.addEventListener('input', () => { setVolume(+volIn.value); renderVol(); });
volIn.addEventListener('change', () => { ensureAudio(); plink(6, 0.7); });
renderVol();
function renderMotion() {
  $('mo-full').setAttribute('aria-pressed', String(!REDUCED)); $('mo-calm').setAttribute('aria-pressed', String(REDUCED));
  appEl.classList.toggle('calm', REDUCED);
}
for (const [id, calm] of [['mo-full', false], ['mo-calm', true]]) $(id).addEventListener('click', () => { REDUCED = calm; store.set('motion', calm ? 'calm' : 'full'); yawVel = 0; renderMotion(); });
renderMotion();
$('m-name').addEventListener('click', () => {
  for (const id of ['share-box', 'open-box', 'confirm']) $(id).hidden = true;
  const b = $('name-box'); b.hidden = !b.hidden;
  if (!b.hidden) { const i = $('name-in'); i.value = harbourName; i.focus(); i.select(); }
});
$('name-cancel').addEventListener('click', () => { $('name-box').hidden = true; });
function saveName() {
  const n = cleanName($('name-in').value);
  $('name-box').hidden = true;
  if (n === harbourName) return;
  commit([], [], [], [harbourName, n]);
  flashHint(shownName(), n ? 'Your harbour has a name. Shared towns carry it.' : 'Back to the harbour’s old number');
}
$('name-go').addEventListener('click', saveName);
$('name-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } else if (e.key === 'Escape') { e.preventDefault(); $('name-box').hidden = true; } });
