# Retomada — onde o trabalho está agora

> Só o estado atual e o próximo passo. Quando algo termina, sai daqui e vai para
> `GATE_STATUS.md` (vereditos), `ATIVIDADES.md` (GitLab) ou `historico/`.
> Atualizado em 2026-09-21, noite.

## Estado

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; ponta a ponta **26/26** com build novo | `pnpm verificar:construir` |
| `@erp/nucleo` | **0.3.2** nas apps (árvore dos gates, ADR-0010); **0.5.0** publicado, ainda não consumido: `sessaoRedis` (0.4.0) e fragmentos `criarFragmento`/`responderFragmento` (ADR-0011); 90 testes; 25 mutações, todas pegas ou equivalentes provadas | `3a7b80c`, `1841771` |
| Envio seguro | hook `pre-push` recusa principal apontando para submódulo não enviado | `repos/scripts/checar-envio.mjs` |
| Apps (`erp-shell`, `erp-zona-*`) | consomem o 0.3.2; lockfiles com os hashes do Verdaccio compartilhado | `666216c`, `530225d`, `e2b3ffc`, `da97b70` |
| Shell novo do Gabriel (503 de zona, sonda, telemetria) | implementado, **gate em andamento** | `erp-shell` `6de4939`, `dab5ffd`, `a63b995` |
| PoC `apps/` | removida; preservada na tag `poc-final` | `73bdc8b` |
| Envio | tudo enviado (principal, submódulos, tag) | `origin/bff-multizone` |

## Em andamento: gate "Shell novo"

| Papel | Agente | Estado |
|---|---|---|
| Revisor | `reviewer_shell_1` (revisor-mfe, Sonnet) | **REQUEST_CHANGES** — ver abaixo |
| Challenger | `challenger_shell_1` (simulador-condicoes, Sonnet) | **REQUEST_CHANGES** — C1: `/ZONA2` (maiúsculas) escapa da sonda e dá 500 cru; janela de 500 cru até ~1 s após a queda; telemetria de 20 MB sem `Content-Length` aceita |
| Auditor forense | `auditor_shell_1` (general-purpose, Opus), dono das portas | despachado |

Suspeitos passados aos verificadores: a decisão do proxy usa `req.nextUrl.pathname` (normalizado;
R1 da PoC); o gateway de telemetria lê o corpo inteiro sem `Content-Length`; o mapa do limitador
de taxa cresce sem limite; a sonda bate numa página que exige sessão.

Achados do revisor (`.agents/reviewer_shell_1/handoff.md`), a corrigir quando o challenger liberar:
1. **Grave:** `exigirModulo` em `lib/pagina.ts` do shell e das zonas (`a63b995`, `bac6d37`…) libera
   o módulo quando a gestão de acesso falha (fail-open): `/zona1/relatorios` restrito fica visível.
   Tem de negar (`notFound()`).
2. `proxy.ts` do shell reimplementa CSP em vez de `criarProxy`: faltam `form-action 'self'` e
   `img-src 'self' data:`.
3. Telemetria sem `Content-Length` bufferiza o corpo inteiro, antes de checar sessão.
4. Mapa do limitador de taxa nunca expira.
Refutados: R1 (caminho normalizado × cru, o Next 16 usa o mesmo parser); sonda numa página com
sessão (307 conta como saudável). Suspeita aberta para o challenger: dois `Content-Security-Policy`
(shell e zona) na mesma resposta.

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
5. Mover `docs/historico/MULTI_ZONES_RESEARCH.md`, `docs/historico/revisao/` e `docs/historico/superpowers/` para `docs/historico/`
   e commitar `docs/README.md` — **só depois que o challenger terminar** (a definição dele lê
   `docs/historico/superpowers/specs/`); atualizar essa referência em `.claude/agents/simulador-condicoes.md`.

## Pedido do humano para depois da saída do challenger (2026-09-21)

Decidido pelo humano e em execução: ver o quadro "Andamento" em `PROPOSTA-REORGANIZACAO.md`.
Docs reorganizadas (D1–D6 feitos). Faltam D7 e C3 (esperam o auditor) e C1/C2 (código).

## Pendências com o humano

- Confirmar no GitLab os avisos de `ATIVIDADES.md` §3.
