import { portOpen } from './pm.mjs';
if (await portOpen(3001)) { console.log('zone UP, abort'); process.exit(2); }
const [dur = '20000', workers = '20'] = process.argv.slice(2);
const CSS = '/_next/static/css/e703f901bfad9e73.css';
const T = [['GET','/REMOTE-APP'],['GET','/Remote-App/api/health'],['GET','/REMOTE-APP-STATIC'+CSS],['GET','/remote-APP/nao/existe'],['GET','/%52EMOTE-APP'],['GET','/%52emote-app/api/health'],['POST','/Remote-App/api/server-data'],['HEAD','/REMOTE-APP'],['GET','/remote-app-STATIC'+CSS],['GET','/_next/data/x/Remote-App.json'],
  ['GET','/remote-app'],['GET','/remote-app/api/health'],['GET','/remote-app-static'+CSS],['GET','/%72emote-app']];
const tally = {}; const lat = []; let i = 0; const t0 = performance.now();
await Promise.all(Array.from({ length: +workers }, async () => {
  while (performance.now() - t0 < +dur) {
    const [m, p] = T[i++ % T.length]; const ts = performance.now();
    let k; try { const r = await fetch('http://localhost:3000' + p, { method: m, redirect: 'manual', ...(m === 'POST' ? { body: '{}' } : {}) }); await r.arrayBuffer(); k = `${m} ${p} -> ${r.status} ${r.headers.get('content-type')} ra=${r.headers.get('retry-after')}`; } catch (e) { k = `${m} ${p} -> ERR ${e.cause?.code || e.message}`; }
    tally[k] = (tally[k] || 0) + 1; lat.push(performance.now() - ts);
  }
}));
for (const [k, v] of Object.entries(tally).sort()) console.log(String(v).padStart(6), k);
lat.sort((a, b) => a - b); const q = (x) => lat[Math.floor(lat.length * x)].toFixed(1);
console.log(`total=${lat.length} dur=${dur}ms workers=${workers} any500=${Object.entries(tally).filter(([k]) => / -> 500 /.test(k)).reduce((a, [, v]) => a + v, 0)} p50=${q(.5)} p95=${q(.95)} p99=${q(.99)} max=${lat.at(-1).toFixed(1)}`);
