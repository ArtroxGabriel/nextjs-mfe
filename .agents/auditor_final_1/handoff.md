# auditor_final_1 — forensic audit, final combined gate (merge 90e8319, HEAD f9f5c8a)

Saved by the orchestrator from the agent's final report.

`INTEGRITY VIOLATION` — veto lies ONLY in D2 (Gabriel's merged work). M2 iteration 6 + M3 alone: CLEAN.

Scratch: `scratchpad/auditor_final_1/` (`tree/`, `pristine/`, `mut.py`, `m2.json`, `d2.json`, `runs/<id>.out`).
`diff -rq pristine tree` clean after every batch. Controls: host 39/39, zone 13/13, shell-ui 10/10, tsc clean.

## A. M2 / M3 — CLEAN
Host suite (tests/pass/fail/cancelled). Caught: X1 39/38/1; X3 and M15 39/37/2; timeouts 1/20/0.8/140 ms 39/38/1;
60 s 39/38/0/1; empty title 39/38/1; matcher drops static or root 39/38/1; inverted health in middleware 39/32/7,
`!== 'next'` 39/32/7, in zoneDecision 39/30/9; TTL Infinity 39/36/3, ttlMs 1e12 39/37/2; bare 500 in middleware
39/34/5, headers dropped 39/38/1, bare 500 in zoneDecision 39/33/6; page heading/message/hint diverge 39/38/1 each,
fallback h1 diverges 39/36/3; guard always next / inverted 39/30/9, skips static 39/38/1, drops root 39/32/7, drops
subpaths 39/38/1; Retry-After '0' 39/38/1; no cache-control 39/37/2; cache not memoized, probe env precedence,
caseSensitiveRoutes false 39/38/1; TTL 3000 39/36/3; body not rendered page 39/37/2; zone health 500 13/12/1.
Survivors: M6 effect fetch (declared D9); G3 `startsWith('/remote-app')` and G7 guard removed — equivalent mutants
while matcher == rewrites (enforced); "permits shell root" (01f35d4) untested; MS non-literal matcher + no guard
passes unit suites (only build/live catches it).
Static: control 7/7 from root and apps/host (D8 fixed); new STATIC-06 FAILS with root rule removed, old (38a204c^)
PASSES (vacuity confirmed); old checker from apps/host fails 02/03/05/06/07 (D8 as recorded).
Claims verified: all worker_m2_fix4 falsifications; hung-sim reproduced twice (n 440, slow 175, share 0.4, max 802;
committed file has no script); §5.1 "16 quedas" = 3+8+5, 950 ms = challenger_m2_6 run 1 949.9; case-down.txt summary
line only. worker_m3: STATIC-06, D8, zone 13/13 native, tsc, R6 grep 0 in apps/ and packages/. Not reproduced (out of
bounds): builds, live smoke, pnpm install −75.
Merge resolutions: zone-decision tests byte-identical to 9dbca4c; dropped tests were existsSync, constant deepEqual
to itself + source regex, source regex of delegation, `assert.ok(cache)` — each property now caught behaviourally
(R1a/b, R2mw/2, R4mw, E3). Host tests unchanged vs bda529a except additions.
Pre-existing: `apps/*/lib/logger.test.mjs` outside the glob, never run.

## B. D2 — INTEGRITY VIOLATION
Suites shell/host/zone. Survive everything: D1 select loses onChange; D1b handler never calls onSessionChange;
**D2 `{showToastButton && onToastPing && (` — the defect challenger_d2_1 declared fixed and "backed by automated
regression tests" (VETO)**; D2b emitToast fallback disabled; D4b preventDefault on remote link; D5b
`{false && <ToastContainer />}`; D7a/D7b event renamed on listener or emitter side only; D9/D9b zone stops
reading/writing localStorage; D10b ServerCard session prop only in a comment; D11 banner shows DEFAULT_SESSION;
D12b host @import points at src/index.ts; D12c extra broken @import; D13 activeRoute not passed; D14 app-header
class only in a comment; D3b next/link anchor with a comment containing the old `<a>` (with next resolvable).
Caught: D3a (shell regex), D4a/D4c href typos, D5a ToastContainer removed, D6 children dropped (host, via
erro-de-zona), D8a/D8b preset tenant, D10a session prop removed, D12a wrong-depth @import.
Static: STATIC-03 reads dead `apps/host/components/SideNavigation.tsx` (unreferenced since ed9aa05) — shell-ui
SideNavigation using next/link `<Link>` passes; deleting the dead file passes (`if (sideNav)`). STATIC-01 scans only
`apps/`.
Claims refuted/unsupported: Obs 1 refuted (test 8 regexes className, emoji and `/emitToast/` which matches the
import); Obs 2 unprotected (test 10 regex, D10b/D11); Obs 3 unprotected (MFE_EVENTS defined 3×, emitters use app
copies, listener uses shell-ui copy); "100% unified" (D1/D1b, dead host components, triplicated events); "No
caveats"/"ready to commit" (verification method cites nonexistent `rtk`, no test command or counts; 8/10 tests are
regex/includes, satisfiable by comments); "@import resolution" partial (D12b/D12c); root `pnpm test` omits shell-ui.

## C. Integrity scan c1ac90e..90e8319
No `.only`/`.skip`/`.todo`; skipped/todo/cancelled 0. No M2 assertion weakened. Source-regex middleware tests not
revived; shell-ui repeats the vetoed pattern. No fabricated measurements in M2/M3; challenger_d2_1 reports none.

## Gate implication
Veto only in D2. Accept M2/M3; hold D2 open until behavioural: react-dom/server renders of Header/SideNavigation/
ShellLayout (button without onToastPing, select onChange wiring, children), single MFE_EVENTS source, STATIC-03 on
packages/shell-ui + delete dead host components, shell-ui in root `pnpm test`.
