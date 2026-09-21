# reviewer_m2_6 — M2 gate, iteration 5 (HEAD 94ccdc2, reviewed as `59507e4..94ccdc2 -- apps docs`)

Saved by the orchestrator from the agent's final report (revisor-mfe has no write tool).

`REQUEST_CHANGES`

A1 is fixed (Next 15.5.24 source read, matchers re-run, live logs agree). Reviewer F1 (M15) fixed; M6
residue and D7 deferral justified. 33/33, tsc clean. One blocking finding: §5.1 understates the hung-zone
cost.

## F1 (medium, blocking): §5.1 makes the hung-zone cost look like a one-off
- `docs/design-bff/mfe/01-operacao.md`: "Depois do intervalo, a requisição que dispara a sonda espera o
  timeout da sonda, 800 ms … As seguintes recebem 503 do cache." and "paga de 3 a 6 ms a mais … com a zona
  no ar ou morta".
- The cache trusts a result for 1 s from when the probe finishes. Each expiry starts a new 800 ms probe and
  every request arriving meanwhile waits on it; while hung this repeats every ~1.8 s.
- Real `createZoneLivenessCache` + `createFetchProbe` (TTL 1000, timeout 800), fetch never answers, one
  request every 20 ms for 9 s (`scratchpad/rev6/hung.mts`): `{"n":442,"slowOver100ms":175,"share":0.4,"maxMs":802}`.
- Fix: say that while the zone stays hung each cache expiry repeats the probe and every request during
  those 800 ms waits (≈40% of a continuous stream); restrict the cost sentence to crashed zones; fix D7's
  evidence line the same way.

## F2 (low): the case-sensitivity guard only checks a config value; the flag's experimental status is unmentioned
- `apps/host/test/rewrites.test.ts:48-54` asserts only `config.experimental?.caseSensitiveRoutes === true`.
  Next only warns on unknown experimental keys; an upgrade that renames/drops the flag re-opens A1 with all
  tests green. No mixed-case check in smoke/e2e.
- Fix: live smoke check that `/REMOTE-APP` is never 5xx with the zone down; optionally a unit test using
  Next's own matchers (`buildCustomRoute('rewrite', rule, '', caseSensitive)` from
  `next/dist/server/lib/router-utils/filesystem.js`, `getMiddlewareMatchers(matcher, {})` from
  `next/dist/build/analysis/get-page-static-info.js`; without the flag `/REMOTE-APP` → rewrite true,
  middleware false; with it both false). Note "experimental; re-verify on every Next upgrade" in the config
  comment and §5.1.

## F3 (low): env-precedence test claims more than it checks
- `apps/host/test/middleware.test.ts:160-174` hardcodes expected URLs. X1 (swap precedence in
  `next.config.js`) → 33/33. With both variables set the shell could probe one zone and proxy to another.
- Fix: with both set, derive the expected origin from `nextConfig.rewrites()` and compare to `probedUrls[0]`.

## F4 (low): two §5.1 phrasings don't match their sources
- "o primeiro 503 chegou entre 871 e 940 ms": `window.mjs` records send time (`t` before fetch). Write
  "foi enviado". Challenger's 8 sequential send times 887.3–916.5 ms also fit.
- "medianas pareadas de cinco séries": only four paired medians exist (5.82, 5.28, 3.50, 4.37); the worker's
  3.33 is an unpaired difference. Write "quatro medianas pareadas" or "cinco séries".

## F5 (low, residue): module-load guard misses a deferred fetch
- X3: `setTimeout(() => { fetch(...).catch(() => {}) }, 0)` at module scope → 33/33 (count read and stub
  restored before the timer fires). Fix: keep a throwing stub for the whole file and assert at the end, or
  wait a timer tick before reading the count.

## F6 (low, evidence): "case variants 100/100 → 404" in worker_m2_fix3 handoff is not in `case-down.txt`
  (one request per path). Add the loop output or restate.

## What checked out
- M15 caught; M6 honestly declared (no DOM renderer installed); 2.96 s attributed; D7 justified; A20, A17
  (probe side), A32 addressed.
- `caseSensitiveRoutes` only reaches `buildCustomRoute` and rewrite param matching; middleware matcher regex
  already case-sensitive; pages, `_next/static`, fragments unaffected; host has no headers/redirects/pages/api.
- Timeout test ≈804 ms vs 1.5 s bound, not flaky; 60 s timeout cancels at 5 s (exit 1). X2 (1400 ms) passes,
  consistent with the title but would let "800 ms" in the doc go stale.
- Env save/restore per test; singleton reset per test; files run in separate processes.
- Doc: one hunk inside §5.1; 11 kills, 79–190, 826–1010 ms, 30 s 3/3, 815–817 ms, 7 probes/1086 requests ✓.
- No dependency files changed; only fetch in non-test host code is the probe; cross-zone links are `<a>`.

## Commands / mutations
control 33/33 · X1 precedence swap in next.config.js 33/33 · X2 timeout 1400 33/33 · X3 deferred module
fetch 33/33 · X4 timeout 60 s 1 cancelled · X5 flag removed 1 fail · X6 60 s at call site 1 cancelled ·
X7 widened rewrite source 4 fail. `tsc --noEmit --incremental false` exit 0. No build, ports, installs or
tracked-file changes.
