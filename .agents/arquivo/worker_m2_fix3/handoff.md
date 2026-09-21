# worker_m2_fix3 — M2 remediation 3 (gate iteration 5)

**Verdict: DONE.** Controller session, 2026-09-14. Addresses the iteration 4 gate: reviewer_m2_5 F1/F2,
challenger_m2_5 A1 and D-a..D-e, and auditor_m2_4's non-blocking survivors A17/A20/A32.

## Changes
| Finding | Change |
|---|---|
| challenger A1 — `/REMOTE-APP` etc. bypass middleware, bare 500 all outage | `apps/host/next.config.js`: `experimental.caseSensitiveRoutes: true`. Rewrites now match case like the middleware matcher. Test first: `rewrites.test.ts` "routes match case-sensitively…" failed, then passed. |
| reviewer F1 — module-load fetch in the page not caught | `erro-de-zona-page.test.ts` stubs `fetch` *before* importing the page and asserts 0 calls in "loading the page module does not touch the network". |
| reviewer F1 — effect-time fetch | **Declared residue**: react-dom/server never runs effects and there is no DOM renderer without a new dependency. Stated in the test file's header. M6 survives (below). |
| reviewer F2 / challenger D-a..D-e — §5.1 wording | §5.1 rewritten: case-sensitive routes; crash window now 871–940 ms over 11 sequential kills (3 worker + 8 challenger), 79–190 requests, concurrent boundary 826–1010 ms; 2.96 s attributed to the previous iteration; new hung-zone paragraph (30 s Next proxy timeout in the window, 815–817 ms probe timeout after it); overhead 3–6 ms over five paired series, same with the zone crashed; 7 probes for 30 clients over 6 s. |
| auditor A20 — probe timeout untested | `ZONE_PROBE_TIMEOUT_MS = 800` exported; middleware test with a `fetch` that never answers must get 503 in < 1.5 s (test timeout 5 s). |
| auditor A17 — env precedence / hardcoded origin | middleware tests clear and restore `REMOTE_ZONE_URL`/`REMOTE_APP_URL`; new test: probe uses `REMOTE_ZONE_URL`, then `REMOTE_APP_URL`. |
| auditor A32 — `includes('')` | copy tests assert the shared text is non-empty. |

Hung zone: documented, not changed. Lowering Next's `experimental.proxyTimeout` would also cut long
responses such as SSE through the rewrite; that trade-off is recorded in DEFERRED.md (D7).

## Falsification (`mutate5.py`, scratch copy, `mut5.txt`)
control 32/32 · M1 matcher 31 · M2 inverted branch 26 · M3 infinite TTL 30 · M4 bare 500 27 · M5 page copy 31 ·
M15 module-load fetch 31 · A20 timeout 60 s → silent-zone test times out · A17 swapped precedence 31 ·
A32 empty hint 31 · TTL 3000 30 · **M6 effect-time fetch 32/32 (declared residue)**.
Removing `caseSensitiveRoutes` is the RED run of the new rewrites test (6/7).

## Live (`case-up.txt`, `case-down.txt`), host rebuilt, `routes-manifest.json` caseSensitive true
- zone up: `/remote-app` 200, `/remote-app/api/health` 200 json, `/remote-app/_fragmento/demo/42` 200,
  lowercase static CSS 200; `/REMOTE-APP`, `/Remote-App/api/health`, `/REMOTE-APP-STATIC/...css`,
  `/remote-APP/nao/existe`, `/Erro-De-Zona` → shell 404 text/html; `/` and `/erro-de-zona` 200.
- zone killed > 1 s: all lowercase zone paths 503 text/html; case variants 100/100 → 404 (no 500).
- `node scripts/smoke-test.mjs --strict` from the repo root: 16/16. Ports freed.

## Found for M3
- `test/e2e/static-invariants.mjs` resolves paths from `process.cwd()`: run from `apps/host`, STATIC-02/03/05/06/07
  fail (11/16). Resolve the root from `import.meta.url`.

## Verification
apps/host `node --test test/*.test.ts` 33/33; `tsc --noEmit` clean; `next build` clean.
