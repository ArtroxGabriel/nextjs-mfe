const [url, n = '200'] = process.argv.slice(2); const d = [];
for (let i = 0; i < +n; i++) { const t = performance.now(); const r = await fetch(url); await r.arrayBuffer(); d.push(performance.now() - t); }
d.sort((a, b) => a - b); const q = (x) => +d[Math.min(d.length - 1, Math.floor(d.length * x))].toFixed(2);
console.log(JSON.stringify({ url, n: +n, p50: q(.5), p90: q(.9), p99: q(.99), max: q(1) }));
