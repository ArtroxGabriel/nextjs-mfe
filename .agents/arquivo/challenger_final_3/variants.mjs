// Sends every variant as raw HTTP/1.1 bytes (no client normalisation) to :3000.
// Usage: node variants.mjs <label> [oracle]   oracle => fetch stub /__events after each request.
import net from 'node:net';
import fs from 'node:fs';
const [label = 'run', oracle] = process.argv.slice(2);
const BUILD = fs.readFileSync('/home/wilson-castro/Documents/projects/mira/nextjs-mfe/apps/host/.next/BUILD_ID', 'utf8').trim();
const ZBUILD = fs.readFileSync('/home/wilson-castro/Documents/projects/mira/nextjs-mfe/apps/remote-app/.next/BUILD_ID', 'utf8').trim();
const CSS = '_next/static/css/e703f901bfad9e73.css';
const V = [];
const add = (method, target, headers = {}, body = null) => V.push({ method, target, headers, body });
// case variants x three prefixes x subpaths
const cases = {
  'remote-app': ['remote-app', 'REMOTE-APP', 'Remote-App', 'remotE-app', 'rEMOTE-APP', 'remote-APP', 'REMOTE-app', 'Remote-app'],
  'remote-app-static': ['remote-app-static', 'REMOTE-APP-STATIC', 'Remote-App-Static', 'remote-app-STATIC', 'remote-app-Static', 'REMOTE-APP-static', 'remote-App-static'],
};
const subs = { 'remote-app': ['', '/', '/api/health', '/_fragmento/demo/42', '/nao/existe', '/api/server-data'], 'remote-app-static': ['', '/', '/' + CSS, '/_next/static/chunks/nope.js'] };
for (const [base, list] of Object.entries(cases)) for (const p of list) for (const s of subs[base]) add('GET', '/' + p + s);
// subpath case (prefix lowercase)
add('GET', '/remote-app/API/HEALTH'); add('GET', '/remote-app/Api/health'); add('GET', '/remote-app-static/_NEXT/static/css/e703f901bfad9e73.css');
// percent-encoded letters, mixed case + encoding
for (const t of ['%72emote-app', '%52emote-app', '%52EMOTE-APP', '%52EMOTE-%41PP', 'remote%2dapp', 'remote%2Dapp', 'REMOTE%2DAPP', '%72%65%6d%6f%74%65%2d%61%70%70', '%52%45%4D%4F%54%45%2D%41%50%50', 'r%45mote-app', 'remote-%41pp', 'remote-app%2dstatic', 'remote-app-%53tatic', 'remote-app-%73tatic', '%2572emote-app', '%c1%b2emote-app', 'remote-app-%C5%BFtatic', '%EF%BC%B2EMOTE-APP']) {
  add('GET', '/' + t); add('GET', '/' + t + '/api/health');
  if (t.includes('static') || t.includes('tatic')) add('GET', '/' + t + '/' + CSS);
}
add('GET', '/remote-app/%61pi/health'); add('GET', '/remote-app/%41PI/health'); add('GET', '/%52EMOTE-APP-STATIC/' + CSS); add('GET', '/%72emote-app-static/' + CSS);
// slashes, dots, separators
for (const t of ['/remote-app/', '/remote-app//', '//remote-app', '///remote-app/api/health', '//REMOTE-APP', '/remote-app//api//health', '//remote-app-static/' + CSS, '/remote-app-static//' + CSS,
  '/remote-app/./api/health', '/remote-app/x/../api/health', '/x/../remote-app', '/X/../REMOTE-APP', '/./remote-app', '/%2e/remote-app', '/remote-app/%2e%2e/remote-app', '/REMOTE-APP/../remote-app', '/remote-app/../REMOTE-APP',
  '/remote-app%2fapi/health', '/remote-app%2Fapi%2Fhealth', '/%2fremote-app', '/%2FREMOTE-APP', '/remote-app\\api\\health', '/\\remote-app', '\\remote-app', '/remote-app%5capi/health', '/REMOTE-APP%5c',
  '/remote-app.json', '/remote-app.rsc', '/REMOTE-APP.json', '/remote-app;x', '/remote-app%3bx', '/remote-app%00', '/remote-app%20', '/remote-app%09', '/remote-app#frag', '/remote-app?x=1', '/REMOTE-APP?x=1',
  '/remote-app?__nextDataReq=1', '/remote-app?_rsc=1', '/remote-app/?__nextLocale=x', '/remote-app/index', '/remote-app/api/health/', '/remote-app/api/health.json',
  `/_next/data/${BUILD}/remote-app.json`, `/_next/data/${BUILD}/REMOTE-APP.json`, `/_next/data/${BUILD}/remote-app/api/health.json`, `/_next/data/${BUILD}/remote-app/index.json`, `/_next/data/${ZBUILD}/remote-app.json`,
  `/_next/data/x/remote-app.json`, `/_next/data/x/Remote-App.json`, `/remote-app/_next/data/${ZBUILD}/index.json`, `/remote-app/_next/data/${ZBUILD}/remote-app.json`, `/REMOTE-APP/_next/data/${ZBUILD}/index.json`,
  'http://localhost:3000/remote-app', 'http://localhost:3000/REMOTE-APP', 'http://localhost:3001/remote-app', 'remote-app', 'REMOTE-APP', '*']) add('GET', t);
// header tricks against middleware
const MW = 'middleware:middleware:middleware:middleware:middleware';
for (const [h, v] of [['x-middleware-subrequest', MW], ['x-middleware-subrequest', 'src/middleware:src/middleware:src/middleware:src/middleware:src/middleware'], ['x-middleware-subrequest', 'pages/_middleware'], ['x-nextjs-data', '1'], ['rsc', '1'], ['next-router-prefetch', '1'], ['x-middleware-prefetch', '1'], ['purpose', 'prefetch'], ['x-matched-path', '/erro-de-zona'], ['x-invoke-path', '/'], ['x-now-route-matches', '1'], ['x-forwarded-host', 'evil.example'], ['host', 'localhost:3001']]) {
  add('GET', '/remote-app', { [h]: v }); add('GET', '/remote-app/api/health', { [h]: v });
  if (h === 'x-nextjs-data') add('GET', `/_next/data/${BUILD}/remote-app.json`, { [h]: v });
}
// methods
for (const m of ['HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) for (const t of ['/remote-app', '/REMOTE-APP', '/remote-app/api/server-data', '/Remote-App/api/server-data', '/%52EMOTE-APP/api/server-data', '/remote-app-static/' + CSS]) add(m, t, m === 'HEAD' || m === 'OPTIONS' ? {} : { 'content-type': 'application/json' }, m === 'HEAD' || m === 'OPTIONS' ? null : '{}');
// final_1: guard-specific variants (pathname guard in middleware.ts vs matcher vs rewrite)
for (const t of ['/remote-app-static', '/remote-app-static?x=1', '/remote-app-static#f', '/remote-app-static.json', '/remote-app-static.rsc', '/remote-app-static;x', '/remote-app-static%2f' + CSS, '/remote-app-static%2F_next/static/css/e703f901bfad9e73.css',
  '/remote-app-staticX', '/remote-app-staticX/' + CSS, '/remote-app-static-x/' + CSS, '/remote-appX', '/remote-appX/api/health', '/remote-app-', '/remote-app-/api/health', '/remote-app_static/' + CSS,
  `/_next/data/${BUILD}/remote-app-static.json`, `/_next/data/${BUILD}/remote-app-static/x.json`, `/_next/data/x/remote-app-static.json`,
  '/remote-app-static/../remote-app', '/remote-app-static/%2e%2e/remote-app/api/health', '/remote-app/../remote-app-static', '/remote-app/%2e%2e/remote-app-static',
  '/remote-app/%2e%2e', '/remote-app/..', '/remote-app/%2e%2e/', '/remote-app-static/..', '/remote-app-static/%2e%2e',
  '/%2Fremote-app', '/%2Fremote-app-static', '//remote-app-static', '/remote-app-static//', '/remote-app?a=/remote-app/', '/remote-app-static?p=/remote-app/api/health',
  '/remote-app/api/health?x=1', '/remote-app-static/?x=1', '/remote-app/?x=1', '/remote-app/%3F', '/remote-app%3F/api/health', '/remote-app-static%3F', '/remote-app-static%23',
  '/remote-app%23/api/health', '/remote-app/%23']) add('GET', t);
for (const m of ['HEAD', 'POST', 'OPTIONS', 'PUT', 'DELETE']) for (const t of ['/remote-app-static', '/remote-app/', '/remote-app-static/', '/remote-app?x=1', '/remote-app/api/health']) add(m, t, m === 'HEAD' || m === 'OPTIONS' ? {} : { 'content-type': 'application/json' }, m === 'HEAD' || m === 'OPTIONS' ? null : '{}');
// controls
add('GET', '/'); add('GET', '/erro-de-zona'); add('GET', '/Erro-De-Zona');
// final_2 extension (ids >= 316): shell-owned look-alikes that could now be over-blocked after the guard removal,
// lower-case percent-encoded prefixes (challenger_m2_6 O3), dot segments that land on shell routes.
const BASE_N = V.length;
const HCSS = '_next/static/css/' + fs.readdirSync('/home/wilson-castro/Documents/projects/mira/nextjs-mfe/apps/host/.next/static/css')[0];
for (const t of ['/remote-apps', '/remote-apps/x', '/remote-apps/api/health', '/remote-appx', '/remote-app-staticx', '/remote-app-staticx/' + CSS, '/remote-app-statics', '/remote-app-static-x',
  '/remote-app.json', '/remote-app.html', '/remote-app.js', '/remote-app~', '/remote-app-static.json', '/remote-app-static.css', '/remote-app-static.js',
  `/_next/data/${BUILD}/remote-app.json`, `/_next/data/${BUILD}/remote-app/x.json`, `/_next/data/${BUILD}/remote-apps.json`, `/_next/data/${BUILD}/index.json`, `/_next/data/${BUILD}/erro-de-zona.json`,
  `/_next/data/${BUILD}/remote-app-static.json`, `/_next/data/${ZBUILD}/index.json`,
  '/%72emote-app', '/%72emote-app/', '/%72emote-app/api/health', '/%72emote-app/_fragmento/demo/42', '/remote%2dapp', '/remote%2dapp/api/health', '/remote%2Dapp', '/%72%65%6d%6f%74%65%2d%61%70%70',
  '/%72%65%6d%6f%74%65%2d%61%70%70/api/health', '/r%65mote-app', '/remote-%61pp', '/remote-ap%70', '/remote-app%2dstatic', '/remote-app%2dstatic/' + CSS, '/remote-app-%73tatic', '/remote-app-%73tatic/' + CSS,
  '/%72emote-app-static/' + CSS, '/remote-app-stati%63/' + CSS, '/remote-app%2Dstatic/' + CSS, '/remote-app%2f', '/remote-app%2F', '/remote-app%2fapi%2fhealth', '/remote-app-static%2f', '/%2fremote-app-static/' + CSS,
  '/remote-app%2e', '/remote-app%2ejson', '/remote-app%20/x', '/remote-app%09/api/health',
  '/remote-app/../', '/remote-app/../erro-de-zona', '/remote-app/%2e%2e/erro-de-zona', '/remote-app/..%2ferro-de-zona', '/remote-app%2f..%2ferro-de-zona', '/remote-app/../' + HCSS,
  '/remote-app-static/../erro-de-zona', '/remote-app-static/../' + HCSS, '/remote-app/.', '/remote-app/%2e', '/remote-app-static/.', '/remote-app-static/%2e',
  '/?x=/remote-app', '/erro-de-zona?next=/remote-app/api/health', '/' + HCSS, '/' + HCSS + '?remote-app', '/favicon.ico', '/_next/image?url=%2Fremote-app', '/404', '/500', '/_error', '/api/health', '/nao-existe',
  '/remote', '/remote-', '/remote-ap', '/REMOTE-APPS', '/%52emote-apps']) add('GET', t);
for (const m of ['HEAD', 'POST']) for (const t of ['/remote-apps', '/remote-app.json', '/%72emote-app', '/remote-app-staticx', `/_next/data/${BUILD}/remote-app.json`]) add(m, t, m === 'POST' ? { 'content-type': 'application/json' } : {}, m === 'POST' ? '{}' : null);
add('GET', `/_next/data/${BUILD}/remote-app.json`, { 'x-nextjs-data': '1' }); add('GET', `/_next/data/${BUILD}/index.json`, { 'x-nextjs-data': '1' });

function raw(v, id) {
  return new Promise((resolve) => {
    const s = net.connect(3000, '127.0.0.1');
    const hdrs = { host: 'localhost:3000', 'x-chal-id': String(id), connection: 'close', ...v.headers };
    if (v.body != null) hdrs['content-length'] = Buffer.byteLength(v.body);
    let req = `${v.method} ${v.target} HTTP/1.1\r\n` + Object.entries(hdrs).map(([k, x]) => `${k}: ${x}`).join('\r\n') + '\r\n\r\n' + (v.body ?? '');
    const chunks = []; const t = performance.now();
    const timer = setTimeout(() => { s.destroy(); resolve({ status: 'TIMEOUT', ms: performance.now() - t }); }, 10000);
    s.on('data', (c) => chunks.push(c));
    s.on('error', (e) => { clearTimeout(timer); resolve({ status: 'ERR ' + e.code, ms: performance.now() - t }); });
    s.on('close', () => {
      clearTimeout(timer);
      const buf = Buffer.concat(chunks).toString('latin1'); const i = buf.indexOf('\r\n\r\n');
      const head = buf.slice(0, i < 0 ? buf.length : i).split('\r\n'); const body = i < 0 ? '' : buf.slice(i + 4);
      const h = {}; for (const l of head.slice(1)) { const k = l.indexOf(':'); if (k > 0) h[l.slice(0, k).toLowerCase()] = l.slice(k + 1).trim(); }
      const status = Number((head[0] || '').split(' ')[1]) || ('NOSTATUS ' + head[0]);
      let mark = /ZONE-REACHED/.test(body) ? 'ZONE-REACHED' : /Zona indispon/i.test(body) ? 'shell-outage-page' : /This page could not be found|404/.test(body) && status === 404 ? 'shell-or-zone-404' : body.replace(/\s+/g, ' ').slice(0, 50);
      resolve({ status, ms: +(performance.now() - t).toFixed(1), ct: h['content-type'] ?? null, ra: h['retry-after'] ?? null, loc: h['location'] ?? null, zr: h['x-zone-reached'] ?? null, bodyLen: body.length, mark, hasScript: /<script/i.test(body) });
    });
    s.write(req);
  });
}
const out = [];
for (let id = 0; id < V.length; id++) {
  const r = await raw(V[id], id);
  let zoneSaw = null;
  if (oracle) { const ev = await fetch('http://localhost:3001/__events').then((x) => x.json()); zoneSaw = ev.filter((e) => e.id === String(id)).map((e) => `${e.method} ${e.url}`); if (!zoneSaw.length) zoneSaw = null; }
  const rec = { label, ext: id >= BASE_N, id, method: V[id].method, target: V[id].target, headers: Object.keys(V[id].headers).length ? V[id].headers : undefined, ...r, zoneSaw };
  out.push(rec); console.log(JSON.stringify(rec));
}
const tally = {}; for (const r of out) { const k = `${r.status} ${r.ct}`; tally[k] = (tally[k] || 0) + 1; }
console.error(JSON.stringify({ label, n: out.length, tally, status500: out.filter((r) => r.status === 500).length, zoneReached: out.filter((r) => r.zoneSaw || r.mark === 'ZONE-REACHED').length }));
