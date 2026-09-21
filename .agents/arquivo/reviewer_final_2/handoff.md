# reviewer_final_2 — final combined gate, iteration 2 (d335af5)

Saved by the orchestrator from the agent's final report (revisor-mfe has no write tool).

`REQUEST_CHANGES` — one blocking finding (D10 incomplete); R1 fix correct.

Mutations in `scratchpad/reviewer_final_2/tree` (`mut.py`), restored and diffed pristine. Controls: `pnpm test` exit 0
(shell-ui 15/15, zone 17/17, host 42/42), `pnpm typecheck` exit 0, static 7/7.

## Blocking
**F1 — D10 is not the complete residue; five non-effect mutants survive, three testable today.** D10 says "All four live in
`useEffect` or in state set by it". Survivors (shell-ui | zone | host): U1 `apps/remote-app/pages/index.tsx:48`
`onSessionChange={handleSessionChange}` removed 15/0 | 17/0 | 42/0 (zone selector dead); U2 HostLayout does not pass
`onSessionChange` (host selector dead); U3 HostLayout does not pass `onToastPing`/`onNavigate`; U4 host page
`activeRoute="/remote-app"`; U5 host page `<HostLayout>` replaced by a fragment (no chrome) — all 15/0 | 17/0 | 42/0.
Feasible without new dependency: throwaway test rendered the host page (`HOSTPAGE true true`) and called hook-free HostLayout
(`HOSTLAYOUT true true function function`). Fix: `apps/host/test/host-page.test.ts` (chrome, `/` active) + HostLayout wiring
test by function call; U1 needs a DOM renderer → D10, reworded "effects, and handlers wired inside hooked page components".

## Non-blocking
- **F2 (low)** R1 tests catch historical guard shapes, not every pathname early return: `p === '/erro-de-zona' ||
  p.startsWith('/_next/')` and `p.endsWith('.ico')` survive 42/0 (`/remote-app/../erro-de-zona`, `/remote-app/favicon.ico`
  would bypass). Fix: call middleware with a Proxy that throws on any property read, zone down, expect 503.
- **F3 (low)** brittle: `shell-ui.test.ts:159` counts a Fragment (symbol type) as a component (wrapping `<ul>` → 14/1); fix
  filter `function|object`. `zone-page.test.ts:33` matches `class="nav-link "` with trailing space (→ 16/1); fix `\s*`.
- **F4 (low)** import allow-list accepts `./../`: `import type … from './../../../apps/remote-app/types'` in Header → all green.
  Fix: resolved path must stay inside `src/`.
- **F5 (info)** CSS coverage regex `\.${name}\b` satisfied by a comment or longer selector. Fix: strip comments, `(?![\w-])`.

## Brief answers
R1 correct and complete (matcher = 3 rewrite literals, parity tested; no rewrite path outside matcher; live evidence 503;
comment accurate). D2 tests are behavioural; calling components as functions fails closed (Header with `useState` → shell 10/5,
"Invalid hook call"). MFE_EVENTS re-export: importers are client components only; middleware chain imports no shell-ui; Pages
Router only; no circularity; literals only in shell-ui events.ts. STATIC-01/03, root scripts, lockfile (+7, shell-ui importer),
tsconfig, `.gitignore` OK. §5.1 matches hung.txt; TEST_READY accurate; D11 claims verified against code.
