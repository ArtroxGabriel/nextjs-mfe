const H = 'http://localhost:3000', Z = 'http://localhost:3001';
const get = async (u, o = {}) => { const t = performance.now(); const r = await fetch(u, { redirect: 'manual', ...o }); const b = Buffer.from(await r.arrayBuffer()); return { s: r.status, ct: r.headers.get('content-type'), len: b.length, ms: +(performance.now() - t).toFixed(1), body: b.toString('utf8') }; };
const out = (k, r, extra = {}) => console.log(JSON.stringify({ k, s: r.s, ct: r.ct, len: r.len, ms: r.ms, ...extra }));
await new Promise((r) => setTimeout(r, 1200));
for (const p of ['/', '/erro-de-zona']) { const r = await get(H + p); out(p, r, { outagePageText: /Zona indispon/.test(r.body) }); }
const zi = await get(H + '/remote-app'); const zd = await get(Z + '/remote-app');
out('/remote-app via host', zi, { sameLenAsDirect: zi.len === zd.len, directLen: zd.len });
const z404 = await get(H + '/remote-app/nao/existe'); out('/remote-app/nao/existe via host', z404, { hasZoneAssetPrefix: z404.body.includes('/remote-app-static/') });
const h = await get(H + '/remote-app/api/health'); out('/remote-app/api/health', h, { body: h.body });
const f = await get(H + '/remote-app/_fragmento/demo/42'); out('/remote-app/_fragmento/demo/42', f, { hasScript: /<script/i.test(f.body), body: f.body.slice(0, 160) });
const fu = await get(H + '/remote-app/_fragmento/unknown/1'); out('/remote-app/_fragmento/unknown/1', fu, { bodyLen: fu.len });
const sd = await get(H + '/remote-app/api/server-data'); out('/remote-app/api/server-data', sd);
// every static asset referenced by the zone page and the shell page, fetched through the host
const refs = new Set(); for (const b of [zi.body, z404.body]) for (const m of b.matchAll(/(?:href|src)="(\/remote-app-static\/[^"]+)"/g)) refs.add(m[1]);
const shellRefs = new Set(); for (const b of [(await get(H + '/')).body, (await get(H + '/erro-de-zona')).body]) for (const m of b.matchAll(/(?:href|src)="(\/_next\/[^"]+)"/g)) shellRefs.add(m[1]);
const tally = {}; for (const u of [...refs, ...shellRefs]) { const r = await get(H + u); const d = u.startsWith('/remote-app-static') ? await get(Z + u) : null; const k = `${u.startsWith('/remote-app-static') ? 'zone' : 'shell'} ${r.s} ${r.ct}${d ? ' bytesEqualDirect=' + (d.body === r.body) : ''}`; tally[k] = (tally[k] || 0) + 1; }
console.log(JSON.stringify({ k: 'static assets', zoneRefs: refs.size, shellRefs: shellRefs.size, tally }));
// SSE through the rewrite: time to headers, connected event, first two data events
const ac = new AbortController(); const t0 = performance.now();
const r = await fetch(H + '/remote-app/api/sse-events', { signal: ac.signal });
const tHdr = performance.now() - t0; const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = ''; const ev = [];
while (ev.length < 3) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value); let i; while ((i = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2); ev.push([+(performance.now() - t0).toFixed(0), chunk.split('\n')[0].slice(0, 30)]); } }
ac.abort();
console.log(JSON.stringify({ k: 'SSE via host', s: r.status, ct: r.headers.get('content-type'), headersMs: +tHdr.toFixed(0), events: ev }));
