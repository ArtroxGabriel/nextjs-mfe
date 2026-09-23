# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-23 (fatia K2)**.

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

## Estado (conferido nesta máquina em 2026-09-22)

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **88/88** com Redis e **85 + 3 pulados** com arquivo (2026-09-23, fatia K2) | `task verificar:redis`, `task verificar:construir` |
| Unidades | contratos 20, núcleo 135, moldura 26, stub 43, shell 42; typecheck das 4 apps; estática 33/33; scripts 14/14 | `task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test` |
| `@erp/nucleo` | **0.9.2** nas 4 apps (acesso v2 só, `exigirModulo(modulo, funcionalidade)`, `exigirPapel`) | lockstep 4 apps |
| `@erp/contratos` / `@erp/moldura` | **0.4.0** / **0.5.0** | ADR-0012, ADR-0014 adendo 1 |
| Gate "Shell novo" (#3, #18) | **aprovado** na iteração 4 | `GATE_STATUS.md`; tag `gate-shell-aprovado` |
| Gate B1+D1+G3+K | iteração 3 reprovada pelo auditor (V1–V7); **fatia K2 feita** (abaixo); falta a iteração 4 | `GATE_STATUS.md`; `.agents/*_b1_d1_3/` |
| Submódulos | os 8 no `master`, iguais a `origin/master` | `git submodule foreach git status -sb` |

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit e apagar as cópias | ✅ implementado; gate: iteração 3 reprovada → K2 | #20 | — |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem tocar domínio; sonda do shell passa a usá-lo | ✅ implementado; sonda só 2xx; gate junto com B1 (K2-8: health sem domínio) | #3 | — |
| | B5 parâmetros fixos no código: B5a (shell: sonda e telemetria) e B5b (núcleo: timeouts) | ✅ B5a e B5b (núcleo 0.8.0); os de sessão entram com o D2 | #20 | — |
| | B4/B6 verificações da spec e lacunas de segurança (server-only, DTO como prop de ilha, `<Link>` entre zonas) | ✅ analisadores endurecidos (23 testes); iteração 3 achou novos contornos → K2-3/4/6/7 | #20 | — |
| **C. Funcionalidades** | C1 fragmentos: rota `_fragmento` na zona 2, bloco na zona 1 com `<Suspense>`, recusa no shell | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1 |
| | C3 mapa de zonas vindo dos manifestos da gestão de acesso | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 sessão no Redis quando `REDIS_URL` existe (shell grava, zonas leem com usuário ACL só de leitura) | ✅ implementado; gate: iteração 3 reprovada → K2-1 | #9 | — |
| | D2 OIDC + PKCE no shell contra o Keycloak local; renovação proativa com lock (**ADR-0013**; pessoa casada por `sub`, adendo 1 do ADR-0014) | ⏳ só os campos da sessão (núcleo 0.8.0); login e renovação não começaram; núcleo 0.10.0 | #9 | G3 |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` do showcase: Redis e Keycloak (realm `erp`, atores ana/bruno/carla/davi) | ✅ | #19 | — |
| | E3 `task showcase` sobe tudo; `task showcase:conferir` | ✅ parcial: com Redis; falta login pelo Keycloak (D2) | #19 | D2 |
| | E4 roteiro do showcase (login OIDC, sessão entre zonas, 404 de módulo, fragmento, SSE, toast, 503, `If-Match`, erro normalizado, trace) | ⬜ | #19 | C1–C3, E3 |
| | E5 verificação ponta a ponta contra o showcase | ⬜ | #19 | E4 |
| **G. Gestão de acesso v2** | G1 modelo de referência e mock da API (porta 4020) | ✅ | #21 | — |
| | G2 decisão de arquitetura (**ADR-0014**, proposto) | ✅ | #21 | — |
| | G3 alinhar à v2 conforme o **adendo 1 do ADR-0014** | ✅ implementado (contratos 0.4.0, núcleo 0.9.2, moldura 0.5.0); gate iteração 3 reprovado → fatia K2 | #21 | — |
| | G4 gate e showcase com os atores da v2 | ⬜ | #21, #19 | G3 |
| | G5 revogação ativa: shell consome `/v2/eventos` e encerra sessões por sujeito (núcleo, não extensão) | ⬜ **lacuna declarada**: até lá não há revogação ativa | #21 | G3, D2 |

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
- **Gate segue o processo do `LEIA-PRIMEIRO.md`:** revisor e challenger em Sonnet, auditor forense em Opus
  com veto, profundidade comparável aos gates anteriores. Rodada fora disso não fecha atividade no GitLab.
- **Nada específico do material de levantamento** (cliente, órgãos, sistemas externos, documentos, pessoas,
  time) entra no repositório; só o vocabulário genérico da base, com dados fictícios.

## Pendências com o humano

1. ✅ **Instalações aprovadas pelo humano em 2026-09-22** ("tudo está aprovado de instalação"): `redis`, SDK OpenTelemetry, biblioteca OIDC, imagens do Redis e do Keycloak. Continua valendo mostrar o que entra antes de instalar.
2. **Decidir infraestrutura** de registro de pacotes / CI (P1). Enquanto cada máquina tiver o próprio
   Verdaccio, os lockfiles trocam de hash a cada máquina (ver `AMBIENTE.md` §1).
3. Aplicar no GitLab o que está em `ATIVIDADES.md` §2 com "pendente".
4. ✅ Sessão de 30 min **por inatividade**, capturada pelos refresh tokens (humano, 2026-09-22); teto absoluto configurável. Parâmetros assim ficam em configuração documentada (`docs/CONFIGURACAO.md`), não no código.
5. Aceitar (ou pedir ajuste de) **ADR-0013** e **ADR-0014 com o adendo 1** (corte seco para a v2, eventos no G5).

## O que foi feito nesta sessão (2026-09-22)

1. Ambiente desta máquina refeito (Verdaccio local; `task pacotes:alinhar-hashes`); B1+D1 conferido 60/60.
2. Gate B1+D1 iteração 2 (auditor Opus): **reprovado**, vetos V1–V8.
3. G2 fechado com o **adendo 1 do ADR-0014** (arquiteto): corte seco para a v2, eventos no G5.
4. **G3 implementado** (contratos 0.4.0, núcleo 0.9.x, moldura 0.5.0, stub, 4 apps, `base/verificacao`).
5. **Fatia K**: V1–V8 e L1–L8 da iteração 2 com correção e teste (ACL de leitura no Redis, analisadores endurecidos, sonda 2xx, tetos).
6. Gate iteração 3: revisor **APPROVE**, challenger **APPROVE**, auditor **INTEGRITY VIOLATION** (vetos abaixo).

## Fatia K2 (2026-09-23): feita — próximo passo é a iteração 4 do gate B1+D1+G3+K

| # | Veto | O que mudou | Teste que pega a mutação do auditor |
|---|---|---|---|
| K2-1 | V1 | zonas sem fallback para `REDIS_URL`: com ele e sem `REDIS_URL_ZONA`, `lib/redis.ts` recusa (docs/CONFIGURACAO.md) | E2E: `CLIENT KILL USER default` + zonas chamadas direto na porta → nenhuma conexão `default` nova; zona avulsa (porta 3012) sem `REDIS_URL_ZONA` → 5xx e nenhuma conexão de escrita; estático sem comentários |
| K2-2 | V2 | — | núcleo: identidade dos valores de `/shell` em todo subpath (o `./proxy` carrega com stub de `next/server`) |
| K2-3 | V3 | `fronteira.mjs` e `seguranca-estatica.mjs` leem imports e `server-only` pela árvore do compilador | todo módulo fora de `app/`/`scripts/` que chega ao servidor declara `import 'server-only'` |
| K2-4 | V4 | prop e filho de ilha só com valor escalar; ilha por barril, namespace e apelido | XE23–XE31, E10b/E10c; E2E procura CPF e e-mail da semente no HTML e no RSC de `/acesso` |
| K2-5 | V5 | actions da zona de acesso chamam o domínio dentro do corpo do `acaoProtegida` | estático: action começa por `return acaoProtegida(` e só toca `nucleo` dentro dele; E2E de Origin com os campos reais de cada action e estado conferido (+ contraprova com Origin válido) |
| K2-6 | V6 | N8: exceção por construção (`permite: fetch/redis`), lista de módulos permitidos, app inteira varrida | XR08–XR17 |
| K2-7 | V7 | `NEXT_PUBLIC_*` só da lista permitida; `next.config` sem `env`/`define`/`webpack` | XE38–XE41 |
| K2-8 | L1–L8 | health sem nada importado e corpo fixo; link de Relatórios; `precisaConstruir` por entrada e porta ocupada; `<Link>`/`router.push`; TTL e cache da sonda; `nome` vazio; `same-site`; âncora e 401 do mock; `ERP_DESTINO_TIMEOUT_MS` usado; t-1 na versão 3 (P16); `hostsPermitidos` só de `SHELL_HOSTS` | um teste por lacuna; **P07 (ator só-leitura) adiado para o D2** (`DEFERRED.md` D13) |

Cada teste novo foi conferido contra a mutação (ou contra o analisador antigo do HEAD): reprova com ela, passa sem ela.
Núcleo sem mudança de fonte (só testes e `scripts/`): continua 0.9.2, nada a publicar.

**Próximo:** iteração 4 com três verificadores novos (revisor Sonnet, challenger Sonnet — pedir que exercite P09, E10c, E01b/c
e a zona avulsa sem `REDIS_URL_ZONA` —, auditor Opus com veto). Depois **D2** (núcleo 0.10.0, OIDC + PKCE, ADR-0013, ator "eva"
do D13); G4; G5; C1–C3; E4–E5.

**Ambiente ao encerrar (2026-09-23):** Verdaccio, Redis e Keycloak do showcase no ar; nenhuma porta da base (3000–3003, 4001–4004, 4020) ocupada. Em 2026-09-22 estava derrubado — showcase (Redis e Keycloak) e Verdaccio parados; nenhuma porta da base
ocupada. O volume do Redis e os pacotes publicados no Verdaccio ficam. Para retomar: `task registry:subir`, `task showcase:subir`,
`task instalar` (se faltar), `task verificar:redis`. Resta um `pnpm start` antigo de outra sessão (pasta de rascunho, sem porta da base).
Outra máquina: publicar contratos 0.4.0 → núcleo 0.9.2 → moldura 0.5.0 no próprio Verdaccio (`task pacotes:publicar`) e rodar
`task pacotes:alinhar-hashes` antes do `task instalar`.
