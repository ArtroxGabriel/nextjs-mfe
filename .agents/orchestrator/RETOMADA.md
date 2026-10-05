# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-10-05 (gate do D2, iteração 1, em andamento)**.

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

## Decisões do humano (2026-10-03)

- **`http://` local em produção (Task 6 do D2):** opção (a) — `ERP_PERMITIR_HTTP_LOCAL=1`, só loopback, núcleo 0.10.2,
  adendo 2 ao ADR-0013; só as tarefas do showcase e da verificação ligam.
- **Token de serviço no modo JWT (Task 5 do D2):** opção (a) — adendo ao ADR-0013; com `IDP_EMISSOR`, `svc.<app>` só registra o manifesto do próprio módulo; `svc.idp`, `primeiro-acesso`, `decisoes` e `eventos` recusados nesse modo; README e `CONFIGURACAO.md` com o alcance real.

## Estado (conferido em 2026-10-03, Task 6 do D2)

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | `base/verificacao` **116/116** com Redis e **112 + 4 pulados** com arquivo (login de dev); **modo OIDC 5/5** contra o Keycloak | `task verificar:redis`, `task verificar:construir`, `task verificar:oidc` |
| Unidades | contratos 20, núcleo 225, moldura 26, stub 75, shell 73; estática 51/51; scripts 20/20; typecheck das 4 apps ok | `task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test` |
| `@erp/nucleo` | **0.10.2** publicado no Verdaccio **desta máquina** e nas 4 apps (lockstep ok). Outra máquina: publicar 0.10.2 no próprio Verdaccio e `task pacotes:alinhar-hashes` | `task lockstep` |
| `@erp/contratos` / `@erp/moldura` | **0.4.0** / **0.5.0** | ADR-0012, ADR-0014 adendo 1 |
| ADRs | **0013 aceito com adendos 1 e 2 (2026-10-03), implementado e verificado contra o Keycloak**; 0014 + adendo 1 aceito | `docs/adr/` |
| Keycloak do showcase | `task showcase:checar` ok; reuso de refresh token revoga a sessão inteira (medição 1 repetida em 2026-10-03) | `base/showcase/medicao-refresh-concorrente.md` |
| Custo do proxy do shell | +0,3–0,4 ms no p95 com a leitura da sessão (página de zona: ~19 ms de p95) | `task medir:proxy`; ADR-0013, Consequências |
| Gate B1+D1+G3+K | **aprovado** na iteração 9 (2026-09-28); tag `gate-b1-d1-g3-aprovado` | `GATE_STATUS.md` |

## Próximo passo: revisão final do D2 (branch inteira) e depois o gate

Plano: `docs/superpowers/plans/2026-09-29-d2-k6-oidc-pkce-renovacao.md` (modo Subagent-Driven). Detalhe de cada task
(revisões, achados menores) no ledger, copiado para o git em `ledger/2026-09-29-d2-k6-oidc-pkce-renovacao/progress.md`
(`task orquestrador:ledger`), e em `ATIVIDADES.md` §4.

1. ✅ **Task 1 (K6):** ator Eva (D13), lacunas LA–LG (D15), invariante 8 na zona 2. Principal `d1d6345`.
2. ✅ **Task 2:** porta de identidade v2, transações de login de uso único, lock `SET NX PX`, `regravar` com `SET XX`. Núcleo `d481d14`..`fd94ecc`.
3. ✅ **Task 3:** adaptador `identidadeOidc` (`openid-client` 6.8.8, PKCE S256, logout sem token). Núcleo `c172bc8`..`9a593a4`.
4. ✅ **Task 4:** renovação no `proxy.ts` do shell, rotas `entrar`/`retorno`/`sair`, CSP `formularioPara`; núcleo **0.10.1** no Verdaccio desta máquina e nas 4 apps. Shell `d333932`, principal `117236f`.
5. ✅ **Task 5:** domínios falsos verificam RS256/JWKS; adendo 1 do ADR-0013 (token de serviço só registra o próprio manifesto em modo JWT). Stub `783242b`, principal `1f4414c`.
6. ✅ **Task 6:** verificação final verde; documentos da lista do ADR-0013 atualizados; p95 do proxy medido (`task medir:proxy`); DEFERRED D17–D18 (D16 abriu e fechou). Relatório: `.superpowers/sdd/2026-09-29-d2-k6-oidc-pkce-renovacao/task-6-report.md`.
7. ✅ **Modo OIDC** (decisão (a) do humano): núcleo **0.10.2** (`ERP_PERMITIR_HTTP_LOCAL`, só loopback; adendo 2 do ADR-0013), stub com a mesma regra, `task showcase:oidc` e `task verificar:oidc` (`base/verificacao/oidc/`).
8. ✅ **Revisão da Task 6** (2026-10-05): aprovado com ressalvas; I1 e M1–M3 corrigidos em `d82e5b7`, re-revisão limpa com R1/R2
   corrigidos em `848e5fe` (`verificar:oidc` 5/5). M4 vai para a triagem final.
9. ✅ **Revisão final do D2** (2026-10-05): correções A1–A6 em shell `bcef220` e principal `16570f1` (logout seguido até o Keycloak,
   `sair` só da mesma origem, docs, DEFERRED D19–D23); re-revisão limpa. A triagem dos menores abaixo está feita (B no `DEFERRED.md`).
10. ⏳ **Gate do D2**: iteração 1 (HEAD `b8a1034`) com revisor e challenger APPROVE e **auditor VETO** por 3 testes faltando (P04, F04,
   L04; sem defeito de produto); `worker_d2_1` escreveu os testes (shell `bce8f59`, núcleo `aeae3af`). **Iteração 2**: `reviewer_d2_2`
   APPROVE, `challenger_d2_2` APPROVE (D19 observado de novo em `/`: 1 de 10 concorrentes renovou); `auditor_d2_2` (Opus) rodando. Para depois do gate
   (achados menores): `server-only` em `erp-shell/lib/cookies.ts`; `trim` em `SHELL_HOSTS` no `sair`; `sair` compara só o host
   (aceita `https://` do mesmo host); `CONFIGURACAO.md` §5 diz que valor inválido falha na subida (é na primeira requisição);
   README §3 e ROTEIRO com contagem velha de testes (hoje 118); estado persistido do showcase sem a eva (`task showcase:dados:resetar`).
   **Decisões do humano (2026-10-05):** histórico reescrito para tirar o JWT de `793f519` (feito pelo humano; ver "Ambiente
   (reescrita de 2026-10-05)"); **D19 → opção B em task própria** (`DEFERRED.md` D19).
11. ⬜ **Task D19-B** (depois do gate; plano `docs/superpowers/plans/2026-10-05-d19b-espera-com-token-vencido.md`, com D20 e os menores do gate): perdedor do lock com token **já vencido** espera a renovação até
   `ERP_RENOVACAO_ESPERA_MS` e relê a sessão; núcleo 0.10.3 + lockstep, adendo 3 ao ADR-0013, teste de concorrência com token
   vencido (unidade no núcleo e no shell, ponta a ponta em `verificar:oidc`). Junto: os menores do gate listados acima.
   Achados menores adiados pelas revisões das tasks (cópia do ledger local, para a triagem):
   - **T2:** tomada de lock velho no store de arquivo pode dar dois vencedores; teste de 20 renovações na fábrica sem Redis falso com NX; transações expiradas nunca limpas em arquivo/memória; `sessaoMemoria().adquirirLockRenovacao` sem `validarTtlDoLock`; `ERP_RENOVACAO_JANELA_S < ERP_TOKEN_VIDA_S/2` só documentado; teste de tempo dos perdedores (<200 ms) pode oscilar; `fronteira.mjs` com nomes genéricos como marcadores de escrita; `identidade-dev` sem `ERP_SESSAO_MAXIMA_S`.
   - **T3:** `urlRetorno` aceita query/fragmento (o `redirect_uri` da troca diverge); `concluir` trata `invalid_client` como recusa; porta não documenta que `concluir`/`iniciar` lançam; `ehTransitorio` trata todo `TypeError` como transitório; causa do erro descartada sem rastro no servidor; sem `id_token_hint` o Keycloak pode não redirecionar no logout (conferir).
   - **T4:** `vidaTransacaoS` do shell repete padrão/teto do núcleo; cola de `proxy.ts` (`Set-Cookie` em redirect/next) sem teste unitário; GET `/api/auth/entrar` grava no store sem autenticação (limitar taxa na borda); resposta atrasada com cookie morto pode apagar sessão nova de outra aba; V1 não vê chamador no próprio arquivo nem `import()` dinâmico; **D18** (`/login/dev` aberto em produção sem `IDP_EMISSOR`).
   - **T5:** base64url sem forma canônica (só a assinatura); JWKS falha fechado ≥ `ERP_JWKS_INTERVALO_MIN_S` com IdP fora (documentar); intervalo mínimo medido início a início; `r.json()` do JWKS sem limite; `azp` não conferido; varredura de rotas do teste por regex.
   - **Abertos de arquitetura:** **D17** (zonas leem `refreshToken`/`idToken`, ADR-0013 decisão 2).


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
| | D2 OIDC + PKCE e renovação proativa com lock (**ADR-0013 aceito**; pessoa por `sub`) | ⏳ Tasks 1–6 feitas, modo OIDC verificado contra o Keycloak; falta a revisão final e o gate | #9 | — |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` com Redis e Keycloak | ✅ | #19 | — |
| | E3 `task showcase` e `task showcase:conferir` | ✅ login pelo Keycloak com `task showcase:oidc`; `showcase:conferir` ainda só no login de dev | #19 | — |
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
- **Revisor de task também grava rascunho** (`review-task<N>-achados.md`, "(parcial)" → "(final)") e o **ledger vai
  para o git** com `task orquestrador:ledger` ao fechar cada task e antes de parar (regras de 2026-10-05, `LEIA-PRIMEIRO.md`).
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
7. ✅ **Modo OIDC na máquina local** (2026-10-03): opção (a), ver "Decisões do humano" acima.

## Ambiente (reescrita de 2026-10-05)

- Em 2026-10-05 a `bff-multizone` foi **reescrita com push forçado** de `793f519` em diante (8 commits, `72ca361` → `f5664bc`) só
  para mascarar um JWT do Keycloak local em `.agents/challenger_d2_1/out-t1b.txt` e `out-t2c.txt`; o conteúdo do resto é o mesmo.
  Os submódulos não mudaram. **Quem baixou antes:** `git fetch` e `git reset --hard origin/bff-multizone` (ou `reset --mixed` para
  manter a árvore). Os SHAs do principal citados no ledger e em handoffs entre `793f519` e `72ca361` são os antigos.

## Ambiente (2026-10-03, fim da Task 6 do D2)

- No ar: Verdaccio (4873), Redis (6379) e Keycloak (8080) do showcase; portas da base 3000–3003 e 4001–4020 livres.
- Agente rodando: revisor da Task 6 (só leitura). Tudo commitado e enviado em 2026-10-03; núcleo **0.10.2** publicado só no Verdaccio desta máquina (outra máquina: `task pacotes:publicar` e `task pacotes:alinhar-hashes`).
- Relatórios, briefs e diffs das tasks do D2 em `.superpowers/sdd/2026-09-29-d2-k6-oidc-pkce-renovacao/` (fora do git, só nesta máquina); o ledger e os achados têm cópia em `ledger/`.

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
