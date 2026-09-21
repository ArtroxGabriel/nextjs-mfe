# Retomada — onde o trabalho está agora

> Só o estado atual e o próximo passo. Quando algo termina, sai daqui e vai para
> `GATE_STATUS.md` (vereditos), `ATIVIDADES.md` (GitLab) ou `historico/`.
> Atualizado em 2026-09-21, noite.

## Estado

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; ponta a ponta **26/26** com build novo | `pnpm verificar:construir` |
| `@erp/nucleo` | **0.3.2** nas apps (árvore dos gates, ADR-0010); **0.4.0** publicado com o adaptador `sessaoRedis` (72 testes, 9 mutações pegas), ainda não consumido | `38d7277`, `3a7b80c` |
| Envio seguro | hook `pre-push` recusa principal apontando para submódulo não enviado | `repos/scripts/checar-envio.mjs` |
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

## Em andamento: desenho da #10 (fragmentos)

`arquiteto-mfe` (Sonnet) decidindo onde mora o `FragmentoRemoto`, como a identidade chega à zona
dona e o que o proxy faz com `/_fragmento/`. Nada de código antes da decisão.

## Próximos passos

1. Fechar o gate (três handoffs), registrar em `GATE_STATUS.md`, corrigir o que reprovar.
2. Atualizar `ATIVIDADES.md` (#3 e #18 dependem do gate).
3. Avisar o Gabriel: buscar o `@erp/nucleo` 0.3.2, descartar o 0.3.1 dele e ler `AMBIENTE.md` §1–2.
4. Depois do gate: ligar o `sessaoRedis` nas apps (#9; exige instalar `redis` e subir um Redis no
   `docker-compose` — pedir aprovação), implementar a fatia de fragmentos (#10) conforme o arquiteto,
   instrumentar uma zona para a telemetria (#18), registro de pacotes único (#14).
5. Mover `docs/MULTI_ZONES_RESEARCH.md`, `docs/revisao/` e `docs/superpowers/` para `docs/historico/`
   e commitar `docs/README.md` — **só depois que o challenger terminar** (a definição dele lê
   `docs/superpowers/specs/`); atualizar essa referência em `.claude/agents/simulador-condicoes.md`.

## Pendências com o humano

- Confirmar no GitLab os avisos de `ATIVIDADES.md` §3.
