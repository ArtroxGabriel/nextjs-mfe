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
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **71/71** com Redis e **70 + 1 pulado** com arquivo | `task verificar:construir`, `task verificar:redis` |
| Unidades | contratos 16, núcleo 109, moldura 25, stub 39, shell 38; typecheck das 4 apps; estática 16/16; scripts 9/9 | `task test`, `task typecheck`, `task verificar:estatica` |
| `@erp/nucleo` | **0.9.2** nas 4 apps (acesso v2 só, `exigirModulo(modulo, funcionalidade)`, `exigirPapel`) | lockstep 4 apps |
| `@erp/contratos` / `@erp/moldura` | **0.4.0** / **0.5.0** | ADR-0012, ADR-0014 adendo 1 |
| Gate "Shell novo" (#3, #18) | **aprovado** na iteração 4 | `GATE_STATUS.md`; tag `gate-shell-aprovado` |
| Gate B1+D1 | **iteração 2 REPROVADA** (auditor Opus, 77 mutações + 29 contornos; vetos V1–V8); iteração 1 superada | `GATE_STATUS.md`; `.agents/auditor_b1_d1_2/` |
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
| | G3 alinhar à v2 conforme o **adendo 1 do ADR-0014** | ✅ implementado (contratos 0.4.0, núcleo 0.9.1, moldura 0.5.0); 62/62 nos dois modos; **falta gate** (iteração 3, junto com B1+D1) | #21 | — |
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

## Correção do gate B1+D1 (fatia "K", antes da iteração 3)

| # | Veto | Correção | Onde |
|---|---|---|---|
| K1 | V1 zona escreve no Redis | `lib/redis.ts` da zona só com `get`; usuário ACL só leitura para as zonas no showcase; teste estático que reprova `.set`/`.del` em zona | zonas, `base/showcase`, `base/verificacao` |
| K2 | V2 `/app` exporta o escritor | teste de fronteira em todo subpath que não seja `/shell` | núcleo |
| K3 | V3 `server-only` por texto; diretiva contornável | `fronteira.mjs` por import real (sem comentário); analisador reconhece `'use client';` e comentário antes; `lib/redis.ts` coberto | núcleo, `base/verificacao` |
| K4 | V4 fallback concede; V6 funcionalidade ignorada; L6 CPF | **G3** (corte seco, `exigirModulo(modulo, funcionalidade)`, `acessoEfetivo`) | núcleo 0.9.0 |
| K5 | V5 DTO por spread | regra P0 cobre spread e objeto inteiro para ilha | `base/verificacao` |
| K6 | V7 `NEXT_PUBLIC_*` | varrer `next.config.ts` e todo `NEXT_PUBLIC_` com endpoint/token | `base/verificacao` |
| K7 | V8 saída de rede | `Reflect`/`getOwnPropertyDescriptor`, `createRequire`, `child_process`, clientes de banco | `base/verificacao` |
| K8 | L1–L8 | health que diz algo (sonda exige 2xx), tetos nos limites, `redirect: 'manual'` na sonda, `finally` nos servidores de teste, `ehSessao` exige token | shell, núcleo |

Todo contorno achado pelo auditor vira caso de teste (AMBIENTE §3).

## G3 implementado (2026-09-22, noite) — falta o resto da fatia K e o gate

Tudo no `master` dos submódulos e fixado no principal. **Ponta a ponta 62/62 com arquivo e 62/62 com Redis.**

| Repositório | Versão / commit | O que tem |
|---|---|---|
| erp-contratos | 0.4.0 | `AcessoEfetivo`, `ModuloEfetivo {id,nome,funcionalidades}`, manifesto v2 validado (20 testes) |
| erp-nucleo | 0.9.1 | só `/v2/eu`, sem fallback (V4); `exigirModulo(modulo, funcionalidade)` (V6); `exigirPapel`; `acaoProtegida(requisito…)`; `entradaInicial`/`entradaAdministrativa` no menu; fronteira por import real (V3); nenhum subpath fora de `/shell` com escritor (V2); tetos (L2); sessão sem token é ausente (L7); testes fecham servidores (L5). 131 testes; 7 mutações pegas |
| erp-moldura | 0.5.0 | `acaoProtegida(requisito, …)` repassa a funcionalidade (L7) |
| erp-dominio-stub | — | token `dev.<login>.<uuid>`, `nome` no `/v2/eu`, ana…davi na unidade central (42 testes) |
| apps | — | destino 4020 só `/v2/eu`; páginas por funcionalidade; zona de acesso com pessoas × módulos (conceder/revogar); manifestos v2 só nas zonas 1 e 2 |
| base | — | `ambiente.mjs` sobe a v2 (4020), v1 só sob demanda; verificação migrada: revogação do davi, segregação (carla não se concede), v2 fora com v1 no ar → indisponível, pessoa desligada → login, funcionalidade exigida tem de estar no manifesto |

## Fatia K concluída (2026-09-22, noite)

Todos os vetos e lacunas do `auditor_b1_d1_2` têm correção e teste que reprova a mutação:

| Veto / lacuna | Correção | Teste |
|---|---|---|
| V1 zona escreve no Redis | cliente da zona só com `get` (`ClienteRedisDeLeitura`, núcleo 0.9.2); `REDIS_URL_ZONA` com usuário ACL só `GET` em `erp:sessao:*` | "V1 estático" e "V1 dinâmico" (NOPERM em SET e DEL) no `base.test.mjs` |
| V2 `/app` exporta escritor | teste em todo subpath fora de `/shell` | `fronteira.test.mjs` (N38 pega) |
| V3 `server-only` e diretiva | fronteira por import real; `ehCliente` pelo prólogo; import transitivo, dinâmico e reexportação | `fronteira.test.mjs`; E01–E06 em `seguranca-estatica.test.mjs` |
| V4, V6, L6 | G3 (corte seco, dois argumentos, sem CPF) | núcleo `acesso.test.mjs`, `paginas.test.mjs`; ponta a ponta "v2 fora e v1 no ar" |
| V5 DTO para ilha | ilha só recebe valor projetado; chave sensível em spread/objeto; nome sensível por trecho | E07–E10 |
| V7 `NEXT_PUBLIC_*` | qualquer forma (índice, destruturação, texto), `next.config` varrido | E19–E22 |
| V8 saída de rede | clientes de banco, global entregue a função, `module`/`child_process`/`vm` | R01–R07 em `saida-de-rede.test.mjs` |
| L1–L3 sonda | só 2xx; `redirect: 'manual'` e `no-store` fixados por teste; tetos | shell `saude.test.mjs` (3 mutações pegas) |
| L2, L5, L7 | tetos; `finally` nos servidores de teste; sessão sem token é ausente | núcleo |
| L8 `<Link>` | href só literal da própria zona, com qualquer nome, também no shell | E12–E18 |

Ponta a ponta: **71/71 com Redis** (com a ACL) e **70/70 + 1 pulado com arquivo** (o teste da ACL só roda com Redis).
Unidades: contratos 20, núcleo 132, moldura 26, stub 42, shell 40; estáticas 23.

## Próximo passo

1. **Iteração 3 do gate B1+D1+G3+K — em andamento:** `reviewer_b1_d1_3` **APPROVE** e `challenger_b1_d1_3`
   **APPROVE** (handoffs commitados); `auditor_b1_d1_3` (Opus) rodando, dono das portas. Interrompido uma vez pelo
   limite de uso e retomado; parcial: 65 mutações, 11 sobreviventes (entre elas N37 `force-cache`, N38b/c escritor
   exportado com outro nome, N53 `same-site` aceito na action) — veredito ainda não saiu. Durante o gate, ninguém
   mexe no código dos submódulos. Endurecimentos anotados pelos dois, para depois do gate: zona recusar subir sem
   `REDIS_URL_ZONA` fora de desenvolvimento; `valorSeguro` aceitar só import de ação (`'use server'`), não qualquer
   import; teste que espione que a action negada não chama `nucleo.destino`.
2. **D2** (núcleo 0.10.0, OIDC + PKCE, ADR-0013, pessoa casada por `sub`); G4; G5 (eventos); C1–C3; E4–E5.

Ambiente desta máquina: Verdaccio (com contratos 0.4.0, núcleo 0.9.2 e moldura 0.5.0), Redis e Keycloak no ar.
Outra máquina: publicar contratos 0.4.0 → núcleo 0.9.2 → moldura 0.5.0 no próprio Verdaccio (`task pacotes:publicar`)
e rodar `task pacotes:alinhar-hashes` antes do `task instalar`.
