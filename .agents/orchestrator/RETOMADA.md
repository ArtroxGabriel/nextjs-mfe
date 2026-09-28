# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-28 (gate B1+D1+G3+K aprovado na iteração 9; próximo passo é o D2 com a K6)**.

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
| Gate B1+D1+G3+K | **aprovado** na iteração 9 (2026-09-28); lacunas sem veto em `DEFERRED.md` D15 | `GATE_STATUS.md`; tag `gate-b1-d1-g3-aprovado` |
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
| 9 | **os três aprovaram** (auditor PASS, sem veto; lacunas LA–LG em D15) | — |

## Próximo passo: D2 (OIDC + PKCE e renovação com lock) com a K6

O gate B1+D1+G3+K fechou; o detalhe das fatias K2–K5 e das iterações está em `GATE_STATUS.md` (pastas dos verificadores no
commit `f010760`).

1. ⬜ **Plano do D2** (antes de código): ler ADR-0013 e ADR-0009 (decisão 3), escrever o plano de implementação em fatias com
   teste por invariante, e decidir a colocação com o `arquiteto-mfe` (núcleo 0.10.0: porta de identidade OIDC, renovação proativa,
   lock `SET NX PX` no Redis). Requisitos já decididos pelo humano:
   - **refresh token sem reuso** (`refreshTokenMaxReuse = 0`); o lock no Redis é requisito e um teste de corrida prova que duas
     renovações simultâneas fazem uma só chamada ao Keycloak (Medição 1: reuso derruba a sessão inteira);
   - pessoa por `sub` (ADR-0013); sessão de 30 min por inatividade; tempos em `docs/CONFIGURACAO.md` (os itens "⬜ D2");
   - biblioteca OIDC já aprovada para instalar (2026-09-22), mas **mostrar ao humano o que entra antes de instalar**.
2. ⬜ **K6:** as lacunas sem veto da iteração 9 (`DEFERRED.md` D15: LA–LG e o contorno `declare`), cada uma com teste que reprova
   com a correção revertida. Entram no mesmo gate do D2.
3. Depois: G4/G5, C1–C3, E4/E5 (tabela abaixo).

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
| | D2 OIDC + PKCE e renovação proativa com lock (**ADR-0013 aceito**; pessoa por `sub`) | ⬜ **próximo passo**; medição 1 concluída | #9 | — |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` com Redis e Keycloak | ✅ | #19 | — |
| | E3 `task showcase` e `task showcase:conferir` | ✅ parcial: falta login pelo Keycloak | #19 | D2 |
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
