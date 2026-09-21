# M2 Gate Iteration 5: Forensic Integrity Audit (auditor_m2_5)

**Verdict: CLEAN**

**Scope:** commit `94ccdc2` ("fix(host): route zone prefixes case-sensitively…") on `bff-multizone`, checked against
`.agents/worker_m2_fix3/handoff.md`, reviewer_m2_5 F1/F2, challenger_m2_5 A1/D-a..D-e and auditor_m2_4 survivors
A17/A20/A32. I did not use `mutate5.py`. My own harness is `scratchpad/auditor5/mut.py`: 56 mutation runs plus a
control. Each run starts from a pristine rsync, and its diff and full output are saved to `scratchpad/auditor5/runs/<name>.out`.

**Scratch copy:** `/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/5d464ea1-4f06-4526-bdf6-51ad32f19bc1/scratchpad/auditor5/`
- `host/` is `apps/host` without `node_modules`, `.next` or `tsconfig.tsbuildinfo`.
- `host/node_modules` links to `apps/host/node_modules`, and `auditor5/node_modules` links to the repo root `node_modules`.

At the end:
- The scratch `host/` was byte-identical to `apps/host` (`diff -r` exit 0).
- `git diff --quiet HEAD` returned exit 0.
- `git status` showed only `apps/host/tsconfig.tsbuildinfo` (known) and `.agents/challenger_m2_6/` and `.agents/reviewer_m2_6/`, which belong to concurrent agents.

No builds, no ports, no servers, no installs. Node v24.7.0.

---

## 1. Claims vs tree

| Claim (worker handoff / commit message) | Checked against | Result |
|---|---|---|
| A1: `experimental.caseSensitiveRoutes: true` in `apps/host/next.config.js` | diff; Next 15.5.24 source | **Holds.** `server/lib/router-utils/filesystem.js` builds every rewrite with `sensitive: opts.config.experimental.caseSensitiveRoutes`, so the key sits at the path Next reads. Checked in-process with Next's own `getPathMatch`: with `sensitive:false`, `/REMOTE-APP`, `/Remote-App/api/health` and `/REMOTE-APP-STATIC/x.css` match the rewrite sources; with `sensitive:true` none do and the lowercase paths still match. The built `middleware-manifest.json` matcher regexes have no `i` flag (`/REMOTE-APP` → false). The current `.next/routes-manifest.json` says `caseSensitive: true`. It was rebuilt at 10:47, after the commit, by another agent. |
| Test first: the rewrites test failed, then passed (6/7) | my CS1 run; file mtimes | **Consistent.** Removing the line gives 1 failure in `rewrites.test.ts` (7 tests there). `rewrites.test.ts` mtime 10:04:27 precedes `next.config.js` 10:04:35. |
| F1 (module load): fetch stub installed before the page import; new test asserts 0 calls | diff; P1, P2, P4, P8 | **Holds.** Kills a top-level fetch in the page (P1), in the transitively imported `HostLayout` (P2) and in a microtask (P4). Moving the stub back after the import makes P1 survive (P8), so the ordering is what gives the test its teeth. |
| F1 (effect): useEffect fetch is declared residue | test header, handoff, commit message; P5 | **Honestly declared.** P5 survives 33/33. The test file header, the handoff table ("Declared residue… M6 survives") and the commit message ("A fetch inside an effect still passes") all say so. Nothing counts it as covered. It is not in `DEFERRED.md` (see F-5). |
| A20: `ZONE_PROBE_TIMEOUT_MS = 800` exported; silent-zone middleware test (< 1.5 s, test timeout 5 s) | diff; T1–T9, S1 | **Holds for the upper bound.** 60 s (constant or call site), 2 s, signal not passed and abort timer removed all fail. The lower bound is untested (F-1). |
| A17: middleware tests clear and restore `REMOTE_ZONE_URL`/`REMOTE_APP_URL`; probe precedence tested | diff; E1–E5, ENV0–ENV2 | **Holds for the probe side.** Probe precedence swapped, `REMOTE_APP_URL` ignored and a hardcoded origin all fail. With external `REMOTE_ZONE_URL` or `REMOTE_APP_URL` set, every middleware test still passes, so the isolation is real. The test's *title* claims more than it checks (F-2). |
| A32: copy tests assert non-empty shared text | diff; C1–C4 | **Holds for the three `OUTAGE_COPY_FIELDS`**: empty heading, whitespace message and empty hint all fail. `ZONE_ERROR_TITLE` is not covered (F-4). |
| §5.1 rewritten (case-sensitive routes, 11 kills, 79–190, 826–1010 ms, hung zone 30 s / 815–817 ms, 3–6 ms over five paired series, 7 probes) | doc diff vs raw logs | **Traceable**, with two wording imprecisions (§4). |
| Mutation counts in `mut5.txt` | my independent runs | **Consistent.** Every count is exactly mine minus one passing test, and the failing-test names match mine exactly (see §4). |
| Live: case variants 100/100 → 404 | `case-down.txt` | **Not backed by a committed log** (F-3). The file has one sample per path. |
| 33/33, `tsc --noEmit` clean | control ×5; `tsc --noEmit --incremental false` on scratch copy | **Holds**: 33/33 five times; tsc exit 0. |
| `next build` clean, smoke 16/16 | none | **Not reproduced**: out of scope, no ports or builds. No log for this iteration is committed. |
| No package.json / lockfile change | `git show --stat 94ccdc2 fb4c3dd` | **Holds.** No package.json, pnpm-lock.yaml, pnpm-workspace.yaml or .npmrc touched. No new imports of uninstalled packages. |

## 2. Falsification by mutation (scratch copy only)

**Control:** `node --test test/erro-de-zona-page.test.ts test/middleware.test.ts test/rewrites.test.ts test/zone-error-page.test.ts test/zone-liveness.test.ts`:
**33 tests, 33 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo**, identical in 5 of 5 runs (2.66–3.11 s). The silent-zone test took 802–804 ms in every run, well under its 1500 ms bound.

Counts are tests / pass / fail / cancelled. KILLED means the suite exited non-zero.

### 2.1 Required mutations

| # | Mutation | t/p/f/c | Result, killed by |
|---|---|---|---|
| CS1 | remove `caseSensitiveRoutes: true` line | 33/32/1/0 | KILLED: "routes match case-sensitively…" |
| CS2 | `caseSensitiveRoutes: false` | 33/32/1/0 | KILLED: same |
| CS3 | key misspelled `caseSensitveRoutes` | 33/32/1/0 | KILLED: same |
| CS4 | moved to top level (out of `experimental`) | 33/32/1/0 | KILLED: same |
| CS5 | `experimental` misspelled `experimentl` | 33/32/1/0 | KILLED: same |
| CS6 | `'true'` (string) | 33/32/1/0 | KILLED: same (strict equal) |
| CS7 | whole `experimental` block removed | 33/32/1/0 | KILLED: same |
| P1 | page: `fetch(...).catch()` at module load (reviewer M15) | 33/32/1/0 | KILLED: "loading the page module does not touch the network" |
| T1 | `ZONE_PROBE_TIMEOUT_MS = 60000` | 33/32/0/1 | KILLED: silent-zone test cancelled at its 5 s timeout |
| T2 | call site `createFetchProbe(healthUrl, 60000)`, constant left at 800 | 33/32/0/1 | KILLED: same |
| E1 | probe env precedence swapped (`REMOTE_APP_URL` first) | 33/32/1/0 | KILLED: "the probe targets the same zone origin…" |
| C1 | `ZONE_ERROR_HEADING = ''` | 33/32/1/0 | KILLED: "both show ZONE_ERROR_HEADING" (non-empty assert) |
| C3 | `ZONE_ERROR_RETRY_HINT = ''` | 33/32/1/0 | KILLED: "both show ZONE_ERROR_RETRY_HINT" |
| R1 | matcher drops `/remote-app-static/:path*` | 33/32/1/0 | KILLED: matcher covers exactly the rewrite sources |
| R1b | matcher drops `/remote-app` | 33/32/1/0 | KILLED: same |
| R2 | `if (!isZoneHealthy)` | 33/27/6/0 | KILLED: healthy, unreachable, non-2xx, TTL window, recovery, silent zone |
| R3a | `ZONE_LIVENESS_TTL_MS = Infinity` | 33/31/2/0 | KILLED: TTL window; recovery |
| R3b | call site `ttlMs: 1e12` | 33/31/2/0 | KILLED: TTL window; recovery |
| R4 | bare `new NextResponse('Internal Server Error', {status:500})` | 33/28/5/0 | KILLED: unreachable, non-2xx, TTL, recovery, silent zone |
| R5a | page `<h2>` literal instead of `ZONE_ERROR_HEADING` | 33/32/1/0 | KILLED: both show HEADING |
| R5b | page message literal | 33/32/1/0 | KILLED: both show MESSAGE |
| R5c | page retry hint literal | 33/32/1/0 | KILLED: both show RETRY_HINT |
| P5 | page `useEffect(() => fetch(...))` (reviewer M6) | 33/33/0/0 | **SURVIVED: declared residue** (§1) |

### 2.2 Adversarial mutations

| # | Mutation | t/p/f/c | Result |
|---|---|---|---|
| P2 | top-level fetch in `components/HostLayout.tsx` (transitive import) | 33/32/1/0 | KILLED: module-load test |
| P3 | page: `setTimeout(() => fetch(...).catch(), 0)` at module load | 33/33/0/0 | **SURVIVED**, see F-6 |
| P4 | page: `queueMicrotask(() => fetch(...))` at module load | 33/32/1/0 | KILLED: module-load test |
| P6 | page: fetch during render | 33/32/1/0 | KILLED: render test |
| P7 | page exports `getServerSideProps` that fetches | 33/32/1/0 | KILLED: data-fetching hooks test |
| P8 | **test tamper**: stub installed after the import again, plus P1 | 33/33/0/0 | SURVIVED, by construction. Shows the new ordering is load-bearing. |
| P9 | **test tamper**: page imported once before the stub, plus P1 | 33/33/0/0 | SURVIVED, by construction. Module cache: same class as P8. |
| C2 | `ZONE_ERROR_MESSAGE = ' '` | 33/32/1/0 | KILLED: `trim()` non-empty assert |
| C4 | `ZONE_ERROR_TITLE = ''` | 33/33/0/0 | **SURVIVED**, see F-4 |
| C5 | page `<title>` literal instead of `ZONE_ERROR_TITLE` | 33/33/0/0 | SURVIVED. Pre-existing gap: the page title was never compared, and `next/head` renders nothing under `renderToStaticMarkup`. See F-4. |
| T3 | probe timeout 1400 ms | 33/33/0/0 | SURVIVED. Inside the test's declared 1.5 s bound, so not a violation. |
| T4 | probe timeout 2000 ms | 33/32/1/0 | KILLED: silent-zone (`elapsedMs < 1500`) |
| T5 | probe timeout **1 ms** | 33/33/0/0 | **SURVIVED**, see F-1 |
| T5b | probe timeout **0.8** (seconds/ms unit confusion) | 33/33/0/0 | **SURVIVED**, see F-1 |
| T5c | probe timeout 20 ms | 33/33/0/0 | **SURVIVED**, see F-1 |
| T6 | `signal: controller.signal` not passed to fetch | HANG | KILLED: the silent-zone test failed at 5006 ms. The run then hung in the pre-existing `createFetchProbe() aborts…` test, which has no timeout, and my harness killed the process group at 90 s. |
| T7 | abort timer does nothing | HANG | KILLED: same pattern |
| T8 | **test tamper**: silent-zone stub rejects at once, plus 60 s timeout | 33/33/0/0 | SURVIVED, by construction. The test's teeth come from a stub that never settles, which is correct. |
| T9 | middleware races `isHealthy()` against its own 900 ms, plus 60 s probe timeout | 33/33/0/0 | SURVIVED. Not a regression: the user-visible property (503 in < 1.5 s) still holds. |
| S1 | **test tamper**: `elapsedMs < 1500` assert deleted, plus 2 s timeout | 33/33/0/0 | SURVIVED, by construction. Shows the bound assert is load-bearing (the 5 s test timeout alone would not catch 2 s). |
| E2 | **next.config.js** rewrites precedence swapped, probe unchanged | 33/33/0/0 | **SURVIVED**, see F-2 |
| E3 | probe ignores `REMOTE_APP_URL` | 33/32/1/0 | KILLED: precedence test |
| E4 | probe origin hardcoded `http://localhost:3001` | 33/32/1/0 | KILLED: precedence test |
| E5 | rewrites prefer `REMOTE_APP_URL` only when both are set | 33/33/0/0 | **SURVIVED**, see F-2 |
| ENV0 | unmutated tree with external `REMOTE_ZONE_URL=http://ci-zone:7777` | 33/32/1/0 | Fails only in `rewrites.test.ts` "contains the 3 required rules", which hardcodes `localhost:3001` and does not clear env. Pre-existing, a false red. All middleware tests pass, so the new isolation works. |
| ENV0b | same with external `REMOTE_APP_URL` | 33/32/1/0 | same |
| ENV1 | **test tamper**: beforeEach no longer deletes env, plus external `REMOTE_ZONE_URL` | 33/31/2/0 | KILLED: the healthy test sees the external origin. Proves the delete is what isolates. |
| ENV2 | **test tamper**: restore and delete both removed, no external env | 33/33/0/0 | SURVIVED. `REMOTE_APP_URL` leaks from the precedence test into the silent-zone test, which does not read the URL. Harness hygiene only, not a production path. |
| X1 | matcher gains `/REMOTE-APP` | 33/32/1/0 | KILLED: matcher deepEqual |
| X2 | extra rewrite `/zone-alias/:path*` not in matcher | 33/31/2/0 | KILLED: matcher deepEqual; rule count |
| X3 | `retry-after` removed | 33/32/1/0 | KILLED: unreachable→503 |
| X4 | TTL 3000 | 33/31/2/0 | KILLED: TTL window; recovery |

**Summary:** every required mutation and every variant fails, except P5, which is declared. Of the adversarial
mutations, the production-code survivors are:
- T5, T5b and T5c (probe timeout lower bound);
- E2 and E5 (rewrite-side precedence);
- C4 (title copy);
- P3 (deferred module-load fetch);
- T3 and T9, which are not regressions.

The remaining survivors (P8, P9, T8, S1, ENV2) are test-file tampering that would show up in any diff.

### 2.3 Findings from survivors (none blocking, none claimed as covered)

- **F-1 (medium-low, pre-existing, new gap in a claimed area).** No test sets a *lower* bound on the probe timeout.
  - Only the upper bound was A20's concern, and the worker claims only that.
  - With `ZONE_PROBE_TIMEOUT_MS` at 1, 20 or `0.8` (a plausible seconds/ms slip), every real probe would abort before a localhost zone can answer. challenger_m2_5 measured direct health p50 4.9 ms and p99 13 ms.
  - The shell would then serve 503 for all zone traffic while the zone is up, and the suite stays 33/33. The smoke test would catch it; the unit suite does not.
  - Fix: pin the constant with an independently written expected value, as `EXPECTED_TTL_MS` does for the TTL, or add a stub that answers after about 50 ms and must pass through.
- **F-2 (low).** The test named "the probe targets the same zone origin the rewrites use, REMOTE_ZONE_URL first" hardcodes the expected URLs. It never compares them with `rewrites()`.
  - Swapping or conditioning the precedence in `next.config.js` (E2, E5) keeps the suite green, and the shell then probes one origin and proxies to another when both variables are set. This is the exact scenario auditor_m2_4 N1 described.
  - `rewrites.test.ts` never sets both variables at once.
  - The handoff's own wording ("probe uses REMOTE_ZONE_URL, then REMOTE_APP_URL") is accurate. The test title overstates it.
  - Fix: in that test, build the expected health origin from `nextConfig.rewrites()` under the same env.
- **F-3 (low, evidence).** The handoff says "case variants 100/100 → 404 (no 500)" with the zone down.
  - The committed `case-down.txt` has one line per case-variant path: 4 variants, 1 sample each.
  - No committed artifact supports 100/100. The direction is still confirmed by `case-down.txt`, by the Next source and by my in-process `getPathMatch` check.
- **F-4 (low).** The non-empty assert covers HEADING, MESSAGE and RETRY_HINT, not `ZONE_ERROR_TITLE`. C4 empties it and `zone-error-page.test.ts` still accepts `<title></title>`.
  - The commit message says "empty shared copy no longer satisfies the copy tests" without that qualifier.
  - Page-title drift (C5) was never covered, which predates this commit.
- **F-5 (info).** The M6 residue (effect-time fetch) is declared in the test header, the handoff and the commit message, but not in `.agents/orchestrator/DEFERRED.md`. That is where the other known residues (D6, D7) are tracked.
- **F-6 (low).** A module-load `setTimeout(() => fetch(...), 0)` escapes the module-load test, because the stub is restored before the timer fires.
  - The test header says network access "is checked at the two points a server ever runs this page: module load and render". A callback scheduled at load and run after it is a third point.
  - The case is contrived, and the old textual test would have caught it. Worth one sentence in the header.

## 3. Test-integrity smells

- **`.only` / `.skip` / `.todo` / `{skip:}`:** none (`grep -rnE "\.(only|skip|todo)\(|\{ *(skip|only|todo) *:" test/` has no hits). The control reports skipped, todo and cancelled all 0.
- **Flakiness:** 5/5 identical control runs, 33/33. The only timing-sensitive test (silent zone, real `setTimeout`, `performance.now`) ran 802–804 ms against a 1500 ms bound: about 700 ms of headroom. It could go red on a heavily loaded CI runner, but never falsely green.
- **Vacuous passes:**
  - The module-load count is captured in `finally` and asserted in a separate test. It is not vacuous: P1, P2 and P4 are killed, and P8 shows that reverting the ordering makes it vacuous.
  - The silent-zone test proves the abort path. The stub only settles on `abort` (T6 and T7 are killed), and the elapsed bound is load-bearing (S1).
  - The `includes('')` vacuity (auditor_m2_4 N4) is closed for the three copy fields.
- **Weakened assertions:** none. Compared with `59507e4`, every change adds an assertion or a test. No assertion was removed or loosened.
- **Hardcoded outputs:** the precedence test hardcodes the expected URLs, legitimately, but see F-2. The case-sensitivity test is structural: it reads a config flag. That is an acceptable proxy, because the behavior lives in Next, and I confirmed the flag's exact path is what Next reads (§1).
- **Env hygiene:** the middleware tests save, delete and restore correctly (ENV0, ENV1). `rewrites.test.ts` is not env-isolated for the "3 required rules" test (ENV0). That predates this commit and gives a false red, never a false green.
- **Harness:** `test/support/register-next-resolution.ts` is unchanged in this commit (`git show --stat`).

## 4. Measurement integrity

**`mut5.txt`:**
- **What it is:** a grep-filtered summary, not raw `node --test` output.
  - Pass and fail are joined on one line, with only the failing names listed.
  - For A20 it shows "pass 31 fail 0" plus a ✖, which is how node reports a timeout: as *cancelled*, a field the filter drops. My T1 shows `c=1` for the same thing.
- **Counts match mine:** every count is exactly one passing test fewer than my run (M1 31 vs 32, M2 26 vs 27, M3 30 vs 31, M4 27 vs 28, M5/M15/A17/A32 31 vs 32, TTL3000 30 vs 31, M6 32 vs 33). Every listed failing-test name matches mine exactly, including the six under the inverted branch and the five under the bare 500.
- **Why the suite had 32 tests:** mtimes put the run after `zoneLiveness.ts` and `middleware.test.ts` (10:01:05, the script uses `ZONE_PROBE_TIMEOUT_MS`) and before `rewrites.test.ts` gained the case test (10:04:27). All worker artefacts were copied in at 10:06:46.
- **Assessment:** consistent with the handoff's "control 32/32" and "caseSensitiveRoutes RED run 6/7". There is no control line in the file, and the handoff's final "33/33" is a later tree. That explains the discrepancy. Nothing points to fabrication.

**`case-up.txt` / `case-down.txt`:**
- Status and content-type per path, consistent with the handoff's zone-up and zone-down lists and with §5.1 ("Hoje ela recebe o 404 do shell").
- They are formatted summaries, not raw curl output, with one sample per path (F-3). Nothing in them contradicts the Next source behavior I verified in-process.

**§5.1 aggregate numbers vs committed logs:**

| §5.1 statement | Source | Traceable? |
|---|---|---|
| first 503 "chegou entre 871 e 940 ms", sequential, 11 kills, two independent measurements | `worker_m2_fix2/window.txt`: 3 runs at 870.8 / 928.8 / 940.1. `challenger_m2_5/window-sigkill-seq.jsonl` (5) and `window-sigterm-seq.jsonl` (3): received 900.5–938.8 | **Yes, 3 + 8 = 11.** Imprecision: `window.mjs` records `t - tKill` taken *before* the fetch, so the worker's three values are send times. The challenger's are receive times, and "chegou" (arrived) fits only those. The upper bound may be understated by one request latency, about 10–20 ms. |
| "depois de 79 a 190 requisições" | worker 110/190/129; challenger 79–143 | **Yes** |
| 30 clients, boundary by send time 826–1010 ms | `window-sigkill-c30*.jsonl`: `first503SentAtMs` 855, 882.4, 863.5, 834.4, 825.9, 829.7, 886.8, 1010.3 | **Yes.** In the 1010.3 run, `statusesBefore` already contains 19 × 503 and the last non-503 was sent at 936.2, so 1010 overstates the window (the conservative direction). |
| 2.96 s at the earlier 3 s TTL, "medido na iteração anterior" | `challenger_m2_4` (per auditor_m2_4 / reviewer_m2_5 F2) | **Yes.** F2 wording fixed. |
| hung zone: proxy timeout "observado em 30 s (3 de 3)", then 815–817 ms probe timeout, then 503 from cache | `hang-single.jsonl` 30055/30030/30031 ms, next request 817/817/815 ms; `hang-sigstop.jsonl` | **Yes** |
| "de 3 a 6 ms… (medianas pareadas de cinco séries), com a zona no ar ou morta" | `overhead-zone-up.jsonl`: paired 5.82, 5.28, 3.50; `equal-spacing` 4.63; `overhead-outage.jsonl` paired 4.37 | **Range traceable (3.50–5.82).** Imprecision: `equal-spacing` is a difference of medians (`p50diff`), not a paired median, so four of the five are paired. |
| "30 clientes durante 6 s geraram 7 sondas" | `probe-count-concurrency.jsonl`: `healthProbes: 7`, gaps 1006–1011 ms | **Yes** |
| `DEFERRED.md` D6 update "871–940 ms over 11 sequential kills" and D7 figures | same files | **Yes** |

These are wording-level imprecisions, not integrity violations. No number in §5.1 lacks a committed source.

## 5. Dependencies

- `git show --stat 94ccdc2 fb4c3dd` touches no `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` or `.npmrc`.
- No `tsx` and no `--experimental-*` flag; the suite runs under plain `node --test`.
- No new third-party import: the new test code uses only `node:test`, `react` and `react-dom/server`, all already present.

## 6. Logic chain and verdict

1. Iteration 4 failed on A1 (case-variant bypass) and on F1 (weakened page network guard plus an overstated coverage claim).
2. **A1:**
   - The fix sets the one flag Next 15.5.24 reads when building rewrite matchers (verified in source and in-process).
   - All 7 ways of removing, disabling, misspelling or relocating it fail the new test.
   - The committed live logs show case variants getting 404 with the zone up and down.
3. **F1:**
   - A module-load fetch now fails, including transitively and via a microtask. Reverting the stub ordering makes it pass again, so the test is what kills it.
   - The effect-time fetch still passes, and that is stated plainly in the test file, handoff and commit. No coverage is claimed.
4. **Previous survivors:**
   - A20: 60 s, 2 s, no signal and no abort are killed.
   - A17: the probe-side swap is killed.
   - A32: empty copy is killed for the three outage fields.
5. **The original five, re-run against 94ccdc2 with my own edits:** all fail with 1–6 failing tests each, including variants on the call site and on each page copy field.
6. **Survivors:** the new survivors (F-1 timeout lower bound, F-2 rewrite-side precedence, F-4 title, F-6 deferred fetch) are coverage gaps no handoff claims as covered. F-3 is an unsupported "100/100" count whose direction is still evidenced.
7. **Measurements:** traceable to committed logs, with two wording imprecisions (send vs receive time; one unpaired series among the "paired" five). `mut5.txt` is a filtered but internally consistent summary of a 32-test tree that predates the final test.
8. **Integrity:** no fabricated result, no disabled or weakened assertion, no `.only`/`.skip`, no flakiness in 5 runs, no dependency change.

**CLEAN**

Recommended for M3, not blocking:
- F-1: pin `ZONE_PROBE_TIMEOUT_MS` with an independently written expected value.
- F-2: derive the expected probe origin from `rewrites()` under both env variables.
- F-3: commit the raw 100-sample case-variant log, or drop the count.
- F-4: add `ZONE_ERROR_TITLE` to the non-empty check.
- F-5: record M6 in `DEFERRED.md`.
- §5.1 wording: say "enviado" for the worker's three values, or re-measure receive time; say "quatro pareadas e uma diferença de medianas".
