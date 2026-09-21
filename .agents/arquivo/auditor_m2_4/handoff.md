# M2 Gate Iteration 4: Forensic Integrity Audit (auditor_m2_4)

**Verdict: CLEAN**

**Scope:** commit `59507e4` ("test(host): exercise the real middleware instead of matching its source")
on `bff-multizone`, checked against the claims in `.agents/worker_m2_fix2/handoff.md` and the veto in
`.agents/auditor_m2_3/handoff.md`. I did not use the worker's `mutations.py`. I wrote my own harness
(`scratchpad/auditor/mut.py`) with 44 mutations (8 for the required five, 36 adversarial), plus a control and one instrumentation-only run. Each run starts from a pristine copy
(`rsync --delete`) and saves its diff and full test output to `scratchpad/auditor/runs/<name>.out`.

**Scratch copy:** `/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/5d464ea1-4f06-4526-bdf6-51ad32f19bc1/scratchpad/auditor/`
- `host/` is `apps/host` without `node_modules`, `.next` or `tsconfig.tsbuildinfo`.
- `host/node_modules` links to `apps/host/node_modules`, and `auditor/node_modules` links to the repo root `node_modules`.

At the end:
- The scratch copy was byte-identical to the real `apps/host` (`diff -r`, exit 0).
- `git diff --quiet HEAD` returned exit 0.
- `git status` showed only `apps/host/tsconfig.tsbuildinfo` (known) and `.agents/challenger_m2_5/` (the concurrent challenger's files, not mine).

No servers, no builds, no ports, no installs.

---

## 1. Claims vs tree

| Claim (worker handoff / commit message) | Checked against | Result |
|---|---|---|
| `middleware-config.test.ts` deleted and replaced by `middleware.test.ts`, which calls the real `middleware()` with a real `NextRequest` | `git show 59507e4`, file contents, load instrumentation (mutation A37) | **Holds.** Under test, the hook loaded the real `host/middleware.ts`, `lib/zoneLiveness.ts`, `lib/zoneErrorPage.ts`, `pages/erro-de-zona.tsx` and the real `node_modules/.pnpm/next@15.5.24…/next/server.js`. The page's default export is `ErroDeZonaPage`. |
| Only `fetch` and `Date` are replaced | `middleware.test.ts` | **Holds.** It uses `mock.method(globalThis,'fetch')` and `mock.timers.enable({apis:['Date']})`, and nothing else is stubbed. |
| Hook handles exactly 3 cases: extensionless relative imports, `next/*` without `.js`, `.tsx` JSX | `test/support/register-next-resolution.ts` | **Holds.** Resolve only acts after `ERR_MODULE_NOT_FOUND`/`ERR_UNSUPPORTED_DIR_IMPORT`, so it cannot redirect a specifier that already resolves. Load only touches `.tsx`. No specifier is special-cased. |
| "No test reads a source file as text any more" | `grep readFileSync` in `apps/host/test` | **Holds.** The only hit is the hook reading `.tsx` so it can transpile it. |
| Page test renders with `react-dom/server` and checks no fetch, no data hooks, shared copy | `erro-de-zona-page.test.ts` | **Holds.** |
| `zone-error-page.test.ts` also checks the retry hint and `<title>` | diff | **Holds.** |
| `ZONE_LIVENESS_TTL_MS = 1000` is an exported named constant used by the shared cache | `lib/zoneLiveness.ts` diff | **Holds.** |
| The TTL test failed against 3000 | my mutation A01 (TTL = 3000) | **Consistent.** It fails 27/29. |
| Worker's 5 mutation counts: 28/29, 24/29, 27/29, 25/29, 28/29 | my independent R1–R5 | **Reproduced exactly** (see §2). |
| 29/29 in apps/host | control run | **Holds**: tests 29, pass 29, fail 0, skipped 0, todo 0, cancelled 0. |
| `tsc --noEmit` clean, and `test/` is in its include | scratch copy, `tsc --noEmit --incremental false` | **Holds**: exit 0. `include` is `**/*.ts`, `**/*.tsx`. |
| Only `01-operacao.md` §5.1 touched | doc diff, heading lines | **Holds.** The one hunk sits at lines 176–201, inside `### 5.1 Hierarquia` (line 171) and before `### 5.2` (line 205). |
| No package.json / lockfile change | `git show --stat 59507e4` | **Holds.** None of package.json, pnpm-lock.yaml, pnpm-workspace.yaml or .npmrc changed. No new dependency: the hook uses the `typescript` already in devDependencies. |
| `apps/remote-app` tests fail under `node --test` (extensionless imports) | grep | **Plausible.** `health.test.ts` imports `'../pages/api/health'` and `fragmento.test.ts` imports `'../pages/_fragmento/[name]/[id]'`, both without extension. Not run. |
| `next build` clean, live measurements, smoke 16/16, ports freed | — | **Not reproduced.** Out of scope for this role this round. See §4 for plausibility. |

## 2. Falsification by mutation (scratch copy only)

The control run came first: **29/29, 0 skipped/todo/cancelled.** Each mutation below was applied alone to a
fresh copy. KILLED means at least one test failed.

### 2.1 The five required mutations (RETOMADA §3)

| # | Mutation | tests / pass / fail | Killed by |
|---|---|---|---|
| R1 | drop `'/remote-app-static/:path*'` from `config.matcher` | 29 / 28 / 1 | matcher covers exactly the rewrite sources |
| R2 | `if (isZoneHealthy)` → `if (!isZoneHealthy)` | 29 / 24 / 5 | healthy passes through; unreachable→503; non-2xx→503; TTL window; recovery |
| R3a | `ZONE_LIVENESS_TTL_MS = Infinity` | 29 / 27 / 2 | TTL window test; recovery test |
| R3b | call site `ttlMs: 1e12` (constant left at 1000) | 29 / 27 / 2 | TTL window test; recovery test |
| R4 | whole `new NextResponse(renderZoneErrorHtml(), {...503 + headers})` → `new NextResponse('Internal Server Error', { status: 500 })`, doc comment kept | 29 / 25 / 4 | unreachable→503; non-2xx→503; TTL window; recovery |
| R5a | page `<h2>{ZONE_ERROR_HEADING}</h2>` → literal `Zona fora do ar` (import left in place) | 29 / 28 / 1 | page and fallback both show ZONE_ERROR_HEADING |
| R5b | page `{ZONE_ERROR_MESSAGE}` → literal `A zona caiu.` | 29 / 28 / 1 | page and fallback both show ZONE_ERROR_MESSAGE |
| R5c | fallback `<h1>${ZONE_ERROR_HEADING}</h1>` → literal (drift on the middleware side) | 29 / 27 / 2 | page and fallback both show ZONE_ERROR_HEADING; `renderZoneErrorHtml()` contains shared copy |

**All required mutations fail, and so do the variants.** All four survivors from iteration 3 (F-A to F-D) are now killed.

### 2.2 Adversarial mutations aimed at the new behavior and harness

| # | Mutation | t / p / f | Result, killed by |
|---|---|---|---|
| A01 | TTL back to 3000 | 29/27/2 | KILLED: TTL window; recovery |
| A02 | TTL 1001 (off-by-one) | 29/27/2 | KILLED: TTL window; recovery |
| A03 | TTL 0 (probe every request) | 29/28/1 | KILLED: TTL window (`probedUrls.length === 1`) |
| A04 | TTL 500 | 29/28/1 | KILLED: TTL window (the "still inside window at +999 ms" check) |
| A05 | cache check `< ttlMs` → `<= ttlMs` | 29/27/2 | KILLED: TTL window; recovery |
| A06 | `retry-after` header removed | 29/28/1 | KILLED: unreachable→503 |
| A07 | Retry-After `'0'` | 29/28/1 | KILLED: unreachable→503 (regex `^[1-9]\d*$`) |
| A08 | content-type `text/plain` | 29/28/1 | KILLED: unreachable→503 |
| A09 | content-type header removed | 29/28/1 | KILLED: unreachable→503 |
| A10 | `cache-control: no-store` removed | 29/28/1 | KILLED: unreachable→503 |
| A11 | error page with **status 200** | 29/25/4 | KILLED: unreachable, non-2xx, TTL, recovery |
| A12 | error page + headers with status 500 | 29/25/4 | KILLED: same four |
| A13 | 503 + headers, empty body | 29/28/1 | KILLED: unreachable→503 (body equals `renderZoneErrorHtml()`) |
| A14 | missing `await` on `isHealthy()` (the Promise is truthy, so it always passes through) | 29/25/4 | KILLED: unreachable, non-2xx, TTL, recovery |
| A15 | health URL `${zone}/api/health` (drops `/remote-app`) | 29/28/1 | KILLED: healthy test (`probedUrls` equals the exact URL) |
| A16 | default zone origin `:3002` | 29/28/1 | KILLED: healthy test |
| A17 | env precedence swapped (`REMOTE_APP_URL` before `REMOTE_ZONE_URL`) | 29/29/0 | **SURVIVED**, see N1 |
| A18 | probe `return response.ok` → `return true` | 29/27/2 | KILLED: non-2xx→503; createFetchProbe non-2xx |
| A19 | probe `catch { return true }` | 29/24/5 | KILLED: unreachable, TTL, recovery, 2 probe unit tests |
| A20 | `DEFAULT_PROBE_TIMEOUT_MS` 800 → 60000 | 29/29/0 | **SURVIVED**, see N2 |
| A21 | no singleton: new cache per request | 29/28/1 | KILLED: TTL window |
| A22 | matcher gains catch-all `'/:path*'` | 29/28/1 | KILLED: matcher deepEqual |
| A23 | fallback HTML loses the retry hint | 29/27/2 | KILLED: both-show RETRY_HINT; zone-error-page shared copy |
| A24 | page loses the retry hint `<p>` | 29/28/1 | KILLED: both-show RETRY_HINT |
| A25 | fallback gains `<script>fetch(...)</script>` | 29/28/1 | KILLED: inert test |
| A26 | page calls `fetch(zone health)` at render (with `.catch`) | 29/28/1 | KILLED: renders without touching the network |
| A27 | page calls `fetch` inside `useEffect` | 29/29/0 | SURVIVED, not a regression (see N3) |
| A28 | page exports `async function getServerSideProps` that fetches the zone | 29/28/1 | KILLED: no data fetching hooks |
| A29 | page exports `const getStaticProps` | 29/28/1 | KILLED: no data fetching hooks |
| A30 | `ErroDeZonaPage.getInitialProps = ...` | 29/28/1 | KILLED: no data fetching hooks |
| A31 | page throws during SSR | 29/25/4 | KILLED: render + 3 copy tests |
| A32 | `ZONE_ERROR_HEADING = ''` in the shared content module | 29/29/0 | **SURVIVED**, see N4 |
| A33 | hook never registered (`registerHooks({` → `void ({`) | 29/18/11 | KILLED: every middleware and page test **fails**, none silently skipped |
| A34 | hook's `.tsx` load throws | 29/24/5 | KILLED: all 5 page tests fail (not skipped) |
| A35 | tamper: hook maps `../middleware.ts` to a known-good decoy, and production middleware is reverted to a bare 500 | 29/29/0 | SURVIVED, by construction (see N5) |
| A36 | tamper: hook loads page source from a known-good decoy, and the production page drifts and exports getServerSideProps | 29/29/0 | SURVIVED, by construction (see N5) |
| A37 | instrumentation only: log the URLs the hook loads | 29/29/0 | confirms the real modules are loaded (§1) |

### 2.3 Survivor notes (non-blocking)

- **N1 (A17, low).** Nothing checks that the health probe's origin uses the same env precedence as `next.config.js`
  `rewrites()`. This only matters when `REMOTE_ZONE_URL` and `REMOTE_APP_URL` are both set to different values: the
  shell would then probe one zone and proxy to another. A related weakness: `middleware.test.ts` hardcodes
  `http://localhost:3001/...`, so a CI environment with `REMOTE_ZONE_URL` set gets a false red (never a false green).
  Not claimed as covered.
- **N2 (A20, medium, pre-existing since `43dedeb`).** Nothing tests the production probe timeout. Unit tests
  inject `timeoutMs`, and the middleware tests stub `fetch` to answer immediately. If the timeout became 60 s, a
  blackholed zone (packets dropped, not refused) would hold every zone request on a cache miss for up to 60 s
  before the 503. That is a real regression of the fix under a partition failure mode, and the suite would stay
  green. It is not among the five required properties, and no handoff claims it is covered. Suggested fix for M3:
  export the default like the TTL constant, and add a middleware test whose stub `fetch` never settles until aborted.
- **N3 (A27).** A `useEffect` fetch never runs in SSR, so the page still renders with the zone down, and a client
  fetch to `/remote-app/*` would get the middleware's 503. This is not a regression of "renders with every zone down".
- **N4 (A32, low, vacuity smell).** The copy tests use `html.includes(text)`, and `includes('')` is always true. If
  a shared copy constant is emptied, both the page and the fallback lose that text together and every copy test still
  passes. They stay in sync, so the drift property holds, but the copy itself is not protected. Pre-existing in
  `zone-error-page.test.ts` and repeated in the new page test. One-line fix: `assert.ok(text.length > 0)`.
- **N5 (A35/A36, tamper class).** These survive by construction. They edit `test/support/`, so they are
  test-infrastructure tampering, not production regressions, and they show up in any diff. The real hook contains
  no such redirection. It only falls back after a module-not-found error, and A37 shows it loads the real files.
  Listed so the gate knows the harness's integrity depends on `test/support/register-next-resolution.ts` staying a
  pure resolver, which is worth a reviewer's eye on future diffs to that file.

## 3. Test-integrity smells

- **`.only` / `.skip` / `.todo` / `{skip:}`:** none in `apps/host/test`. The control run reports skipped 0, todo 0, cancelled 0.
- **Vacuous pass when a hook fails:**
  - Checked by mutation. If the hook is unregistered (A33) or broken (A34), the `test.before` import fails and every dependent test reports **fail**, not skip.
  - The `rewriteSources` guard in `before` uses `assert.ok(Array.isArray(...))`, so a malformed config fails loudly.
- **Assertions in callbacks that never run:**
  - None. The fetch stub records `probedUrls`, and tests assert on its exact contents and length, so the stub is proven to be called.
  - The page "no network" test asserts `callCount() === 0` on a mock that would throw. A26 shows it detects a render-time fetch.
- **Stubs that make assertions trivially true:**
  - None found for the vetoed properties. The pass-through check reads the real `x-middleware-next: 1` header that the real `NextResponse.next()` sets.
  - The body is compared to `renderZoneErrorHtml()`, which is legitimate, not a hardcoded expected string. A13 shows it has teeth.
  - One weak spot is the empty-string `includes` (N4).
- **Hardcoded outputs:** the expected TTL (`EXPECTED_TTL_MS = 1000`) is written independently in the test, not imported from the implementation. That is correct: it is why A01, A02 and A04 are killed.
- **Test-only code in production modules:** `__resetSharedZoneLivenessCacheForTests` is exported from `lib/zoneLiveness.ts`. It predates this commit (`43dedeb`), is named as a test hatch, and has no behavioral effect unless called. Minor, not a violation.
- **Weakened assertions:** none. Compared with iteration 3, every behavioral property is asserted more strictly. The old `REMOTE_ZONE_URL` source-text check was dropped and disclosed. Its intent is covered by A26 and A28 being killed.

## 4. Measurement integrity (`window.txt`, `overhead.txt`, 01-operacao.md §5.1)

- **`window.txt`:** three JSON lines, first 503 at 940.05 / 928.76 / 870.84 ms, with 129 / 190 / 110 bare 500s
  before it. Every one has `ct: null`, body `Internal Server Error`, and `Retry-After` 5 on the 503.
  - The values look like raw output: `performance.now()` float noise, `lastBadAtMs` just before `first503AtMs`, and a request count that does not track time (190 in 929 ms, 129 in 940 ms).
  - The doc text ("871, 929 e 940 ms … de 110 a 190 requisições", sequential loop) matches exactly.
- **Independent corroboration:** the concurrent challenger's own harness (`.agents/challenger_m2_5/window-*.jsonl`, written today and not part of this commit) gets the same magnitude.
  - Sequential SIGKILL: first 503 sent at about 909–917 ms after 79+ bare 500s.
  - SIGTERM: 887–897 ms.
  - 30 workers: first 503 *sent* at 834–887 ms, with 135–199 bare 500s.
  - I did not rely on it for the verdict, but nothing in it contradicts the worker's numbers.
- **`overhead.txt`:** 15.08 − 11.75 = 3.33 ms median difference, which matches "cerca de 3 ms (mediana medida)". Two caveats:
  - n = 20 per arm, and the p90s differ by 8 ms, so this is a noisy, low-sample estimate. The previous challenger measured "~6 ms added latency".
  - The doc says "cerca de 3 ms", which is fair for a median but should not be read as a tight bound.
- **"Com o cache de 3 s … a mesma medição deu 2,96 s":** the 2.96 s figure comes from `challenger_m2_4` (curl loop, 120 requests, 1.9 ms kill gap; see `challenger_m2_4/probe-staleness-controlled.log`), not from the worker's node harness.
  - The metric is the same (time from kill to first 503 after a warm probe), but the harness is not.
  - The worker handoff's "the same probe gave 2.96 s" slightly overstates the equivalence. Wording nit only: the number is real and traceable.
- **Reproducibility gap (minor):** the script that produced `window.txt` / `overhead.txt` is not committed. The raw output is, and the challenger's `window.mjs` independently reproduces the shape.

## 5. Dependencies and banned shortcuts

- No package.json, lockfile, workspace or `.npmrc` change.
- No `tsx`, no `--experimental-*` flag, no new dependency.
- The `apps/host` `"test"` script still says `npx tsx --test`. That is pre-existing, and M3 (R6) owns it.
- The commit message has no co-author footer and no authorship marker.
- No test disables or bypasses assertions.

## 6. Logic chain and verdict

1. Iteration 3 was vetoed because four safety-critical properties could be reverted with a green suite: bare 500, inverted branch, infinite TTL, copy drift.
2. Using my own mutations, not the worker's script, all five required mutations and three variants now fail. Among them are the literal original defect with the doc comment left intact, a TTL change applied at the call site instead of the constant, and drift on either side of the copy sync.
3. 30 of the 36 adversarial mutations against the new behavior and harness were killed. They cover:
   - status and headers;
   - TTL boundaries at 0, 500, 1001 and 3000, plus `<=`;
   - probe semantics and health URL;
   - singleton and matcher;
   - render-time fetch and all three data hooks;
   - hook failure.

   Of the 44 mutations, 6 survived:
   - Two are tampering with `test/support/`, not production regressions (A35, A36).
   - One is not a regression (A27).
   - Three are narrow coverage gaps outside the vetoed properties that no handoff claims (A17 env precedence, A20 probe timeout default, A32 empty copy constant).

   A37 is instrumentation only and is not counted.
4. Every verifiable claim in the worker handoff matches the tree. The measurements are plausible raw output, consistent with the doc and with an independent concurrent measurement. The only inaccuracies are wording-level.
5. No integrity violation: the tests are behavioral, they load the real modules, they cannot pass silently when their harness breaks, and they protect the properties they are named after.

**CLEAN**

Recommended, not blocking: fix N2 (probe timeout default untested) and N4 (empty-string `includes`) in M3, and commit the window/overhead measurement script next to its output.
