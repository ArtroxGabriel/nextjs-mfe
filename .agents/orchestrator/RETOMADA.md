# Retomada — onde o trabalho está agora

> Só o estado atual e o próximo passo. Quando algo termina, sai daqui e vai para
> `GATE_STATUS.md` (vereditos), `ATIVIDADES.md` (GitLab) ou `historico/`.
> Atualizado em 2026-09-21, noite.

## Estado

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; ponta a ponta **26/26** com build novo | `pnpm verificar:construir` |
| `@erp/nucleo` | **0.3.2** nas apps (árvore dos gates, ADR-0010); **0.5.0** publicado, ainda não consumido: `sessaoRedis` (0.4.0) e fragmentos `criarFragmento`/`responderFragmento` (ADR-0011); 90 testes; 25 mutações, todas pegas ou equivalentes provadas | `3a7b80c`, `1841771` |
| Envio seguro | hook `pre-push` recusa principal apontando para submódulo não enviado | `base/scripts/checar-envio.mjs` |
| Apps (`erp-shell`, `erp-zona-*`) | consomem o 0.3.2; lockfiles com os hashes do Verdaccio compartilhado | `666216c`, `530225d`, `e2b3ffc`, `da97b70` |
| Shell novo do Gabriel (503 de zona, sonda, telemetria) | implementado, **gate em andamento** | `erp-shell` `6de4939`, `dab5ffd`, `a63b995` |
| PoC `apps/` | removida; preservada na tag `poc-final` | `73bdc8b` |
| Envio | tudo enviado (principal, submódulos, tag) | `origin/bff-multizone` |

## Gate "Shell novo": iteração 1 reprovada, correção feita, falta a iteração 2

Resultado da iteração 1 em `GATE_STATUS.md` (revisor e challenger REQUEST_CHANGES, auditor com
veto: vazamento de módulo no payload RSC com a gestão de acesso fora).

Correção (`erp-shell` `f3d8803`, zonas `a0d9bc1`/`831d128`/`b24b078`): `exigirModulo` volta a
negar; `/ZONA2` passa pela sonda; telemetria anônima descartada sem ler, limite em streaming,
limitador expira, repasse pelo registro de destinos; CSP igual à do núcleo. Os quatro testes do
auditor (L1–L4) entraram em `base/verificacao`: vermelhos antes, verdes depois. Ponta a ponta
**30/30** com build novo; shell 29/29. O teste N8 foi endurecido: o código original escapava dele
com `globalThis['fetch']`.

**Iteração 2 em andamento:** `reviewer_shell_2` e `challenger_shell_2` (dono das portas)
despachados; `auditor_shell_2` (Opus) entra quando o challenger liberar as portas.
(A primeira tentativa caiu no limite de sessão às ~19h; redespachada às 19h34, sem escrita parcial.)

`reviewer_shell_2`: **REQUEST_CHANGES** — os 7 achados da iteração 1 resolvidos; novos: (1) `proxy.ts`
do shell apaga `__Host-flash` sem `Secure` (o navegador rejeita; toast pode repetir no shell);
(2) id de zona com maiúscula em `zonas.json` reabriria o C1 (normalizar/validar em `carregarZonas`);
(3) 400 da telemetria sem teste. Corrigir junto com o que challenger e auditor trouxerem.

`challenger_shell_2`: **APPROVE** — C1 corrigido nas 3 zonas (27 combinações, 503 próprio);
nada de módulo no HTML nem no payload RSC com a gestão de acesso fora; telemetria 413 em streaming
(20 MB custam ~1,25 MB de RSS), anônimo não repassado, 400/429 certos; 30/30. Divergência não
bloqueante: recuperação medida ~0,8 s (documentado ~1,2–1,5 s). Não conseguiu forjar navegação
RSC real sem cliente Next (lacuna registrada). `auditor_shell_2` (Opus) despachado.

Correção dos achados do `reviewer_shell_2` já escrita: `erp-shell` `6d93f8e` (**só local**, não
enviado: falta a ponta a ponta) — id de zona validado no boot, remoção de `__Host-flash` com
`Secure`; testes novos no principal: 400 da telemetria (L4) e L5 (Secure). Shell 30/30 na
unidade. **Quando o auditor liberar as portas:** `CONSTRUIR=1 pnpm verificar` (esperado 31/31),
enviar o shell, apontar o principal, somar os achados do auditor numa rodada só.

Avaliação do processo (pedido do humano, 20h20): auditor trabalhando certo, em cópia isolada.
Melhorias feitas: build só das apps alteradas (`precisaConstruir`) e handoff parcial desde o
começo (`LEIA-PRIMEIRO.md`). Navegador real **sem instalar nada** (decisão do humano: nada de baixar Chromium):
`base/verificacao/navegador.mjs` abre o Chrome do Flatpak em headless e fala CDP pelo WebSocket
nativo do Node; perfil temporário apagado, processos encerrados (autoteste 3/3). Teste **L6**
escrito: navegação do cliente (`window.next.router.push`) para `/zona1/relatorios` com a gestão
de acesso fora, exigindo que uma requisição RSC aconteça. **Falta rodar** (portas do auditor) e
provar que ele reprova com o `exigirModulo` fail-open da zona 1 (reconstruir só a zona 1).
Pendente e opcional: lint por AST no lugar do regex do N8.

Kit de app (C1/C2) desenhado pelo `arquiteto-mfe` e registrado no ADR-0012; implementar depois do gate. Gate de lockstep do núcleo feito
(`base/scripts/verificar-lockstep.mjs`, no `pre-push`).

## Feito: fatia de núcleo da #10 (fragmentos)

Decisão do `arquiteto-mfe` registrada no ADR-0011. `@erp/nucleo` 0.5.0 traz `criarFragmento` e
`responderFragmento`. Falta ligar: rota `_fragmento` na zona 2, bloco na zona 1, recusa de
`/{zona}/_fragmento/` no shell e teste ponta a ponta — depois do gate.

## Próximos passos

1. Fechar o gate (três handoffs), registrar em `GATE_STATUS.md`, corrigir o que reprovar.
2. Atualizar `ATIVIDADES.md` (#3 e #18 dependem do gate).
3. Avisar o Gabriel: buscar o `@erp/nucleo` 0.3.2, descartar o 0.3.1 dele e ler `AMBIENTE.md` §1–2.
4. Depois do gate: ligar o `sessaoRedis` nas apps (#9; exige instalar `redis` e subir um Redis no
   `docker-compose` — pedir aprovação), implementar a fatia de fragmentos (#10) conforme o arquiteto,
   instrumentar uma zona para a telemetria (#18), registro de pacotes único (#14).
5. Reorganização: docs, `base/` e `.agents/arquivo/` feitos; falta só o código (C1 kit
   `@erp/nucleo/app`, C2 shell com `criarProxy`).

## Pedido do humano para depois da saída do challenger (2026-09-21)

Decidido pelo humano e em execução: ver o quadro "Andamento" em `PROPOSTA-REORGANIZACAO.md`.
Docs reorganizadas (D1–D6 feitos). Faltam D7 e C3 (esperam o auditor) e C1/C2 (código).

## Pendências com o humano

- Confirmar no GitLab os avisos de `ATIVIDADES.md` §3.
