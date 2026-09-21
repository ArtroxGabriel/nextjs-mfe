import fs from 'node:fs';
const pgid = Number(fs.readFileSync(new URL('./pg/zone', import.meta.url), 'utf8'));
await new Promise((r) => setTimeout(r, 1300));
const w = await fetch('http://localhost:3000/remote-app'); await w.arrayBuffer();
process.kill(-pgid, 'SIGSTOP');
const t = performance.now();
let out;
try { const r = await fetch('http://localhost:3000/remote-app', { signal: AbortSignal.timeout(45000) }); const b = await r.text(); out = { status: r.status, ct: r.headers.get('content-type'), body: b.slice(0, 40) }; }
catch (e) { out = { error: e.name }; }
out.elapsedMs = +(performance.now() - t).toFixed(0);
const t2 = performance.now(); const r2 = await fetch('http://localhost:3000/remote-app'); await r2.arrayBuffer();
process.kill(-pgid, 'SIGCONT');
console.log(JSON.stringify({ warm: w.status, stalePathRequest: out, nextRequestWhileStopped: { status: r2.status, ms: +(performance.now() - t2).toFixed(0) } }));
