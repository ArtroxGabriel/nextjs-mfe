# worker_m3 — Milestone 3: workspace purge and final E2E (R6)

**Verdict: DONE.** Controller session, 2026-09-14. Commits 38a204c (tests, static checks, D4/D5/D8) and
2088139 (purge + lockfile). Human decision 2026-09-14: full purge, including the explicit webpack pins, with
`pnpm install`.

## What changed
- `pnpm-workspace.yaml` → only `packages: ['apps/*']` (no `allowBuilds`, `onlyBuiltDependencies`, `overrides`).
- `.npmrc` → no `only-built-dependencies[]` lines; `node-linker=hoisted` and `confirm-modules-purge=false` kept
  (not Federation-specific; changing the linker would reshape node_modules).
- `webpack: 5.90.3` removed from root devDependencies and both apps' dependencies (Next ships compiled webpack).
- `pnpm install` (pnpm 11.22.0): `Packages: -75`, lockfile 650 deletions, 0 additions, `pnpm-workspace.yaml`
  not rewritten by pnpm.
- Test scripts: `node --test test/*.test.ts` in both apps; root `pnpm test`.
- Zone tests fixed to run natively (they only ever passed under tsx): `health.test.ts` imports `.ts`
  (`allowImportingTsExtensions` added to the zone tsconfig), `fragmento.test.ts` imports the real runtime API
  route through a per-zone copy of the resolution hook.
- D4: STATIC-06 and STATIC-07 load the real configs. Old STATIC-06 PASSED with the root rule removed; new FAILS
  (verified in a scratch copy).
- D8: static checks resolve the root from `import.meta.url`; 7/7 from `apps/host`.
- D5: `*.tsbuildinfo` gitignored; `apps/remote-app/tsconfig.tsbuildinfo` untracked.
- Root `PROJECT.md` symlink pointed at `/home/gabrigas/...`; now relative to `.agents/orchestrator/PROJECT.md`.
- `TEST_READY.md` (STATIC-06/07, ONLINE-10, native runner), `WALKTHROUGH.md` (historical notice), plan
  `2026-09-11-multizone-refactor.md` (boxes ticked, `node --test`, execution record).

## Verification (after install)
- R6 grep `@module-federation|remoteEntry|NextFederationPlugin|remote/ServerCard|remote/RemoteDashboard` and
  `exposes:|remotes:` in `apps/` (excluding node_modules/.next): 0. Same tokens in `apps/*/.next`: 0.
- `pnpm typecheck`: both clean. `pnpm test`: zone 13/13, host 36/36.
- `pnpm build`: both clean; Next lists `caseSensitiveRoutes` under experiments.
- Both apps on `next start`: `node scripts/smoke-test.mjs --strict` **17/17** (`smoke-final.txt`); host HTML has
  0 `remoteEntry`; zone HTML loads chunks from `/remote-app-static/_next/...`.
- ONLINE-10 falsified: host rebuilt with `caseSensitiveRoutes: false` → 16/17, `/REMOTE-APP` got 200
  (`smoke-noflag.txt`); restored from git and rebuilt → 17/17. Ports freed.

## Not done
- 20 orphaned directories from the old install remain in `node_modules/.pnpm` (`@module-federation+*`,
  `@rspack+core`, `webpack@5.90.3`, `enhanced-resolve@5.17.1`): untracked, unreferenced by the lockfile or any
  link; the hoisted linker does not prune `.pnpm`. Removing them needs `rm -rf`, which needs human approval.
