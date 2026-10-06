# SDD ledger — plan: docs/superpowers/plans/2026-10-06-d7-zona-travada.md

Task 1: dispatched (erp-shell BASE 0a3131d; main BASE a130d42)
Task 1: attempt 1 died with the session, no commit (erp-shell still 0a3131d); re-dispatched fresh (2026-10-06)
Task 1: dispatched again, fresh implementer (Sonnet), erp-shell BASE 0a3131d
Task 1: implemented (erp-shell 0a3131d..45787f1), 114/114, build ok; review dispatched
Task 1: minor (deferred): 5_000/60_000 of ERP_DESTINO_TIMEOUT_MS duplicated from the core (core does not export the reader); no parity test
Task 1: minor (deferred): proxyTimeout wiring in next.config.ts proven by build and manual start only, no automated test (Task 2 end-to-end covers it)
Task 1: cannot-verify resolved: commit has no co-author footer (checked); CONFIGURACAO.md and submodule pointer belong to Task 2 by the plan
Task 1: complete (erp-shell commits 0a3131d..45787f1, review clean)
Task 2: dispatched (Sonnet), main BASE e8da5e7
Task 2: implemented (main e8da5e7..f01b25d), L9 RED/GREEN, verificar 115+4 skip, redis 119/119, oidc 6/6; review dispatched
Task 2: minor (deferred): atual.md test-count table already stale before the L9 (50, 15, 107, 25, 24, 36); documentation debt, not asked by the brief
Task 2: minor (deferred): RED message was "TimeoutError em 16002 ms" (fetch aborts at teto+10 s before Next's 30 s), not the brief's text; fails for the right reason
Task 2: minor (deferred): L9 "ms >= 2000" alone does not tell proxy hold from other slowness; the "teto - 500" floor covers it
Task 2: minor (deferred): probe timeout 800 ms in 01-operacao.md vs 500 ms default in CONFIGURACAO.md; pre-existing
Task 2: complete (main commits e8da5e7..f01b25d, review clean)
Gate: iteration 1 PASS (revisor_d7_1 APPROVE, challenger_d7_1 APPROVE, auditor_d7_1 PASS 36/39, 3 live as declared limits -> DEFERRED D28); tag gate-d7-aprovado
