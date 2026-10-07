# SDD ledger — plan: docs/superpowers/plans/2026-10-06-c1-fragmentos-entre-zonas.md
Task 1: dispatched (Sonnet), main BASE 1486296, zona-2 BASE 5a665a7
Task 1: implemented (main 1486296..eb5cf05, zona-2 5a665a7..1626fd1), C1a RED 404 -> GREEN, build lists /zona2/_fragmento/tarefas/[id]; review dispatched
Task 1: minor (deferred): C1a does not cover "nada pendente" (200 with "Nenhuma tarefa pendente.") nor escaping of a title with < or &
Task 1: minor (deferred): C1a 200 checks headers and marker, not a real title; a regression that always returns an empty list would pass (gate auditor: mutate the filter/escape)
Task 1: minor (deferred): domain failure and denied access give the same 204 (intentional, ADR-0011); no test tells them apart
Task 1: complete (main 1486296..eb5cf05, zona-2 5a665a7..1626fd1, review clean)
Task 2: dispatched (Sonnet), main BASE dcba633, shell BASE 45787f1
Task 2: implemented (main dcba633..4e9de60, shell 45787f1..836ddc4), units 116/116, C1b RED 200 -> GREEN; review dispatched
Task 2: minor (deferred, suspicion): //zona2/_fragmento/x, /zona2//_fragmento/x, /zona2/%2F_fragmento/x and /zona2%2F_fragmento/x give 'prosseguir' in the guard; probably never reach the zone route (rewrite :caminho* vs empty segment; route still needs a session). Gate challenger must try them against the running base; optional hardening: collapse /+ before the regex
Task 2: minor (deferred): /zona2-static/_fragmento/... is also 404 (beyond the brief, harmless)
Task 2: minor (deferred): C1b does not cover //, %2F nor %255F
Task 2: complete (main dcba633..4e9de60, shell 45787f1..836ddc4, review clean)
Task 3: dispatched (Sonnet), main BASE 3e180ac, zona-1 BASE 860a176
Task 3: implemented (main 3e180ac..decd1ae, zona-1 860a176..39c4b76); verificar 119+4, redis 123/123, estatica 51/51, shell 116; atual.md not edited (no natural place); review dispatched
Task 3: minor (deferred): ADR-0011 addendum 1 cites alvo.md §6, a file kept out of commit by the human (pending reference)
Task 3: minor (deferred): atual.md not wrong, only incomplete: missing the zone 1 -> zone 2 edge (diagram l.25-26, table l.158)
Task 3: minor (deferred): page.tsx fetches the fragment also for users without the zone 2 module (one useless 204 call per render)
Task 3: minor (deferred): invalid ZONA2_URL fails the page at load (fail-fast) instead of hiding the block; document only
Task 3: minor (deferred): C1c does not check the RSC payload nor token absence in the HTML (gate challenger)
Task 3: minor (deferred, outside diff, core): ehHtmlInerte misses <img/onerror= (slash instead of space); CSP without nonce blocks it, but the gate auditor should try it
Task 3: cannot-verify resolved: no co-author footer in decd1ae nor 39c4b76 (checked)
Task 3: complete (main 3e180ac..decd1ae, zona-1 860a176..39c4b76, review clean)
Gate: PASS at iteration 3 (it.1 and it.2 vetoed by test only, fixed by worker_c1_1/worker_c1_2); tag gate-c1-aprovado
