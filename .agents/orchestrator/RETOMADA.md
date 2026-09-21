# Retomada — onde o trabalho está agora

> Só o estado atual e o próximo passo. Quando algo termina, sai daqui e vai para
> `GATE_STATUS.md` (vereditos), `ATIVIDADES.md` (GitLab) ou `historico/`.
> Atualizado em 2026-09-21, fim da tarde.

## Estado

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; ponta a ponta **26/26** com build novo | `pnpm verificar:construir` |
| `@erp/nucleo` | **0.3.2** = árvore que passou pelos gates; reescrita paralela reconciliada | ADR-0010, `erp-nucleo` `38d7277` |
| Apps (`erp-shell`, `erp-zona-*`) | consomem o 0.3.2; lockfiles com os hashes do Verdaccio compartilhado | `666216c`, `530225d`, `e2b3ffc`, `da97b70` |
| Shell novo do Gabriel (503 de zona, sonda, telemetria) | implementado, **gate em andamento** | `erp-shell` `6de4939`, `dab5ffd`, `a63b995` |
| PoC `apps/` | removida; preservada na tag `poc-final` | `73bdc8b` |
| Envio | tudo enviado (principal, submódulos, tag) | `origin/bff-multizone` |

## Em andamento: gate "Shell novo"

| Papel | Agente | Estado |
|---|---|---|
| Revisor | `reviewer_shell_1` (revisor-mfe, Sonnet) | despachado |
| Challenger | `challenger_shell_1` (simulador-condicoes, Sonnet), dono das portas | despachado |
| Auditor forense | `auditor_shell_1` (general-purpose, Opus) | entra quando o challenger liberar as portas |

Suspeitos passados aos verificadores: a decisão do proxy usa `req.nextUrl.pathname` (normalizado;
R1 da PoC); o gateway de telemetria lê o corpo inteiro sem `Content-Length`; o mapa do limitador
de taxa cresce sem limite; a sonda bate numa página que exige sessão.

## Próximos passos

1. Fechar o gate (três handoffs), registrar em `GATE_STATUS.md`, corrigir o que reprovar.
2. Atualizar `ATIVIDADES.md` (#3 e #18 dependem do gate).
3. Avisar o Gabriel: buscar o `@erp/nucleo` 0.3.2, descartar o 0.3.1 dele e ler `AMBIENTE.md` §1–2.
4. Depois do gate, em ordem de valor (ver `docs/arquitetura/alvo.md` §6): registro de pacotes
   único (#14), OIDC + Redis (#9), fragmentos (#10).

## Pendências com o humano

- Confirmar no GitLab os avisos de `ATIVIDADES.md` §3.
