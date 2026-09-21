# worker_final_fix — remediation of the final combined gate

**Verdict: DONE.** Controller session, 2026-09-15. Scope per human decision (GATE_STATUS, "Human decisions 2026-09-15"):
R1 + D2 behavioural tests + reviewer A1/A2; D2 hardening deferred as D11.

| Finding | Change |
|---|---|
| challenger_final_1 R1 (blocking) | `apps/host/middleware.ts`: pathname guard removed; comment says why (matcher/rewrite see the raw path, `nextUrl.pathname` is normalised). Two tests in `middleware.test.ts` written first and seen failing against the guard (`expected 503, actual 200` ×2): bare `/remote-app-static`, and `/remote-app/..` whose `nextUrl.pathname` is `/`. |
| auditor_final_1 veto / reviewer_final_1 B1 | `packages/shell-ui/test/shell-ui.test.ts` rewritten: markup via react-dom/server; handlers by calling the hook-free components and invoking `onChange`/`onClick` (ping fallback dispatches on a stand-in `window` EventTarget); host `<a>` elements only, no component in the nav tree; imports allow-listed through `ts.preProcessFile` (comments cannot satisfy it); every rendered class styled in shell-layout.css; every `@import` in both `globals.css` resolves and one is shell-layout.css. New resolution hook `packages/shell-ui/test/support/register-tsx.ts`. New `apps/remote-app/test/zone-page.test.ts` renders the real zone page with real server data. |
| auditor §B.2(3), reviewer B4 (events) | `apps/{host,remote-app}/lib/events.ts` re-export `MFE_EVENTS` from `@mfe/shell-ui`; `events.test.ts` in each app asserts identity. |
| auditor STATIC-03 / STATIC-01 | STATIC-03 reads `packages/shell-ui/src/SideNavigation.tsx`, fails if missing, bans `from 'next/…'` there; STATIC-01 scans `apps/` and `packages/`. Dead `apps/host/components/{Header,SideNavigation,ToastContainer}.tsx` deleted (no importer). |
| reviewer B2 | root `pnpm test`/`pnpm typecheck` run shell-ui first. Approved install: `typescript@5.9.3`, `@types/react@18.3.31` devDependencies in shell-ui; `pnpm install` downloaded 0, added 0; lockfile +7 lines (shell-ui importer only); tsconfig `paths` into the host's node_modules removed; `pnpm --filter @mfe/shell-ui typecheck` now runs. |
| reviewer A1 | §5.1: each request waits the remainder of the in-flight probe, up to 800 ms, median 454 ms among waits over 100 ms. Script committed: `hung.mts`; `hung.txt` 3 runs `{"n":443,"slowOver100":175,"share":0.4,"medianSlowMs":454,…}` (453–454). |
| reviewer A2, B6 | `zoneLiveness.ts` comment 871-950 ms; duplicate `*.tsbuildinfo` in `.gitignore` removed. |

## Falsification (scratch copy, `mut.py`, `mutations.txt`)
Control: shell 15/15, zone 17/17, host 42/42, static 7/7. **27/27 required mutants caught**: R1 guard restored (host 40/2),
guard `startsWith('/remote-app')` (41/1), D1, D1b, D2 declared defect (shell 12/3), D2b, D2c, D3 next/link-like anchor, D3c
unused next/link import (shell + STATIC-03), D4a, D4b preventDefault, D4d, D5a, D5b, D6, D13, D13b, D14 comment-only class,
D7b/D7c app event copies, D10b ServerCard in comment, D12b, D12c, Z1 zone without ShellLayout (zone 14/3), Z2, unstyled
rendered class, federation token in packages/ (STATIC-01). **4 declared survivors** (effects, D10): X-D9, X-D9b, X-D11, X-TC.

## Verification
`pnpm typecheck` (shell-ui, zone, host) exit 0. `pnpm test` exit 0: shell-ui 15/15, zone 17/17, host 42/42. Static 7/7.
`pnpm build` both clean. Live (`smoke-strict.txt`): strict smoke 17/17; zone page has app-header, layout-sidebar,
toast-portal. Zone killed (`r1-live-zone-down.txt`): `/remote-app-static` (GET, `?x=1`, HEAD, POST, OPTIONS),
`/remote-app/..`, `/remote-app/%2e%2e`, `/remote-app/../REMOTE-APP`, `/remote-app-static/..`, `/remote-app-static/x`,
`/remote-app` all 503 text/html; `/` 200. Ports freed.

---

# Addendum — worker_final_fix2 (gate iteration 3), 2026-09-15

Addresses reviewer_final_2 F1–F5. Challenger/auditor of iteration 2 died on the rate limit with no verdict.

| Finding | Change |
|---|---|
| F1 (blocking) | `apps/host/test/host-page.test.ts`: host page rendered (chrome, `/` active, remote link inactive, content in `<main>`); hook-free `HostLayout` called as a function (returns `ShellLayout`, passes session, handler, route, children); its `onToastPing` dispatches `MFE_EVENTS.TOAST` on a stand-in window. D10 reworded and U1 added. |
| F2 | `middleware.test.ts`: middleware called with a Proxy that throws on any property read, zone down → 503. |
| F3 | component check ignores Fragment (symbol type); zone-page class regex `nav-link\s*"`. |
| F4 | import allow-list: relative imports must resolve inside `packages/shell-ui/src`. |
| F5 | CSS comments stripped before matching; boundary `(?![\w-])`; `@import` scan also strips comments. |

Falsification (`mutations2.txt`, `mut.py`): control shell 15, zone 17, host 46, static 7. **40/40 required caught**, including
U2–U6 (host 41–45 pass), F2a `/erro-de-zona`+`/_next` guard, F2b `.ico` guard, F2c `request.url` guard, F4 `./../` import,
F5/F5b/F5c CSS. **5 declared survivors (D10)**: X-D9, X-D9b, X-D11, X-TC, U1. **Harmless changes stay green**: Fragment
around the nav list, className without trailing space.
