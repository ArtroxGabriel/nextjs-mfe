// Equal spacing: every request 600 ms after the previous one; odd = probe, even = cache hit (observed in probe-classification.log).
const [path = '/remote-app', n = '200', gap = '600'] = process.argv.slice(2);
const one = async (u) => { const t = performance.now(); const r = await fetch(u, { cache: 'no-store' }); await r.arrayBuffer(); return [performance.now() - t, r.status]; };
await new Promise((r) => setTimeout(r, 1500));
const P = [], Hh = [], st = {};
for (let i = 0; i < Number(n); i++) { const [d, s] = await one('http://localhost:3000' + path); (i % 2 === 0 ? P : Hh).push(d); st[s] = (st[s] || 0) + 1; await new Promise((r) => setTimeout(r, Number(gap))); }
const q = (a, x) => { const s = [...a].sort((p, c) => p - c); return +s[Math.min(s.length - 1, Math.floor(s.length * x))].toFixed(2); };
const sum = (a) => ({ n: a.length, p10: q(a, .1), p50: q(a, .5), p90: q(a, .9), p99: q(a, .99), max: q(a, 1) });
console.log(JSON.stringify({ label: 'equal-spacing', path, gapMs: +gap, statuses: st, probe: sum(P), hit: sum(Hh), p50diff: +(q(P, .5) - q(Hh, .5)).toFixed(2) }));
