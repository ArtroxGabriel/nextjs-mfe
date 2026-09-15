// Oracle stand-in for the zone on :3001. mode=sick: health 503 (middleware must answer every matched request itself).
// mode=healthy: health 200. Every non-probe request is logged with its x-chal-id and answered with a ZONE-REACHED marker.
import http from 'node:http';
const mode = process.argv[2] || 'sick';
const events = [];
http.createServer((req, res) => {
  if (req.url === '/__events') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(events.splice(0))); return; }
  const id = req.headers['x-chal-id'] || null;
  events.push({ t: Date.now(), method: req.method, url: req.url, id, xfh: req.headers['x-forwarded-host'] || null, ua: req.headers['user-agent'] || null });
  if (!id && req.url.startsWith('/remote-app/api/health')) {
    res.statusCode = mode === 'sick' ? 503 : 200; res.setHeader('content-type', 'application/json'); res.end(mode === 'sick' ? '{"ok":false}' : '{"ok":true}'); return;
  }
  res.setHeader('content-type', 'text/plain'); res.setHeader('x-zone-reached', '1'); res.end('ZONE-REACHED ' + req.method + ' ' + req.url);
}).listen(3001, () => console.log('oracle stub ' + mode));
