# challenger_final_3 — final combined gate, iteration 3 (deb23f2; runtime = d335af5), model sonnet

Saved by the orchestrator from the agent's final report. Evidence in this directory; scripts reused verbatim from
`challenger_final_2/` with paths repointed.

`APPROVE`

Environment: 16 cores, Node 24.7.0, pnpm 11.22.0, load 1.4–7.4 (uncontrolled). Both apps rebuilt from deb23f2; `git diff
d335af5 deb23f2` over runtime paths empty.

## A. R1 closure
406 raw-TCP variants × 4 conditions: oracle sick zoneReached **0**; oracle healthy 122; zone up and zone down status500 = 2 (id
181 `GET *` pre-existing O1; id 385 `/500` the shell's own error page); zone-down tally identical to oracle-sick. All former
bypass targets (`/remote-app-static` all methods, `/remote-app/..`, `/remote-app/%2e%2e`, `/remote-app/../REMOTE-APP`,
`/remote-app-static/..`) → 503 shell page. `bypass-sustained-outage.log`: 6245 requests / 10 s / 10 workers, 0 bare 500,
780–781 × 503 per target, `/` 780 × 200.

## B. Regression
Strict smoke **17/17** (`smoke-strict.log`). Steady outage 30 workers × 12 s: 4557, any 500 = 0, p50 73.1 / p99 186.0 ms.
Mixed case 20 × 20 s: 14285, any500 = 0. Crash window SIGKILL sequential ×5: first 503 received 894.3/949.8/923.3/959.1/954.1
ms, 0 non-503 after; 30 workers ×3: last bare 500 received 965.6/1010.2/963.1 ms. Recovery ×3: 33–34 × 503 then 200s, host first
200 328–387 ms after zone direct 200. Cold cache 3/3 paths 503 text/html Retry-After 5. Hung zone n=3 (script run 3×): inside
cache window bare 500 after 30015–30041 ms; next request 503 after 811–815 ms — matches §5.1.

## C. D2 live
Zone page via :3000: app-header, layout-sidebar, side-navigation, toast-portal ×1; SSR user default admin (D3); nav anchors
`/`, `/remote-app`. 9 page assets, 13 zone and 14 host static files all 200; no cross-zone chunk references. Event names in both
apps' chunks: only `mfe:toast`, `mfe:session-change`, `mfe:map-select`; single source in shell-ui. `ƒ Middleware 35.3 kB`;
`.next/server/middleware.js` 106,747 B contains no shell-ui markers. Byte-identical files across zones 252,903 B uncompressed
(framework 139,833, polyfills 112,594, `_app` 399, `_ssgManifest` 77) — orchestrator note: polyfills are `nomodule` and not
fetched by modern browsers; challenger_final_1 measured ≈45 kB gzip actually re-downloaded.

## D. Over-blocking during outage
5797 requests / 8 s: 503 for `/%72emote-app`, `/remote%2dapp`, `/remote-app%2f`, `/remote-app-%73tatic`,
`/remote-app-static.json`, `/remote-app.json`; 404 for `/remote-app-staticx`, `/remote-app.html`, `/remote-apps`. Same shape as
challenger_m2_6 O3 (previously accepted), no new path. Non-blocking.

## Caveats
Uncontrolled load; hung zone n=3 by three invocations; no browser; 406 variants is a result, not an upper bound (no HTTP/2,
smuggling, proxy re-encoding); unit suites not re-run by this agent; duplicate-bytes single run. Ports freed, no tracked file
modified.
