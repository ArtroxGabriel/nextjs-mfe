import { start, stop, portOpen } from './pm.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const runs = Number(process.argv[2] || 3);
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); await r.arrayBuffer(); return r.status; } catch (e) { return 'ERR'; } };
for (let run = 1; run <= runs; run++) {
  if (await portOpen(3001)) await stop('zone', 'SIGKILL');
  await sleep(1500);
  const pre = await get('http://localhost:3000/remote-app');
  const t0 = performance.now();
  const startP = start('zone', { waitReady: false });
  let zoneOk = null, hostOk = null, done = false, zoneOkSent = null, hostOkRecv = null, portAt = null; const hostSeq = [];
  const pollPort = (async () => { while (!(await portOpen(3001))) await sleep(2); portAt = performance.now() - t0; })();
  const pollZone = (async () => { while (!zoneOk) { const zs = performance.now() - t0; if ((await get('http://localhost:3001/remote-app/api/health')) === 200) { zoneOk = performance.now() - t0; zoneOkSent = zs; } else await sleep(10); } })();
  const pollHost = (async () => { while (!hostOk && performance.now() - t0 < 15000) { const ts = performance.now() - t0; const s = await get('http://localhost:3000/remote-app'); hostSeq.push([+ts.toFixed(0), s, +(performance.now() - t0).toFixed(0)]); if (s === 200) { hostOk = ts; hostOkRecv = performance.now() - t0; } else await sleep(25); } })();
  await Promise.all([pollZone, pollHost, startP, pollPort]);
  const tally = hostSeq.reduce((m, [, s]) => ((m[s] = (m[s] || 0) + 1), m), {});
  const after = []; for (let i = 0; i < 20; i++) after.push(await get('http://localhost:3000/remote-app'));
  console.log(JSON.stringify({ run, preStatus: pre, zonePortOpenAtMs: +portAt.toFixed(0), zoneDirect200SentAtMs: +zoneOkSent.toFixed(0), zoneDirect200RecvAtMs: +zoneOk.toFixed(0), hostFirst200RecvAtMs: hostOkRecv && +hostOkRecv.toFixed(0), hostFirst200SentAtMs: hostOk && +hostOk.toFixed(0), hostRecvMinusZoneRecvMs: hostOk && +(hostOkRecv - zoneOk).toFixed(0), lastHostNon200SentAfterPortOpenMs: (() => { const b = hostSeq.filter(([, s]) => s !== 200); return b.length ? b[b.length-1][0] - +portAt.toFixed(0) : null; })(), hostStatusesDuringRecovery: tally, last3: hostSeq.slice(-3), next20: [...new Set(after)] }));
}
