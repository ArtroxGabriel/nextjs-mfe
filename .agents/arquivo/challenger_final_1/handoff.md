# challenger_final_1 — final combined gate (M2 it. 6 + M3 + D2), code 90e8319

Saved by the orchestrator from the agent's final report. Evidence files in this directory.

`REQUEST_CHANGES` — one blocking M2 regression introduced by the merge (guard from 01f35d4). D2 works as a
feature, no blocking finding. D1/D7 unchanged.

Environment: 16 cores, Node 24.7.0, Next 15.5.24, both apps rebuilt from 90e8319; load 0.4 → 4.7 peak (30-worker
kills) → 0.34; reviewer_final_1 active in parallel.

## I. M2/M3 on the merged tree
### R1 (BLOCKING) — pathname guard skips the liveness check on paths matcher and rewrite both handle
`apps/host/middleware.ts` guard accepts `=== '/remote-app' || startsWith('/remote-app/') ||
startsWith('/remote-app-static/')` on the normalised `nextUrl.pathname`.
(a) bare `/remote-app-static`: matcher and rewrite `:path*` match zero segments; guard needs the trailing slash.
(b) dot segments: matcher/rewrite see the raw path, guard sees the normalised one (`/remote-app/..` → `/`,
`/remote-app/../REMOTE-APP` → `/REMOTE-APP`).
Oracle stub sick (`variants.mjs`, `variants-oracle-sick.jsonl`), 316 raw-TCP variants (248 from challenger_m2_6 +
68 new): 18 reached the zone — `/remote-app-static` (GET/HEAD/POST/OPTIONS/PUT/DELETE, `?x=1`, `#f`,
`?p=/remote-app/api/health`, `/_next/data/<build>/remote-app-static.json`), `/remote-app/../remote-app-static`,
`/remote-app/%2e%2e/remote-app-static`, `/remote-app/..`, `/remote-app/%2e%2e`, `/remote-app-static/..`,
`/remote-app-static/%2e%2e`, `/remote-app/../REMOTE-APP`.
Real zone down (`variants-zone-down.jsonl`): the same 18 → `500`, no content-type, `Internal Server Error`.
Sustained (`bypass-sustained.mjs`, `bypass-sustained-outage.log`): 10 workers × 10 s, 6 bypass targets 331/331 ×
bare 500 each (1986); same run `/remote-app` 330 × 503, `/` 330 × 200. Not bounded by TTL.
Regression proof (`oracle-diff.log`): on 94ccdc2 (no guard) `GET /remote-app-static` and `/remote-app/../REMOTE-APP`
were 503 in sick and zone-down runs; now zone-reached / 500. Other 16 are new variants. `guard-repro.log`: pure logic
false for all 6 raw shapes. Host 39/39 and smoke 17/17 do not send these paths. Class (a) browser-reachable; (b)
needs a non-browser client.
Repro: `curl -si http://localhost:3000/remote-app-static` (zone down) → 500; `curl -si --path-as-is
http://localhost:3000/remote-app/..` → 500; control `/remote-app-static/x` → 503.
Side effect (improvement): challenger_m2_6 O3 over-blocking gone — 15 encoded lower-case variants now shell 404.
`GET *` 500 text/plain pre-existing (O1).
Fix: remove the guard (matcher already limits middleware; 94ccdc2 had 0 bypasses in 248) or accept everything the
matcher accepts; behavioural tests for `/remote-app-static` and `/remote-app/..` in middleware.test.ts; online smoke
check with zone down.

### Declared vs observed
- §5.1 "duas exceções limitadas": false on 90e8319 (R1 is a third, unbounded) — fix the code.
- Crash window sequential, 5 kills: last bare 500 sent 910.6/934.8/938.1/943.6/940.4 ms; first 503 received
  950.8/943.0/948.1/951.9/948.6 ms (two runs 0.8–1.9 ms above 950 — negligible); 122/228/219/320/203 bare 500s
  before (doc's 79–190 is rate-dependent, optional).
- 30 clients: last bare 500 sent 927.9/931.7/942.2 ms — within 826–1010.
- Hung zone n=1: 30028 ms then bare 500; next 813 ms then 503 — matches.
- Cold cache: 3/3 503 text/html Retry-After 5, second also 503 — matches.

### Measurements
Strict smoke 17/17 (`smoke-strict.log`). Zone-up regression (`regress.log`): shell and zone routes, fragment 200/204,
10 zone assets byte-equal to direct, 11 shell assets, SSE streams. Steady outage 30 × 12 s (`steady-outage-c30.log`):
7305 requests, all zone targets 503 + Retry-After + no-store, `/` and `/erro-de-zona` 608 × 200, 0 × 500; p50 45.1,
p99 108.4 ms. Mixed case 20 × 20 s (`sustained-case-outage.log`): 20532, any500 0, variants shell 404. Variant sweep
316 × 4 conditions: 106 reach zone when healthy, 18 bypass when sick. Crash window 8 kills: 0 non-503 after first 503;
30-worker first 503 at 1036.3/996.1/1009.6 ms. Recovery 3 runs (`recovery.jsonl`): 33 × 503 then 200, 0 × 500.

## II. D2 (packages/shell-ui around the zone page)
No blocking finding; no markup/attribute injection from `localStorage['host_user_session']` (`ssr-session.cjs`,
`ssr-session.jsonl`: real sources, TS 5.9.3, react-dom/server 18.3.1, effect run once in render; served chunk has the
same logic, `zone-index-chunk.js`). All XSS payloads escaped.
- **D2-1 (not blocking)** non-string rendered field (`userName`/`role` object, `$$typeof`) throws `Objects are not
  valid as a React child` on zone AND host (shared key; persists until cleared); JSON `null` throws on host
  (`saved.userId` outside try, pre-existing since 1ffbdbd). Browser outcome likely Next client error page — not run.
- **D2-2 (not blocking)** chrome structurally identical (1 × app-header, layout-sidebar, side-navigation,
  toast-portal) but visually not: host globals.css redefines 13 shell-ui selectors + `:root` (`.layout-main` 2rem +
  max-width 1100px vs 2.5rem; `.nav-icon` 1.15 vs 1.25rem; `.nav-title`; `.nav-description`; `.nav-badge-*`;
  `.toast-card` animation; `--border-color` #1f2937 vs #334155; `--bg-color` #030712 vs #0f172a)
  (`css-effective.log`, `css-analysis.log`). "100% identical" is false.
- **D2-3 (note)** standalone :3001 side-nav `/` → 404 (basePath); via :3000 both links 200 with chrome
  (`d2.jsonl`). challenger_d2_1 has no Observation 8 (only 1–4).
- **D2-4 (D3, deferred)** SSR always renders DEFAULT_SESSION (Ana Souza, Admin) on :3000/remote-app and :3001; stored
  user appears only after the effect; no hydration mismatch.
Measurements (`d2.mjs`, `d2.jsonl`): chrome present, 2 plain `<a>`, active class correct on both pages; 9 zone assets
all `/remote-app-static/...` 200 via :3000, all 13 zone and 14 host static files 200; 0 cross-zone chunk references;
one stylesheet per page. Duplicate download on first cross-zone navigation ≈45.4 kB gzip identical bytes (framework
44,928 B; polyfills nomodule not fetched) (`dup-transfer.log`).

## III. Deferred
D1: 1 client aborted at 3286 ms → CONNECTED 1, DISCONNECTED 0, broadcasts continue — unchanged. D7 n=1 unchanged.

## Caveats
No browser (hydration, client error page, visual diffs, toasts not executed). No patched host built (no edits
allowed) — R1 fix effect inferred. Dot-segment variants other than `/remote-app/../REMOTE-APP` not measured on
94ccdc2 (inferred from matcher regex). 316 variants is a result, not an upper bound (no HTTP/2, smuggling, reverse
proxy re-encoding). Small samples: 8 kills, hung n=1, SSE n=1. Probe overhead not re-measured.

## Housekeeping
Ports free before and after (`ports-after.log`), all process groups stopped, SIGSTOPped zone SIGCONTed first. No
tracked file changed (`git-status-after.log`). `.next` directories hold the rebuild from the same tree.
