# worker_m2_fix2 — M2 remediation 2 (gate iteration 4)

**Verdict: DONE.** Run 2026-09-14 by the controller session, after the dispatched worker was stopped
before writing any file. The three tasks from `orchestrator/RETOMADA.md` §3.

## Task 1 — the tests are behavioral now (the veto)

The worker's hint worked better than the extraction plan B, and it needed no experimental flag.
`next/server.js` loads under plain Node, so `middleware.ts` did not have to be restructured:

- `apps/host/test/support/register-next-resolution.ts` registers `module.registerHooks` (sync, Node 24)
  for the three things Next's bundler resolves and Node does not: extensionless relative imports,
  `next/<subpath>` without `.js`, and JSX in `.tsx` (transpiled with the `typescript` already in
  devDependencies). No new dependency. Modules that need it are loaded with `import()` in `test.before`.
- `test/middleware-config.test.ts` (regex over the file) **deleted**, replaced by `test/middleware.test.ts`,
  which calls the real `middleware()` with a real `NextRequest` and reads the real `NextResponse`.
  Only `fetch` (the zone health route) and `Date` (`mock.timers`) are replaced. It checks: matcher equals
  the rewrite sources taken from `next.config.js` (data, not regex); healthy → `x-middleware-next`;
  down → 503, `text/html; charset=utf-8`, numeric `Retry-After`, `no-store`, body equals
  `renderZoneErrorHtml()`; non-2xx health → 503; outage still passes at +999 ms without re-probing and
  is 503 at +1000 ms; recovery after the TTL.
- `test/erro-de-zona-page.test.ts` rewritten to render the page with `react-dom/server`: no `fetch` during
  render, no `getServerSideProps`/`getStaticProps`/`getInitialProps`, and heading, message and retry hint
  present in both the rendered page and the middleware fallback.
- `test/zone-error-page.test.ts`: also asserts the retry hint and the shared `<title>`.

**Textual residue: none.** No test reads a source file as text any more. The old check that the page
source does not mention `REMOTE_ZONE_URL` was dropped; the render-time `fetch` stub and the export check
cover what it was a proxy for.

### Acceptance — the five mutations (`mutations.py`, run in a scratch copy with node_modules linked)

| # | Mutation | Result |
|---|---|---|
| control | none | 29/29 pass |
| 1 | drop `/remote-app-static/:path*` from the matcher | 28/29 — matcher test |
| 2 | `if (!isZoneHealthy)` | 24/29 — five middleware tests |
| 3 | `ttlMs: Number.MAX_SAFE_INTEGER` in the shared cache | 27/29 — TTL and recovery tests |
| 4 | `return new NextResponse('Internal Server Error', { status: 500 })`, doc comment left intact | 25/29 |
| 5 | page `<h2>` becomes a literal, import left in place | 28/29 — heading copy test |

All five fail. A first attempt without `apps/host/node_modules` linked failed the control too (typescript
lives there, not hoisted); that run was discarded, not counted.

## Task 2 — TTL 1 s, measured

`ZONE_LIVENESS_TTL_MS = 1000`, exported named constant in `lib/zoneLiveness.ts`. The TTL test was written
first and failed against 3000 (recovery at +1000 ms still passing through), then passed after the change.

Live, `next start` on both apps (`overhead.txt`, `window.txt`):
- probe overhead with the zone up: p50 15.08 ms on a request that pays a synchronous probe vs 11.75 ms on
  a cache hit at the same spacing, ≈ 3.3 ms, at most once per second per host process. Direct zone p50 2.59 ms.
- window after a kill right after a healthy probe, three runs: first 503 at 940, 929, 871 ms; before it
  129, 190, 110 bare 500s (no `Content-Type`, body `Internal Server Error`). At 3 s the same probe gave 2.96 s.
  The count follows the loop's request rate; the time follows the TTL.
- after restart: `/remote-app` 200; `scripts/smoke-test.mjs --strict` 16/16; ports freed.

## Task 3 — `01-operacao.md` §5.1

Only §5.1 touched: the table's third row now names the middleware, and three paragraphs record the
bounded exception with the numbers above, the cold-cache case and the probe overhead.

## Verification

`node --test test/*.test.ts` in apps/host 29/29; `tsc --noEmit` clean (test/ is in its include);
`next build` clean for both apps.

## Found outside scope (for M3)

`apps/remote-app` tests **fail under `node --test`**: `health.test.ts` and `fragmento.test.ts` import
`../pages/api/health` without extension. They only ever passed under `tsx`. The gen-2 gate ran host tests only.
