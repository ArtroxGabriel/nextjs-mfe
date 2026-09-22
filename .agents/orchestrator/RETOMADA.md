# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-22 (noite)**.

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
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **60/60** com sessão em arquivo e **60/60** com Redis (`CONSTRUIR=tudo`) | `task verificar`, `task verificar:redis` |
| Unidades | contratos 16, núcleo 109, moldura 25, stub 39, shell 38; typecheck das 4 apps; estática 16/16; scripts 9/9 | `task test`, `task typecheck`, `task verificar:estatica` |
| `@erp/nucleo` | **0.8.2** nas 4 apps (kit `/app`, timeouts configuráveis, campos OIDC na sessão, acesso v2 parcial) | lockstep 4 apps |
| `@erp/contratos` / `@erp/moldura` | **0.3.1** (contratos da v2) / **0.4.0** (`/servidor`) | ADR-0012, ADR-0014 |
| Gate "Shell novo" (#3, #18) | **aprovado** na iteração 4 | `GATE_STATUS.md`; tag `gate-shell-aprovado` |
| Gate B1+D1 | iteração 1 registrada como PASS, mas **rasa** (7 mutações, verificadores fora do processo); **iteração 2 com auditor Opus em andamento** desde ~17h40: às 19h00, ~90 mutações, fase ponta a ponta; achados parciais abaixo | `.agents/auditor_b1_d1_2/handoff.md` (parcial) |
| Submódulos | os 8 no `master`, iguais a `origin/master` | `git submodule foreach git status -sb` |

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit e apagar as cópias | ✅ implementado; ⏳ gate iteração 2 (auditor) | #20 | — |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem tocar domínio; sonda do shell passa a usá-lo | ✅ implementado (zonas `677a79c` etc., shell `d7a27a9`); ⏳ no escopo do auditor | #3 | — |
| | B5 parâmetros fixos no código: B5a (shell: sonda e telemetria) e B5b (núcleo: timeouts) | ✅ B5a e B5b (núcleo 0.8.0); os de sessão entram com o D2 | #20 | — |
| | B4/B6 verificações da spec e lacunas de segurança (server-only, DTO como prop de ilha, `<Link>` entre zonas) | ✅ `base/verificacao/seguranca-estatica.mjs` 16/16; ⏳ no escopo do auditor | #20 | — |
| **C. Funcionalidades** | C1 fragmentos: rota `_fragmento` na zona 2, bloco na zona 1 com `<Suspense>`, recusa no shell | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1 |
| | C3 mapa de zonas vindo dos manifestos da gestão de acesso | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 sessão no Redis quando `REDIS_URL` existe (shell grava, zonas leem) | ✅ implementado; 60/60 com Redis; ⏳ gate iteração 2 | #9 | — |
| | D2 OIDC + PKCE no shell contra o Keycloak local; renovação proativa com lock (**ADR-0013**; pessoa casada por `sub`, adendo 1 do ADR-0014) | ⏳ só os campos da sessão (núcleo 0.8.0); login e renovação não começaram; núcleo 0.10.0 | #9 | G3 |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` do showcase: Redis e Keycloak (realm `erp`, atores ana/bruno/carla/davi) | ✅ | #19 | — |
| | E3 `task showcase` sobe tudo; `task showcase:conferir` | ✅ parcial: com Redis; falta login pelo Keycloak (D2) | #19 | D2 |
| | E4 roteiro do showcase (login OIDC, sessão entre zonas, 404 de módulo, fragmento, SSE, toast, 503, `If-Match`, erro normalizado, trace) | ⬜ | #19 | C1–C3, E3 |
| | E5 verificação ponta a ponta contra o showcase | ⬜ | #19 | E4 |
| **G. Gestão de acesso v2** | G1 modelo de referência e mock da API (porta 4020) | ✅ | #21 | — |
| | G2 decisão de arquitetura (**ADR-0014**, proposto) | ✅ | #21 | — |
| | G3 alinhar à v2 conforme o **adendo 1 do ADR-0014**: corte seco para a 4020, `acessoEfetivo`, `exigirModulo(modulo, funcionalidade)`, `exigirPapel` na zona de acesso, manifesto v2, atores ana…davi na semente v2; contratos 0.4.0, núcleo 0.9.0 | ⏳ decidido; implementação depois do veredito do auditor | #21 | gate B1+D1 |
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

## Gate B1+D1, iteração 2 — achados parciais (auditor ainda rodando)

Registrados no handoff parcial; o veredito sai no fim. Já há motivo de veto:

- **Fallback do acesso v2 concede** (N27): `/v2/eu` com 401, 403, 500, timeout ou corpo sem `modulos` cai
  no `/v1` e entrega o que ele disser. Nenhum teste cobre. A correção é o corte seco do adendo 1 do
  ADR-0014 (G3), com os testes marcados † lá.
- **`exigirModulo(id, funcionalidade)` não checa a funcionalidade** sem que teste algum reprove (N17).
- **Fronteira do núcleo por texto** (N08): um comentário com `import 'server-only'` satisfaz a checagem.
- **`@erp/nucleo/app` pode exportar `criarNucleoDoShell`** sem teste reprovar (N38; invariante 15).
- **`cache: 'no-store'` → `'force-cache'`** passa na unidade do núcleo (N37; invariante 13).
- Timeouts do núcleo (`lerNumeroPositivo`, padrão) sem teste (N33, N34, N36).
- **`seguranca-estatica.mjs` e `saida-de-rede.mjs` contornáveis**: 27 de 29 contornos passaram (`'use client';`
  com ponto e vírgula, comentário antes da diretiva, import transitivo de `lib/nucleo`, DTO por spread,
  `<Link>` com `href` em expressão ou renomeado, `NEXT_PUBLIC` por índice, cliente de rede fora do registro,
  `Reflect`/`createRequire`/`child_process`). As mesmas formas no código real foram pegas pelo ponta a
  ponta (E09), então hoje é lacuna de verificação, não vazamento conhecido.
- Testes de `acesso.test.mjs` travam ao reprovar (servidor sem `finally { close() }`).

Já pegas: sessão no Redis (chave crua, fail-open, prefixo vazio, `encerrar`), limites da sonda e da
telemetria, `exigirModulo` removido ou trocado de página, health quebrado, Server Action com módulo errado.

## Próximo passo

1. Esperar o veredito do `auditor_b1_d1_2` e registrar em `GATE_STATUS.md`. Com veto, a correção do fallback
   é o próprio G3; as demais (N08, N17, N37, N38, estáticas) entram como tarefas do gate seguinte.
2. **G3** (núcleo 0.9.0, contratos 0.4.0) conforme o adendo 1 do ADR-0014. **Feito:** `erp-contratos` 0.4.0
   (`b56320e`, 20/20 testes, enviado ao `master` do submódulo; o principal ainda aponta para o 0.3.1 e
   nada foi publicado). **Falta:** stub (token com uuid, `nome` no `/v2/eu`, ana…davi na semente), núcleo,
   moldura, as 4 apps e `base/verificacao`. Só começa depois do auditor (ele muta esses repositórios).
3. **D2** (núcleo 0.10.0, OIDC + PKCE, ADR-0013, pessoa casada por `sub`); gate G4; depois G5 (eventos).

Ambiente desta máquina: Verdaccio, Redis e Keycloak no ar; lockfiles com hashes locais **não commitados**.
