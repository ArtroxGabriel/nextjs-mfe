# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-22**.

## Objetivo final

Uma base genérica BFF + Multi-Zones **funcionando, testável e pronta para escalar**, entregue com um
**caso de teste usável (showcase)** que mostra cada funcionalidade basilar com as próprias mãos:

- domínios simulados por **APIs mock em Node.js com dados em JSON** (arquivo `.json` por domínio,
  sem dependência nova; um "jsondb" só se o JSON puro não bastar);
- **Keycloak** subido por imagem Docker como IdP (OIDC + PKCE), com realm e atores importados;
- **Redis** subido por imagem Docker como store de sessão;
- um comando sobe tudo e um roteiro diz o que clicar e o que deve acontecer.

## Estado

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **47/47** com navegador real | `pnpm verificar:construir` |
| `@erp/nucleo` | **0.6.0** nas 4 apps (CSP e trace); **0.7.0** publicado com o kit `/app`, ainda não consumido | `e624c0c`; ADR-0012 |
| `@erp/moldura` | 0.3.0 nas apps; **0.4.0** (`/servidor`) publicado, não consumido | ADR-0012 |
| Gate "Shell novo" (#3, #18) | iteração 3 **reprovada** pelo auditor (V1 página de recurso fora do L1; V2 zona travada); corrigida na verificação, **50/50**; falta a iteração 4 | `GATE_STATUS.md` |
| Repositório | limpo em 2026-09-22: só o necessário; o resto na tag `historico-2026-09-22` | este commit |

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell, iteração 4 (revisor + auditor; só a verificação mudou) | ⏳ | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit (`@erp/nucleo` 0.7.0 + `@erp/moldura` 0.4.0) e apagar as cópias | ⬜ | #20 | A1 |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem tocar domínio; sonda do shell passa a usá-lo | ⬜ | #3 | B1 |
| | B5 parâmetros fixos no código (timeouts de destino e fragmento, TTL/timeout da sonda, limites da telemetria, vida da sessão dev) viram variáveis de ambiente com padrão e validação na subida, conforme `docs/CONFIGURACAO.md` | ⬜ | #20 | B1 |
| | B4 verificações da spec: `server-only` em `'use client'` falha o build; DTO sensível como prop de ilha; guarda contra `<Link>` entre zonas | ⬜ | #20 | B1 |
| **C. Funcionalidades** | C1 fragmentos: rota `_fragmento` na zona 2, bloco na zona 1 com `<Suspense>`, recusa no shell | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1 |
| | C3 mapa de zonas vindo dos manifestos da gestão de acesso | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 ligar `sessaoRedis` (cliente `redis` + Redis no compose) | ⬜ | #9 | — (instalação aprovada) |
| | D2 OIDC + PKCE no shell contra o Keycloak local; renovação proativa com lock no proxy do shell; núcleo 0.8.0 | ⬜ desenho decidido: **ADR-0013** (proposto) | #9 | B1, D1 |
| **E. Showcase** | E1 domínios mock com dados em JSON por domínio (sementes por ator, persistência em arquivo, reset por comando) | ✅ commit `35cb4c7` no branch `e1-dados-json` do `erp-dominio-stub` (worktree em scratchpad); 24/24, 6 mutações pegas. **Falta:** merge no `master` do submódulo depois do auditor, envio, fixar no principal e rodar `pnpm verificar` | #19 | A1 (só para o merge) |
| | E2 `docker-compose` do showcase: Redis, Keycloak (realm `erp` com ana/bruno/carla/davi) | ✅ `base/showcase/` **no ar e conferido** (`docker compose -f base/showcase/docker-compose.yml up -d`; `node base/showcase/checar-keycloak.mjs`: sem PKCE recusado, verifier errado recusado, login da ana com token de 300 s e refresh): Redis 7.4 com AOF e `noeviction`; Keycloak 26 com cliente confidencial `erp-shell` + PKCE S256, sessão de 30 min. Grupos ficam nos domínios (ADR-0009), não no Keycloak | #19 | D1, D2 (imagens aprovadas) |
| | E3 `pnpm showcase`: sobe imagens, mocks e apps; derruba com um comando | ⬜ | #19 | E1, E2 |
| | E4 roteiro do showcase: cada funcionalidade basilar com passo e resultado esperado (login OIDC, sessão entre zonas, módulo negado = 404, fragmento, SSE, toast, zona fora = 503, `If-Match`, erro `{ codigo, supportId }`, trace) | ⬜ | #19 | C1–C3, E3 |
| | E5 verificação ponta a ponta rodando contra o showcase | ⬜ | #19 | E4 |
| **P. Caminho para produção** | P1 registro de pacotes único / CI com lockstep e verificação | 🔒 | #14 | **decisão de infraestrutura** |
| | P2 rate limiting na borda; p99 e alarme de RTT BFF↔domínio > 5 ms | 🔒 | — | ambiente real |
| | P3 `@erp/ui` depois de medir duplicação de bundle | 🔒 | #12 | medição (entra em F2) |

**Ordem:** A1 → B1 → (B3, B4, C1, C2, C3 em paralelo onde não disputam portas) → D1 → D2 → E1–E5.
E1 pode começar a qualquer momento (não depende das apps).

### Lista 2 — refinamento (separada; **não começar agora**)

Condição para começar qualquer item: **Lista 1 fases A–E concluídas** (estrutura da arquitetura e
atividades relacionadas feitas) **e todas as funcionalidades basilares no showcase**.
Cada item começa com um **pedido de detalhamento** em `pedidos/AAAA-MM-DD-<assunto>.md` (formato em
`pedidos/README.md`); só se implementa depois que o humano devolver o detalhamento.

| # | Atividade | O que o pedido de detalhamento precisa responder |
|---|---|---|
| F1 | Refinamento arquitetural com design patterns e padrões de arquitetura | quais padrões (ports & adapters, strategy, decorator, circuit breaker, anti-corruption layer…) e onde cada um entra no núcleo, nas zonas e nos domínios; critério de pronto |
| F2 | Otimização para desenvolvimento e produção | metas (tempo de subir, HMR, build, bundle, TTFB, p95/p99); o que medir e com que ferramenta; perfis `dev` e `prod` |
| F3 | Mapa robusto | confirmar o escopo (mapa de zonas: descoberta, versão, fallback, saúde, dono de cada rota); formato e fonte da verdade |
| F4 | Refinamento da gestão de acesso | modelo de perfis/módulos/concessões, delegação, auditoria, administração pela UI, integração com grupos do Keycloak |
| F5 | Padronização de erro | catálogo de `codigo`, mapeamento domínio → BFF → UI, `supportId` e correlação com trace, páginas de erro |
| F6 | Camada de testes | pirâmide (unidade, contrato, integração, ponta a ponta, navegador); onde mora cada teste; cobertura mínima; mutação |
| F7 | Camada de testes de desempenho e segurança | cenários de carga, metas, ferramentas (k6/autocannon), testes de segurança (OWASP, CSP, sessão, IDOR), frequência |

## Como o trabalho é conduzido

- **Estado salvo e commitado a cada passo concluído**; nunca deixar trabalho só na árvore local.
  Submódulo enviado antes do principal (`AMBIENTE.md` §2).
- **Handoff aos 80% do uso da sessão do horário:** reescrever este arquivo com o passo exato em que
  parou, atualizar `ATIVIDADES.md`, commitar e enviar. Verificadores mantêm o próprio handoff
  "(parcial)" desde o começo.
- **Pendências do GitLab revisadas a cada passo:** `ATIVIDADES.md` atualizado e bloco 📌 GitLab na resposta.
- **Só o necessário no repositório:** documento ou pasta encerrada sai com `git rm`; o git guarda.

## Pendências com o humano

1. ✅ **Instalações aprovadas pelo humano em 2026-09-22** ("tudo está aprovado de instalação"): `redis`, SDK OpenTelemetry, biblioteca OIDC, imagens do Redis e do Keycloak. Continua valendo mostrar o que entra antes de instalar.
2. **Decidir infraestrutura** de registro de pacotes / CI (P1).
4. ✅ Sessão de 30 min **por inatividade**, capturada pelos refresh tokens (humano, 2026-09-22); teto absoluto configurável. Regra nova: parâmetros assim ficam em configuração documentada (`docs/CONFIGURACAO.md`), não no código.
3. Aplicar no GitLab o que está em `ATIVIDADES.md` §2 com "pendente".

## Próximo passo

Iteração 4 do gate do shell (revisor **APPROVE**; nit: `congelarApp`/`descongelarApp` sem a guarda `if (!p) return` — aplicar depois do auditor): `reviewer_shell_4` (Sonnet, só leitura e unidade) e `auditor_shell_4` (Opus, dono das
portas). Com CLEAN: registrar, atualizar #3 e #18, fazer o merge do E1 e seguir para B1.
