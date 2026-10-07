# SDD ledger — plan: docs/superpowers/plans/2026-10-07-nucleo-0104-html-inerte.md

BASE núcleo 610217d (erp-nucleo, master)
Task 1: dispatched (Sonnet), nucleo BASE 610217d
Task 1: implemented (nucleo 610217d..50a0fea), RED 15 -> GREEN 286/286, M1-M13 caught; review dispatched
Task 1: ⚠️ resolved by controller: server-only kept (line 1), commit without footer, not pushed until close, report has M1-M13 table and 286/286
Task 1: minor (deferred): balanced stack is not valid HTML nesting (<p><ul></ul></p>, <a><a></a></a>, <li> outside a list pass; parser restructures DOM, no execution vector)
Task 1: minor (deferred): id/class accept any clean value (DOM clobbering, reuse of consumer CSS classes); declared limit
Task 1: minor (deferred): href accepts any local path, including GET routes with effect (needs a user click; domain decides); no test documents these limits
Task 1: complete (nucleo 610217d..50a0fea, review clean)
Task 2: dispatched (Sonnet), human approved publish+install 0.10.4 and showcase:subir (2026-10-07); controller resolution: no zone-2 unit-test infra, producer evidence = C1a in verificar:redis + one-off check; BASEs shell 836ddc4, zona-1 39c4b76, zona-2 1626fd1, zona-acesso 4ea036d, main 923618c
Task 2: implemented (shell 2f03183, zona-1 0a1dcc0, zona-2 4184225, zona-acesso 54741cd, main bbf6a84), lockstep 0.10.4, shell 116/116, verificar:redis 123/123 incl. C1a-C1d; concern: pnpm 12.5.1 drops 'tarball:' from @erp resolutions (format only, registry from .npmrc); review dispatched
Task 2: ⚠️ resolved by controller: report quotes verificar:redis 123/123 with C1a-C1d ok and one-off producer check (empty: true, seed: true); 4 apps and main in sync with origin; main commit without footer; pnpm install --frozen-lockfile --offline ok in zona-2
Task 2: minor (deferred): note in AMBIENTE.md that pnpm 12.5.1 drops 'tarball:' from @erp resolutions (format only; alinhar-hashes regex tolerates both) -> carried to Task 3
Task 2: complete (shell 836ddc4..2f03183, zona-1 39c4b76..0a1dcc0, zona-2 1626fd1..4184225, zona-acesso 4ea036d..54741cd, main 923618c..bbf6a84, review clean)
Task 3: dispatched (Sonnet), main BASE bbf6a84; extras: ADR-0011 addendum 2, close D29, Task 1 minors as declared limits, AMBIENTE tarball note, RETOMADA/ATIVIDADES
Task 3: implemented (main bbf6a84..a503458: 646a7a7 docs, a503458 orchestrator), pushed; review dispatched
Task 3: review: spec ✅, 2 Important (D30 "Fecha em" stale + limits missing; 02-zonas §2.5 paragraph breaks "Isso" antecedent) -> fix round 1 dispatched (resume implementer); FIX_BASE a503458
Task 3: minor (deferred): RETOMADA "Estado" table still dated 2026-10-06 with core 271 tests (Task 4 recounts)
Task 3: minor (deferred): RETOMADA item 2b "✅ (falta o gate)" mixes states
Task 3: minor (deferred): ADR-0011 addendum 2 says "atributos e esquemas"; should be "tags, atributos e esquemas"
Task 3: fix round 1/5 (2 addressed, 0 open; commits a503458..33da07b)
Task 3: complete (main bbf6a84..33da07b, review clean after fix round 1)
Final review: replaced by the project's full gate (revisor, challenger, auditor; LEIA-PRIMEIRO), Task 4
Task 4: verification suite running (controller, background), log task-4-verificacao.log
Task 4: verification green: task test (contratos 20, nucleo 286, moldura 26, stub 75, shell 116), typecheck ok, estatica 51/51, verificar:redis 123/123, verificar:construir 119+4 skipped, oidc 6/6, showcase:checar ok, lockstep 0.10.4
Task 4: gate D29 iteration 1 dispatched: revisor_d29_1 (revisor-mfe, sonnet) + challenger_d29_1 (simulador-condicoes, sonnet); auditor_d29_1 (opus) after challenger frees ports
