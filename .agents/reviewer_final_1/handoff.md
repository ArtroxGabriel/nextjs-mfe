# reviewer_final_1 — final combined gate (merge 90e8319, HEAD f9f5c8a)

Saved by the orchestrator from the agent's final report (revisor-mfe has no write tool).

`REQUEST_CHANGES` — one blocker, in the merged D2 work. M2 iteration 6 + M3 alone: APPROVE.

Evidence and scratch mutations: `scratchpad/reviewer_final_1/` (`mutate.sh`, `hung.mts`, `static.mjs`,
`apps/remote-app/test/zz-render.test.ts`). Control in copy: host 39/39, zone 13/13, shell-ui 10/10; typecheck clean.

## A. M2 iteration 6 (bda529a) + M3 (38a204c, 2088139, c930a08)
Confirmed: F1 recurrence in §5.1 (checkedAt set at probe end); F2 ONLINE-10 + experimental note (not run live);
F3 X1 → 38/39; F5 X3 → 37/39; auditor F-1 timeout 20 ms → 38/39; bare-500 revert in zoneDecision.ts → 33/39;
F6 backed by challenger_m2_6's 9540 requests; D4 STATIC-06 FAIL with root rule deleted, 7/7 restored; D8 7/7 from
apps/host; D5 0 tracked tsbuildinfo; purge clean, R6 grep 0. Merge resolutions sound (middleware-config.test.ts was
regex + 2 decision tests, kept; ZONE_MATCHER_PATHS redundant with middleware.test.ts literal-vs-rewrites check;
dropped shared-cache test only asserted truthiness).

- **A1 (low)** §5.1 "cada expiração repete a espera de 800 ms para toda requisição": each request waits only the
  remainder of the in-flight probe. `hung.mts`: `{"n":444,"slowOver100":175,"share":0.39,"medianSlowMs":455,
  "meanAllMs":182,"maxMs":802}`. Fix: "espera o restante da sonda, até 800 ms (mediana 455 ms entre as que esperam
  mais de 100 ms)".
- **A2 (low)** `apps/host/lib/zoneLiveness.ts:87` comment "0.87-0.94 s" vs §5.1 871–950 ms.

## B. Merged D2 (packages/shell-ui, zone page, host adapter)
Confirmed: plain `<a>` everywhere, no next/link or next/router outside tests; shell has no DAL (only fetch is the
probe); no runtime sharing across zones (source package via transpilePackages, matches `00-arquitetura.md` §5.2
`@erp/ui`); single React instance; middleware bundle does not import shell-ui; pathname guard is as strict as the
matcher, no bypass (untested: G1 `if (false)` keeps 39/39, harmless).

- **B1 (BLOCKS closing D2)** No test catches D2 being undone. Z1: remove `<ShellLayout>` and localStorage read from
  `apps/remote-app/pages/index.tsx` → shell-ui 10/10, zone 13/13 (malformed variant also 13/13). Shell-ui mutations
  all green across shell-ui/host/zone: S1 ToastContainer removed; S2 `{showToastButton && onToastPing && (` (the
  exact bug test 8 is named after); S3 `onSessionChange?.(selected)` removed; S4 preventDefault on cross-zone `<a>`;
  S5 event renamed `'mfe:toasts'`; S6 activeRoute not passed. S0 `{children}`→`{null}` caught only via host
  erro-de-zona (36/39). Tests 3,5,7,8,10 are source regex; only 1–2 and 9 behavioural; 4 partially. Same pattern
  vetoed in iteration 3. Behavioural test is possible with no new dependency (`zz-render.test.ts`, zone resolution
  hook + react-dom/server + real getServerData: real page `HAS app-header true HAS sidebar true HREF / true toast
  true`; without ShellLayout all false). Fix: replace 3,5,7,8,10 with renderToStaticMarkup tests (header, sidebar,
  both hrefs, toast-portal, ping button with/without onToastPing, nav-link-active); add zone test rendering
  pages/index.tsx; declare S3/S4/S5 next to D9 (need DOM renderer). Keep D2 open until then.
- **B2 (medium)** root `pnpm test`/`pnpm typecheck` skip shell-ui (TEST_READY.md:14 claims root runs the unit
  suites); `pnpm --filter @mfe/shell-ui typecheck` → `tsc: not found` (no typescript devDependency); its tsconfig
  `paths` point into `apps/host/node_modules/@types/react`. Fix: add shell-ui to root scripts; pinned typescript +
  @types/react devDependencies in shell-ui (dependency change → human approval).
- **B3 (medium; D3 not solved)** `apps/remote-app/pages/index.tsx:17-28` casts `JSON.parse(raw) as UserSession`,
  checks only userId: `{"userId":"ghost"}` → empty fields, `role-undefined`, select matches no option;
  `{"userId":"usr_viewer_03","role":"admin"}` → header viewer, banner/ServerCard admin. Key `'host_user_session'`
  duplicated in host and zone, no schema. SSR always renders Ana Souza (Admin). challenger_d2_1 and the "Active Zone
  Session" label read as working inheritance. Pre-existing: `apps/host/pages/index.tsx:28` stored `null` → throws in
  useEffect. Fix: shared `readStoredSession`/`writeStoredSession` in shell-ui with key constant, resolve userId
  against PRESET_USERS, fallback DEFAULT_SESSION; relabel zone banner as client-side only.
- **B4 (low)** host `globals.css` redefines shell selectors after the `@import`, 8 differing values (`.layout-main`
  padding 2.5rem vs 2rem, `.nav-title` 0.9 vs 0.85rem, `.nav-icon`, `.nav-description`, `.nav-badge-*`,
  `.toast-card` animation) → chrome not identical; `apps/host/components/{Header,SideNavigation,ToastContainer}.tsx`
  dead; `'mfe:toast'` typed in three files. Fix: delete duplicates and dead components; import MFE_EVENTS from
  shell-ui.
- **B5 (low)** no `aria-current` on active nav link (`SideNavigation.tsx:20,35`); two `<h1>` on zone page
  (`Header.tsx:47`, `index.tsx:53`); `ToastContainer.tsx:157` unvalidated CustomEvent detail (`{}` → key undefined,
  "Invalid Date"), setTimeout not cleared on unmount; zone header shows "(Port 3000)" labels.
- **B6 (info)** app tsconfig `paths` map runtime `react` to `@types/react` — works only via JsConfigPathsPlugin
  fallback; B2 fix removes it. `.gitignore` lists `*.tsbuildinfo` twice.
