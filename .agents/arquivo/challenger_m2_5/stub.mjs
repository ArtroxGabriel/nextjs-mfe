// Counting stand-in for the zone on :3001 (used only to observe which host requests trigger a probe).
import http from 'node:http';
const events = [];
const srv = http.createServer((req, res) => {
  events.push([Math.round(performance.timeOrigin + performance.now()), req.url]);
  if (req.url === '/__events') { res.end(JSON.stringify(events.splice(0))); return; }
  if (req.url.startsWith('/remote-app/api/health')) { res.setHeader('content-type', 'application/json'); res.end('{"ok":true}'); return; }
  res.setHeader('content-type', 'text/plain'); res.end('stub:' + req.url);
});
srv.listen(3001, () => console.log('stub listening'));
