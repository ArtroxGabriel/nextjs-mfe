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
Task 4: dispatched (Opus), shell BASE c7a08d9, main BASE a515aec; carried items: lazy map + start-up check, short retry with empty map, e2e coverage of map read/refusal/guard
Task 4: worker 1 (Opus) died at session limit mid-step (N8 exception). Tree state: shell unit 157/157, tsc clean, estatica 52/52; e2e, mutations, commits pending. WIP patches saved (task-4-wip-*.patch). Dispatching worker 2 (Opus) for the remaining steps
Task 4: implemented by worker 2 (shell c7a08d9..4eb47e2, main a515aec..5700aaf), verificar:redis 134/134, construir 129+5 skipped, oidc 6/6, shell 157/157, M1-M11 + carried caught; L9 6012 ms, L9b 6010 ms, L9c cut 3004 ms after headers; concerns: x-middleware-rewrite leaks internal zone origin on fast path; skipProxyUrlNormalize; x-forwarded-proto from browser forwarded; pushes pending (GitHub 500); review dispatched (opus)
Task 4: review (opus): spec ✅, Approved; 1 Important plan-mandated (decisão do humano): fast path sends x-middleware-rewrite with the zone's internal origin to the browser (Next resolve-routes.js:466-469, router-server.js:395-397; no config removes it; L10 asserts on that header); options a (declare), b (strip at the edge proxy), c (custom server), d (all through gateway), e (internal names)
Task 4: minor (deferred): skipProxyUrlNormalize: /_next/data/<id>/_gateway/zona1.json with cookie reaches the gateway route (404 by reading); add e2e and optional per-process marker header
Task 4: minor (deferred): x-forwarded-proto from browser wins in the gateway (pre-existing on fast path; nothing reads it)
Task 4: minor (deferred): L10 accepts 2*TTL+1s; tighten to TTL+1s and declare "TTL plus one refresh"
Task 4: minor (deferred): locationRelativo turns //host into protocol-relative open redirect; collapse leading // and /\ ; add test
Task 4: minor (deferred): ERP_ZONA_OCIOSIDADE_MS lacks the "greater than ERP_DESTINO_TIMEOUT_MS" rule; verification runs 3000 < 5000
Task 4: minor (deferred): ADR-0015 decision 1 says Sec-Fetch-Dest; align with GET/HEAD without RSC and Next-Action (Task 5)
Task 4: human decision (2026-10-07) on x-middleware-rewrite leak: option b+a, the edge proxy strips x-middleware-* in production; declared limit on the local machine; ADR-0015 addendum, DEFERRED and infra doc in Task 5
Task 4: complete (shell c7a08d9..4eb47e2, main a515aec..5700aaf, review Approved; Important resolved by human decision; code minors Location //, ociosidade rule, L10 tightening and /_next/data e2e carried into Task 5)
Task 5: dispatched (Sonnet), main BASE 526d4f8, shell BASE 4eb47e2; scope = brief + human decision on x-middleware-rewrite + Task 4 code minors (Location //, ociosidade rule, L10 TTL+1s, /_next/data e2e)
Task 5: implemented (shell 4eb47e2..0081185, main 526d4f8..897c657), shell 158/158, verificar:redis 135/135, estatica 52/52, scripts 29/29; L9 6011, L9b 6013, L9c 7005 after headers (ociosidade 7000), L10 2217/2002 ms; mutations caught; review dispatched
Task 5: review: Approved; 1 Important (01-operacao cites D28 instead of D31) + doc minors folded into fix round 1 because they are human style rules or doc accuracy in a doc task (× in alvo.md, hard-wrapped added paragraphs, divergent measured numbers, "TTL plus one refresh" wording, ADR-0015 decision 4 still cites nucleo.zonas.listar); FIX_BASE main 897c657
Task 5: minor (deferred): /_next/data e2e lacks a positive control (a shell page /_next/data answering 200) so a wrong BUILD_ID would also give 404
Task 5: minor (deferred): atual.md proxy flow diagram cut at page end in PDF (renderer, pre-existing); consider splitting
Task 5: fix round 1/5 (5 addressed, 1 open: DEFERRED line 21 L9b 6010 vs 6013; main 897c657..e0474cf); fix round 2 dispatched
Task 5: fix round 2/5 (1 addressed, 0 open; main e0474cf..07c7c81)
Task 5: complete (shell 4eb47e2..0081185, main 526d4f8..07c7c81, review clean after 2 fix rounds)
