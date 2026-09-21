# reviewer_m2_5 — M2 gate, iteration 4 (HEAD 59507e4)

Saved by the orchestrator from the agent's final report (revisor-mfe has no write tool).

`REQUEST_CHANGES`

**Summary.** The fix for the iteration 3 veto holds. The middleware tests now run the real code, and all
five mutations were reproduced failing, plus nine more. But the commit removed an existing guard on the
outage page and put in a weaker one. The worker's handoff says the new test covers what the old one did,
and it doesn't: two mutations that add a network call to the page pass 29/29, and both failed the test
this commit deleted.

## F1 (medium, blocking): the page's "no fetch" guard got weaker, and the handoff says it didn't
- Where: `apps/host/test/erro-de-zona-page.test.ts` lines 22–27 (setup) and 33–41.
- The `fetch` stub is installed inside the test body, after the page was imported in `test.before`, so a
  fetch at module load already ran. `renderToStaticMarkup` never runs `useEffect`, so a fetch in an effect
  is never seen either.
- M6: `useEffect(() => { fetch('http://localhost:3001/remote-app/api/domain'); }, [])` in the page → 29/29.
  The deleted test (`git show c1ac90e:apps/host/test/erro-de-zona-page.test.ts`) fails on it.
- M15: top-level `fetch('http://localhost:3001/remote-app/api/x').catch(() => {})` in the page → 29/29;
  the old test fails.
- The handoff line "the render-time fetch stub and the export check cover what it was a proxy for" is false.
- Fix: install the stub before importing the page in `test.before`, count calls, assert 0. For effect-time
  fetches there is no DOM renderer without a new dependency: declare the gap as residue or add a narrow
  documented textual check; either way correct the handoff.

## F2 (low, non-blocking): one sentence in §5.1 overstates where its number comes from
- `docs/design-bff/mfe/01-operacao.md`, "Com o cache de 3 s usado antes, a mesma medição deu 2,96 s."
- 2.96 s comes from `.agents/challenger_m2_4/handoff.md` (different agent and script, kill 1.9 ms after
  warm-up instead of 0 ms), not from `window.txt`. Say it was the same scenario measured in the previous
  iteration.
- Everything else in §5.1 matches the files (871/929/940 ms; 110–190 bare 500s; ≈3 ms = 15.08 − 11.75).
  The diff is one hunk inside §5.1.

## What checked out
1. Hook and tests exercise real code: retries `.ts`/`.tsx` only after module-not-found, `.js` only for
   `next/*`, rethrows anything else; no `.ts`/`.tsx` basename collisions; `test.before` failures fail
   tests (M12: 6 fail; M17: 11 fail). `NextRequest`/`NextResponse` are the real classes. Each test file
   runs in its own process, so hooks do not leak.
2. 29/29 pass, 0 skipped/cancelled; `tsc --noEmit` exit 0.
3. TTL: `ZONE_LIVENESS_TTL_MS = 1000` used by the shared cache; test pins it with its own
   `EXPECTED_TTL_MS`; cache takes `Date.now` after `mock.timers.enable`. TTL 999 → 1 fail, 2000 → 2,
   MAX_SAFE_INTEGER → 2.
4. Five required mutations (worker script re-run): 28, 24, 27, 25, 28 of 29.
5. Extra mutations all caught: retry-after removed (1), content-type removed (1), heading hard-coded in
   `zoneErrorPage.ts` (2), health URL `/api/healthz` (1), any status healthy (2).
6. Invariants: no package.json/lockfile change; middleware.ts and pages/ unchanged; cross-zone links
   `<a>`; no DAL or domain fetch in the shell; only test-only export is the pre-existing
   `__resetSharedZoneLivenessCacheForTests`; no test reads source as text.

Not verified: `next build` (not allowed). Middleware tests run `NextResponse` under Node, not the Edge
runtime; Edge behaviour rests on the live proof.

## Commands run
- `git show --stat 59507e4`, `git show 59507e4 -- apps docs`: 11 files, no dependency files.
- `cd apps/host && node --test test/*.test.ts` (Node v24.7.0): 29 pass, exit 0.
- `cd apps/host && npx tsc --noEmit`: exit 0.
- Scratch copies with node_modules symlinked: control 29/29; mutations 1–17; old page test from c1ac90e
  against M6 and M15: 1 fail each; proposed F1 fix: 6/6 clean, 1 fail on M15.
- `git status --short` at the end: only untracked `apps/host/tsconfig.tsbuildinfo` and
  `.agents/challenger_m2_5/`.
