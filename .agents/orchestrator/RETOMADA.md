# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-23 (encerramento: gate iteração 4 reprovado; esperando decisões)**.

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

## ⛔ Parado esperando o humano — leia primeiro

O trabalho está **parado de propósito** até o humano responder, **por inteiro**, o pedido
[`pedidos/2026-09-23-decisoes-gate-c2-d2.md`](../../pedidos/2026-09-23-decisoes-gate-c2-d2.md) (instrução do humano,
2026-09-23: "espera uma resposta toda para prosseguir"). São três decisões:

| | Decisão | Recomendação | O que destrava |
|---|---|---|---|
| **A** | Critério de veto do auditor: A1 manter (todo contorno é veto) · **A2** veto só para defeito de produto ou erro plausível de boa-fé, contorno deliberado vira limite declarado · A3 encerrar como está | A2 | escopo da fatia K3 e o despacho da iteração 5 |
| **B** | Fase C2: `proxyTimeout` (B1 10 s · B2 30–60 s · B3 padrão) + 3 propostas (aviso vindo do domínio falso; Redis pub/sub só com mais de uma cópia do shell; meta de 2 s) | B1 10 s, propostas ok | o desenho do C2 e o D7 |
| **C** | Medição 1 do D2 (duas renovações simultâneas no Keycloak): agora ou no início do D2 | agora | o rigor do lock de renovação (ADR-0013) |

**Ao retomar:** leia a seção "Resposta do humano" do pedido. Vazia → não faça nada além de lembrar o humano.
Preenchida → marque o pedido como `respondido`, registre as decisões em "Pendências com o humano" abaixo e siga
"Próximos passos".

## Estado (conferido nesta máquina em 2026-09-23)

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **88/88** com Redis e **85 + 3 pulados** com arquivo (conferido de novo pelo auditor da iteração 4 ao fim) | `task verificar:redis`, `task verificar:construir` |
| Unidades | contratos 20, núcleo 135, moldura 26, stub 43, shell 42; typecheck das 4 apps; estática 33/33; scripts 14/14 | `task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test` |
| `@erp/nucleo` | **0.9.2** nas 4 apps (acesso v2, `exigirModulo(modulo, funcionalidade)`, `exigirPapel`) | lockstep 4 apps |
| `@erp/contratos` / `@erp/moldura` | **0.4.0** / **0.5.0** | ADR-0012, ADR-0014 adendo 1 |
| ADRs | **0013 aceito** e **0014 + adendo 1 aceito** (humano, 2026-09-23) | `docs/adr/` |
| Gate "Shell novo" (#3, #18) | **aprovado** na iteração 4 | `GATE_STATUS.md`; tag `gate-shell-aprovado` |
| Gate B1+D1+G3+K | **iteração 4 reprovada** pelo auditor (vetos V1–V5 novos); revisor e challenger aprovaram. Correção: fatia K3, **esperando a decisão A** | `GATE_STATUS.md`; `.agents/*_b1_d1_4/` |
| Submódulos | os 8 no `master`, iguais a `origin/master`; só `pnpm-lock.yaml` de hash local modificado em `erp-dominio-stub` e `erp-moldura` (não commitar) | `git submodule foreach git status -sb` |

## Histórico curto do gate B1+D1+G3+K

| Iteração | Resultado | Correção |
|---|---|---|
| 1 | considerada rasa | iteração 2 com auditor Opus |
| 2 | auditor vetou V1–V8 | fatia K |
| 3 | revisor e challenger aprovaram; auditor vetou V1–V7 (127 mutações, 55 sobreviventes) | fatia **K2** (2026-09-23): cada veto com teste que reprova a mutação; P07 adiado (D13) |
| 4 | revisor e challenger aprovaram; auditor vetou **V1–V5** novos (127, 55 sobreviventes; tudo da iteração 3 agora pego) | fatia **K3**, escopo depende da decisão A |

**Por que a decisão A existe:** os vetos restantes são, em boa parte, contornos deliberados de analisadores estáticos;
cada iteração fecha os da anterior e o auditor acha os seguintes (55 e 55). Analisador estático protege contra erro de
boa-fé; contra burla deliberada, a defesa é revisão obrigatória (CODEOWNERS) e barreira no ambiente. Detalhe no pedido §2.

## Próximos passos (depois da resposta)

1. **Fatia K3** conforme a decisão A. Tabela dos vetos (correções sugeridas pelo auditor; com A2, K3-2 e K3-4 viram
   "fechar o barato + declarar o limite"):

| # | Veto | Correção |
|---|---|---|
| K3-1 | V1 (E01f) | zona não recebe `REDIS_URL` no ambiente (`subir()`, `base/showcase/subir.mjs`, Taskfile); teste lê `/proc/<pid>/environ` de cada processo de zona e exige a ausência |
| K3-2 | V2 (N38d–f) | fronteira: símbolos de `src/shell` só importados por `src/shell`; `src/index.ts` tratado como camada |
| K3-3 | V3 (E10d/XE26) | prop de ilha com tipo escalar pelo TypeChecker do TypeScript; ilha por `createElement`/`next/dynamic`/`export const`; E2E procura `CC-` em `/zona1` |
| K3-4 | V4 (XR20p/38p/23p) | sombra de `fetch` só no escopo declarado; não pular `test/` aninhado em `fontesDaApp`; `next/*` por lista explícita; chave calculada em `constructor`/`binding` |
| K3-5 | V5 (XN01p) | `next.config`: recusar atribuição a `.env`, chave calculada e spread de outro módulo; E2E procura origens internas no JS do navegador |
| K3-6 | L1–L5 | contornos do `P0-acao-protegida`; N4 conclui com o `If-Match` da página numa tarefa cuja versão o teste não fixa (P16b); cache de "fora" com duração mínima; `router.push(variavel)`; `rewrites()`/`assetPrefix` com endereço interno |

2. **Iteração 5** com verificadores novos (revisor e challenger Sonnet; auditor Opus), o critério da decisão A escrito no
   despacho do auditor, e a lista de sobreviventes da iteração 4 como casos para o challenger.
3. Medição 1 do D2 (quando a decisão C mandar) — script em `base/showcase/`, sem instalar nada.
4. **D2** (núcleo 0.10.0, OIDC + PKCE, ADR-0013; medição 2 do `sub` fixo no início; ator "eva" do D13); G4; G5; C1–C3 (C2 com a
   decisão B); E4–E5; B2. Registro de pacotes/CI (P1) **no fim** (humano).

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit | ✅ implementado; gate: iteração 4 reprovada → K3 | #20 | 🔒 decisão A |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem domínio; sonda do shell o usa | ✅ implementado e testado (K2); gate junto com B1 | #3 | — |
| | B5 parâmetros em configuração (B5a shell, B5b núcleo) | ✅; os de sessão entram com o D2 | #20 | — |
| | B4/B6 verificações estáticas de segurança | ✅ endurecidas na K2 (33 testes); iteração 4 achou contornos → K3 | #20 | 🔒 decisão A |
| **C. Funcionalidades** | C1 fragmentos entre zonas | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1; 🔒 decisão B |
| | C3 mapa de zonas vindo dos manifestos | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 sessão no Redis (shell grava, zonas leem com ACL só de leitura) | ✅ implementado; gate → K3-1 | #9 | 🔒 decisão A |
| | D2 OIDC + PKCE e renovação proativa com lock (**ADR-0013 aceito**; pessoa por `sub`) | ⏳ só os campos da sessão; login e renovação não começaram; núcleo 0.10.0 | #9 | gate B1+D1; decisão C |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` com Redis e Keycloak | ✅ | #19 | — |
| | E3 `task showcase` e `task showcase:conferir` | ✅ parcial: falta login pelo Keycloak | #19 | D2 |
| | E4 roteiro do showcase | ⬜ | #19 | C1–C3, E3 |
| | E5 verificação ponta a ponta contra o showcase | ⬜ | #19 | E4 |
| **G. Gestão de acesso v2** | G1 modelo e mock (porta 4020) | ✅ | #21 | — |
| | G2 **ADR-0014 + adendo 1, aceito** | ✅ | #21 | — |
| | G3 alinhar à v2 | ✅ implementado; gate → K3 | #21 | 🔒 decisão A |
| | G4 gate e showcase com os atores da v2 | ⬜ | #21, #19 | G3 |
| | G5 revogação ativa por `/v2/eventos` | ⬜ **lacuna declarada e aceita** até lá | #21 | G3, D2 |

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

## Como o trabalho é conduzido

- **Estado salvo e commitado a cada passo concluído**; nunca deixar trabalho só na árvore local.
  Submódulo enviado antes do principal (`AMBIENTE.md` §2). Commits sem rodapé de coautoria (hook `no-ai-authorship`).
- **Handoff aos 80% do uso da sessão:** reescrever este arquivo com o passo exato, atualizar `ATIVIDADES.md`, commitar e enviar.
  Verificadores mantêm o próprio handoff "(parcial)" desde o começo.
- **Decisão do humano em aberto → pedido em `pedidos/` e parar** o que depende dele.
- **Pendências do GitLab revisadas a cada passo:** `ATIVIDADES.md` atualizado e bloco 📌 GitLab na resposta.
- **Gate segue o `LEIA-PRIMEIRO.md`:** revisor e challenger em Sonnet, auditor forense em Opus com veto; o auditor só roda
  quando o challenger libera as portas. Verificador que já entregou handoff não é reusado.
- **Nada específico do material de levantamento** entra no repositório; só o vocabulário genérico da base, com dados fictícios.

## Pendências com o humano

1. ⛔ **Pedido `pedidos/2026-09-23-decisoes-gate-c2-d2.md`** — decisões A, B e C (acima). Bloqueia tudo.
2. ✅ Decisões de 2026-09-23: iteração 4 autorizada; ADR-0013 aceito; ADR-0014 + adendo 1 aceito (com a lacuna até o G5);
   P07 adiado para o D2 (`DEFERRED.md` D13).
3. ✅ Instalações aprovadas (2026-09-22): `redis`, SDK OpenTelemetry, biblioteca OIDC, imagens do Redis e do Keycloak.
   Continua valendo mostrar o que entra antes de instalar.
4. ✅ Sessão de 30 min por inatividade (2026-09-22); parâmetros em `docs/CONFIGURACAO.md`.
5. **Registro de pacotes / CI (P1): no fim do plano** (humano, 2026-09-23). Até lá, `task pacotes:alinhar-hashes`.
6. Aplicar no GitLab o que estiver "pendente" em `ATIVIDADES.md` §2 (hoje só comentários opcionais).

## Ambiente ao encerrar (2026-09-23)

- **No ar:** Verdaccio (4873), Redis (6379) e Keycloak (8080) do showcase. **Livres:** portas da base 3000–3003, 3012, 4001–4004,
  4010, 4020 (conferido depois do auditor).
- Nenhum agente rodando. Pastas dos verificadores da iteração 4 (`.agents/*_b1_d1_4/`) commitadas; as da iteração 3 ficam enquanto
  a K3 citar os achados delas.
- Para retomar noutra sessão: `git fetch origin`, `git submodule update --init`, `task registry:subir`, `task showcase:subir`,
  `task verificar:redis` (esperado 88/88). Outra máquina: publicar contratos 0.4.0 → núcleo 0.9.2 → moldura 0.5.0 no próprio
  Verdaccio (`task pacotes:publicar`) e `task pacotes:alinhar-hashes` antes do `task instalar`.
