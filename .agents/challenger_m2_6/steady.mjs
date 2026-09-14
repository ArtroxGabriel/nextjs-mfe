import { portOpen } from './pm.mjs';
const H = 'http://localhost:3000';
const [durationMs = '12000', workers = '50'] = process.argv.slice(2);
if (await portOpen(3001)) { console.log('zone is UP; aborting'); process.exit(2); }
await new Promise((r) => setTimeout(r, 1500)); // > TTL since zone died
const CSS = '/remote-app-static/_next/static/css/7328242de7a8f19b.css';
const targets = [
  ['GET', '/remote-app'], ['GET', '/remote-app/'], ['GET', '/remote-app/api/health'],
  ['GET', '/remote-app/nao/existe/x'], ['GET', '/remote-app/_fragmento/demo/1'], ['GET', '/remote-app/api/sse-events'],
  ['GET', CSS], ['GET', '/remote-app-static/_next/static/chunks/nope.js'], ['HEAD', '/remote-app'],
  ['POST', '/remote-app/api/server-data'], ['GET', '/'], ['GET', '/erro-de-zona'],
];
const tally = {}; const lat = {}; let i = 0; const t0 = performance.now();
const worker = async () => {
  while (performance.now() - t0 < Number(durationMs)) {
    const [m, p] = targets[i++ % targets.length];
    const ts = performance.now();
    let key;
    try {
      const r = await fetch(H + p, { method: m, cache: 'no-store', ...(m === 'POST' ? { body: '{}', headers: { 'content-type': 'application/json' } } : {}) });
      const body = await r.text();
      const marker = /Zona indispon/.test(body) ? 'shell-outage-page' : body.slice(0, 25).replace(/\s+/g, ' ');
      key = `${m} ${p} -> ${r.status} ct=${r.headers.get('content-type')} retry-after=${r.headers.get('retry-after')} cc=${r.headers.get('cache-control')} body=${m === 'HEAD' ? '(head)' : marker}`;
    } catch (e) { key = `${m} ${p} -> ERR ${e.cause?.code || e.message}`; }
    tally[key] = (tally[key] || 0) + 1;
    (lat[p] ||= []).push(performance.now() - ts);
  }
};
await Promise.all(Array.from({ length: Number(workers) }, worker));
const total = Object.values(tally).reduce((a, b) => a + b, 0);
console.log(JSON.stringify({ durationMs: Number(durationMs), workers: Number(workers), total }, null, 0));
for (const [k, v] of Object.entries(tally).sort()) console.log(String(v).padStart(6), k);
const bare500 = Object.entries(tally).filter(([k]) => / -> 500 /.test(k)).reduce((a, [, v]) => a + v, 0);
console.log('bare/any 500 count:', bare500);
const all = Object.values(lat).flat().sort((a, b) => a - b); const q = (x) => all[Math.floor(all.length * x)].toFixed(1);
console.log(`latency all paths ms: p50=${q(0.5)} p95=${q(0.95)} p99=${q(0.99)} max=${all[all.length - 1].toFixed(1)}`);
