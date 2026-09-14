import { start, stop, portOpen } from './pm.mjs';
const paths = ['/remote-app', '/remote-app/api/health', '/remote-app-static/_next/static/css/7328242de7a8f19b.css'];
if (await portOpen(3001)) { console.log('zone up; abort'); process.exit(2); }
for (const p of paths) {
  console.log(JSON.stringify({ stopHost: await stop('host', 'SIGKILL') }));
  const s = await start('host', { waitReady: false });
  const t0 = performance.now();
  while (!(await portOpen(3000))) await new Promise((r) => setTimeout(r, 2));
  const tOpen = performance.now() - t0;
  const ts = performance.now();
  const r = await fetch('http://localhost:3000' + p);
  const body = await r.text();
  const first = { path: p, portOpenAfterSpawnMs: +tOpen.toFixed(1), latencyMs: +(performance.now() - ts).toFixed(1), status: r.status, ct: r.headers.get('content-type'), retryAfter: r.headers.get('retry-after'), shellPage: /Zona indispon/.test(body) };
  const r2 = await fetch('http://localhost:3000' + p); await r2.text();
  console.log(JSON.stringify({ first, second: r2.status, hostLog: s.logPath.split('/').pop() }));
}
