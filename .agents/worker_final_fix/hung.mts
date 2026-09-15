import { createZoneLivenessCache, createFetchProbe } from '../../apps/host/lib/zoneLiveness.ts';
globalThis.fetch = ((_i: any, init?: RequestInit) => new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('abort'))))) as any;
const cache = createZoneLivenessCache({ probe: createFetchProbe('http://hung/remote-app/api/health', 800), ttlMs: 1000 });
const waits: number[] = []; const pend: Promise<void>[] = [];
const start = performance.now();
while (performance.now() - start < 9000) {
  const t = performance.now();
  pend.push(cache.isHealthy().then(() => { waits.push(performance.now() - t); }));
  await new Promise(r => setTimeout(r, 20));
}
await Promise.all(pend);
const slow = waits.filter(w => w > 100); const s = [...slow].sort((a,b)=>a-b);
console.log(JSON.stringify({ n: waits.length, slowOver100: slow.length, share: +(slow.length/waits.length).toFixed(2), medianSlowMs: Math.round(s[s.length>>1]), meanAllMs: Math.round(waits.reduce((a,b)=>a+b,0)/waits.length), maxMs: Math.round(Math.max(...waits)) }));
