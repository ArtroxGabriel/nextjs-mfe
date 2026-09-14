# Deferred Defects & Scope Decisions

Tracked items that are real, verified, and deliberately NOT fixed in the milestone that found them.
Each was escalated to the human, who decided the round it belongs to.

## D1 — SSE handler leaks its interval when the client disconnects through the rewrite
- **Found by**: challenger_m2_3 (M2 gate, iteration 2), finding F2
- **Evidence**: one 8-second client connection through the host produced `SSE_CLIENT_CONNECTED: 1`,
  `SSE_CLIENT_DISCONNECTED: 0`, `SSE_EVENT_BROADCAST: 15544` over 6+ hours; `zone.log` reached 2.37 MB.
- **Where**: `apps/remote-app/pages/api/sse-events.ts:49` — `req.on('close', ...)` exists and calls
  `clearInterval`, so the code is written correctly but the event never fired behind the rewrite proxy.
- **Why deferred** (human decision, 2026-09-12): the file is pre-existing PoC code that the refactor only
  moved during the rename, so it is M1-owned and not a regression of M2. The fix needs real investigation
  (does `close` fail only behind the rewrite, or also direct on :3001?) and verification with more than one
  connection — n=1 today.
- **Narrowed 2026-09-12 by challenger_m2_4**: the missing disconnect reproduces hitting the zone DIRECTLY on :3001, with no middleware or rewrite in the path. The leak is zone-owned; the rewrite neither causes nor worsens it. This closes challenger_m2_3's open caveat.
- **Owner**: a later round, before anything depends on SSE in production.

## D2 — The zone does not render the shell's header and side navigation
- **Found by**: reviewer_m2_3 (M2 gate, iteration 2), POC.md regression 1
- **Evidence**: `apps/remote-app/pages/index.tsx` renders its own standalone `<header>` and never reuses
  `HostLayout`/`Header`/`SideNavigation`. Cross-zone navigation is a hard document swap, so the shell chrome
  disappears on `/remote-app`.
- **Conflicts with**: `POC.md` — "remote é uma parte interna da tela do host (host com header e sidenavigation)".
- **Why deferred** (human decision, 2026-09-12): Rodada 2, after M3. Restoring the chrome means the zone
  re-implements it; that is new design work, not a gate remediation.

## D3 — Cross-zone session inheritance is non-functional end to end
- **Found by**: reviewer_m2_3 (M2 gate, iteration 2), POC.md regression 2
- **Evidence**: the old path forwarded `x-user-session` from host SSR and died with `lib/safeRemoteLoader.ts`.
  `apps/remote-app/pages/index.tsx` now calls `getServerData()` with no session, and `apps/host/lib/session.ts`
  is localStorage-only, so nothing reaches the server. The designed mechanism (cookie + shared store,
  `01-operacao.md` §2) was never built.
- **Why deferred** (human decision, 2026-09-12): Rodada 2, after M3. Same reason as D2.

## D4 — STATIC-06 is a vacuous check
- **Found by**: auditor_m2_2 (M2 gate, iteration 2)
- **Evidence**: reproducing `testHostRewritesConfig`'s `.includes()` logic against a config with the zone-root
  rule deleted still reports PASS. STATIC-03 was proven to work correctly by the same method.
- **Where**: `test/e2e/static-invariants.mjs`
- **Routed to**: M3, which owns `test/e2e/**` cleanup.

## D5 — `apps/host/tsconfig.tsbuildinfo` is untracked and not gitignored
- **Found by**: challenger_m2_3, finding F4. Reappears on every build.
- **Routed to**: M3.

## D6 — The zone-outage guarantee has a bounded exception, measured
- **Found by**: challenger_m2_4 (M2 gate, iteration 3)
- **Evidence**: cache warmed, zone killed 1.9 ms later, then 120 consecutive requests over 2.96 s returned the
  byte-identical pre-fix failure (`500`, no `Content-Type`, body `Internal Server Error`), before the first correct 503.
  With the cache already past its TTL at kill time, zero requests were affected. Cold cache (host booted with the zone
  already dead) serves a correct 503 on the very first request, because an empty cache forces a synchronous probe.
- **Meaning**: `01-operacao.md` §5.1 reads as an unconditional guarantee ("Zona inteira fora → shell serve /erro-de-zona").
  In reality the guarantee holds in steady state, with a window bounded by the liveness TTL right after an outage begins.

- **Update 2026-09-14 (challenger_m2_5)**: the window is bounded by time for a crashed zone (871–940 ms over 11
  sequential kills at TTL 1 s). For a hung zone see D7. §5.1 records both.

## D7 — A hung zone holds requests inside the stale window for Next's proxy timeout
- **Found by**: challenger_m2_5 (M2 gate, iteration 4), finding D-b
- **Evidence**: zone frozen with SIGSTOP right after a healthy probe; a request inside the 1 s window waited 30.03,
  30.03 and 30.06 s and then got the bare 500 (3/3). The next request paid the 800 ms probe timeout (815–817 ms) and got
  503; later requests got 503 from the cache.
- **Why not fixed**: the lever is `experimental.proxyTimeout` on the host, which applies to every proxied request,
  including SSE streams and slow legitimate responses through the rewrite. Choosing a value is an operational
  decision, not a gate remediation. Documented in `01-operacao.md` §5.1 instead.
- **Owner**: a later round, together with D1 (SSE) since both touch long-lived proxied responses.

## D8 — Static invariant checks resolve paths from the current directory
- **Found by**: controller, M2 gate iteration 5. `test/e2e/static-invariants.mjs` uses `process.cwd()` as the
  project root; `node ../../scripts/smoke-test.mjs --strict` from `apps/host` fails STATIC-02/03/05/06/07 (11/16)
  with the tree correct.
- **Routed to**: M3, with D4.
