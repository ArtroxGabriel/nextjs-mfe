# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-22, noite (handoff)**.

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
| | B3 `/{zona}/api/health` sem tocar domínio; sonda do shell passa a usá-lo | ⬜ | #3 | B1 |
| | B5 parâmetros fixos no código (timeouts de destino e fragmento, TTL/timeout da sonda, limites da telemetria, vida da sessão dev) viram variáveis de ambiente com padrão e validação na subida, conforme `docs/CONFIGURACAO.md` | ⬜ | #20 | B1 |
| | B4 verificações da spec: `server-only` em `'use client'` falha o build; DTO sensível como prop de ilha; guarda contra `<Link>` entre zonas | ⬜ | #20 | B1 |
| | B6 lacunas de segurança do relatório de 2026-09-22 (`.agents/seguranca_2026-09-22/relatorio.md`): 13 dos 17 invariantes com prova de mutação; **P0** `server-only` em `'use client'` falhar o build e DTO sensível como prop (= B4); **P1** guarda de `<Link>` entre zonas (= B4) e prova de mutação do invariante 1 (token); **P2** invariante 9 ("não recarregar"), 11 (`NEXT_PUBLIC_*` estático), 13 (cache); **P3** invariante 14 e 4 itens do checklist §10 sem teste (headers em spans, logs sem `Authorization`, sem `traceresponse`/`Server-Timing`, rota pública sem `cookies()`) | ⬜ | #20 | B1 |
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

## Estado de trabalho (2026-09-22, madrugada)

- B1 e D1 **no `master`** das quatro apps e fixados no principal. Sem branches de trabalho abertos.
- Showcase (`task showcase`) **no ar** com a sessão no Redis; `task showcase:conferir` todo verde.
- Documentação de responsabilidades do zero: `docs/RESPONSABILIDADES.md` (ligada no README de cada repositório).
- Ainda sem gate: B1 + D1 (despachar `reviewer_b1_1`, `challenger_b1_1`, `auditor_b1_1`).
- `registrarManifesto()` no núcleo (ADR-0012, decisão 5) não existe no 0.7.0: os scripts ficam nas apps; levar ao 0.8.0.
- B5 dividido: B5a (shell: sonda e telemetria → configuração) e B5b (núcleo: timeouts e sessão dev, no 0.8.0).
- Pendente com o humano: o que é o "backend específico" da gestão de acesso.

## Próximo passo

Gate de B1+D1 (o challenger precisa das portas: parar o showcase antes); depois B5a, B3, B4/B6 (P0 e P1), C1–C3, D2 (ADR-0013), E4–E5.
