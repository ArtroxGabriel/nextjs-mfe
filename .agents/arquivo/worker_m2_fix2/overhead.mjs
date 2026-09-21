const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function timed(url) {
  const t = performance.now();
  const res = await fetch(url, { cache: 'no-store' });
  await res.arrayBuffer();
  return { ms: performance.now() - t, status: res.status };
}
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const summary = (name, rs) => console.log(`${name}: n=${rs.length} statuses=${[...new Set(rs.map(r=>r.status))]} p50=${pct(rs.map(r=>r.ms),0.5).toFixed(2)}ms p90=${pct(rs.map(r=>r.ms),0.9).toFixed(2)}ms`);
const path = '/remote-app/api/health';
for (let i = 0; i < 20; i++) { await timed('http://localhost:3001' + path); await timed('http://localhost:3000' + path); }
const direct = []; for (let i = 0; i < 200; i++) direct.push(await timed('http://localhost:3001' + path));
const hostTight = []; for (let i = 0; i < 200; i++) hostTight.push(await timed('http://localhost:3000' + path));
const hostProbe = []; for (let i = 0; i < 20; i++) { await sleep(1100); hostProbe.push(await timed('http://localhost:3000' + path)); }
const hostControl = []; for (let i = 0; i < 20; i++) { await sleep(1100); await timed('http://localhost:3000' + path); hostControl.push(await timed('http://localhost:3000' + path)); }
summary('direct zone :3001', direct);
summary('via host, tight loop (cache mostly warm)', hostTight);
summary('via host, 1.1s apart (every request pays a synchronous probe)', hostProbe);
summary('via host, 2nd request right after a probe (cache hit, same spacing)', hostControl);
