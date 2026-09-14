const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
await fetch('http://localhost:3001/__events').then((r) => r.json());
const t0 = Date.now(); let n = 0; const st = {};
await Promise.all(Array.from({ length: 30 }, async () => { while (Date.now() - t0 < 6000) { const r = await fetch('http://localhost:3000/remote-app/x', { headers: { 'x-chal-id': 'pc' } }); await r.arrayBuffer(); n++; st[r.status] = (st[r.status] || 0) + 1; } }));
const ev = await fetch('http://localhost:3001/__events').then((r) => r.json());
const probes = ev.filter((e) => !e.id && e.url.startsWith('/remote-app/api/health')).map((e) => e.t - t0);
console.log(JSON.stringify({ workers: 30, durationMs: 6000, hostRequests: n, statuses: st, proxiedSeenByStub: ev.filter((e) => e.id).length, healthProbes: probes.length, probeTimesMs: probes, gapsMs: probes.slice(1).map((t, i) => t - probes[i]) }));
