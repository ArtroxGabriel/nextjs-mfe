import { start, killNow, portOpen } from './pm.mjs';
const H = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [signal = 'SIGKILL', runs = '5', workers = '1', path = '/remote-app'] = process.argv.slice(2);

async function one(url) {
  const t = performance.now();
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const body = await r.text();
    return { t, dt: performance.now() - t, s: r.status, ct: r.headers.get('content-type'), ra: r.headers.get('retry-after'), body: body.slice(0, 40) };
  } catch (e) { return { t, dt: performance.now() - t, s: 'ERR:' + (e.cause?.code || e.message) }; }
}

for (let run = 1; run <= Number(runs); run++) {
  if (!(await portOpen(3001))) await start('zone');
  await sleep(1300); // let the cache expire so the warm request pays a synchronous probe
  const warm = await one(H + path);
  const warmEnd = warm.t + warm.dt;
  const kill = killNow('zone', signal);
  const results = [];
  let first503 = null;
  let stopAt = Infinity;
  const worker = async () => {
    while (performance.now() < stopAt && performance.now() - kill.t < 6000) {
      const r = await one(H + path);
      r.at = r.t - kill.t;
      results.push(r);
      if (r.s === 503 && !first503) { first503 = r; stopAt = performance.now() + 500; }
    }
  };
  await Promise.all(Array.from({ length: Number(workers) }, worker));
  results.sort((a, b) => a.t - b.t);
  const before = results.filter((r) => r.t < first503?.t);
  const after = results.filter((r) => first503 && r.t >= first503.t);
  const tally = (arr) => arr.reduce((m, r) => ((m[r.s] = (m[r.s] || 0) + 1), m), {});
  const non503Before = before.filter((r) => r.s !== 503);
  const sample500 = before.find((r) => r.s === 500);
  // Latest *start* time of a request that still got a non-503 (i.e. was dispatched on stale cache)
  const lastBad = non503Before.length ? non503Before[non503Before.length - 1] : null;
  const lateBad = after.filter((r) => r.s !== 503);
  console.log(JSON.stringify({
    run, signal, workers: Number(workers), path, warmStatus: warm.s,
    killAfterWarmEndMs: +(kill.t - warmEnd).toFixed(2),
    first503SentAtMs: first503 ? +first503.at.toFixed(1) : null,
    first503ReceivedAtMs: first503 ? +(first503.at + first503.dt).toFixed(1) : null,
    first503: first503 && { ct: first503.ct, ra: first503.ra },
    requestsBeforeFirst503: before.length, statusesBefore: tally(before),
    lastNon503SentAtMs: lastBad ? +lastBad.at.toFixed(1) : null,
    lastBare500ReceivedAtMs: (() => { const b = results.filter((r) => r.s !== 503); return b.length ? +Math.max(...b.map((r) => r.at + r.dt)).toFixed(1) : null; })(),
    totalNon503: results.filter((r) => r.s !== 503).length,
    latencyMsP50P95Max: (() => { const d = results.map((r) => r.dt).sort((a, b) => a - b); return [d[Math.floor(d.length*0.5)], d[Math.floor(d.length*0.95)], d[d.length-1]].map((x) => +x.toFixed(1)); })(),
    statusesInNext500ms: tally(after), non503AfterFirst503: lateBad.length,
    sample500: sample500 && { ct: sample500.ct, body: sample500.body },
  }));
}
