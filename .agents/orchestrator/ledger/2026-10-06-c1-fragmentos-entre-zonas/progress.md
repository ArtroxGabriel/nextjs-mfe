# SDD ledger — plan: docs/superpowers/plans/2026-10-06-c1-fragmentos-entre-zonas.md
Task 1: dispatched (Sonnet), main BASE 1486296, zona-2 BASE 5a665a7
Task 1: implemented (main 1486296..eb5cf05, zona-2 5a665a7..1626fd1), C1a RED 404 -> GREEN, build lists /zona2/_fragmento/tarefas/[id]; review dispatched
Task 1: minor (deferred): C1a does not cover "nada pendente" (200 with "Nenhuma tarefa pendente.") nor escaping of a title with < or &
Task 1: minor (deferred): C1a 200 checks headers and marker, not a real title; a regression that always returns an empty list would pass (gate auditor: mutate the filter/escape)
Task 1: minor (deferred): domain failure and denied access give the same 204 (intentional, ADR-0011); no test tells them apart
Task 1: complete (main 1486296..eb5cf05, zona-2 5a665a7..1626fd1, review clean)
