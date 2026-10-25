// A minimal in-memory Nostr relay for the two-player test: forwards each event to matching subscriptions.
// Trystero only needs EVENT, REQ (kinds, #x and since filters), CLOSE, OK and EOSE.
const { WebSocketServer } = require('ws');
module.exports = function relay(port) {
  const wss = new WebSocketServer({ host: '127.0.0.1', port });
  const subs = new Map();   // socket -> Map(subId -> filters)
  const match = (ev, f) => (!f.kinds || f.kinds.includes(ev.kind)) && (!f.since || ev.created_at >= f.since - 5) &&
    Object.keys(f).filter(k => k[0] === '#').every(k => ev.tags.some(t => t[0] === k.slice(1) && f[k].includes(t[1])));
  wss.on('connection', ws => {
    subs.set(ws, new Map());
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m[0] === 'EVENT') {
        const ev = m[1];
        ws.send(JSON.stringify(['OK', ev.id, true, '']));
        for (const [s, ss] of subs) for (const [id, fs] of ss) if (fs.some(f => match(ev, f)) && s.readyState === 1) s.send(JSON.stringify(['EVENT', id, ev]));
      } else if (m[0] === 'REQ') { subs.get(ws).set(m[1], m.slice(2)); ws.send(JSON.stringify(['EOSE', m[1]])); }
      else if (m[0] === 'CLOSE') subs.get(ws).delete(m[1]);
    });
    ws.on('close', () => subs.delete(ws));
  });
  return wss;
};
