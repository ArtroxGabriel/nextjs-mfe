# SDD ledger — plan: docs/superpowers/plans/2026-10-07-e3-e4-e5-showcase.md

Task 1: dispatched (Sonnet), main BASE f16fc29
Task 1: implemented (main f16fc29..beb5b95), conferir exit 0 in dev and OIDC, oidc 6/6, redis 135/135, M1-M3 caught; review dispatched
Task 1: minor (deferred): conferir 'modo de login em uso' condition always true (informative); hard-coded http://localhost:3000 instead of SHELL; rewrite check accepts only path form
Task 1: minor (deferred): oidc.test wrapper asserts Keycloak origin after login (clearer error if checked before)
Task 1: complete (main f16fc29..beb5b95, review clean)
Task 2: dispatched (Sonnet), main BASE 076588c
Task 2: implemented (main 076588c..7ea3658), appear 31.5 s, down 503 immediate, back 200 immediate, removed ~30 s; M1 M2 caught. Found: sonda path (decisao-proxy.ts:186) renders zone-down page WITHOUT supportId (invariant 12; pre-existing since the shell gate) -> plan amended with Task 2b (shell fix). Review of Task 2 dispatched
Task 2: review Needs fixes: 1 Important (remover ignores DELETE status and prints "Rota removida") + text fixes that would mislead the roadmap (wait-for-map after derrubar, NaN s, one wording) + SIGHUP/unhandledRejection + verify via task -> fix round 1 dispatched (ports shared with Task 2b: wait until free); FIX_BASE 7ea3658
Task 2: minor (deferred): default 30000 duplicates CONFIGURACAO; port 3009 and url fixed in the text though subirZonaDemo takes porta
Task 2b: implemented (shell d52b5fc..d6e48fc, main 0e4f087), shell 161/161, redis 135/135, mutation caught; review dispatched
Task 2b: minor (deferred): decisao-proxy.ts:25 supportId comment still says "only in the empty-map 503"; one log line per 503 under load (same as gateway and mapaVazio)
Task 2b: complete (shell d52b5fc..d6e48fc, main 0e4f087, review clean)
Task 2: fix round 1 implemented (7ea3658..1198ab1); verified through task showcase:zona-demo; mutation caught; re-review dispatched
Task 2: re-review redispatched (new session; previous re-review died without draft)
Task 3: dispatched (Sonnet), main BASE 1198ab1 (docs only, parallel with Task 2 re-review)
Task 2: re-review Approved (fix 7ea3658..1198ab1)
Task 2: minor (deferred): 'Remova à mão' hint hard-codes demo instead of id (principal only uses the default id)
Task 2: complete (main 076588c..1198ab1, review clean)
Task 3: implemented (main 1198ab1..2d1a6df), docs only; concerns: F-test names future (Task 4), A15 log claim from code not run; review dispatched
Task 3: review Needs fixes (F4 said bruno for /zona1/relatorios, seed gives him relatorios.ver; zone-down wording ignored ERP_SONDA_TTL_MS; 'registro do shell' ambiguous) -> fixed by orchestrator in 8d3428e (text only, facts checked in A4, rotas-auth.ts:72, CONFIGURACAO.md:49)
Task 3: complete (main 1198ab1..8d3428e)
Task 4: dispatched (Sonnet), main BASE 6923818
Task 4: implemented (main 3bc9b10..4f7c562), dev 7/7 92.5 s, oidc 7/7 93.2 s, M1-M5 caught; concerns: roadmap F7 said 412, domain answers 409 (fixed in table); F7 bumps t-4 version each run; review dispatched
Task 4: review Needs fixes (Important: F7 bumps t-4 version each run, loop v<=30 fails after ~14 runs; Minor: F5 nav not compared across zones, F5 toast button only manual, F6 comment overclaims, roadmap F7 cell too long) -> fix round 1 sent to the same worker; FIX_BASE aa6c3ec
Task 4: fix round 1 implemented (aa6c3ec..d625731): F7 reads t-4 version via domain C GET; dev 7/7 twice in a row, oidc 7/7; M4, If-Match-ignored, own-nav mutations caught; re-review dispatched
Task 4: re-review Approved
Task 4: complete (main 3bc9b10..d625731)
Task 5: started by orchestrator (final verification), main BASE d625731
Task 5: quick checks green (test 20/26/83/161/286, typecheck, estatica 52, scripts 29, lockstep, checar)
Task 5: REGRESSION found by orchestrator: verificar:redis (glob base/verificacao/*.test.mjs) now picks showcase.test.mjs, which needs the showcase up -> 135 + 1 fail; fix: move suite to base/verificacao/showcase/ (like oidc/), challenger held until fixed
Gate e3e5 it.1: revisor_e3e5_1 APPROVE (4b71d68), 2 minors: modoDeLogin fixed Keycloak origin; TTL NaN in suite -> fixed together with the regression
Task 5: regression fixed in a63710b (suite in base/verificacao/showcase/, plus reviewer minors); rerun: redis 135/135, oidc 6/6, showcase:verificar 7/7 dev and oidc, conferir ok both; challenger dispatched
Gate e3e5 it.1: challenger_e3e5_1 REJECT (3d9c3d4): roadmap A3/A8/A9/A10/A15 differ from the real UI; zona-demo raw stack on EADDRINUSE and unreachable access mgmt; minors. Auditor not dispatched. Fix -> worker_e3e5_1
Gate e3e5 it.2: worker_e3e5_1 fixed (af8239c, handoff 8a1f3cb); revisor_e3e5_2 and challenger_e3e5_2 dispatched
Gate e3e5 it.2: revisor_e3e5_2 APPROVE (2f232e2), 4 minors -> D33
Gate e3e5 it.2: challenger_e3e5_2 APPROVE (99ab8e8); auditor_e3e5_1 dispatched (opus)
Gate e3e5 it.2: auditor_e3e5_1 VETO only by test (0273cd7): 5 live in zona-demo (ZD1-4, ZD6); fix -> worker_e3e5_2 (test only)
