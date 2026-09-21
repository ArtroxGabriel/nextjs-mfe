// Pairs: sleep gapMs (> TTL, so A pays a synchronous probe), A, then B immediately (cache hit).
const [path = '/remote-app', n = '20', gapMs = '1100', label = ''] = process.argv.slice(2);
const H = 'http://localhost:3000';
const one = async () => { const t = performance.now(); const r = await fetch(H + path, { cache: 'no-store' }); await r.arrayBuffer(); return [performance.now() - t, r.status]; };
const A = [], B = [], st = {};
for (let i = 0; i < Number(n); i++) {
  await new Promise((r) => setTimeout(r, Number(gapMs)));
  const [a, sa] = await one(); const [b, sb] = await one();
  A.push(a); B.push(b); st[`${sa}/${sb}`] = (st[`${sa}/${sb}`] || 0) + 1;
}
const q = (arr, x) => { const s = [...arr].sort((p, c) => p - c); return +s[Math.min(s.length - 1, Math.floor(s.length * x))].toFixed(2); };
const d = A.map((a, i) => a - B[i]);
const summary = (arr) => ({ p10: q(arr, 0.1), p50: q(arr, 0.5), p90: q(arr, 0.9), max: q(arr, 1) });
console.error(JSON.stringify({ rawA: A.map((x) => +x.toFixed(1)), rawB: B.map((x) => +x.toFixed(1)) }));
console.log(JSON.stringify({ label, path, n: Number(n), gapMs: Number(gapMs), statuses: st, A_probe: summary(A), B_hit: summary(B), pairedDiff_A_minus_B: summary(d) }));
