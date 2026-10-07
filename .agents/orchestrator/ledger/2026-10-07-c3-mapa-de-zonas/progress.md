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
Task 3: dispatched (Sonnet), shell BASE 2f03183, main c377c02
Task 3: implemented (shell 2f03183..aa128c7, main db9655a), mapa-zonas 14/14, shell 130/130, M1-M8 caught (M2 needed 2 extra tests); concern: map created at import, prod build would need ERP_ZONAS_ORIGENS_PERMITIDAS; review dispatched
Task 3: review (opus): spec ✅; 2 Important: (1) prod start (next start) lacks ERP_ZONAS_ORIGENS_PERMITIDAS and shell token; shared ERP_TOKEN_SERVICO would make zones register as shell (partly plan-mandated name; controller resolution keeps the name: inject per role only for the shell in ambiente.mjs; missing token in prod = start-up error); (2) awaited guarda.gravar and unbounded guarda.ler in the single flight make the map hang on Redis -> fix round 1 dispatched (resume implementer); FIX_BASE shell aa128c7, main db9655a
Task 3: minor (carried to Task 4): mapaDeZonas created at import; make it lazy and do the explicit start-up check in Task 4 (instrumentation register or equivalent)
Task 3: minor (carried to Task 4): failed refresh renews lidoEm; with an empty map (cold start, both sources down) retry on a short configurable interval instead of a full TTL
Task 3: minor (deferred): lerOrigensPermitidas does not validate pattern format (typo without port silently discards all)
Task 3: minor (deferred): mapa-zonas.ts lacks import 'server-only' (invariant 3)
Task 3: minor (deferred): CONFIGURACAO: ACESSO_URL line does not cite GET /v2/zonas; IPv6 only matches literal patterns
Task 3: minor (carried to Task 4/6): e2e must cover map read with svc.shell, refusal with another token, guard round trip (key and PX)
Task 3: fix round 1 implemented (shell aa128c7..c7a08d9, main db9655a..9db50d5), shell 132/132, scripts 29/29 (28 at 5a77240, +1; the '31' in Task 2 report counted differently), M4 M5 M9 M10 caught; re-review dispatched
Task 3: fix round 1/5 (2 addressed, 0 open; shell aa128c7..c7a08d9, main db9655a..9db50d5)
Task 3: minor (deferred): test title typo "fonte fora da mapa vazio"; explicit undefined key would override shell default (improbable)
Task 3: complete (shell 2f03183..c7a08d9, main ..9db50d5, review clean after fix round 1)
