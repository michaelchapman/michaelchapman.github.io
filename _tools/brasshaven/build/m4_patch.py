import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # this _tools/brasshaven folder
p=os.path.join(ROOT, 'brasshaven.html'); s=open(p).read()
def rep(a, b, count=1):
    global s
    n = s.count(a)
    assert n == count, (n, a[:110])
    s = s.replace(a, b)

# ---------------- CSS ----------------
rep("@media (max-width:420px){", r"""#harbour-no{max-width:calc(100vw - 170px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.box input{box-sizing:border-box;width:100%;height:42px;padding:0 10px;border-radius:6px;border:1px solid rgba(198,154,75,.5);background:#15100c;color:var(--cream);font:600 15px var(--font-ui);-webkit-user-select:text;user-select:text}
.box input:focus-visible{outline:2px solid var(--brass-hi);outline-offset:1px}
.menu .seg input[type=range]{-webkit-appearance:none;appearance:none;width:148px;height:32px;margin:0 6px 0 0;background:transparent;cursor:pointer}
.menu .seg input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--brass) var(--v,70%),rgba(0,0,0,.42) var(--v,70%))}
.menu .seg input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--brass-hi),var(--brass) 55%,#6d5124);box-shadow:0 1px 2px rgba(0,0,0,.55)}
.menu .seg input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:rgba(0,0,0,.42)}
.menu .seg input[type=range]::-moz-range-progress{height:6px;border-radius:3px;background:var(--brass)}
.menu .seg input[type=range]::-moz-range-thumb{width:20px;height:20px;border:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--brass-hi),var(--brass) 55%,#6d5124)}
.menu .seg input[type=range]:focus-visible{outline:2px solid var(--brass-hi);outline-offset:2px}

/* tips: one at a time, the control it names glows */
.hint.tip{padding-right:26px}
.hint .step{display:block;margin-bottom:1px;font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--brass)}
.hint .hint-x{all:unset;pointer-events:auto;cursor:pointer;position:absolute;top:-11px;right:-11px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:17px;line-height:1;color:var(--cream);background:var(--panel);border:1px solid rgba(198,154,75,.65);box-shadow:0 2px 6px var(--shadow)}
.hint .hint-x:focus-visible{outline:2px solid var(--brass-hi)}
@keyframes beckon{0%,100%{box-shadow:0 0 0 0 rgba(239,207,134,0),0 8px 22px var(--shadow)}50%{box-shadow:0 0 0 7px rgba(239,207,134,.4),0 8px 22px var(--shadow)}}
@keyframes beckon-coin{0%,100%{outline:2px solid rgba(239,207,134,0);outline-offset:2px}50%{outline:2px solid rgba(239,207,134,.95);outline-offset:6px}}
.beckon{animation:beckon 1.8s ease-in-out infinite}
.coin.beckon{animation-name:beckon-coin}
#app.calm .beckon{animation:none;box-shadow:0 0 0 4px rgba(239,207,134,.5),0 8px 22px var(--shadow)}
#app.calm .coin.beckon{box-shadow:none;outline:2px solid var(--brass-hi);outline-offset:5px}

/* postcard mode: everything but the shutter bar steps aside; the frame shows what the card will hold */
#app.pc .brand,#app.pc .gear,#app.pc .side,#app.pc .menu,#app.pc .palette,#app.pc .dock,#app.pc .hint{display:none}
.pc-frame{position:absolute;pointer-events:none;box-shadow:0 0 0 100vmax rgba(18,11,5,.4);outline:1px solid rgba(243,229,198,.3)}
.pc-frame i{position:absolute;width:24px;height:24px;border:0 solid var(--cream)}
.pc-frame i:nth-child(1){left:-4px;top:-4px;border-width:3px 0 0 3px}
.pc-frame i:nth-child(2){right:-4px;top:-4px;border-width:3px 3px 0 0}
.pc-frame i:nth-child(3){left:-4px;bottom:-4px;border-width:0 0 3px 3px}
.pc-frame i:nth-child(4){right:-4px;bottom:-4px;border-width:0 3px 3px 0}
.pc-bar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 14px);display:flex;align-items:center;gap:10px;padding:7px 24px}
.pc-bar .txt{all:unset;box-sizing:border-box;cursor:pointer;min-width:84px;height:48px;padding:0 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-radius:8px;font-weight:800;font-size:12.5px;letter-spacing:.03em;color:var(--cream)}
.pc-bar .txt svg{width:22px;height:22px;color:var(--brass-hi)}
.pc-bar .txt:hover{background:rgba(239,207,134,.08)}
.shutter{all:unset;box-sizing:border-box;cursor:pointer;width:58px;height:58px;flex:none;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3cc,var(--brass) 55%,#6d5124);box-shadow:inset 0 0 0 5px rgba(31,24,19,.6),0 0 0 2px rgba(239,207,134,.75),0 2px 6px rgba(0,0,0,.5)}
.shutter:active{transform:scale(.95)}
.pc-bar .txt:focus-visible,.shutter:focus-visible{outline:2px solid var(--brass-hi);outline-offset:3px}
.flash{position:absolute;inset:0;background:#fffaf0;opacity:0;pointer-events:none;transition:opacity .6s ease-out}
.flash.on{opacity:.85;transition:none}
.pc-sheet{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100vw - 32px));max-height:calc(100% - 32px);overflow:auto;box-sizing:border-box;padding:12px;display:flex;flex-direction:column;gap:10px;z-index:7}
.pc-sheet img{display:block;width:100%;height:auto;max-height:min(64vh,600px);object-fit:contain;-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto}
.pc-sheet .row{flex-wrap:wrap}
.pc-sheet .box button{min-width:110px}
@media (max-height:460px){
  .side{flex-direction:row;top:calc(env(safe-area-inset-top,0px) + 12px);right:max(78px,calc(env(safe-area-inset-right,0px) + 74px))}
  .pc-sheet img{max-height:52vh}
}

@media (max-width:420px){""")

# ---------------- HTML ----------------
rep("""      <svg id="key-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12.6v8.4M12 20.6h2.6M12 17.8h2.2"/><path d="M12 12.6c-1.6 0-3.3-.7-4.5-2C6.2 9.2 6 7 7.2 5.8s3.4-1 4.8.6c1.4-1.6 3.6-1.8 4.8-.6s1 3.4-.3 4.8c-1.2 1.3-2.9 2-4.5 2z"/><circle cx="12" cy="9.2" r="1.1"/></svg>
    </button>
  </div>""", """      <svg id="key-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12.6v8.4M12 20.6h2.6M12 17.8h2.2"/><path d="M12 12.6c-1.6 0-3.3-.7-4.5-2C6.2 9.2 6 7 7.2 5.8s3.4-1 4.8.6c1.4-1.6 3.6-1.8 4.8-.6s1 3.4-.3 4.8c-1.2 1.3-2.9 2-4.5 2z"/><circle cx="12" cy="9.2" r="1.1"/></svg>
    </button>
    <button class="round plate" id="pc-btn" aria-label="Take a postcard">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.8 8h3.4l1.7-2.4h6.2L16.8 8h3.4v10.6H3.8z"/><circle cx="12" cy="13" r="3.3"/><path d="M17.4 10.4h.01"/></svg>
    </button>
  </div>""")
rep("""  <div class="hint" id="hint" role="status"></div>""", """  <div class="hint" id="hint" role="status"></div>

  <div class="pc-frame" id="pc-frame" hidden aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <div class="flash" id="flash" aria-hidden="true"></div>
  <div class="pc-bar plate riveted" id="pc-bar" hidden>
    <button class="txt" id="pc-cancel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg><span>Done</span></button>
    <button class="shutter" id="pc-snap" aria-label="Take the picture"></button>
    <button class="txt" id="pc-time" aria-label="Time of day"><svg id="pc-time-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg><span id="pc-cap">Golden hour</span></button>
  </div>
  <div class="pc-sheet plate" id="pc-sheet" role="dialog" aria-label="Your postcard" hidden>
    <img id="pc-img" alt="Postcard of your harbour">
    <div class="box">
      <p class="msg" id="pc-msg" role="status"></p>
      <div class="row"><button class="go" id="pc-save">Save postcard</button><button class="go" id="pc-share" hidden>Share</button><button class="no" id="pc-again">Take another</button><button class="no" id="pc-done">Done</button></div>
    </div>
  </div>""")
rep("""    <button class="item" id="m-sound" aria-pressed="true"><span>Sound</span><span class="val" id="m-sound-val">On</span></button>""",
"""    <button class="item" id="m-sound" aria-pressed="true"><span>Sound</span><span class="val" id="m-sound-val">On</span></button>
    <label class="seg"><span>Volume</span><input type="range" id="m-vol" min="0" max="100" step="5" value="70"></label>
    <div class="seg"><span>Motion</span><div role="group" aria-label="Motion">
      <button id="mo-full" aria-pressed="true">Full</button><button id="mo-calm" aria-pressed="false">Calm</button>
    </div></div>""")
rep("""    <div class="rule"></div>
    <button class="item" id="m-clear">""", """    <button class="item" id="m-tips" aria-pressed="true"><span>Tips</span><span class="val" id="m-tips-val">On</span></button>
    <button class="item" id="m-name"><span>Name your harbour</span></button>
    <div class="box" id="name-box" hidden>
      <label for="name-in">Harbour name</label>
      <input id="name-in" type="text" maxlength="28" autocomplete="off" spellcheck="false" placeholder="Harbour No. 1887">
      <div class="row"><button class="go" id="name-go">Save name</button><button class="no" id="name-cancel">Cancel</button></div>
    </div>
    <div class="rule"></div>
    <button class="item" id="m-clear">""")

# ---------------- motion and sound ----------------
rep("const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;",
    "let REDUCED = (() => { const m = store.get('motion', null); return m ? m === 'calm' : matchMedia('(prefers-reduced-motion: reduce)').matches; })();")
rep("""let actx = null, soundOn = store.get('sound', true);""", """let actx = null, soundOn = store.get('sound', true), master = null, volume = Math.max(0, Math.min(100, store.get('volume', 70) | 0));
const volGain = () => Math.pow(volume / 70, 1.7);
// every sound runs through one master gain so the volume setting applies to all of it
function bus() { if (!master) { master = actx.createGain(); master.gain.value = volGain(); master.connect(actx.destination); } return master; }
function setVolume(v) { volume = v; store.set('volume', v); if (master && actx) master.gain.setTargetAtTime(volGain(), actx.currentTime, 0.02); }""")
rep("  const out = actx.createGain(); out.connect(actx.destination);", "  const out = actx.createGain(); out.connect(bus());")
rep("  src.connect(fl); fl.connect(g2); g2.connect(actx.destination); src.start(t);", "  src.connect(fl); fl.connect(g2); g2.connect(bus()); src.start(t);")
rep("  o.connect(gn); gn.connect(actx.destination); o.start(t); o.stop(t + 0.26);", "  o.connect(gn); gn.connect(bus()); o.start(t); o.stop(t + 0.26);")

# ---------------- names travel with towns and undo ----------------
rep("""const undoStack = [], redoStack = [];
function applyEdit(adds, removes, paints) {""", """const undoStack = [], redoStack = [];
// the harbour's name is part of the town: saved, carried in town codes, undone like any edit
const NAME_MAX = 28;
function cleanName(t) { return String(t || '').replace(/[\\u0000-\\u001f\\u007f-\\u009f]/g, '').replace(/\\s+/g, ' ').trim().slice(0, NAME_MAX); }
let harbourName = cleanName(store.get('name', ''));
const shownName = () => harbourName || 'Harbour No. 1887';
function renderName() { $('harbour-no').textContent = shownName(); }
function setName(n) { harbourName = cleanName(n); store.set('name', harbourName); renderName(); }
function applyEdit(adds, removes, paints, names) {
  if (names) setName(names[1]);""")
rep("""function commit(adds, removes, paints = []) {
  if (!adds.length && !removes.length && !paints.length) return;
  removes = removes.map(([v, y]) => [v, y, M(v, y)]);
  applyEdit(adds, removes, paints);
  undoStack.push({ adds, removes, paints });""", """function commit(adds, removes, paints = [], names = null) {
  if (!adds.length && !removes.length && !paints.length && !names) return;
  removes = removes.map(([v, y]) => [v, y, M(v, y)]);
  applyEdit(adds, removes, paints, names);
  undoStack.push({ adds, removes, paints, names });""")
rep("function undo() { const e = undoStack.pop(); if (!e) return; applyEdit(e.removes, e.adds, flip(e.paints)); redoStack.push(e); updateUndoUI(); plink(2, 0.6); }",
    "function undo() { const e = undoStack.pop(); if (!e) return; applyEdit(e.removes, e.adds, flip(e.paints), e.names && [e.names[1], e.names[0]]); redoStack.push(e); updateUndoUI(); plink(2, 0.6); }")
rep("function redo() { const e = redoStack.pop(); if (!e) return; applyEdit(e.adds, e.removes, e.paints); undoStack.push(e); updateUndoUI(); plink(4, 0.6); }",
    "function redo() { const e = redoStack.pop(); if (!e) return; applyEdit(e.adds, e.removes, e.paints, e.names); undoStack.push(e); updateUndoUI(); plink(4, 0.6); }")
rep("""async function encodeTown() {
  const raw = packBytes();
  if ('CompressionStream' in window) { try { return 'BHz' + toB64(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* fall back to raw */ } }
  return 'BHr' + toB64(raw);
}""", """async function encodeTown() {
  const raw = packBytes();
  let code = null;
  if ('CompressionStream' in window) { try { code = 'BHz' + toB64(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* fall back to raw */ } }
  if (!code) code = 'BHr' + toB64(raw);
  return harbourName ? code + '.' + toB64(new TextEncoder().encode(harbourName)) : code;
}""")
rep("""  s = s.replace(/\\s+/g, '');
  if (!/^BH[zr][A-Za-z0-9_-]+$/.test(s)) throw new Error('format');
  let bytes = fromB64(s.slice(3));
  if (s[2] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return unpackBytes(bytes);
}""", """  s = s.replace(/\\s+/g, '');
  let name = '';
  const dot = s.indexOf('.');
  if (dot >= 0) { try { name = cleanName(new TextDecoder().decode(fromB64(s.slice(dot + 1)))); } catch (e) { name = ''; } s = s.slice(0, dot); }
  if (!/^BH[zr][A-Za-z0-9_-]+$/.test(s)) throw new Error('format');
  let bytes = fromB64(s.slice(3));
  if (s[2] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return { ...unpackBytes(bytes), name };
}""")
rep("""function replaceTown(c, mt) {
  const removes = [], adds = [];
  for (let v = 0; v < V; v++) for (let y = 0; y <= MAXL; y++) {
    if (F(v, y)) removes.push([v, y]);
    if ((c[v] >> y) & 1) adds.push([v, y, mt[v * 16 + y]]);
  }
  commit(adds, removes);
}""", """function replaceTown(c, mt, name) {
  const removes = [], adds = [];
  for (let v = 0; v < V; v++) for (let y = 0; y <= MAXL; y++) {
    if (F(v, y)) removes.push([v, y]);
    if ((c[v] >> y) & 1) adds.push([v, y, mt[v * 16 + y]]);
  }
  const n = cleanName(name);
  commit(adds, removes, [], name !== undefined && n !== harbourName ? [harbourName, n] : null);
}""")
rep("    const { c, mt } = await decodeTown($('code-in').value);\n    replaceTown(c, mt); recentre(); closeMenu(); plink(7);",
    "    const { c, mt, name } = await decodeTown($('code-in').value);\n    replaceTown(c, mt, name); recentre(); closeMenu(); plink(7);")
rep("decodeTown(location.hash).then(({ c, mt }) => { replaceTown(c, mt); recentre();", "decodeTown(location.hash).then(({ c, mt, name }) => { replaceTown(c, mt, name); recentre();")

# ---------------- acting: no building in postcard mode; tips advance by doing ----------------
rep("""function act(sx, sy, useTool, ptype = 'mouse') {
  let hit = pickAt(sx, sy);""", """function act(sx, sy, useTool, ptype = 'mouse') {
  if (pcMode) return false;
  let hit = pickAt(sx, sy);""")
rep("""  if (!hinted && plan.adds) { hinted = true; store.set('hinted', true); hideHint(); }""", """  if (plan.adds || plan.paints) {
    if (plan.adds) { tipEvent('build'); if (plan.y >= 2) tipEvent('storey'); }
    if (curMat !== M_BRICK) tipEvent('material');
    if (curMat === M_IRON) tipEvent('iron');
  }
  if (!hinted && plan.adds) { hinted = true; store.set('hinted', true); }""")
rep("""function doHover() {
  if (!hoverQueued) return;""", """function doHover() {
  if (pcMode) { hoverQueued = null; return; }
  if (!hoverQueued) return;""")

# ---------------- hints: flashes give way to the current tip ----------------
rep("function showHint(main, sub) { hintEl.textContent = '';", "function showHint(main, sub) { hintEl.classList.remove('tip'); hintEl.textContent = '';")
rep("function flashHint(msg, sub) { clearTimeout(hintTimer); showHint(msg, sub); hintTimer = setTimeout(hideHint, sub ? 2600 : 2200); }",
    "let hintFlashing = false;\nfunction flashHint(msg, sub) { clearTimeout(hintTimer); hintFlashing = true; showHint(msg, sub); hintTimer = setTimeout(() => { hintFlashing = false; restHint(); }, sub ? 2600 : 2200); }")
rep("  if (!hinted) showHint(COARSE ? 'Tap the water to build a house' : 'Click the water to build a house', 'Choose a material from the coins below');\n  else hideHint();",
    "  renderName();\n  restHint();")

# ---------------- time and key feed the tips ----------------
rep("""function cycleTime() {
  setTime(todIndex + 1); renderTime();""", """function cycleTime() {
  setTime(todIndex + 1); renderTime(); renderPcTime(); tipEvent('time');""")
rep("""  if (tension >= 1 && before < 1) plink(10, 0.3);
  hintWind();
}""", """  if (tension >= 1 && before < 1) plink(10, 0.3);
  hintWind(); tipEvent('key');
}""")
rep("""    if (tension > 0.1) hintWind();""", """    if (tension > 0.1) { hintWind(); tipEvent('key'); }""")
rep("""  if (label !== keyLabel) { keyLabel = label; keyBtn.setAttribute('aria-label', label); }
}
""", """  if (label !== keyLabel) { keyLabel = label; keyBtn.setAttribute('aria-label', label); }
}
""" + open(os.path.join(ROOT, 'build', 'm4.js')).read())

# hintWind: the tip already says it; keep the one-off explanation only when tips are off
rep("""function hintWind() {
  if (windHinted) return; windHinted = true;""", """function hintWind() {
  if (windHinted) return; windHinted = true;
  if (currentTip() && currentTip().id === 'key') return;""")

# ---------------- menu boxes, keys ----------------
rep("function closeMenu() { if (menu.hidden) return; menu.hidden = true; gear.setAttribute('aria-expanded', 'false'); for (const id of ['confirm', 'share-box', 'open-box']) $(id).hidden = true; }",
    "function closeMenu() { if (menu.hidden) return; menu.hidden = true; gear.setAttribute('aria-expanded', 'false'); for (const id of ['confirm', 'share-box', 'open-box', 'name-box']) $(id).hidden = true; }")
rep("gear.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; gear.setAttribute('aria-expanded', String(open)); for (const id of ['confirm', 'share-box', 'open-box']) $(id).hidden = true; });",
    "gear.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; gear.setAttribute('aria-expanded', String(open)); for (const id of ['confirm', 'share-box', 'open-box', 'name-box']) $(id).hidden = true; });")
rep("""  else if (k === 't') cycleTime();
  else if (k === 'k') addTension(0.2);
  else if (k === 'escape') closeMenu();""", """  else if (k === 't') cycleTime();
  else if (k === 'k') addTension(0.2);
  else if (k === 'c') { if (!pcMode) enterPostcard(); }
  else if (k === 'escape') { if (!pcSheet.hidden) hideSheet(); else if (pcMode) exitPostcard(); else closeMenu(); }""")
rep("""Hold the key to wind every machine faster; the dial above it changes the time of day.'""",
    """Hold the key to wind every machine faster; the dial above it changes the time of day, and the camera takes a postcard of your harbour.'""")
rep("""Hold the key (K) to wind every machine faster; the dial above it (T) changes the time of day.'""",
    """Hold the key (K) to wind every machine faster; the dial above it (T) changes the time of day, and the camera (C) takes a postcard of your harbour.'""")

# ---------------- quality tiers ----------------
rep("""function instanced(geo, mat, n, shadow) {
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.frustumCulled = false; im.castShadow = !!shadow; im.receiveShadow = true;""", """// shadow: 'big' parts always cast; 'small' ones only at high detail
const castsFor = (shadow, t) => shadow === 'big' || (shadow === 'small' && t === 'high');
function instanced(geo, mat, n, shadow) {
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.frustumCulled = false; im.userData.shadow = shadow; im.castShadow = castsFor(shadow, tier); im.receiveShadow = true;""")
rep("const im = instanced(gearGeos[n], brassMat, these.length, true);", "const im = instanced(gearGeos[n], brassMat, these.length, 'small');")
rep("const fw = instanced(flyGeo, redMat, n, true), rod = instanced(rodGeo, steelMat, n, true),", "const fw = instanced(flyGeo, redMat, n, 'big'), rod = instanced(rodGeo, steelMat, n, 'small'),")
rep("const im = instanced(wheelGeo, wheelMat, wheelList.length, true);", "const im = instanced(wheelGeo, wheelMat, wheelList.length, 'big');")
rep("  const want = 1 + (cellCount >= 60 ? 1 : 0) + (mastPos ? 1 : 0);", "  const want = Math.min(tier === 'high' ? 3 : 1, 1 + (cellCount >= 60 ? 1 : 0) + (mastPos ? 1 : 0));")
rep("""function applyTier(t) {
  tier = t;
  const dpr = Math.min(window.devicePixelRatio || 1, t === 'high' ? 2 : 1.25);""", """// high, low, and an automatic last step below low that drops shadows
function applyTier(t) {
  tier = t;
  const dpr = Math.min(window.devicePixelRatio || 1, t === 'high' ? 2 : t === 'low' ? 1.25 : 1);""")
rep("  pCap = t === 'high' ? PMAX : 500; if (pN > pCap) pN = pCap;", """  pCap = t === 'high' ? PMAX : t === 'low' ? 500 : 250; if (pN > pCap) pN = pCap;
  if (sun.castShadow !== (t !== 'lowest')) { sun.castShadow = t !== 'lowest'; for (const m of [townMat, waterMat, brassMat, steelMat, redMat, wheelMat, handMat]) m.needsUpdate = true; }
  for (const im of dynMeshes) im.castShadow = castsFor(im.userData.shadow, t);
  syncShips();""")
rep("""    if (quality === 'auto' && tier === 'high' && now > perfStart && !document.hidden) {""", """    if (quality === 'auto' && tier !== 'lowest' && now > perfStart && !document.hidden && !pcMode) {""")
rep("        if (sorted[45] > 0.031) applyTier('low');", "        if (sorted[45] > (tier === 'high' ? 0.031 : 0.04)) applyTier(tier === 'high' ? 'low' : 'lowest');")

# ---------------- point scale helper and resize ----------------
rep("""  camera.aspect = w / h; camera.updateProjectionMatrix();
  const sc = (renderer.getPixelRatio() * h) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  steamMat.uniforms.uScale.value = haloMat.uniforms.uScale.value = sc;
  steamMat.uniforms.uMax.value = haloMat.uniforms.uMax.value = Math.max(64, renderer.getPixelRatio() * h * 0.3);
}""", """  camera.aspect = w / h; camera.updateProjectionMatrix();
  updatePointScale();
  if (pcMode) layoutFrame();
}
// steam and halo points are sized in world units, so they follow the drawing buffer's height
function updatePointScale() {
  const h = canvas.clientHeight || window.innerHeight, pr = renderer.getPixelRatio();
  steamMat.uniforms.uScale.value = haloMat.uniforms.uScale.value = (pr * h) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  steamMat.uniforms.uMax.value = haloMat.uniforms.uMax.value = Math.max(64, pr * h * 0.3);
}""")

# ---------------- debug hooks ----------------
rep("winding: () => winding,", "winding: () => winding, enterPostcard, exitPostcard, snapPostcard, pcBlob: () => pcBlob, tips: () => ({ on: tipsOn, done: [...tipsDone], current: currentTip() && currentTip().id }), tipEvent, setTips, harbourName: () => harbourName, tier: () => tier, applyTier, volume: () => volume, motion: () => REDUCED, cleanShot: () => { renderer.render(scene, camera); return canvas.toDataURL('image/jpeg', 0.9); },")
rep("""   Brasshaven, milestone 3: the town is a machine. Engine houses and
   mill wheels power districts of clockwork; steam, gaslight, airships.""", """   Brasshaven, milestone 4: polish and launch. Postcards, first-run tips,
   settings and quality tiers on top of milestone 3's working town.""")
open(p, 'w').write(s)
print('m4 patch ok')
