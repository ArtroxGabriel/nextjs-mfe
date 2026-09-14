import fs from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pgid = Number(fs.readFileSync(new URL('./pg/zone', import.meta.url), 'utf8'));
const H = 'http://localhost:3000';
const one = async (tag) => { const t = performance.now(); try { const r = await fetch(H + '/remote-app', { signal: AbortSignal.timeout(4000) }); await r.arrayBuffer(); return { t, dt: performance.now() - t, s: r.status }; } catch (e) { return { t, dt: performance.now() - t, s: e.name === 'TimeoutError' ? 'TIMEOUT4s' : 'ERR' }; } };
await sleep(1300);
const warm = await one();
const tStop = performance.now();
process.kill(-pgid, 'SIGSTOP');
const res = [];
await Promise.all(Array.from({ length: 10 }, async () => { while (performance.now() - tStop < 6000) { const r = await one(); r.at = r.t - tStop; res.push(r); } }));
process.kill(-pgid, 'SIGCONT');
const buckets = {};
for (const r of res) { const b = `${Math.floor(r.at / 1000)}s`; (buckets[b] ||= {}); buckets[b][r.s] = (buckets[b][r.s] || 0) + 1; }
const lat = (s) => { const d = res.filter((r) => r.s === s).map((r) => r.dt).sort((a, b) => a - b); return d.length ? { n: d.length, p50: +d[Math.floor(d.length / 2)].toFixed(0), p90: +d[Math.floor(d.length * .9)].toFixed(0), max: +d[d.length - 1].toFixed(0) } : null; };
console.log(JSON.stringify({ warm: warm.s, workers: 10, clientTimeoutMs: 4000, statusesBySendSecondAfterSIGSTOP: buckets, latency503: lat(503), latencyTimeout: lat('TIMEOUT4s'), latency500: lat(500), latency200: lat(200) }));
await sleep(1500);
const after = []; for (let i = 0; i < 10; i++) after.push((await one()).s);
console.log(JSON.stringify({ afterSIGCONT: after }));
