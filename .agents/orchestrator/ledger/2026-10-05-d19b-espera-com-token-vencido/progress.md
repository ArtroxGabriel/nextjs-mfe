# SDD ledger — plan: docs/superpowers/plans/2026-10-05-d19b-espera-com-token-vencido.md
Começo 2026-10-05, depois do gate do D2 (tag gate-d2-aprovado). Base: main 4ff264a, nucleo 83b00e0, shell 3034f76
Task 1: dispatched implementer (opus)
Task 1: implementer DONE_WITH_CONCERNS (nucleo c879b0b; 248/248; mutações M1–M5 pegas); controlador documentou as 2 variáveis em CONFIGURACAO e commitou ambiente.test + ponteiro em d898b84. Review dispatched (opus), package review-task1.diff
Task 1: review (opus) APROVADO, 0 Critical/Important; minors 1 (testes '1e3','0x10','+5'), 3 (mensagem acima do inteiro seguro), 4 (comentário sobre sub na espera), 5 (teste vencedor revogada → perdedor ausente) → Task 2; minors 2 (CONFIGURACAO: versão e LOCK_S≥3, passo só com espera ligada) e 6 (ADR-0013:28) → Task 4; minor 7 (releitura sem timeout próprio, pré-existente) → DEFERRED na Task 4
Task 1: complete (nucleo 83b00e0..c879b0b, main d898b84; review clean)
Task 2: dispatched implementer (opus) com os minors 1,3,4,5 da Task 1
Task 2: implementer DONE_WITH_CONCERNS (nucleo e1a09f2 local: push negado ao agente, humano roda; 258/258; 7 mutações pegas); controlador documentou e commitou main 264352f sem push (pre-push recusa até o núcleo subir). Review dispatched (opus), package review-task2.diff
Task 2: review (opus) aprovado com 1 Important I1 (FalhaDoNucleo sem motivo) + M1–M9; fix round 1 dispatched (I1, M1–M4, M6) com commit só local; M7 corrigido pelo controlador (aa57f08, local); M5, M8, M9 → Task 4. Push do núcleo e do principal pendente com o humano
Task 2: fix round 1 DONE (nucleo 3576971 local; 262/262; 8 mutações pegas); re-review dispatched (sonnet)
Task 2: re-review (sonnet) limpo; minor opcional (thenable não nativo em registrarFalha: Promise.resolve(r).catch) → Task 3
Task 2: complete (nucleo c879b0b..3576971, main 264352f..c36441b; review clean). Push pendente com o humano
Task 3: dispatched implementer (opus) at main c36441b, nucleo 3576971 (push liberado pelo humano para estes; agente tenta push e reporta se negado)
Task 3: implementer DONE (nucleo fdea296 v0.10.3 publicado, shell 9c8b11a+acec0bf, z1 2754937, z2 d830ad4, zacesso 88772d3, main c26619c; tudo enviado; verificar:oidc 6/6 com o novo e2e que reprova na 0.10.2; mutações pegas). Review dispatched (opus)
Task 3: review (opus) aprovado com ressalvas; Important I1 (zonas sem trim em SHELL_HOSTS: lib/pagina.ts:16 e next.config.ts:9) → Task 4; minors: guarda do e2e com tolerância (oidc.test.mjs:283), ESPERA 4000 no verificar:oidc, regex frágil do teste de lib/nucleo.ts → Task 4; esquema no sair: manter (Next usa X-Forwarded-Proto), documentar na Task 4
Task 3: complete (nucleo fdea296 v0.10.3, shell acec0bf, zonas, main c26619c)
Task 4: dispatched implementer (opus): docs + I1 zonas + minors da Task 3 + menores do gate do D2 restantes
