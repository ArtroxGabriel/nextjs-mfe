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
| `@erp/nucleo` | **0.6.0** nas 4 apps (CSP e trace); **0.7.0** publicado com o kit `/app`, ainda não consumido | `e624c0c`; ADR-0012 |
| `@erp/moldura` | 0.3.0 nas apps; **0.4.0** (`/servidor`) publicado, não consumido | ADR-0012 |
| Gate "Shell novo" (#3, #18) | **aprovado** na iteração 4 (revisor APPROVE, challenger APPROVE, auditor CLEAN); lacunas do auditor fechadas depois, **51/51** | `GATE_STATUS.md`; tag `gate-shell-aprovado` |
| Repositório | limpo em 2026-09-22: só o necessário; o resto na tag `historico-2026-09-22` | este commit |

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit (`@erp/nucleo` 0.7.0 + `@erp/moldura` 0.4.0) e apagar as cópias | ⏳ **WIP** no branch `b1-kit` das 4 apps (ver "Handoff" abaixo) | #20 | — |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem tocar domínio; sonda do shell passa a usá-lo | ⬜ | #3 | B1 |
| | B5 parâmetros fixos no código (timeouts de destino e fragmento, TTL/timeout da sonda, limites da telemetria, vida da sessão dev) viram variáveis de ambiente com padrão e validação na subida, conforme `docs/CONFIGURACAO.md` | ⬜ | #20 | B1 |
| | B4 verificações da spec: `server-only` em `'use client'` falha o build; DTO sensível como prop de ilha; guarda contra `<Link>` entre zonas | ⬜ | #20 | B1 |
| | B6 lacunas de segurança do relatório de 2026-09-22 (`.agents/seguranca_2026-09-22/relatorio.md`): 13 dos 17 invariantes com prova de mutação; **P0** `server-only` em `'use client'` falhar o build e DTO sensível como prop (= B4); **P1** guarda de `<Link>` entre zonas (= B4) e prova de mutação do invariante 1 (token); **P2** invariante 9 ("não recarregar"), 11 (`NEXT_PUBLIC_*` estático), 13 (cache); **P3** invariante 14 e 4 itens do checklist §10 sem teste (headers em spans, logs sem `Authorization`, sem `traceresponse`/`Server-Timing`, rota pública sem `cookies()`) | ⬜ | #20 | B1 |
| **C. Funcionalidades** | C1 fragmentos: rota `_fragmento` na zona 2, bloco na zona 1 com `<Suspense>`, recusa no shell | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1 |
| | C3 mapa de zonas vindo dos manifestos da gestão de acesso | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 ligar `sessaoRedis` (cliente `redis` + Redis no compose) | ⬜ | #9 | — (instalação aprovada) |
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

## Handoff (2026-09-22, noite) — parar e retomar sem retrabalho

O humano pediu para parar. Tudo está commitado e enviado; o principal e os submódulos estão no `master`,
com os ponteiros verificados (51/51). O único trabalho em andamento é o **B1**.

### Onde o B1 parou

Branch `b1-kit` (enviado) em `erp-shell` `deadb74`, `erp-zona-1` `d11c273`, `erp-zona-2` `390045f`,
`erp-zona-acesso` `2a8b1fe`. Feito nesse commit, igual nas quatro apps:
- `lib/pagina.ts` virou só a ligação com o Next: `criarPaginas` (`@erp/nucleo/app`) + `criarMolduraDoServidor`
  (`@erp/moldura/servidor`), exportando `caminhoAtual`, `sessaoDaPagina`, `modulosPermitidos`, `exigirModulo`,
  `dadosDaMoldura`, `flash`, `acaoProtegida` com as mesmas assinaturas de antes;
- `lib/indisponivel.tsx` apagado; o layout importa `ServicoIndisponivel` de `@erp/moldura`;
- `app/global-error.tsx` é um re-export de `ErroGlobal` da moldura;
- `package.json`: `@erp/nucleo` 0.7.0, `@erp/moldura` 0.4.0.

**Não feito (próximos passos exatos, nesta ordem):**
1. Em cada app: `git checkout b1-kit`.
2. No layout (`app/layout.tsx`; no shell `app/(app)/layout.tsx`), juntar as duas linhas de import de
   `@erp/moldura` numa só (`import { Moldura, ServicoIndisponivel } from '@erp/moldura'`).
3. Verdaccio no ar (`task registry:subir`) e `pnpm install` em cada app (atualiza o lockfile; o pnpm acrescenta
   as versões em `minimumReleaseAgeExclude`, é esperado — `AMBIENTE.md` §1).
4. `task typecheck`; procurar imports quebrados (`grep -rn "@/lib/indisponivel" repos/erp-*/app`).
5. `task lockstep`; `task verificar:construir` → esperado **51/51**.
6. Merge `b1-kit` → `master` (fast-forward) nas 4 apps, envio dos submódulos, fixar os 4 ponteiros no principal
   num commit só (lockstep, ADR-0012 decisão 6), enviar; apagar os branches `b1-kit`.
7. Atualizar `docs/arquitetura/atual.md` (núcleo 0.7.0/moldura 0.4.0 nas apps) e `README.md` se mudar contagem.
8. Gate do B1 com agentes novos (`reviewer_b1_1` Sonnet, `challenger_b1_1` Sonnet dono das portas, depois
   `auditor_b1_1` Opus): foco em fail-open do `exigirModulo`/`acaoProtegida` agora num lugar só, e md5sum sem
   cópias idênticas além da ligação de `lib/pagina.ts`.

**Observações do B1:**
- `registrarManifesto()` na raiz do núcleo (ADR-0012, decisão 5) **não existe no 0.7.0**; os
  `scripts/registrar-manifesto.ts` ficam nas apps (arquivo-modelo permitido). Levar a função ao núcleo 0.8.0 (junto com D2).
- B5 dividido: **B5a** (shell: `lib/saude-zonas.ts` TTL/timeout da sonda, `lib/telemetria.ts` limites → variáveis
  de `docs/CONFIGURACAO.md`, sem publicar pacote) pode entrar logo depois do B1; **B5b** (núcleo: timeout de
  destino e de fragmento, vida da sessão dev → parâmetros de `criarNucleo` lidos do ambiente pela app) entra no 0.8.0.

### Ambiente deixado no ar

- Contêineres: `verdaccio` (4873), `erp-showcase-redis-1` (6379), `erp-showcase-keycloak-1` (8080). Nenhum processo
  nas portas da base (3000–3003, 4001–4004, 4010). `task showcase:descer` derruba Redis/Keycloak se quiser.

### Pendências com o humano (abertas nesta sessão)

- **Gestão de acesso — "backend específico":** é um sistema real da empresa com contrato próprio (então precisamos
  de endpoints/payloads, modelo de perfis e como identifica o usuário) ou só separar a gestão num backend próprio?
  Até a resposta, o simulador atual (`erp-dominio-stub`, porta 4010, dados em `dados/semente/gestao-acesso.json`) segue.
- GitLab: aplicar o que está "pendente" em `ATIVIDADES.md` §2 (textos em §3).

## Próximo passo

Retomar o B1 pelo passo 1 do handoff acima. Depois: B5a, B3, B4/B6 (P0 e P1), C1–C3, D1, D2 (ADR-0013), E2–E5.
