# TEST_READY — Next.js Multi-Zones Refactoring

## 1. Overview & Operational Status
The opaque-box End-to-End (E2E) testing infrastructure for the Multi-Zones refactoring is **READY** and fully operational.

The test suite validates the architectural transition from Webpack Module Federation (`@module-federation/nextjs-mf`) to native Next.js Multi-Zones architecture as specified in `PROJECT.md`, `ORIGINAL_REQUEST.md`, and `docs/design-bff/mfe/`.

---

## 2. How to Run the Tests

The primary test runner is `scripts/smoke-test.mjs`. It requires no external dependencies beyond Node.js v18+ (tested on Node v26.8.1 and v24.7.0). Paths resolve from the script's own location, so it can be started from any directory.

Unit suites run on Node's native test runner, with no `tsx`: `pnpm test` at the root (packages/shell-ui, then both apps), or `node --test test/*.test.ts` inside a package or app. Use the explicit glob: on Node 24.7, `node --test <dir>` runs zero tests and exits 0.

### 2.1 Quick Commands

```bash
# Standard Execution (Runs offline checks; probes and runs online checks if servers are online)
node scripts/smoke-test.mjs

# Offline Static Invariants Only (Zero-dependency audit for build/CI pipelines)
node scripts/smoke-test.mjs --offline

# Online Smoke Checks Only (Requires localhost:3000 and localhost:3001)
node scripts/smoke-test.mjs --online

# Strict CI Mode (Fails if any check fails OR if servers are unreachable)
node scripts/smoke-test.mjs --strict
```

### 2.2 Environment Configuration
You can customize target host and zone URLs via environment variables:
```bash
HOST_URL=http://localhost:3000 ZONE_URL=http://localhost:3001 node scripts/smoke-test.mjs
```

---

## 3. What Actually Runs

`TEST_INFRA.md` specifies a broader 4-tier matrix (173 documented cases). That document is a
specification: most of its cases are **not** automated. What runs today:

| Layer | Command | Count | Needs servers |
|---|---|---|---|
| Unit — shared chrome | `node --test test/*.test.ts` in `packages/shell-ui` | 15 | no |
| Unit — zone | same, in `apps/remote-app` | 17 | no |
| Unit — shell | same, in `apps/host` | 46 | no |
| Static invariants | `node scripts/smoke-test.mjs --offline` | 7 (STATIC-01..07) | no |
| Online smoke | `node scripts/smoke-test.mjs --strict` | 17 (7 static + ONLINE-01..10) | yes, 3000 and 3001 |

`pnpm check` runs typecheck, all unit suites and the static invariants. `pnpm smoke` runs the
strict smoke. Zone-outage behaviour is covered by the host unit suite against a simulated zone;
the live outage checks are manual (see `README.md` §3.3).

---

## 4. Executed Smoke & Invariant Test Cases

`scripts/smoke-test.mjs` executes both static AST/grep invariant audits and dynamic live HTTP probes:

### 4.1 Static Invariant Checks (`STATIC-*`)
- `[STATIC-01]` **Zero Module Federation references**: Scans `apps/` and `packages/` for banned tokens (`@module-federation`, `remoteEntry`, `NextFederationPlugin`, `remote/ServerCard`, `remote/RemoteDashboard`).
- `[STATIC-02]` **TypeScript strict optional properties**: Verifies `compilerOptions.exactOptionalPropertyTypes === true` in `apps/remote-app/tsconfig.json`.
- `[STATIC-03]` **Plain HTML `<a>` navigation**: Enforces that cross-zone navigation to `/remote-app` in `apps/host/pages/index.tsx` and in the shared `packages/shell-ui/src/SideNavigation.tsx` uses native `<a>` tags and never Next.js `<Link>`; the shared navigation may not import from `next/` at all.
- `[STATIC-04]` **Shell DAL exclusion**: Verifies zero database packages or domain access layers in `apps/host/package.json` or `apps/host/pages/`.
- `[STATIC-05]` **Zone directory rename**: Verifies `apps/remote` is renamed to `apps/remote-app` and `package.json` name is updated.
- `[STATIC-06]` **Host rewrites configuration**: Loads `apps/host/next.config.js`, calls `rewrites()`, and requires exactly the sources `/remote-app`, `/remote-app/:path*` and `/remote-app-static/:path*`, each keeping its path on one zone origin. (Before 2026-09-14 this was a substring check that passed with the root rule removed, D4.)
- `[STATIC-07]` **Remote zone configuration**: Loads `apps/remote-app/next.config.js` and requires `basePath === '/remote-app'` and `assetPrefix === '/remote-app-static'`.

### 4.2 Online Smoke Checks (`ONLINE-*`)
- `[ONLINE-01]` **Host Shell Home**: `GET http://localhost:3000/` returns HTTP 200, renders shell runtime diagnostics, and includes `<a href="/remote-app">`.
- `[ONLINE-02]` **Zone Index via Shell Rewrite**: `GET http://localhost:3000/remote-app` returns HTTP 200, rendering remote app index content.
- `[ONLINE-03]` **Zone Health via Shell**: `GET http://localhost:3000/remote-app/api/health` returns HTTP 200, `Content-Type: application/json`, and body `{"ok":true}`.
- `[ONLINE-04]` **Zone Health Direct**: `GET http://localhost:3001/remote-app/api/health` returns HTTP 200 `{"ok":true}` directly on zone process.
- `[ONLINE-05]` **Fragment Demo via Shell**: `GET http://localhost:3000/remote-app/_fragmento/demo/42` returns HTTP 200, `Content-Type: text/html; charset=utf-8`, contains `Demo fragment (id: 42)`, and strictly contains zero `<script>` tags or inline handlers.
- `[ONLINE-06]` **Fragment Demo Direct**: `GET http://localhost:3001/remote-app/_fragmento/demo/42` returns HTTP 200 with inert markup directly on port 3001.
- `[ONLINE-07]` **Fragment Unknown / Unauthorized (Masking)**: `GET http://localhost:3000/remote-app/_fragmento/unknown/1` returns HTTP 204 No Content with 0-byte payload.
- `[ONLINE-08]` **Fragment Method Not Allowed**: `POST http://localhost:3000/remote-app/_fragmento/demo/1` returns HTTP 405 Method Not Allowed.
- `[ONLINE-09]` **Static Asset Proxying**: `GET http://localhost:3000/remote-app-static/...` proxies without host 5xx server crash.
- `[ONLINE-10]` **Mixed-case zone prefix stays in the shell**: `GET /REMOTE-APP` and `GET /Remote-App/api/health` on the host return 404. Both answer 200 from the zone if the rewrites match case-insensitively, which would let them bypass `middleware.ts` (see `docs/design-bff/mfe/01-operacao.md` §5.1). Guards `experimental.caseSensitiveRoutes` across Next upgrades.

---

## 5. Pass / Fail Semantics

### 5.1 Exit Codes
- **`0` (PASS)**: All executed test cases succeeded. In default mode without `--strict`, if servers are offline, static checks passing will exit `0`.
- **`1` (FAIL)**: One or more test assertions failed, or target servers were offline when `--strict` or `--online` was specified.

### 5.2 Failure Diagnosis
- Every failing check prints the exact test ID, descriptive context, and underlying failure message (e.g. specific file paths and offending tokens for static checks, or received HTTP status and body for online checks).
- When target servers are offline, the runner provides explicit instructions on how to start them (`pnpm dev` or `pnpm start`).

---

## 6. Authoritative Reference Documents
- `TEST_INFRA.md` — Complete specification of test philosophy, 4-tier methodology, and full 16-feature mapping matrix.
- `PROJECT.md` — Monorepo architecture principles, milestone responsibilities, and interface contracts.
- `ORIGINAL_REQUEST.md` — Requirements R1–R6 and acceptance criteria.
