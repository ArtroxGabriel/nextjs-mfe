const H = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const req = async (tag, path) => { const t = Date.now(); const r = await fetch(H + path + '?tag=' + tag); await r.text(); log.push([t, tag, r.status]); };
await fetch('http://localhost:3001/__events').then((r) => r.json());
// Pattern 1 (worker's): gap 1100, A then B immediately
for (let i = 0; i < 5; i++) { await sleep(1100); await req('P1A' + i, '/remote-app/x'); await req('P1B' + i, '/remote-app/x'); }
await sleep(1500);
// Pattern 2: equal spacing 600 ms
for (let i = 0; i < 10; i++) { await req('P2-' + i, '/remote-app/x'); await sleep(600); }
const ev = await fetch('http://localhost:3001/__events').then((r) => r.json());
// For each proxied request (by tag), was a health probe seen between the previous proxied request and this one?
let lines = [], sawProbe = false;
for (const [t, url] of ev) {
  if (url.startsWith('/remote-app/api/health')) { sawProbe = true; continue; }
  const tag = new URL('http://x' + url).searchParams.get('tag');
  if (tag) { lines.push(`${tag}: probe=${sawProbe}`); sawProbe = false; }
}
console.log(lines.join('\n'));
