# P1: progresso salvo na pausa

**Estado:** pausado pelo humano em 2026-10-09, sem gate aprovado. Shell local `bd51363`; principal salvo depois deste registro. Nenhum envio remoto desta sessão.

## Tasks

1. Registro, instalação congelada, publicação e migração implementados. Task não fechada: pnpm real view retornou 401 sem Authorization, tanto com npmrcAuthFile camel como kebab. Instalação real não confirmada.
2. D18 implementado. Fixture antiga do mapa corrigida com IdP. Regressão corrigida não terminou: parou antes no teste de tempo do núcleo. Gate completo pendente.
3. Workflows escritos e YAML validado localmente. Não houve CI remoto ou registro oficial provisionado.
4. Documentação, revisão por leitura, resultados parciais e pausa salvos. Challenger não aprovou, auditor não iniciado.

## Evidência

- Scripts 50/50, fail 0, skipped 0, fora do sandbox.
- Lockstep passou; estática passou por arquivo no sandbox (2/2).
- E2E em arquivo: 135 casos, 129 pass, 6 skipped, fail 0. Redis/OIDC/showcase não rodados nesta sessão.
- Primeira unidade após implementação: núcleo passou; shell falhou na fixture antiga sem IdP, depois corrigida.
- Segunda unidade: núcleo 285/286, falha no teto de tempo em identidade.test.mjs:601 (1602 ms). Causa não investigada; shell corrigido ainda não reexecutado.
- M1/M2 pegas no scratch; M3 parou no marcador duplicado antes de aplicação. M3–M10 pendentes. Não houve mutação na árvore do projeto.
- Revisor APROVA por leitura. npm real pack/publish passou no mock do challenger. pnpm auth pendente, gate não aprovado.

## Recursos encerrados

Testes do orquestrador terminados. Portas 3000–3003, 3009, 4001–4004, 4010 e 4020 conferidas livres. Challenger confirmou zero processos próprios restantes, portas efêmeras usadas 41913/33593. Dois agentes terminados, auditor não iniciado. Nenhum Docker iniciado e nenhum recurso do sisbin administrado.

## Retomada

Somente após novo pedido. Seguir RETOMADA.md e os dois handoffs. Resolver auth pnpm, executor M3, falha temporal, regressão e gate. P1 operacional depende de registro oficial, migração canônica e CI remoto. Não enviar o principal antes do shell e das verificações exigidas.
