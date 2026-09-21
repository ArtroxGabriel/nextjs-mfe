# worker_m2_fix4 — M2 remediation 4 (gate iteration 6)

**Verdict: DONE.** Controller session, 2026-09-14. Addresses gate iteration 5: reviewer_m2_6 F1–F6,
challenger_m2_6 D-1/D-2 (verdict APPROVE), auditor_m2_5 F-1..F-6 (verdict CLEAN).

| Finding | Change |
|---|---|
| reviewer F1 (blocking) — hung-zone cost read as one-off | §5.1: while the zone stays hung every cache expiry repeats the 800 ms wait; ≈40% of a continuous stream. Reproduced independently: `hung-sim.txt` `{"n":443,"slowOver100ms":175,"share":0.4,"maxMs":803}` with the real cache and probe. Cost sentence restricted to zone up or crashed. D7 evidence line updated. |
| reviewer F2 — flag guard is only a config value; experimental status unmentioned | `test/e2e/online-smoke.mjs` ONLINE-10: `/REMOTE-APP` and `/Remote-App/api/health` must get 404 (both answer 200 from the zone if the rewrite matches, so 404 can only be the shell). Comment in `next.config.js` and a sentence in §5.1: experimental, re-check on every Next upgrade. A unit test on Next's internal matchers was not added: `buildCustomRoute` and `getMiddlewareMatchers` live in unexported `dist/` paths and would break on upgrades for unrelated reasons. |
| reviewer F3 / auditor F-2 — precedence not compared with the rewrites | middleware test with both variables set derives the expected origin from `next.config.js` `rewrites()`; second test with only `REMOTE_APP_URL`. X1 (swap in next.config.js) now fails. |
| reviewer F4 / challenger D-1, D-2 / auditor wording | §5.1: "a janela de 500 cru terminou entre 871 e 950 ms … (16 quedas, três medições independentes)"; "medianas de cinco séries". 79–190 kept: sequential runs were 110–190 (worker), 79–143 (challenger_m2_5), 93–136 (challenger_m2_6). |
| reviewer F5 / auditor F-6 — deferred module-load fetch | page test keeps a recording `fetch` for the whole file, waits 20 ms after import, and a last test asserts no fetch happened at any point. X3 and M15 fail. |
| reviewer F6 / auditor F-3 — 100/100 unbacked | appended the loop's terminal output line to `worker_m2_fix3/case-down.txt`; challenger_m2_6 independently ran 9540 case-variant requests during an outage, 0 × 500. |
| auditor F-1 — no lower bound on the probe timeout | test: a live zone answering the probe in 150 ms must pass through. Timeout 1, 20 and 0.8 each fail it. |
| auditor F-4 — title not covered | fallback test asserts all four shared strings non-empty; empty title fails. |
| auditor F-5 — M6 not in DEFERRED | D9 added. |

## Falsification (scratch copy)
control 35 → 36/36 after F-1/F-4 · X1 precedence swap in next.config.js 1 fail · X3 setTimeout fetch at module
scope 2 fail · M15 2 fail · timeout 1 / 20 / 0.8 ms 1 fail each · empty title 1 fail.

## Verification
apps/host `node --test test/*.test.ts` 36/36; `tsc --noEmit --incremental false` clean. ONLINE-10 is verified
live in the M3 end-to-end run (servers not started for this step).
