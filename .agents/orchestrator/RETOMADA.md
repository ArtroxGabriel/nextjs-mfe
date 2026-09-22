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

## Gate "Shell novo": iterações 1 e 2 reprovadas e corrigidas; falta a iteração 3

Histórico e provas em `GATE_STATUS.md`. Estado atual: shell `72e0475`, zonas `f26fd7c`/`8627c02`/`ee623ab`,
núcleo 0.6.0 nas 4 apps (CSP e trace vindos do núcleo). `base/verificacao` **47/47** (duas vezes),
com navegador real (L6) e análise estrutural de saída de rede (N8).

**Iteração 3 em andamento:** `reviewer_shell_3` e `challenger_shell_3` (dono das portas) despachados;
`auditor_shell_3` (Opus) entra quando o challenger liberar as portas.
`reviewer_shell_3`: **APPROVE** — achados da iteração 2 e o veto fechados, com testes rodados; nenhum achado novo.
`challenger_shell_3`: **APPROVE** — 6 itens confirmados ao vivo (navegação real nas 16 combinações sem vazar módulo; trace forjado substituído; prefixos; CSP única; flash uma vez); 47/47. Observação menor: o 307 de login não leva CSP (corpo vazio).
`auditor_shell_3` (Opus) despachado.

## Feito: fatia de núcleo da #10 (fragmentos)

Decisão do `arquiteto-mfe` registrada no ADR-0011. `@erp/nucleo` 0.5.0 traz `criarFragmento` e
`responderFragmento`. Falta ligar: rota `_fragmento` na zona 2, bloco na zona 1, recusa de
`/{zona}/_fragmento/` no shell e teste ponta a ponta — depois do gate.

## Próximos passos

Ver "Plano até o objetivo" abaixo: a fase A (fechar o gate do shell) vem primeiro.

## Pedido do humano para depois da saída do challenger (2026-09-21)

Decidido pelo humano e em execução: ver o quadro "Andamento" em `PROPOSTA-REORGANIZACAO.md`.
Docs reorganizadas (D1–D6 feitos). Faltam D7 e C3 (esperam o auditor) e C1/C2 (código).

## Plano até o objetivo (revisto em 2026-09-21, noite)

Objetivo (ADR-0009, N1–N8): base genérica BFF + Multi-Zones **funcionando, testável e pronta
para escalar**; depois, o caminho para produção descrito em `docs/arquitetura/alvo.md` §6–7.

| Fase | Item | Atividade | Bloqueio |
|---|---|---|---|
| **A. Fechar o que está aberto** | A1 gate do shell: iteração 3 | #3, #18 | — |
| **B. Base consistente** | B1 kit de app (ADR-0012): pacotes **prontos** (núcleo 0.7.0, moldura 0.4.0); falta migrar as 4 apps juntas | — | A1 |
| | B2 núcleo 8: propagação **feita** (0.6.0); falta exportar spans (SDK OpenTelemetry) | #18 | **aprovação de instalação** |
| | B3 `/{zona}/api/health` sem tocar domínio; sonda passa a usá-lo | #3 | B1 |
| | B4 verificações da spec: build falha com `server-only` em `'use client'`; DTO sensível como prop de ilha; guarda contra `<Link>` entre zonas | — | — |
| **C. Funcionalidades do alvo** | C1 ligar fragmentos: rota `_fragmento` na zona 2, bloco na zona 1 com `<Suspense>` e breaker, recusa no shell | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`) | #11 | — |
| | C3 mapa de zonas vindo dos manifestos da gestão de acesso | #14 | — |
| **D. Produção** | D1 ligar `sessaoRedis` (cliente `redis` + Redis no compose) | #9 | **aprovação de instalação** |
| | D2 OIDC + PKCE e renovação de token (30 min de sessão) | #9 | **respostas do IdP** (`desenho/bff/PENDENCIAS.md` §4) |
| | D3 registro de pacotes único / CI com lockstep e verificação | #14 | **decisão de infraestrutura** |
| | D4 rate limiting na borda; p99 e alarme de RTT BFF↔domínio > 5 ms | — | ambiente real |
| | D5 `@erp/ui` depois de medir duplicação de bundle | #12 | medição |

## Pendências com o humano

- Confirmar no GitLab os avisos de `ATIVIDADES.md` §3.
