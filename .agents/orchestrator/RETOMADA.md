# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-28 (fatia K5 feita e verificada nos dois modos; próximo passo é a iteração 9 do gate)**.

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

## Estado (conferido em 2026-09-23; sincronização reconferida em 2026-09-28)

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **109/109** com Redis e **105 + 4 pulados** com arquivo (K5, 2026-09-28) | `task verificar:redis`, `task verificar:construir` |
| Unidades | contratos 20, núcleo 142, moldura 26, stub 43, shell 43; typecheck das 4 apps; estática 48/48; scripts 18 | `task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test` |
| `@erp/nucleo` | **0.9.2** nas 4 apps (acesso v2, `exigirModulo(modulo, funcionalidade)`, `exigirPapel`) | lockstep 4 apps |
| `@erp/contratos` / `@erp/moldura` | **0.4.0** / **0.5.0** | ADR-0012, ADR-0014 adendo 1 |
| ADRs | **0013 aceito** e **0014 + adendo 1 aceito** (humano, 2026-09-23) | `docs/adr/` |
| Gate "Shell novo" (#3, #18) | **aprovado** na iteração 4 | `GATE_STATUS.md`; tag `gate-shell-aprovado` |
| Gate B1+D1+G3+K | **aberto**: iteração 8 reprovada pelo auditor (vetos V1–V4); fatia **K5 feita** (2026-09-28); **iteração 9 a despachar** | `GATE_STATUS.md` |
| Repositórios | principal em `bff-multizone` e os 8 submódulos no `master`, iguais ao remoto (fetch em 2026-09-28, nada novo desde `401770c`). Só local, não commitar: hash do `@erp/contratos` 0.2.1 no `pnpm-lock.yaml` do `erp-dominio-stub` e do `erp-moldura` (`AMBIENTE.md` §1) | `git submodule foreach git status -sb` |

## Histórico curto do gate B1+D1+G3+K

| Iteração | Resultado | Correção |
|---|---|---|
| 1 | considerada rasa | iteração 2 com auditor Opus |
| 2 | auditor vetou V1–V8 | fatia K |
| 3 | revisor e challenger aprovaram; auditor vetou V1–V7 (127 mutações, 55 sobreviventes) | fatia **K2** (2026-09-23): cada veto com teste que reprova a mutação; P07 adiado (D13) |
| 4 | revisor e challenger aprovaram; auditor vetou **V1–V5** novos (127, 55 sobreviventes; tudo da iteração 3 agora pego) | fatia **K3** implementada e testada (K3-1 a K3-6) |
| 5 | os três aprovaram, mas **invalidada pelo humano**: auditoria rasa (6 mutações sem evidência) e V3 ainda aberto | fatia **K4-1/K4-2** (V3 pelo verificador de tipos; limites em D14) |
| 6 | revisor e challenger reprovaram: as zonas ainda recebiam `REDIS_URL` (a K3 nunca rodou no modo Redis) | **K4-3** |
| 7 | challenger reprovou: o Redis do showcase aceitava escrita sem senha | **K4-4** |
| 8 | revisor e challenger aprovaram; auditor vetou **V1–V4** (ambiente por exclusão, escopos do N8, `test/` sem teste, fronteira por lista fixa) | fatia **K5** (feita, 2026-09-28) |

## Próximo passo: iteração 9 do gate

1. ✅ **K4-1 (V3):** a regra da ilha usa o verificador de tipos do TypeScript (`programaDaApp` em
   `base/verificacao/seguranca-estatica.mjs`): prop de ilha por `x.campo` só passa se o tipo for escalar; `any` reprova.
   Teste novo reprova com a correção revertida (23/24). Apps reais: 0 achados.
2. ✅ **K4-2:** limites declarados da Decisão A2 registrados em `DEFERRED.md` D14 (classes de contorno deliberado e a
   defesa de cada uma; o bloqueio de saída de rede fica para o deploy).
3. ❌ **Iteração 6:** reprovada (revisor e challenger): na K3 as zonas continuavam recebendo `REDIS_URL`. ✅ **K4-3** corrige
   (`GATE_STATUS.md`); `task verificar:redis` 98/98, `task verificar` 95 + 3 pulados.
4. ❌ **Iteração 7:** reprovada pelo challenger: o Redis do showcase aceitava escrita sem senha. ✅ **K4-4** corrige
   (`GATE_STATUS.md`); `task verificar:redis` 100/100, `task verificar` 96 + 4 pulados. **Outra máquina: recriar o Redis
   (`task showcase:subir`) para valer a senha nova.**
5. ❌ **Iteração 8:** revisor e challenger aprovaram; **auditor vetou V1–V4** (`GATE_STATUS.md`).
6. ✅ **Fatia K5** (2026-09-28; detalhe e números em `GATE_STATUS.md`). Núcleo **sem versão nova**: só `scripts/` e `test/` do
   `erp-nucleo` mudaram (`08642ed`), o `dist` publicado é o mesmo. Plano original, para referência. Antes de rodar testes nesta
   máquina: `task showcase:descer` e `task showcase:subir` (Redis com a senha da K4-4). Cada item com teste que
   reprova com a correção revertida, e os **dois modos** rodados antes do commit (`AMBIENTE.md`):
   - **K5-1 (V1):** ambiente de zona e de domínio por **lista de inclusão** (só o que cada um precisa) em `base/scripts/ambiente.mjs`,
     valendo para `start`, `build`, `registrar` e apps avulsas; o mesmo em `base/showcase/subir.mjs`. Teste: com
     `ERP_REDIS_SENHA_SHELL` definida, nenhum valor do ambiente de zona ou domínio contém a senha; chave-sentinela ausente após o build.
     Fecha também L6 (AMB4/AMB6).
   - **K5-2 (V2):** `saida-de-rede.mjs` abre escopo em `constructor`, acessor (`get`/`set`), `catch`, `for`/`for-of`/`for-in` e bloco
     (fecha L2/SR1). Teste: um caso por forma, com `fetch` e `WebSocket`.
   - **K5-3 (V3):** teste que reprova se `fontesDaApp` voltar a pular `test/` fora da raiz da app.
   - **K5-4 (V4):** fronteira do núcleo deriva os símbolos exclusivos de `src/shell/index.ts` (nada de lista escrita à mão) e não isenta o
     arquivo definidor; `sessaoRedis` fora de `shell/` sem opção de escrita. Teste: N38g, N38i, N38k, N38l. Exige núcleo novo (0.9.3,
     lockstep nas 4 apps).
   - Lacunas baratas junto: L1 (dentes em `ehTipoEscalar` e no `programa` da varredura), L3 (XN09 por shorthand/atribuição).
   Depois: iteração 9 (revisor, challenger, auditor com o catálogo da iteração 8 como piso).
6b. ⏳ **Iteração 9** (despachada em 2026-09-28: `reviewer_b1_d1_9` e `challenger_b1_d1_9` rodando; o challenger é dono das portas;
   auditor ainda não despachado). Se a sessão cair: conferir os handoffs "(parcial)", `git status` dos submódulos e as portas antes de retomar. Plano: `reviewer_b1_d1_9` (revisor-mfe, Sonnet) e `challenger_b1_d1_9` (simulador-condicoes,
   Sonnet) em paralelo; o `auditor_b1_d1_9` (general-purpose, Opus) só quando o challenger liberar as portas. Piso do auditor: o catálogo
   da iteração 8 inteiro (`.agents/auditor_b1_d1_8/mutacoes.txt`) mais mutações novas na K5 (lista de inclusão, `executar`, resolução
   léxica do N8, `simbolosDoShell`, regra por tipo `temEscrita`). No despacho do challenger: rodar com `ERP_REDIS_SENHA_SHELL` definida
   e repetir a prova da iteração 8 (`anexos/prova-senha-shell.log`, E01g, XR20q4).
7. Depois: **D2** (núcleo 0.10.0, OIDC + PKCE, lock de renovação), G4/G5, C1–C3. **Humano (2026-09-23): refresh token
   sem reuso** (`refreshTokenMaxReuse = 0`); o lock no Redis é requisito e o teste de corrida prova que duas renovações
   simultâneas fazem uma só chamada ao Keycloak (Medição 1: reuso derruba a sessão inteira).

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit | ⏳ implementado; gate B1+D1+G3+K em correção (K5, iteração 9) | #20 | K5 |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem domínio; sonda do shell o usa | ⏳ implementado e testado (K2); gate B1+D1+G3+K em correção | #3 | K5 |
| | B5 parâmetros em configuração (B5a shell, B5b núcleo) | ✅; os de sessão entram com o D2 | #20 | — |
| | B4/B6 verificações estáticas de segurança | ⏳ 40 testes; vetos V2–V4 da iteração 8 na K5 | #20 | K5 |
| **C. Funcionalidades** | C1 fragmentos entre zonas | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1; decisão B ok |
| | C3 mapa de zonas vindo dos manifestos | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 sessão no Redis (shell grava com senha, zonas leem com ACL só de leitura) | ⏳ implementado; veto V1 da iteração 8 (senha de escrita chega às zonas) na K5 | #9 | K5 |
| | D2 OIDC + PKCE e renovação proativa com lock (**ADR-0013 aceito**; pessoa por `sub`) | ⬜ medição 1 concluída; começa depois do gate B1+D1+G3+K | #9 | gate B1+D1+G3+K |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` com Redis e Keycloak | ✅ | #19 | — |
| | E3 `task showcase` e `task showcase:conferir` | ✅ parcial: falta login pelo Keycloak | #19 | D2 |
| | E4 roteiro do showcase | ⬜ | #19 | C1–C3, E3 |
| | E5 verificação ponta a ponta contra o showcase | ⬜ | #19 | E4 |
| **G. Gestão de acesso v2** | G1 modelo e mock (porta 4020) | ✅ | #21 | — |
| | G2 **ADR-0014 + adendo 1, aceito** | ✅ | #21 | — |
| | G3 alinhar à v2 | ⏳ implementado; gate B1+D1+G3+K em correção | #21 | K5 |
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

## Ambiente (retomada de 2026-09-28)

- Conferido ao fim da K5 (2026-09-28): no ar Verdaccio (4873), Redis (6379, com senha) e Keycloak (8080); livres as portas da base
  3000–3003, 3012, 4001–4004, 4010, 4020.
- Rodando (2026-09-28): `reviewer_b1_d1_9` e `challenger_b1_d1_9`. Pastas dos verificadores da iteração 8 (`.agents/*_b1_d1_8/`) commitadas; as das iterações 3, 4, 6 e 7
  ficam enquanto a K5 e o D14 citarem os achados delas. As do gate do shell (fechado) e da iteração 1 ainda estão na raiz de
  `.agents/` e podem sair com `git rm` (regra do `LEIA-PRIMEIRO.md`).
- Para retomar noutra sessão: `git fetch origin`, `git submodule update --init`, `task registry:subir`, `task showcase:descer` e
  `task showcase:subir`, `task verificar:redis` (esperado 100/100). Outra máquina: publicar contratos 0.4.0 → núcleo 0.9.2 →
  moldura 0.5.0 no próprio Verdaccio (`task pacotes:publicar`) e `task pacotes:alinhar-hashes` antes do `task instalar`.
- Nesta máquina, `.claude/settings.local.json` (fora do git) libera git de leitura e sincronização sem o classificador do auto mode,
  que ficou fora do ar na retomada de 2026-09-28.
