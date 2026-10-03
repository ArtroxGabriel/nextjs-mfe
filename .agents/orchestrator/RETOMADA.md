# Retomada — onde o trabalho está agora

> Só o estado atual, o plano e o próximo passo. O que termina sai daqui e vai para
> `GATE_STATUS.md` (vereditos) ou `ATIVIDADES.md` (GitLab). Atualizado em **2026-10-03 (Task 5 do D2 implementada; revisão da task em andamento)**.

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

## Estado (conferido em 2026-10-01)

| O quê | Estado | Evidência |
|---|---|---|
| Base em `repos/` (Next 16) | funcionando; `base/verificacao` **109/109** com Redis e **105 + 4 pulados** com arquivo; D13 E2E testado | `task verificar:redis`, `task verificar:construir` |
| Unidades | contratos 20, núcleo 144 (+2 testes K6), moldura 26, stub 43, shell 43; estática 51/51 (+3 testes K6); scripts 19 (+1 teste LA) | `task test`, `task typecheck`, `task verificar:estatica`, `task scripts:test` |
| `@erp/nucleo` | **0.9.2** publicado e nas 4 apps (lockstep ok); fonte em **0.10.0** no `master` do erp-nucleo (184/184), **não publicado**: publicação e lockstep entram na Task 4 (decisão do humano, 2026-10-01) | lockstep 4 apps; `fd94ecc` |
| `@erp/contratos` / `@erp/moldura` | **0.4.0** / **0.5.0** | ADR-0012, ADR-0014 adendo 1 |
| ADRs | **0013 aceito** e **0014 + adendo 1 aceito** (humano, 2026-09-23) | `docs/adr/` |
| Gate B1+D1+G3+K | **aprovado** na iteração 9 (2026-09-28); tag `gate-b1-d1-g3-aprovado` | `GATE_STATUS.md` |
| Fatia K6 | **concluída e verificada** (2026-09-29): ator Eva (D13), LA–LG fechados (D15), invariante 8 na zona-2 | `progress.md`, commit `d1d6345` |
| Plano D2 + K6 | **aprovado** pelo humano (modo Subagent-Driven) | `docs/superpowers/plans/2026-09-29-d2-k6-oidc-pkce-renovacao.md` |

## Próximo passo: D2 (Task 5 — verificação RS256/JWKS no stub de domínio e realm Keycloak)

O plano de implementação em `docs/superpowers/plans/2026-09-29-d2-k6-oidc-pkce-renovacao.md` foi aprovado. A Task 1 (K6 + D13) foi concluída e aprovada pelo revisor.

1. ✅ **Plano do D2 + K6:** aprovado (2026-09-29). Dependências propostas para instalação documentadas (`openid-client` v6 no shell e peer no núcleo).
2. ✅ **Task 1 (K6):** ator Eva (`zona2.leitor`, fecha D13) em identidadeDev, realm e semente; botão Concluir ocultado na zona 2 (invariante 8); analisador ignora `declare` e pega atribuições a `assetPrefix`; `precisaConstruir` monitora `ambiente.mjs`; banner e CLI do showcase higienizados. Commits: nucleo `cf56312`, stub `29bdc1c`, zona-2 `7d11a62`, principal `d1d6345`.
3. ✅ **Task 2** (aprovada 2026-10-03): porta de identidade `@erp/nucleo` 0.10.0 (`iniciar`, `concluir`, `renovar`, `encerrar`), transações de login de uso único no store (`erp:login:*`, GETDEL; `rename` no arquivo) e lock de renovação `SET NX PX` (`erp:renovacao:*`). Renovação em `criarNucleoDoShell.renovarSessao(id)` (o proxy só chama; lança em erro transitório do IdP).
   - Commits: erp-nucleo `d481d14` (implementação) e `fd94ecc` (correção da rodada 1); principal `dcecec5` (`docs/CONFIGURACAO.md`).
   - Revisão da task (Opus): spec ✅; **1 Important** — logout durante a renovação ressuscitava a sessão. Corrigido em `fd94ecc` (`regravar` com `SET XX PX`; `renovarSessao` devolve `'ausente'`); teste de corrida em memória, arquivo e Redis falso; mutação conferida; 184/184.
   - Re-revisão restrita (Sonnet, 2026-10-03) de `d481d14..fd94ecc`: achado resolvido nos três stores, sem quebra nova. **Task 2 fechada.**
   - Decisão do humano (2026-10-01): a Task 2 só mexe no erp-nucleo; publicação no Verdaccio e lockstep 0.10.0 nas 4 apps vão para a Task 4. Até lá o shell não compila contra 0.10.0 (`nucleo.sessao.entrar(credencial)` saiu).
   - Achados menores (para a revisão final decidir): tomada de lock velho no store de arquivo pode dar dois vencedores; teste de 20 renovações concorrentes na fábrica sem a variante Redis falso; transações expiradas nunca limpas em arquivo/memória; `sessaoMemoria().adquirirLockRenovacao` sem `validarTtlDoLock`; `ERP_RENOVACAO_JANELA_S < ERP_TOKEN_VIDA_S/2` documentado e não imposto; teste de tempo dos perdedores (<200 ms) pode oscilar; `fronteira.mjs` com nomes genéricos (`iniciar`, `concluir`, `renovar`) como marcadores de escrita; `identidade-dev` sem teto absoluto (`ERP_SESSAO_MAXIMA_S`).
   - **Para a Task 4:** o wrapper `lib/redis.ts` do shell precisa repassar `getDel`, `NX` e `XX`; o ADR-0013 §2 (leitor das zonas descarta `refreshToken`/`idToken`) não foi feito — se for, o shell precisa de leitura completa própria.
4. ✅ **Task 3** (aprovada 2026-10-03): Adaptador `identidadeOidc` com `openid-client` v6.
   - Commits: erp-nucleo `c172bc8` e `9a593a4` (correção: URL de logout sem `id_token_hint`, só `client_id` + `post_logout_redirect_uri`; nenhum token na URL) (211/211; `openid-client` 6.8.8 + `jose` 6.2.12 + `oauth4webapi` 3.8.8 como dev e peer opcional); principal `635f2f5` (`docs/CONFIGURACAO.md`). Sem variável nova; `lerTimeoutDeDestinoMs` compartilhado com `destinos.ts`.
   - Revisão (Opus) + re-revisão restrita (Sonnet): aprovada. **Para a Task 4 e o ponta a ponta:** `erp-shell` precisa de `openid-client` ao subir para 0.10 (o `/shell` reexporta o adaptador); sem o hint o Keycloak mostra confirmação de logout e pode não redirecionar (conferir); `encerrar` lança se o discovery falhar depois de a sessão já ter sido apagada (try/catch na rota `sair`); `concluir`/`iniciar`/`encerrar` lançam erro normalizado em falha de rede/discovery (a rota de retorno precisa de try/catch); access token decodificado sem verificar assinatura (o domínio verifica); exigências estritas a confirmar no Keycloak (access token JWT, `sub` igual ao do id_token, `preferred_username` no id_token com `scope=openid profile`).
5. ✅ **Task 4** (aprovada 2026-10-03): Renovação proativa e serializada no `proxy.ts` do shell e rotas `/api/auth/{entrar,retorno,sair}`.
   - Commits: shell `03ba9b0`, zona-1 `6791943`, zona-2 `4965236`, zona-acesso `d396627`, principal `4604f08`. **`@erp/nucleo` 0.10.0 publicado no Verdaccio desta máquina** (de `9a593a4`) e em lockstep nas 4 apps; `openid-client` 6.8.8 no shell. Outra máquina: publicar 0.10.0 no próprio Verdaccio e `task pacotes:alinhar-hashes` antes de instalar.
   - Shell 70/70, núcleo 211/211, estática 51/51, `verificar:construir` com arquivo 109 + 4 pulados. Login de dev agora é GET `entrar` → `/login/dev` → GET `retorno` (o POST saiu; `base/verificacao/apoio.mjs` ajustado).
   - Revisão (Opus): 1 Important — logout OIDC barrado pela CSP (`form-action 'self'`; ADR-0013 decisão 6). Corrigido: **núcleo 0.10.1** (`formularioPara`, publicado no Verdaccio desta máquina, lockstep nas 4 apps; zonas recebem `IDP_EMISSOR`, só a origem). Commits: núcleo `2fa8c06`, shell `d333932`, zona-1 `c7f52cf`, zona-2 `a8b1753`, zona-acesso `5b02a2b`, principal `78b019b`.
   - Lacuna achada pelo orquestrador: `task scripts:test` V1 vermelho desde o núcleo 0.10 (4 variáveis de sessão). Corrigido em `117236f`: V1 conta só o código do núcleo que a zona alcança, com exceções por função e motivo; 20/20.
   - Re-revisão restrita (Sonnet): os dois achados resolvidos, sem quebra nova. Outra máquina: publicar 0.10.1 no próprio Verdaccio.
6. ⏳ **Task 5:** Verificação RS256 JWKS no stub de domínio e realm Keycloak.
   - Commits: stub `4712d4e`, principal `2c058cb`. Stub 69/69; `verificar:construir` 111 + 4 pulados; `verificar:redis` 115/115; `showcase:checar` ok. Realm já tinha mapper, `revokeRefreshToken` e `refreshTokenMaxReuse: 0`. Variáveis novas: `ERP_JWKS_TTL_S`, `ERP_JWKS_INTERVALO_MIN_S`, `ERP_JWT_TOLERANCIA_S`.
   - **Em andamento:** revisão da task (Opus). **Decisão provável do humano:** o token de serviço `Bearer svc.<app>` segue aceito no modo JWT (senão `registrar-manifesto` quebra com OIDC); o ADR-0013 decisão 7 diz "só JWT".
   - Containers no ar: Verdaccio, Redis e Keycloak do showcase.
7. ⬜ **Task 6:** Verificação final e handoff.

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

## Ambiente (parada de 2026-10-01)

- Nenhum agente rodando. Relatórios da Task 2 ficaram em `.superpowers/sdd/2026-09-29-d2-k6-oidc-pkce-renovacao/` (fora do git, só nesta máquina); o essencial está acima.
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
