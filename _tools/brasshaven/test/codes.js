async () => {
  const b = window.__brasshaven;
  const code = await b.encodeTown();
  const { c, mt } = await b.decodeTown('Here you go: https://example.org/brasshaven/#' + code + '  ');
  let same = true;
  for (let v = 0; v < b.V; v++) { if (c[v] !== b.cols[v]) same = false; for (let y = 0; y <= 12; y++) if ((c[v] >> y) & 1 && mt[v*16+y] !== b.mats[v*16+y]) same = false; }
  let bad = 'ok'; try { await b.decodeTown('BHzNOTREAL'); bad = 'accepted'; } catch (e) { bad = 'rejected'; }
  // share button fills the box
  document.getElementById('gear').click();
  document.getElementById('m-share').click();
  await new Promise(r => setTimeout(r, 600));
  const out = document.getElementById('share-out').value, msg = document.getElementById('share-msg').textContent;
  // migration: an M1 save loads as brick
  localStorage.removeItem('brasshaven:town2');
  return { codeLength: code.length, roundTrip: same, junk: bad, shareBoxHasCode: out.startsWith('BH') || out.includes('#BH'), msg, blocks: b.cellCount() };
}
