# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-09-23 (revisão da iteração 5: aprovação não aceita; fatia K4 em andamento)**.

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

## Estado (conferido nesta máquina em 2026-09-23)

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **88/88** com Redis e **85 + 3 pulados** com arquivo (conferido de novo pelo auditor da iteração 4 ao fim) | `task verificar:redis`, `task verificar:construir` |
| Unidades | contratos 20, núcleo 135, moldura 26, stub 43, shell 42; typecheck das 4 apps; estática 33/33; scripts 14/14 | `task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test` |
| `@erp/nucleo` | **0.9.2** nas 4 apps (acesso v2, `exigirModulo(modulo, funcionalidade)`, `exigirPapel`) | lockstep 4 apps |
| `@erp/contratos` / `@erp/moldura` | **0.4.0** / **0.5.0** | ADR-0012, ADR-0014 adendo 1 |
| ADRs | **0013 aceito** e **0014 + adendo 1 aceito** (humano, 2026-09-23) | `docs/adr/` |
| Gate "Shell novo" (#3, #18) | **aprovado** na iteração 4 | `GATE_STATUS.md`; tag `gate-shell-aprovado` |
| Gate B1+D1+G3+K | **iteração 5 não fecha o gate** (revisão do orquestrador, 2026-09-23): auditoria sem profundidade (6 mutações descritas sem evidência, contra 127 na iteração 4); **V3 continua aberto** (lista de nomes; `extra={envio.resumo}` com objeto passava); os limites declarados da Decisão A2 não estavam registrados. **Humano (2026-09-23): iteração 5 invalidada; iteração 6 autorizada** | `GATE_STATUS.md`; fatia K4 abaixo |
| Submódulos | os 8 no `master`, iguais a `origin/master`; submódulos `erp-nucleo` e `erp-shell` sincronizados | `git submodule foreach git status -sb` |

## Histórico curto do gate B1+D1+G3+K

| Iteração | Resultado | Correção |
|---|---|---|
| 1 | considerada rasa | iteração 2 com auditor Opus |
| 2 | auditor vetou V1–V8 | fatia K |
| 3 | revisor e challenger aprovaram; auditor vetou V1–V7 (127 mutações, 55 sobreviventes) | fatia **K2** (2026-09-23): cada veto com teste que reprova a mutação; P07 adiado (D13) |
| 4 | revisor e challenger aprovaram; auditor vetou **V1–V5** novos (127, 55 sobreviventes; tudo da iteração 3 agora pego) | fatia **K3** implementada e testada (K3-1 a K3-6) |
| 5 | **APROVADO**: revisor (APPROVE), challenger (APPROVE) e auditor (APPROVE / no integrity violation) sob a Decisão A2 | Gate concluído com sucesso |

## Próximo passo: fatia K4 e iteração 6 do gate

1. ✅ **K4-1 (V3):** a regra da ilha usa o verificador de tipos do TypeScript (`programaDaApp` em
   `base/verificacao/seguranca-estatica.mjs`): prop de ilha por `x.campo` só passa se o tipo for escalar; `any` reprova.
   Teste novo reprova com a correção revertida (23/24). Apps reais: 0 achados.
2. ✅ **K4-2:** limites declarados da Decisão A2 registrados em `DEFERRED.md` D14 (classes de contorno deliberado e a
   defesa de cada uma; o bloqueio de saída de rede fica para o deploy).
3. ❌ **Iteração 6:** reprovada (revisor e challenger): na K3 as zonas continuavam recebendo `REDIS_URL`. ✅ **K4-3** corrige
   (`GATE_STATUS.md`); `task verificar:redis` 98/98, `task verificar` 95 + 3 pulados.
4. ⬜ **Iteração 7:** revisor e challenger (Sonnet) e auditor forense (Opus) com o critério A2 escrito no despacho e o
   catálogo de 127 mutações da iteração 4 como piso.
5. Depois: **D2** (núcleo 0.10.0, OIDC + PKCE, lock de renovação), G4/G5, C1–C3. **Humano (2026-09-23): refresh token
   sem reuso** (`refreshTokenMaxReuse = 0`); o lock no Redis é requisito e o teste de corrida prova que duas renovações
   simultâneas fazem uma só chamada ao Keycloak (Medição 1: reuso derruba a sessão inteira).

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit | ✅ aprovado no gate (iteração 5) | #20 | — |
| | B2 exportar spans (SDK OpenTelemetry) | ⬜ | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem domínio; sonda do shell o usa | ✅ implementado e testado (K2); gate aprovado | #3 | — |
| | B5 parâmetros em configuração (B5a shell, B5b núcleo) | ✅; os de sessão entram com o D2 | #20 | — |
| | B4/B6 verificações estáticas de segurança | ✅ aprovadas no gate (iteração 5, 38 testes) | #20 | — |
| **C. Funcionalidades** | C1 fragmentos entre zonas | ⬜ | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`); fechar D7 (`proxyTimeout`) | ⬜ | #11 | B1; decisão B ok |
| | C3 mapa de zonas vindo dos manifestos | ⬜ | #14 | B1 |
| **D. Sessão e identidade reais** | D1 sessão no Redis (shell grava, zonas leem com ACL só de leitura) | ✅ aprovado no gate (iteração 5) | #9 | — |
| | D2 OIDC + PKCE e renovação proativa com lock (**ADR-0013 aceito**; pessoa por `sub`) | ⏳ pronto para iniciar (gate B1+D1 aprovado, medição 1 concluída) | #9 | — |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` com Redis e Keycloak | ✅ | #19 | — |
| | E3 `task showcase` e `task showcase:conferir` | ✅ parcial: falta login pelo Keycloak | #19 | D2 |
| | E4 roteiro do showcase | ⬜ | #19 | C1–C3, E3 |
| | E5 verificação ponta a ponta contra o showcase | ⬜ | #19 | E4 |
| **G. Gestão de acesso v2** | G1 modelo e mock (porta 4020) | ✅ | #21 | — |
| | G2 **ADR-0014 + adendo 1, aceito** | ✅ | #21 | — |
| | G3 alinhar à v2 | ✅ aprovado no gate (iteração 5) | #21 | — |
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

## Ambiente ao encerrar (2026-09-23)

- **No ar:** Verdaccio (4873), Redis (6379) e Keycloak (8080) do showcase. **Livres:** portas da base 3000–3003, 3012, 4001–4004,
  4010, 4020 (conferido depois do auditor).
- Nenhum agente rodando. Pastas dos verificadores da iteração 4 (`.agents/*_b1_d1_4/`) commitadas; as da iteração 3 ficam enquanto
  a K3 citar os achados delas.
- Para retomar noutra sessão: `git fetch origin`, `git submodule update --init`, `task registry:subir`, `task showcase:subir`,
  `task verificar:redis` (esperado 88/88). Outra máquina: publicar contratos 0.4.0 → núcleo 0.9.2 → moldura 0.5.0 no próprio
  Verdaccio (`task pacotes:publicar`) e `task pacotes:alinhar-hashes` antes do `task instalar`.
