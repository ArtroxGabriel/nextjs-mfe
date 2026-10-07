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
