# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-10-06 (gate do C1 aprovado na iteração 3; próximo: núcleo 0.10.4, D29)**.

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

**Funcionalidades básicas (definidas pelo humano, 2026-10-06)** — o critério de pronto do showcase:
1. renderizar o shell;
2. ter zonas;
3. integrar as zonas;
4. os tratamentos de todo esse fluxo (erro, acesso negado, zona fora do ar);
5. base de UI;
6. base de contrato e outras bases do mesmo tipo, cada uma em pacote separado;
7. integração com os backends (domínios).

**Não são funcionamento básico:** sessão compartilhada e cache.

**Repriorização (humano, 2026-10-06):** o objetivo fecha com **D7, C1, C3 (nesta ordem), E3 (resto), E4 e E5**. **C3 entra** (zona nova
sem editar o `zonas.json` nem republicar o shell). **C2, B2, G4 e G5 ficam para depois do objetivo.** A D19-B fecha o gate
em andamento. Ordem: D19-B (✅) → D7 → C1 → C3 → E3 (resto) e E4 → E5.

## Decisões do humano (respondido em 2026-09-23)

O pedido [`pedidos/2026-09-23-decisoes-gate-c2-d2.md`](../../pedidos/2026-09-23-decisoes-gate-c2-d2.md) foi respondido pelo humano:
- **Decisão A:** `A2` — Veto só para defeito de produto ou erro plausível de boa-fé (V1, V3, V5); contornos deliberados de analisadores estáticos viram limites declarados (`DEFERRED.md` D14), com a barreira de ambiente como defesa.
- **Decisão B:** `B1 (10 s)` — `proxyTimeout` em 10s e propostas 1 a 3 aceitas.
- **Decisão C:** `agora` — Medição 1 de concorrência de refresh token no Keycloak executada imediatamente.

## Decisões do humano (2026-10-06, veto do gate do C1)

- **Dados do veto:** as tarefas com título hostil e a tarefa concluída entram na **semente do stub** (`dominio-c.json`),
  tratada como dado de teste: a iteração 2 do gate é **só um auditor novo**.
- **`ehHtmlInerte` do núcleo** (deixa passar `<img/onerror>`, `<svg/onload>`, `<meta http-equiv=refresh>`): **adiado para
  logo depois do gate do C1**, núcleo 0.10.4 em lockstep, antes do C3 (`DEFERRED.md` D29).

## Decisões do humano (2026-10-03)

- **`http://` local em produção (Task 6 do D2):** opção (a) — `ERP_PERMITIR_HTTP_LOCAL=1`, só loopback, núcleo 0.10.2,
  adendo 2 ao ADR-0013; só as tarefas do showcase e da verificação ligam.
- **Token de serviço no modo JWT (Task 5 do D2):** opção (a) — adendo ao ADR-0013; com `IDP_EMISSOR`, `svc.<app>` só registra o manifesto do próprio módulo; `svc.idp`, `primeiro-acesso`, `decisoes` e `eventos` recusados nesse modo; README e `CONFIGURACAO.md` com o alcance real.

## Estado (conferido em 2026-10-06, fim do gate da D19-B)

| O quê | Estado | Evidência |
|---|---|---|
| Ponta a ponta | `verificar:redis` **118/118**, modo arquivo **114 + 4 pulados**, `verificar:oidc` **6/6** | `GATE_STATUS.md` (D19-B it.2) |
| Unidades | contratos 20, núcleo 271, moldura 26, stub 75, shell 108; estática 51/51 | `task test`, `task verificar:estatica` |
| Pacotes | `@erp/nucleo` **0.10.3**, `@erp/contratos` **0.4.0**, `@erp/moldura` **0.5.0**, só no Verdaccio desta máquina; lockstep ok | `task lockstep` |
| ADRs | 0013 com adendos 1–3 e 0014 com adendo 1, aceitos | `docs/adr/` |
| Gates fechados | shell, B1+D1+G3+K, D2, D19-B (2026-10-06, tag `gate-d19b-aprovado`), D7 (2026-10-06, iteração 1, tag `gate-d7-aprovado`), **C1** (2026-10-06, iteração 3, tag `gate-c1-aprovado`) | `GATE_STATUS.md`

## Próximo passo: C1, depois C3 (ordem do humano, 2026-10-06; D7 ✅)

Sessão e identidade estão fechadas (D1, D2, D19-B). Os menores do D2 estão em `DEFERRED.md` D27; os de arquitetura em
D17, D18, D24–D26. Ordem decidida pelo humano, **um de cada vez**, cada um com plano em `docs/superpowers/plans/`
(modo Subagent-Driven), tasks revisadas e gate:

1. ✅ **D7 — zona travada** (#11). Plano: `docs/superpowers/plans/2026-10-06-d7-zona-travada.md`. Tasks 1 e 2 (erp-shell `45787f1`, principal `f01b25d`, L9) e **gate aprovado na iteração 1** (2026-10-06): revisor e challenger APROVAM, auditor PASS (39 mutações, 36 pegas, 3 vivas como limite declarado); tag `gate-d7-aprovado`. Menores e limites em `DEFERRED.md` D28.
   **Decisão do humano (2026-10-06): teto agora, página com o C3.** O `proxyTimeout` do Next conta inatividade do socket e, ao
   estourar, o próprio Next escreve o 500 cru (`proxy-request.js`, sem gancho); o D7 entrega `ERP_ZONA_TETO_MS` (10 s, B1) e a
   página de indisponível dentro do teto passa a ser requisito do C3.
2. ✅ **C1 — fragmentos entre zonas** (#10). Plano: `docs/superpowers/plans/2026-10-06-c1-fragmentos-entre-zonas.md`. Zona 2 `1626fd1` (dona), shell `836ddc4` (recusa), zona 1 `39c4b76` (bloco, `ZONA2_URL`); testes C1a–C1d. **Gate aprovado na iteração 3** (2026-10-06): revisor e challenger APROVAM; auditor vetou duas vezes só por teste (escape, filtro, placeholder) e passou na 3; tag `gate-c1-aprovado`. Menores e limites em `DEFERRED.md` D30.
2b. ⬜ **Núcleo 0.10.4 — `ehHtmlInerte` por lista de permissão** (`DEFERRED.md` D29; decisão do humano, 2026-10-06: logo depois do C1, antes do C3). Plano em `docs/superpowers/plans/`, lockstep nas 4 apps, gate próprio.
   Falta: rota `_fragmento` na zona 2, bloco dela na zona 1, o shell recusa `/{zona}/_fragmento/` vindo do navegador, e
   o teste ponta a ponta.
3. ⬜ **C3 — mapa de zonas pelos manifestos** (#14). Zona nova entra sem editar o `zonas.json` nem republicar o shell.
   **Requisito vindo do D7 (2026-10-06):** o mecanismo escolhido entrega a página de indisponível dentro de `ERP_ZONA_TETO_MS`.
   Do gate do D7: uma página com várias chamadas lentas em sequência, sem mandar bytes, também é cortada no teto (500 cru);
   e a zona com um domínio congelado devolve a página genérica do Next, sem `supportId` (`DEFERRED.md` D28).
   **Começa pelo `arquiteto-mfe`** (os rewrites do Next são fixados na subida; escolher o mecanismo); se for estrutural,
   ADR e pedido em `pedidos/` para o humano.
4. Depois: resto do E3 (`showcase:conferir` no modo OIDC), E4 (roteiro: uma linha por funcionalidade básica) e E5.

**Para retomar (passo exato):** ler este arquivo e `AMBIENTE.md`; `git fetch` e ler commits do outro; conferir o ambiente
(`docker ps`: Redis e Keycloak podem ter caído com a máquina → `task showcase:subir` e `task showcase:checar`); então
escrever o plano do **núcleo 0.10.4** (`DEFERRED.md` D29: `ehHtmlInerte` por lista de permissão de tags e atributos; lockstep nas 4 apps) em `docs/superpowers/plans/` e seguir task a task. Nada está rodando e nenhum agente está aberto.

## Plano até o objetivo

Legenda: ✅ feito · ⏳ em andamento · ⬜ a fazer · ⏸️ depois do objetivo · 🔒 bloqueado (motivo na coluna).

### Lista 1 — atividades atuais (estrutura, funcionalidades e showcase)

| Fase | Item | Estado | Atividade | Depende de / bloqueio |
|---|---|---|---|---|
| **A. Fechar o aberto** | A1 gate do shell | ✅ aprovado na iteração 4 | #3, #18 | — |
| **B. Base consistente** | B1 migrar as 4 apps para o kit | ✅ gate B1+D1+G3+K aprovado (2026-09-28) | #20 | — |
| | B2 exportar spans (SDK OpenTelemetry) | ⏸️ depois do objetivo (humano, 2026-10-06) | #18 | — (instalação aprovada) |
| | B3 `/{zona}/api/health` sem domínio; sonda do shell o usa | ✅ gate B1+D1+G3+K aprovado | #3 | — |
| | B5 parâmetros em configuração (B5a shell, B5b núcleo) | ✅; os de sessão entram com o D2 | #20 | — |
| | B4/B6 verificações estáticas de segurança | ✅ 48 testes; limites em D14, lacunas em D15 (K6) | #20 | — |
| **C. Funcionalidades** | C1 fragmentos entre zonas | ✅ gate aprovado (2026-10-06, iteração 3) | #10 | B1 |
| | C2 SSE no shell (`/api/stream` + `SharedWorker`) | ⏸️ depois do objetivo (humano, 2026-10-06) | #11 | B1; decisão B ok |
| | **D7** zona travada segura a requisição ~30 s e devolve 500 cru (separado do C2) | ✅ teto; gate aprovado (2026-10-06); página com o C3 | #11 | — |
| | C3 mapa de zonas vindo dos manifestos | ⬜ básico (humano, 2026-10-06) | #14 | B1 |
| **D. Sessão e identidade reais** | D1 sessão no Redis (shell grava com senha, zonas leem com ACL só de leitura) | ✅ gate B1+D1+G3+K aprovado (ambiente por lista de inclusão) | #9 | — |
| | D2 OIDC + PKCE e renovação proativa com lock (**ADR-0013 aceito**; pessoa por `sub`) | ✅ gate do D2 aprovado (iteração 3, 2026-10-05); D19-B aprovada (2026-10-06) | #9 | — |
| **E. Showcase** | E1 domínios mock com dados em JSON | ✅ | #19 | — |
| | E2 `docker-compose` com Redis e Keycloak | ✅ | #19 | — |
| | E3 `task showcase` e `task showcase:conferir` | ✅ login pelo Keycloak com `task showcase:oidc`; `showcase:conferir` ainda só no login de dev | #19 | — |
| | E4 roteiro do showcase: uma linha por funcionalidade básica | ⬜ | #19 | C1, C3, D7, E3 |
| | E5 verificação ponta a ponta contra o showcase | ⬜ | #19 | E4 |
| **G. Gestão de acesso v2** | G1 modelo e mock (porta 4020) | ✅ | #21 | — |
| | G2 **ADR-0014 + adendo 1, aceito** | ✅ | #21 | — |
| | G3 alinhar à v2 | ✅ gate B1+D1+G3+K aprovado | #21 | — |
| | G4 gate e showcase com os atores da v2 | ⏸️ depois do objetivo (humano, 2026-10-06) | #21, #19 | G3 |
| | G5 revogação ativa por `/v2/eventos` | ⏸️ depois do objetivo (humano, 2026-10-06); **lacuna declarada e aceita** até lá | #21 | G3, D2 |

### Lista 2 — refinamento (separada; **não começar agora**)

Condição para começar qualquer item: **objetivo atingido**, isto é, todas as funcionalidades básicas no showcase
(itens ⬜ da Lista 1). A ordem entre a Lista 2 e os itens ⏸️ ainda não foi decidida.
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
- **Verificador interrompido não é retomado em outra sessão:** o agente some com a sessão; despachar um novo (`<papel>_<gate>_<n+1>`)
  só com as etapas que faltam, a partir do handoff parcial do anterior (2026-10-06).
- **Gate segue o `LEIA-PRIMEIRO.md`:** revisor e challenger em Sonnet, auditor forense em Opus com veto (veto só por teste: a iteração seguinte é só um auditor novo); o auditor só roda
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

## Ambiente (2026-10-06, fim do gate do D7)

- No ar: Verdaccio (4873), Redis (6379) e Keycloak (8080), `showcase:checar` ok. Portas da base 3000–3003 e 4001–4120 livres;
  nenhum agente rodando.
- `@erp/nucleo` 0.10.3 só no Verdaccio desta máquina. Outra máquina: `task pacotes:publicar` e `task pacotes:alinhar-hashes`.
- Fora de commit, de propósito: `docs/README.md`, `docs/arquitetura/alvo.md`, `docs/arquitetura/infraestrutura-alvo.md`
  (trabalho do humano) e os `pnpm-lock.yaml` de erp-dominio-stub e erp-moldura (hash local, `AMBIENTE.md` §1).
- Ambientes anteriores (2026-09-28 a 2026-10-05) no histórico do git deste arquivo.

## Ambiente (reescrita de 2026-10-05)

- Em 2026-10-05 a `bff-multizone` foi **reescrita com push forçado** de `793f519` em diante (8 commits, `72ca361` → `f5664bc`) só
  para mascarar um JWT do Keycloak local em `.agents/challenger_d2_1/out-t1b.txt` e `out-t2c.txt`; o conteúdo do resto é o mesmo.
  Os submódulos não mudaram. **Quem baixou antes:** `git fetch` e `git reset --hard origin/bff-multizone` (ou `reset --mixed` para
  manter a árvore). Os SHAs do principal citados no ledger e em handoffs entre `793f519` e `72ca361` são os antigos.
