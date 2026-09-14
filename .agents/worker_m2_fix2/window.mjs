// Warm the host's liveness cache with a healthy probe, kill the zone at once,
// then poll /remote-app tightly until the first 503.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pgid = process.argv[2];
await sleep(1200); // make sure the next request forces a fresh, healthy probe
const warm = await fetch('http://localhost:3000/remote-app', { cache: 'no-store' });
await warm.arrayBuffer();
const tWarm = performance.now();
process.kill(-Number(pgid), 'SIGTERM');
const tKill = performance.now();
const samples = [];
let first503 = null, sample500 = null;
while (performance.now() - tKill < 4000) {
  const t = performance.now();
  const res = await fetch('http://localhost:3000/remote-app', { cache: 'no-store' });
  const body = await res.text();
  samples.push({ at: t - tKill, status: res.status });
  if (res.status === 500 && !sample500) sample500 = { ct: res.headers.get('content-type'), body };
  if (res.status === 503) { first503 = { at: t - tKill, retryAfter: res.headers.get('retry-after'), ct: res.headers.get('content-type') }; break; }
}
const bad = samples.filter((s) => s.status !== 503);
console.log(JSON.stringify({
  warmStatus: warm.status, killGapMs: +(tKill - tWarm).toFixed(1),
  requestsBeforeFirst503: bad.length, statusesBefore503: [...new Set(bad.map((s) => s.status))],
  lastBadAtMs: bad.length ? +bad.at(-1).at.toFixed(0) : null,
  first503AtMs: first503 && +first503.at.toFixed(0), first503,
  sample500,
}));
