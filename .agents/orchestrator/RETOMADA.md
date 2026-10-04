# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-10-03 (Task 6 do D2 feita; modo OIDC aguarda decisão do humano)**.

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

## Decisões do humano (respondido em 2026-09-23)

O pedido [`pedidos/2026-09-23-decisoes-gate-c2-d2.md`](../../pedidos/2026-09-23-decisoes-gate-c2-d2.md) foi respondido pelo humano:
- **Decisão A:** `A2` — Veto só para defeito de produto ou erro plausível de boa-fé (V1, V3, V5); contornos deliberados de analisadores estáticos viram limites declarados (`DEFERRED.md` D14), com a barreira de ambiente como defesa.
- **Decisão B:** `B1 (10 s)` — `proxyTimeout` em 10s e propostas 1 a 3 aceitas.
- **Decisão C:** `agora` — Medição 1 de concorrência de refresh token no Keycloak executada imediatamente.

## Decisão do humano (2026-10-03)

- **Token de serviço no modo JWT (Task 5 do D2):** opção (a) — adendo ao ADR-0013; com `IDP_EMISSOR`, `svc.<app>` só registra o manifesto do próprio módulo; `svc.idp`, `primeiro-acesso`, `decisoes` e `eventos` recusados nesse modo; README e `CONFIGURACAO.md` com o alcance real.

## Estado (conferido em 2026-10-03, Task 6 do D2)

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando no login de dev; `base/verificacao` **116/116** com Redis e **112 + 4 pulados** com arquivo | `task verificar:redis`, `task verificar:construir` |
| Unidades | contratos 20, núcleo 219, moldura 26, stub 71, shell 73; estática 51/51; scripts 20/20; typecheck das 4 apps ok | `task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test` |
| `@erp/nucleo` | **0.10.1** publicado no Verdaccio **desta máquina** e nas 4 apps (lockstep ok). Outra máquina: publicar 0.10.1 no próprio Verdaccio e `task pacotes:alinhar-hashes` | `task lockstep` |
| `@erp/contratos` / `@erp/moldura` | **0.4.0** / **0.5.0** | ADR-0012, ADR-0014 adendo 1 |
| ADRs | **0013 aceito, adendo 1 (2026-10-03), implementado menos o modo OIDC na base**; 0014 + adendo 1 aceito | `docs/adr/` |
| Keycloak do showcase | `task showcase:checar` ok; reuso de refresh token revoga a sessão inteira (medição 1 repetida em 2026-10-03) | `base/showcase/medicao-refresh-concorrente.md` |
| Custo do proxy do shell | +0,3–0,4 ms no p95 com a leitura da sessão (página de zona: ~19 ms de p95) | `task medir:proxy`; ADR-0013, Consequências |
| Gate B1+D1+G3+K | **aprovado** na iteração 9 (2026-09-28); tag `gate-b1-d1-g3-aprovado` | `GATE_STATUS.md` |

## Próximo passo: decisão do humano sobre o modo OIDC local; depois revisão final do D2 e gate

Plano: `docs/superpowers/plans/2026-09-29-d2-k6-oidc-pkce-renovacao.md` (modo Subagent-Driven). Detalhe de cada task
(revisões, achados menores) no ledger local `.superpowers/sdd/2026-09-29-d2-k6-oidc-pkce-renovacao/progress.md`
(fora do git) e em `ATIVIDADES.md` §4.

1. ✅ **Task 1 (K6):** ator Eva (D13), lacunas LA–LG (D15), invariante 8 na zona 2. Principal `d1d6345`.
2. ✅ **Task 2:** porta de identidade v2, transações de login de uso único, lock `SET NX PX`, `regravar` com `SET XX`. Núcleo `d481d14`..`fd94ecc`.
3. ✅ **Task 3:** adaptador `identidadeOidc` (`openid-client` 6.8.8, PKCE S256, logout sem token). Núcleo `c172bc8`..`9a593a4`.
4. ✅ **Task 4:** renovação no `proxy.ts` do shell, rotas `entrar`/`retorno`/`sair`, CSP `formularioPara`; núcleo **0.10.1** no Verdaccio desta máquina e nas 4 apps. Shell `d333932`, principal `117236f`.
5. ✅ **Task 5:** domínios falsos verificam RS256/JWKS; adendo 1 do ADR-0013 (token de serviço só registra o próprio manifesto em modo JWT). Stub `783242b`, principal `1f4414c`.
6. ✅ **Task 6:** verificação final verde; documentos da lista do ADR-0013 atualizados; p95 do proxy medido (`task medir:proxy`); DEFERRED D16–D18. **Achado bloqueante:** a base não sobe em modo OIDC contra o Keycloak local (abaixo). Relatório: `.superpowers/sdd/2026-09-29-d2-k6-oidc-pkce-renovacao/task-6-report.md`.
7. ⬜ **Decisão do humano** (pendência 7 abaixo) → implementar o modo OIDC no showcase e no ponta a ponta (`DEFERRED.md` D16).
8. ⬜ **Revisão final do D2** (branch inteira; triagem dos menores do ledger) e depois o **gate** (`LEIA-PRIMEIRO.md`, "Como um gate funciona").


## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit | ✅ gate B1+D1+G3+K aprovado (2026-09-28) | #20 | — |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem domínio; sonda do shell o usa | ✅ gate B1+D1+G3+K aprovado | #3 | — |
| | B5 parâmetros em configuração (B5a shell, B5b núcleo) | ✅; os de sessão entram com o D2 | #20 | — |
| | B4/B6 verificações estáticas de segurança | ✅ 48 testes; limites em D14, lacunas em D15 (K6) | #20 | — |
| **C. Funcionalidades** | C1 fragmentos entre zonas | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1; decisão B ok |
| | C3 mapa de zonas vindo dos manifestos | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 sessão no Redis (shell grava com senha, zonas leem com ACL só de leitura) | ✅ gate B1+D1+G3+K aprovado (ambiente por lista de inclusão) | #9 | — |
| | D2 OIDC + PKCE e renovação proativa com lock (**ADR-0013 aceito**; pessoa por `sub`) | ⏳ Tasks 1–6 feitas; falta o modo OIDC na base (decisão do humano), a revisão final e o gate | #9 | pendência 7 |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` com Redis e Keycloak | ✅ | #19 | — |
| | E3 `task showcase` e `task showcase:conferir` | ✅ parcial: falta login pelo Keycloak | #19 | D2; pendência 7 |
| | E4 roteiro do showcase | ⬜ | #19 | C1–C3, E3 |
| | E5 verificação ponta a ponta contra o showcase | ⬜ | #19 | E4 |
| **G. Gestão de acesso v2** | G1 modelo e mock (porta 4020) | ✅ | #21 | — |
| | G2 **ADR-0014 + adendo 1, aceito** | ✅ | #21 | — |
| | G3 alinhar à v2 | ✅ gate B1+D1+G3+K aprovado | #21 | — |
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
  Submódulo enviado antes do principal (`AMBIENTE.md` §2). Commits sem rodapé de coautoria (hook `no-ai-authorship`).
- **Handoff aos 80% do uso da sessão:** reescrever este arquivo com o passo exato, atualizar `ATIVIDADES.md`, commitar e enviar.
  Verificadores mantêm o próprio handoff "(parcial)" desde o começo.
- **Decisão do humano em aberto → pedido em `pedidos/` e parar** o que depende dele.
- **Duas pessoas na mesma branch, em horários diferentes** (humano, 2026-09-23): ao retomar, `git fetch` e ler os commits do
  outro antes de seguir; ao parar, deixar tudo commitado e enviado, com este arquivo dizendo o passo exato e o que está rodando.
- **Pendências do GitLab revisadas a cada passo:** `ATIVIDADES.md` atualizado e bloco 📌 GitLab na resposta.
- **Gate segue o `LEIA-PRIMEIRO.md`:** revisor e challenger em Sonnet, auditor forense em Opus com veto; o auditor só roda
  quando o challenger libera as portas. Verificador que já entregou handoff não é reusado.
- **Nada específico do material de levantamento** entra no repositório; só o vocabulário genérico da base, com dados fictícios.

## Pendências com o humano

1. ✅ **Pedido `pedidos/2026-09-23-decisoes-gate-c2-d2.md`** respondido (2026-09-23): Decisões A2, B1 (10s) e C (agora).
2. ✅ Decisões de 2026-09-23 anteriores: iteração 4 autorizada; ADR-0013 aceito; ADR-0014 + adendo 1 aceito; P07 adiado para D2.
3. ✅ Instalações aprovadas (2026-09-22): `redis`, SDK OpenTelemetry, biblioteca OIDC, imagens do Redis e do Keycloak.
   Continua valendo mostrar o que entra antes de instalar.
4. ✅ Sessão de 30 min por inatividade (2026-09-22); parâmetros em `docs/CONFIGURACAO.md`.
5. **Registro de pacotes / CI (P1): no fim do plano** (humano, 2026-09-23). Até lá, `task pacotes:alinhar-hashes`.
6. Aplicar no GitLab o que estiver "pendente" em `ATIVIDADES.md` §2 (hoje só comentários opcionais).
7. **Modo OIDC na máquina local (achado da Task 6 do D2, 2026-10-03).** A regra "`http://` só fora de produção"
   (ADR-0013, decisão 5) barra o Keycloak do showcase (`http://127.0.0.1:8080`) e o retorno `http://localhost:3000`,
   e a base sobe com `next start` (`NODE_ENV=production`): com `IDP_EMISSOR`, o shell dá 500 em toda rota. Opções:
   - **(a) exceção explícita só para loopback** no núcleo (ex.: `ERP_PERMITIR_HTTP_LOCAL=1`, aceita só `localhost`,
     `127.0.0.1` e `::1`), como já existe `ERP_PERMITIR_IDENTIDADE_DEV`; núcleo 0.10.2 + lockstep; adendo 2 ao
     ADR-0013. Mantém o build de produção sob teste. Recomendada.
   - **(b) TLS local:** Keycloak em `https` e o shell atrás de um proxy TLS, com certificado local confiado por
     `NODE_EXTRA_CA_CERTS`. Sem mudar a regra; mais peças e um certificado a gerar por máquina.
   - **(c) apps em `next dev` no modo OIDC:** sem mudar código do núcleo; mas o que se verifica deixa de ser o build
     de produção, e a subida fica mais lenta.
   Até a decisão: showcase e verificação seguem no login de dev (`DEFERRED.md` D16).

## Ambiente (2026-10-03, fim da Task 6 do D2)

- No ar: Verdaccio (4873), Redis (6379) e Keycloak (8080) do showcase; portas da base 3000–3003 e 4001–4020 livres.
- Relatórios das tasks do D2 em `.superpowers/sdd/2026-09-29-d2-k6-oidc-pkce-renovacao/` (fora do git, só nesta máquina); o essencial está acima.

## Ambiente (parada de 2026-10-01)

- Em 2026-10-01 a `bff-multizone` e os `master` de erp-dominio-stub e erp-moldura foram **reescritos com push forçado** para tirar 3 commits com rodapé de atribuição e seus reverts (voltaram a `51fd1ab`, `29bdc1c`, `a875c21`). Quem baixou antes: `git fetch` e `git reset --hard origin/bff-multizone` (e o mesmo nos dois submódulos).
- Nesta máquina, erp-dominio-stub e erp-moldura têm `pnpm-lock.yaml` modificado só com o hash local do `@erp/contratos` 0.2.1 (não commitar, `AMBIENTE.md` §1).

## Ambiente (retomada de 2026-09-28)

- Conferido ao fim do gate (2026-09-28, auditor_b1_d1_9): no ar Verdaccio (4873), Redis (6379, com senha) e Keycloak (8080);
  livres as portas da base 3000–3003, 3012, 4001–4004, 4010, 4020.
- Nenhum agente rodando. Pastas de verificadores de gate: nenhuma na raiz de `.agents/` (as do gate B1+D1+G3+K saíram ao fechar,
  última versão em `f010760`; as do gate do shell estão na tag `historico-2026-09-22`).
- Para retomar noutra sessão: `git fetch origin`, `git submodule update --init`, `task registry:subir`, `task showcase:descer` e
  `task showcase:subir`, `task verificar:redis` (esperado 109/109). Outra máquina: publicar contratos 0.4.0 → núcleo 0.9.2 →
  moldura 0.5.0 no próprio Verdaccio (`task pacotes:publicar`) e `task pacotes:alinhar-hashes` antes do `task instalar`.
- Nesta máquina, `.claude/settings.local.json` (fora do git) libera git de leitura e sincronização sem o classificador do auto mode,
  que ficou fora do ar na retomada de 2026-09-28.
