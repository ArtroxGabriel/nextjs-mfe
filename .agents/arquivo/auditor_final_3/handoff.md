# auditor_final_3 — forensic audit, final combined gate iteration 3 (deb23f2), model opus

Saved by the orchestrator from the agent's final report. Scratch: `scratchpad/auditor_final_3/` (`tree/`, `pristine/`,
`harness.py`, `m1–m3.py`, `probe-capture.test.ts`, `probe-effects.test.ts`, `m1–m3.txt`, `runs/`). Shared tree untouched.
Controls: shell 15/15, zone 17/17, host 46/46, static 7/7.

`INTEGRITY VIOLATION`

## V1 — a declared D2-bar defect returns with every suite green
auditor_final_1 §B "D7b: event renamed on the emitter side only". A3c: `apps/remote-app/lib/events.ts` `emitToast` dispatches
`new CustomEvent('mfe:toasts', …)` → shell 15/0, zone 17/0, host 46/0, static 7/7. Zone toasts (ServerCard, RemoteMap,
RemoteTelemetry) would never reach ToastContainer. `apps/remote-app/test/events.test.ts` is titled as protecting emission but
asserts only constant identity. Not declared in D10/D11; catchable with the stand-in window pattern (12-line probe → zone
20/19/1). Host side (A3d) is caught (45/1).

## V2 — D10's "needs a DOM renderer" is false for U1 and X-D9b
`probe-capture.test.ts` (no new dependency): wraps `react/jsx-runtime` `jsx`/`jsxs` via `createRequire` before ES module
snapshot, renders the real zone page, captures props passed to ShellLayout, calls `onSessionChange` against a stub
localStorage. Control 20/20; U1 → 20/19/1; X-D9b → 20/19/1. D10 also mislabels X-D9b as effect-bound (the write is in
`handleSessionChange`). X-D9, X-D11, X-TC reachable only by stubbing React's exported `useEffect` synchronously — judged a hack;
D10 acceptable for those three. No concealment.
Smallest fix: behavioural test for zone `emitToast`; jsx-runtime capture test for zone `onSessionChange` + localStorage write,
or D10 rewording naming the technique and why rejected; correct X-D9b description.

## Sample of worker mutants reproduced (own patches), counts identical to worker
R1 host 43/3; D2 shell 12/3; D1b 14/1; D4b 14/1; D5b shell 14/1 zone 16/1; D7b spread copy zone 16/1; D14 shell 13/2 zone 16/1
host 45/1; Z1 zone 14/3; U2 host 45/1; U5 host 45/1; F2b host 45/1; F4 shell 14/1; F5 shell 14/1. Declared survivors all survive
existing suites.

## New adversarial mutants
Caught / fail loudly: A1a–c hooks in Header/SideNavigation ("Invalid hook call"); A2a/A2b anchor wrapped in component / memo;
A3a/A3b spread copies; A3d host literal; A4a content outside `<main>`; A4b children after `</main>`; A5 behaviour-preserving
inline wrapper (over-coupled, low); A5b; A6 middleware reads headers for logging (deliberate pin, acceptable); A8a–c
`import()`/`require`/template `next/link`; A8e re-export Link.
Survived: **A3c (V1)**; A2c `if (e.button === 0) preventDefault` and A2d `e.nativeEvent?.preventDefault()` (stub event, low);
A6b try/catch-wrapped pathname guard swallows the Proxy throw (low); A7a `@media print`, A7b class in `content: ""` string, A7c
unterminated trailing comment, A7d never-true `@supports` (CSS regex, low); A8d computed import specifier (info).

## Claims
Verified: mutations.txt 27/27 and mutations2.txt 40/40 accurate; hung.mts reproduces (median 455, max 802); r1-live and
smoke-strict consistent with tree (the "app-header, layout-sidebar, toast-portal" line is not in smoke-strict.txt, supported
instead by the SSR test); no `.only/.skip/.todo`; `git diff 90e8319 deb23f2 -- apps/host/test` additions only.
Refuted/overstated: D10 for U1/X-D9b (V2); zone events test title (V1); deb23f2 "no pathname, url or header check can come back"
(A6b); "ignore CSS comments" (A7c).
