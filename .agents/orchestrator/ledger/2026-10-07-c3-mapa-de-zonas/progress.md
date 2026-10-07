# SDD ledger — plan: docs/superpowers/plans/2026-10-07-c3-mapa-de-zonas.md

Task 1: dispatched (Sonnet), stub BASE b85540c
Task 1: implemented (stub b85540c..2da6dcb), RED 8 -> GREEN 83/83, M1-M8 caught; push failed (GitHub 500); review dispatched
Task 1: minor (deferred): alias REGISTRO_DE_MANIFESTO in src/base.mjs has no importer (dead code)
Task 1: minor (deferred): jwt-verificacao.test.mjs const MANIFESTO and sweep title now misleading (rename to ROTAS_DE_SERVICO)
Task 1: minor (deferred): zonaValida id regex wider than svc token regex (digit-first or >32 chars registrable by nobody)
Task 1: minor (deferred): route events record autor null (consistent with manifest)
Task 1: complete (stub b85540c..2da6dcb, review clean); push pending (GitHub 500)
Task 2: dispatched (Sonnet), BASEs zona-1 0a1dcc0, zona-2 4184225, zona-acesso 54741cd, main 47422a4
Task 2: implemented (zona-1 ce8e015, zona-2 f88cce7, zona-acesso 73a2c19, main 5a77240), scripts 31/31, estatica 51/51, verificar:redis 124/124; pushes ok (incl. stub 2da6dcb); review dispatched
Task 2: ⚠️ resolved by controller: main 5a77240 without footer, no lockfile nor erp-moldura in the stat
Task 2: minor (deferred): script-shape test checks redirect/exit by regex over source (a comment would satisfy it)
Task 2: minor (deferred): N8 DEPLOY_ROTA reason duplicates DEPLOY text; N8 does not check redirect value (pre-existing, also for registrar-manifesto)
Task 2: complete (zona-1 0a1dcc0..ce8e015, zona-2 4184225..f88cce7, zona-acesso 54741cd..73a2c19, main 47422a4..5a77240, review clean)
