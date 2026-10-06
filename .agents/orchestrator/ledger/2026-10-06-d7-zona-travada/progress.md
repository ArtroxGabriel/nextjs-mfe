# SDD ledger — plan: docs/superpowers/plans/2026-10-06-d7-zona-travada.md

Task 1: dispatched (erp-shell BASE 0a3131d; main BASE a130d42)
Task 1: attempt 1 died with the session, no commit (erp-shell still 0a3131d); re-dispatched fresh (2026-10-06)
Task 1: dispatched again, fresh implementer (Sonnet), erp-shell BASE 0a3131d
Task 1: implemented (erp-shell 0a3131d..45787f1), 114/114, build ok; review dispatched
Task 1: minor (deferred): 5_000/60_000 of ERP_DESTINO_TIMEOUT_MS duplicated from the core (core does not export the reader); no parity test
Task 1: minor (deferred): proxyTimeout wiring in next.config.ts proven by build and manual start only, no automated test (Task 2 end-to-end covers it)
Task 1: cannot-verify resolved: commit has no co-author footer (checked); CONFIGURACAO.md and submodule pointer belong to Task 2 by the plan
Task 1: complete (erp-shell commits 0a3131d..45787f1, review clean)
