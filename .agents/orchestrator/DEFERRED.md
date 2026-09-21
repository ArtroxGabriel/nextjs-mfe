# Deferred Defects & Scope Decisions

## Congelamento da PoC `apps/` — decisão do humano em 2026-09-21

A revisão `docs/revisao/2026-09-15-revisao-base-generica.md` §7 foi decidida: a base é validada em
`repos/` (App Router) e a PoC `apps/` fica **congelada como evidência histórica** (ADR-0009). Nenhum
item abaixo será corrigido na PoC. Cada um fecha como "encerrado por substituição" e o risco que ele
descreve passa a ser requisito da base nova, verificado no gate dela.

| Item | Trabalho feito na PoC (sem gate independente) | Onde o risco vive na base nova |
|---|---|---|
| D1 — SSE vaza intervalo | `23aecd1`: limpeza em `res`/`req`/`socket` + testes unitários; sem medição ao vivo com n>1 | Rodada 3 (SSE centralizado no shell); a base genérica não tem SSE |
| D3 — sessão entre zonas | `53b7c9a`: cookie `host_user_session=<userId>`, legível por JS, escrito por host **e** zona | Resolvido pelo desenho: cookie opaco `__Host-session`, store compartilhado, shell escritor único |
| D6/D7 — janela da sonda e zona travada | `aecd971` só torna o timeout da sonda configurável; o 500 após ~30 s (proxyTimeout) segue | Falha isolada de zona no shell da base nova; decisão operacional do `proxyTimeout` continua em aberto |
| D9/D10 — testes de DOM | `bb3d051`: suíte happy-dom; exige `pnpm install --frozen-lockfile` | Moldura nova (`@erp/moldura`) testa o barramento de toast sem DOM |
| D11 — moldura | `9b1a0b9` (CSS) e `bb3d051` (timers do toast); sessão espelhada e acessibilidade seguem | `@erp/moldura`: menu com `aria-current`, um `<h1>` por página, toast tipado |

Histórico original abaixo.


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
- **Update 2026-09-15 (2)**: final combined gate FAILED on D2 test integrity (auditor_final_1 veto). worker_final_fix replaced the
  source-regex tests with rendered and handler-level tests (27/27 mutants caught); effect-driven residue is D10, hardening is D11.
  Closes when a gate passes.
- **Update 2026-09-15**: Gabriel implemented it ahead of schedule as `packages/shell-ui` (commits `ed9aa05`,
  `fa990ec`, `9dbca4c`), merged in `90e8319`. Under verification in the final combined gate; not closed until it passes.
  The zone page now also mirrors the session through `localStorage['host_user_session']` on the shared origin — a
  client-side stand-in, not the cookie + store mechanism D3 asks for.

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
  503; later requests got 503 from the cache until it expired. The wait recurs: the cache trusts a result for 1 s from
  the end of each probe, so while the zone stays hung every expiry starts another 800 ms probe that every arriving
  request waits on — about 40% of a continuous stream (reviewer_m2_6: 175 of 442 requests over 100 ms, real cache and
  probe against a fetch that never answers).
- **Why not fixed**: the lever is `experimental.proxyTimeout` on the host, which applies to every proxied request,
  including SSE streams and slow legitimate responses through the rewrite. Choosing a value is an operational
  decision, not a gate remediation. Documented in `01-operacao.md` §5.1 instead.
- **Owner**: a later round, together with D1 (SSE) since both touch long-lived proxied responses.

## D8 — Static invariant checks resolve paths from the current directory
- **Found by**: controller, M2 gate iteration 5. `test/e2e/static-invariants.mjs` uses `process.cwd()` as the
  project root; `node ../../scripts/smoke-test.mjs --strict` from `apps/host` fails STATIC-02/03/05/06/07 (11/16)
  with the tree correct.
- **Routed to**: M3, with D4.

## D9 — The outage page's no-network guard does not see a fetch inside an effect [RESOLVED 2026-09-18]
- **Found by**: reviewer_m2_5 (M6), confirmed by auditor_m2_4 (A27) and auditor_m2_5.
- **Evidence**: `useEffect(() => { fetch(...) }, [])` in `pages/erro-de-zona.tsx` keeps the host suite green.
  `react-dom/server` never runs effects, and no DOM renderer (jsdom, happy-dom, react-test-renderer,
  @testing-library) is installed.
- **Resolved (2026-09-18)**: Covered by `apps/host/test/dom-outage-page.test.ts` using `happy-dom`. Mounts `ErroDeZonaPage` in DOM with a mocked `fetch` and asserts 0 network calls occur during mount or unmount effects.

## D10 — Code that runs only inside effects is untested [RESOLVED 2026-09-18]
- **Found by**: worker_final_fix (2026-09-15), corrected after auditor_final_3 V2.
- **Evidence**: Survivors that live only in `useEffect` (react-dom/server never runs effects; no DOM renderer installed, same cause as D9).
- **Resolved (2026-09-18)**: Covered by DOM test suite (`happy-dom` + `node --test`):
  - `apps/remote-app/test/dom-session-storage.test.ts`: multi-tab session persistence and fallback.
  - `packages/shell-ui/test/dom-toast-and-header.test.ts`: ToastContainer `mfe:toast` event subscription and auto-dismiss timer cleanup.
  - `apps/remote-app/test/dom-telemetry-sse.test.ts`: RemoteTelemetry EventSource instantiation, stream parsing, and socket closure.
  - `apps/remote-app/test/dom-map.test.ts`: MapLibre GL map container lifecycle, pins, and `flyTo` navigation.
  - Documented in `docs/testes-navegador.md`.

## D11 — Shared chrome hardening (human decision 2026-09-15: not in the final-gate remediation)
- **Session mirror unvalidated** (reviewer_final_1 B3, challenger_final_1 D2-1): `JSON.parse(raw) as UserSession` checks only
  `userId`; an object-valued `userName`/`role` throws `Objects are not valid as a React child` on the zone and host pages
  (shared key, persists until cleared); `{"userId":"usr_viewer_03","role":"admin"}` shows viewer in the header and admin in the
  banner; SSR always renders the default admin (D3). Pre-existing: JSON `null` throws in `apps/host/pages/index.tsx` effect.
  Fix: `readStoredSession`/`writeStoredSession` in shell-ui with the key as a constant, resolving `userId` against
  `PRESET_USERS`; relabel the zone banner as client-side only until D3.
- **Chrome not visually identical** (reviewer_final_1 B4, challenger_final_1 D2-2): `apps/host/styles/globals.css` redefines 13
  shell-ui selectors and `:root` after its `@import` (`.layout-main` 2rem + max-width vs 2.5rem, `.nav-*`, `.toast-card`
  animation, `--border-color`, `--bg-color`).
- **Accessibility and robustness** (reviewer_final_1 B5): no `aria-current` on the active nav link; two `<h1>` on the zone page;
  `ToastContainer` accepts any `CustomEvent` detail and never clears its timers on unmount; zone header shows "(Port 3000)"
  labels.
- **Build-only checks** (auditor_final_1 A.4): a non-literal middleware `matcher` passes the unit suites; only `next build`
  or a live check sees it. `apps/*/lib/logger.test.mjs` sit outside the `test/*.test.ts` glob and never run.
- **Duplicate download** (challenger_final_1 II.3): ≈45 kB gzip of identical framework bytes re-downloaded on the first
  cross-zone navigation, because the browser cache is keyed by URL prefix.
