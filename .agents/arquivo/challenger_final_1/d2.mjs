import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe';
const H = 'http://localhost:3000', Z = 'http://localhost:3001';
const get = async (u) => { const r = await fetch(u, { redirect: 'manual', cache: 'no-store' }); const b = Buffer.from(await r.arrayBuffer()); return { s: r.status, ct: r.headers.get('content-type'), loc: r.headers.get('location'), len: b.length, sha: crypto.createHash('sha256').update(b).digest('hex').slice(0, 16), body: b.toString('utf8') }; };
const log = (o) => console.log(JSON.stringify(o));
const pages = { zoneViaHost: H + '/remote-app', hostRoot: H + '/', zoneDirect: Z + '/remote-app', zoneDirectRoot: Z + '/', hostZoneDown: null };
const html = {};
for (const [k, u] of Object.entries(pages)) { if (!u) continue; const r = await get(u); html[k] = r.body;
  const nav = (r.body.match(/<nav class="side-navigation"[\s\S]*?<\/nav>/) || [''])[0];
  const navAnchors = [...nav.matchAll(/<a ([^>]*)>/g)].map((m) => m[1].match(/href="([^"]*)"/)?.[1]);
  const refs = [...r.body.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((x) => x.startsWith('/') && !navAnchors.includes(x) && x !== '/remote-app');
  const nd = r.body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/); const nextData = nd ? JSON.parse(nd[1]) : null;
  log({ page: k, url: u, status: r.s, ct: r.ct, len: r.len,
    appHeader: (r.body.match(/class="app-header"/g) || []).length, layoutSidebar: (r.body.match(/class="layout-sidebar"/g) || []).length, sideNav: (r.body.match(/class="side-navigation"/g) || []).length,
    toastPortal: (r.body.match(/class="toast-portal"/g) || []).length, sessionBanner: /data-testid="remote-active-session"/.test(r.body), ssrUser: (r.body.match(/User: <strong>([^<]*)<\/strong>/) || [])[1] ?? null,
    selectValue: (r.body.match(/<option[^>]*selected[^>]*>([^<]*)/) || [])[1] ?? null,
    navAnchors, navHasNonAnchorLinks: /<button[^>]*nav-link/.test(nav), activeNav: [...nav.matchAll(/class="nav-link ([^"]*)"/g)].map((m) => m[1]),
    assetRefs: refs, nextDataAssetPrefix: nextData?.assetPrefix, nextDataPage: nextData?.page, nextDataBuildId: nextData?.buildId });
}
// Fetch every asset referenced from the zone page via host, and from host root via host; record cross-prefix refs
const assetSets = {};
for (const [k, base] of [['zoneViaHost', H], ['hostRoot', H], ['zoneDirect', Z]]) {
  const refs = [...new Set([...html[k].matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((x) => x.startsWith('/_next') || x.startsWith('/remote-app-static') || x.endsWith('.ico')))];
  const res = [];
  for (const u of refs) { const r = await get(base + u); res.push({ u, s: r.s, ct: r.ct, len: r.len, sha: r.sha }); }
  assetSets[k] = res;
  log({ assetsOf: k, via: base, n: res.length, non200: res.filter((x) => x.s !== 200), crossZone: k === 'zoneViaHost' || k === 'zoneDirect' ? res.filter((x) => !x.u.startsWith('/remote-app-static')).map((x) => x.u) : res.filter((x) => x.u.startsWith('/remote-app-static')).map((x) => x.u), totalBytes: res.reduce((a, x) => a + x.len, 0), list: res.map((x) => `${x.s} ${x.len} ${x.sha} ${x.u}`) });
}
// Every static file the zone build produced, through host; plus the build manifest chunks
for (const [app, prefix] of [['remote-app', '/remote-app-static/_next/static'], ['host', '/_next/static']]) {
  const dir = path.join(ROOT, 'apps', app, '.next/static'); const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(path.relative(dir, p)); } };
  walk(dir);
  const tally = {}; const bad = [];
  for (const f of files) { const r = await get(H + prefix + '/' + f); const k = String(r.s); tally[k] = (tally[k] || 0) + 1; if (r.s !== 200) bad.push(`${r.s} ${f}`); }
  log({ everyBuiltStaticFileViaHost: app, n: files.length, tally, bad });
}
// Byte-identical assets downloaded under both prefixes (a browser caches by URL, so these are fetched twice)
const hostBy = new Map(assetSets.hostRoot.map((x) => [x.sha, x])); const dup = assetSets.zoneViaHost.filter((x) => hostBy.has(x.sha)).map((x) => ({ zone: x.u, host: hostBy.get(x.sha).u, bytes: x.len }));
log({ byteIdenticalAcrossZones: dup, dupBytes: dup.reduce((a, x) => a + x.bytes, 0), zonePageAssetBytes: assetSets.zoneViaHost.reduce((a, x) => a + x.len, 0), hostPageAssetBytes: assetSets.hostRoot.reduce((a, x) => a + x.len, 0) });
// nav link targets
for (const [base, hrefs] of [[H, ['/', '/remote-app']], [Z, ['/', '/remote-app']]]) for (const h of hrefs) { const r = await get(base + h); log({ navTarget: base + h, status: r.s, ct: r.ct, loc: r.loc, hasChrome: /class="app-header"/.test(r.body), notFound: /404|could not be found/i.test(r.body) && r.s === 404 }); }
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'zone-via-host.html'), html.zoneViaHost);
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'host-root.html'), html.hostRoot);
