# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-23 (handoff)**.

## Objetivo final

Uma base genérica BFF + Multi-Zones **funcionando, testável e pronta para escalar**, entregue com um
**caso de teste usável (showcase)** que mostra cada funcionalidade basilar com as próprias mãos:

- domínios simulados por **APIs mock em Node.js com dados em JSON** (arquivo `.json` por domínio,
  sem dependência nova; um "jsondb" só se o JSON puro não bastar);
- **Keycloak** subido por imagem Docker como IdP (OIDC + PKCE), com realm e atores importados;
- **Redis** subido por imagem Docker como store de sessão;
- um comando sobe tudo e um roteiro diz o que clicar e o que deve acontecer;
- a **gestão de acesso** segue o modelo de referência da base (`docs/gestao-acesso/MODELO.md`): unidades,
  papéis com escopo, módulos com validação, segregação de funções, auditoria — e a arquitetura (núcleo, BFFs,
  zonas, domínios, shell) alinhada a ele, sem perder nenhum invariante de segurança.

## Estado

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **51/51** com navegador real | `task verificar:construir` |
| `@erp/nucleo` | **0.7.0** nas 4 apps (kit `/app`) | ADR-0012 |
| `@erp/moldura` | **0.4.0** nas 4 apps (`/servidor`) | ADR-0012 |
| Gate "Shell novo" (#3, #18) | **aprovado** na iteração 4 (revisor APPROVE, challenger APPROVE, auditor CLEAN); lacunas do auditor fechadas depois, **51/51** | `GATE_STATUS.md`; tag `gate-shell-aprovado` |
| Repositório | limpo em 2026-09-22: só o necessário; o resto na tag `historico-2026-09-22` | este commit |

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit e apagar as cópias | ✅ implementado (shell `8559367`, zonas `495f1ef`/`8283621`/`3250e9f`); 51/51; **falta gate** (junto com D1) | #20 | — |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem tocar domínio; sonda do shell passa a usá-lo | ✅ implementado nas 3 zonas e shell atualizado; 38/38 testes verdes | #3 | — |
| | B5 parâmetros fixos no código: B5a (shell: sonda e telemetria) e B5b (núcleo: timeouts e sessão dev) | ⏳ B5a ✅ implementado e testado; B5b no núcleo 0.8.0 | #20 | — |
| | B4 verificações da spec e B6 lacunas de segurança: P0 (server-only, DTO como prop de ilha) e P1 (guarda de <Link> entre zonas) | ✅ `base/verificacao/seguranca-estatica.mjs` (16/16 estáticos verdes) | #20 | — |
| **C. Funcionalidades** | C1 fragmentos: rota `_fragmento` na zona 2, bloco na zona 1 com `<Suspense>`, recusa no shell | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1 |
| | C3 mapa de zonas vindo dos manifestos da gestão de acesso | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 sessão no Redis quando `REDIS_URL` existe (`lib/redis.ts` com `redis` 6.2.1; shell grava, zonas leem) | ✅ implementado; `task verificar:redis` 51/51 com 68 chaves no Redis; **falta gate** e o cenário "Redis fora → erro normalizado" como teste | #9 | — |
| | D2 OIDC + PKCE no shell contra o Keycloak local; renovação proativa com lock no proxy do shell; núcleo 0.8.0 | ⬜ desenho decidido: **ADR-0013** (proposto) | #9 | B1, D1 |
| **E. Showcase** | E1 domínios mock com dados em JSON por domínio (sementes, persistência com `DADOS_DIR`, `task showcase:dados:resetar`) | ✅ `erp-dominio-stub` `35cb4c7`; 24/24, 6 mutações pegas; ponta a ponta 51/51 | #19 | — |
| | E2 `docker-compose` do showcase: Redis, Keycloak (realm `erp` com ana/bruno/carla/davi) | ✅ `base/showcase/` **no ar e conferido** (`docker compose -f base/showcase/docker-compose.yml up -d`; `node base/showcase/checar-keycloak.mjs`: sem PKCE recusado, verifier errado recusado, login da ana com token de 300 s e refresh): Redis 7.4 com AOF e `noeviction`; Keycloak 26 com cliente confidencial `erp-shell` + PKCE S256, sessão de 30 min. Grupos ficam nos domínios (ADR-0009), não no Keycloak | #19 | D1, D2 (imagens aprovadas) |
| | E3 `task showcase`: sobe imagens, mocks e apps; Ctrl-C derruba; `task showcase:conferir` mostra ator × zona | ✅ parcial: tudo sobe e funciona com login dev e sessão em arquivo (conferido: matriz de 4 atores × 7 páginas, custo só para bruno, CSP, sem token); falta trocar para Keycloak/Redis (D1, D2) | #19 | D1, D2 para completar |
| | E4 roteiro do showcase: cada funcionalidade basilar com passo e resultado esperado (login OIDC, sessão entre zonas, módulo negado = 404, fragmento, SSE, toast, zona fora = 503, `If-Match`, erro `{ codigo, supportId }`, trace) | ⬜ | #19 | C1–C3, E3 |
| | E5 verificação ponta a ponta rodando contra o showcase | ⬜ | #19 | E4 |
| **G. Gestão de acesso v2** | G1 modelo de referência e mock da API (porta 4020, contrato OpenAPI, 39 testes, 7 mutações pegas) | ✅ `docs/gestao-acesso/MODELO.md`; `erp-dominio-stub` | #21 | — |
| | G2 decisão de arquitetura com o `arquiteto-mfe` + **ADR-0014**: como núcleo (`acessoHttp`/`exigirModulo` por funcionalidade), manifestos das zonas (módulo + funcionalidades), domínios (`/v2/decisoes`) e shell (`/v2/eventos` encerra sessões) passam a usar a v2; o que muda nos 17 invariantes e nos testes | ✅ registrado no **ADR-0014** (proposto) | #21 | — |
| | G3 implementar o alinhamento (núcleo 0.8.0 junto com D2/ADR-0013, zonas, stub), trocar 4010 → v2, `base/verificacao` cobrindo os papéis e a segregação | ⬜ | #21 | G2, B1/D1 gate |
| | G4 gate (revisor, challenger, auditor) e showcase com os atores da v2 | ⬜ | #21, #19 | G3 |

## Handoff (2026-09-22, encerramento de sessão)

O que está pronto, commitado e enviado:
- **G2**: decisão de arquitetura registrada no [ADR-0014](docs/adr/0014-gestao-de-acesso-v2.md) e referenciada no índice da documentação.
- **B5a**: limites de sonda e telemetria tornados configuráveis via variáveis de ambiente no shell (`ERP_SONDA_TTL_MS`, `ERP_SONDA_TIMEOUT_MS`, `ERP_TELEMETRIA_MAX_BYTES`, `ERP_TELEMETRIA_LOTES_POR_MINUTO`) com validação de inteiro positivo e testes unitários.
- **B3**: rotas públicas `/{zona}/api/health` adicionadas nas 3 zonas (`erp-zona-1`, `erp-zona-2`, `erp-zona-acesso`) sem tocar em domínio nem exigir sessão; `urlSaude` padrão do shell atualizado para usá-las.
- **B4 / B6 (P0 e P1)**: analisador estático implementado em `base/verificacao/seguranca-estatica.mjs` com suíte de 9 testes cobrindo Invariante 3 (`server-only`), Invariante 2 (DTO sensível como prop de JSX), P1 (`<Link>` entre zonas) e Invariante 11 (`NEXT_PUBLIC_*`). Todas as 4 apps passam com 0 violações; adicionada tarefa `task verificar:estatica`.
- **Submódulos:** todos os 7 submódulos modificados commitados no `master` e enviados para os remotos (`origin/master`), validados pelo hook `task checar-envio`.

Próximos passos, em ordem:
1. Gate de B1+D1.
2. G3 junto com D2 (ADR-0013 e ADR-0014 sobem o `@erp/nucleo` para a versão 0.8.0 nas 4 apps em lockstep); depois G4.
3. C1–C3, E4–E5.
