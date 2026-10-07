# Adiados de propósito

> Só o que está **aberto**. Cada item diz o que é, a evidência e em que atividade do plano fecha.
> Os itens da PoC (D1–D11) fecharam por substituição em 2026-09-21; estão na tag `historico-2026-09-22`.
> D13 (ator só com `tarefas.ver`) e D15 (lacunas sem veto da iteração 9) fecharam na K6 (2026-09-29, `d1d6345`;
> saíram daqui em `51fd1ab`); conferido de novo na Task 6 do D2 (2026-10-03). D16 (verificação OIDC contra o Keycloak)
> abriu e fechou na mesma task: adendo 2 do ADR-0013 e `task verificar:oidc`.
> **D19** (token vencido ia ao login) fechou na D19-B (2026-10-05) pela opção B do humano: núcleo **0.10.3** em lockstep,
> quem perde o lock com o token vencido espera o vencedor até `ERP_RENOVACAO_ESPERA_MS` (ADR-0013, adendo 3). Evidência:
> `oidc.test.mjs` "token ja vencido: 10 requisicoes concorrentes…": com a 0.10.2 e com a mutação "não esperar" no build,
> `200 200 307 200 307 …`; com a 0.10.3, 10 × 200 e uma gravação da sessão (`task verificar:oidc` 6/6); unidade nos três
> stores em `erp-nucleo/test/identidade.test.mjs`. Commits: núcleo `c879b0b`, `fdea296`; shell `acec0bf`; principal
> `d898b84`, `c26619c`. **D20** fechou inteiro no mesmo 0.10.3: lock > 2 × timeout recusado na criação e janela conferida
> por sessão (`tokenVidaMs`, `FalhaDoNucleo` com `motivo`), `urlRetorno` sem query nem fragmento, JSDoc da porta
> (`e1a09f2`, `3576971`); `iniciarLogin` devolve `expiraEm` e o shell não lê mais `ERP_LOGIN_TRANSACAO_S` (`acec0bf`).
> Os menores do gate do D2 (`server-only` em `cookies.ts`, `SHELL_HOSTS` com espaço no shell e nas zonas, esquema no
> `sair`, §5 do `CONFIGURACAO.md`, aviso do showcase sem a eva) entraram nas Tasks 3 e 4.
> **D29** (`ehHtmlInerte` deixava passar HTML ativo) fechou no núcleo **0.10.4** (2026-10-07): validação por lista de
> permissão (`docs/desenho/mfe/02-zonas.md` §2.3, ADR-0011 adendo 2). Evidência: 15 testes em `erp-nucleo`, mutações M1–M13
> do plano todas pegas. Commits: núcleo `50a0fea`; apps em lockstep, principal `bbf6a84`. Limites da lista: D30.
> **D7** (zona travada: página da base dentro do teto) fechou no C3 (2026-10-07, ADR-0015): o documento passa pelo gateway do shell, que conta `ERP_ZONA_TETO_MS` até os cabeçalhos e responde 503 com a página e o `supportId`. Evidência (`task verificar:redis`): L9 6011 ms com o teto em 6 s (antes, 500 cru em 6 s), L9b (três chamadas lentas de 2,5 s em sequência, sem byte) 6013 ms, L9c (cabeçalhos mandados e zona parada) corte 7005 ms depois dos cabeçalhos com a ociosidade em 7 s (todos os números, L10 inclusive, de uma só rodada de `verificar:redis`). Commits: shell `c7a08d9` (mapa) e `4eb47e2` (gateway e proxy híbrido); principal `5700aaf`. Os itens de roteamento do D28 fecharam junto; ficam nele só os demais. Limites novos do C3: D31.

## D12 — Menores do núcleo (fatia 1)

| Item | Estado | Fecha em |
|---|---|---|
| `sessaoArquivo`: diretório sem permissão restritiva (`sessao-arquivo.ts:18`) | aberto | D1 (Redis substitui o arquivo) |
| `sessaoArquivo.ler`: `existsSync` antes de `readFileSync` (TOCTOU inofensivo) | aberto | D1 |
| `sanitizarSupportId` valida formato, não semântica | aceito | F4 (padronização de erro) |
| teste de namespace passa com `caminhos` vazio | a conferir | F6 (camada de testes) |
| `sessaoArquivo`: tomar o lock de renovação vencido pode dar dois vencedores (revisão final D2, T2) | aceito: store de arquivo é de desenvolvimento, com um processo de shell | store de arquivo servindo mais de um processo |
| transações de login vencidas nunca limpas nos stores de arquivo e memória (revisão final D2, T2) | aceito: só desenvolvimento e teste; o Redis tem TTL | store de arquivo fora do desenvolvimento |

## D14 — Limites declarados dos analisadores estáticos (Decisão A2, 2026-09-23)

- **O que é:** os analisadores de `base/verificacao/` (`seguranca-estatica.mjs`, `saida-de-rede.mjs`) e a fronteira do núcleo
  pegam o **erro de boa-fé**; um contorno escrito de propósito sempre acha outra sintaxe. Pela Decisão A2, contorno deliberado
  não veta o gate: fica aqui, com a defesa que vale contra ele. Erro plausível de boa-fé continua vetando.
- **Classes aceitas** (IDs do `auditor_b1_d1_4/mutacoes.txt`, no git em `ec08ed1`; a iteração 6 confere o que a K3/K4 já fechou):

| Classe | Exemplos | Defesa que vale |
|---|---|---|
| ilha alcançada por indireção (apelido condicional, objeto de componentes, barril sem `from`) | XA09–XA13 | domínio devolve só o que o usuário pode ver (inv. 9); ponta a ponta procura dado interno no HTML e no RSC |
| chave calculada ou sintaxe montada (`['e'+'nv']`, `'const'+'ructor'`, `process['bind'+'ing']`) | XN02–XN04, XR28, XR31 | a zona não tem credencial nem endereço de domínio que valha fora do registro de destinos |
| `acaoProtegida` falsa ou domínio chamado por helper no argumento | XP01, XP03–XP06 | ponta a ponta de `Origin` e `CAMPOS_VALIDOS` (P09b); o domínio recusa sem credencial |
| navegação entre zonas escrita de forma indireta | XL01–XL04 | só experiência de uso: a zona de destino exige sessão e `exigirModulo` |
| rota do domínio repassada por `rewrites`/`NextResponse.rewrite` | XN08, XR30 | o domínio responde 401 sem credencial; bloqueio de saída de rede no deploy |
| `require` por apelido e `__non_webpack_require__` (auditor_b1_d1_9) | XR40–XR44 | mesma de chave calculada: a zona não tem credencial nem endereço de domínio fora do registro |
| rede do navegador sem `fetch` (`WebTransport`, `Image`, `Worker`) (auditor_b1_d1_9) | XR45–XR48 | CSP `default-src 'self'` em shell e zonas (teste de CSP do ponta a ponta) |
| V1 não vê o chamador no próprio arquivo nem por `import()` (revisão final D2, T4) | — | escrita de sessão só existe em `@erp/nucleo/shell` (inv. 15) e a ACL das zonas no Redis é só `+get` |
| varredura de rotas do stub por regex (revisão final D2, T5) | — | piso de 117 chamadas na varredura; o domínio recusa sem credencial válida |

- **Barreira de ambiente em vigor desde a K5:** zona e domínio recebem o ambiente por lista de inclusão, em toda fase
  (`base/scripts/ambiente.mjs`); a senha de escrita não chega a eles, conferido em `/proc/<pid>/environ` por
  `base/verificacao/base.test.mjs` com `ERP_REDIS_SENHA_SHELL` sempre definida.
- **Fecha em:** bloqueio de saída de rede das zonas no deploy (P1, fim do plano). Até lá, risco aceito.

## D17 — Zonas leem `refreshToken` e `idToken` (ADR-0013, decisão 2, não cumprida)

- **O que é:** a decisão 2 diz que o leitor das zonas descarta `refreshToken` e `idToken`. O leitor (`sessaoRedis`,
  `sessaoArquivo`) devolve a `SessaoArmazenada` inteira, e o usuário ACL das zonas no Redis tem `GET` em
  `erp:sessao:*`, que traz o JSON com os dois. Nada chega ao navegador (`nucleo.sessao.atual` projeta `{ sub, nome }`,
  invariante 1), mas uma zona comprometida teria o refresh token de toda sessão que lê.
- **Evidência:** `erp-nucleo/src/adaptadores/sessao-redis.ts` e `sessao-arquivo.ts` sem descarte; registrado na
  Task 2 do D2 (`RETOMADA.md`, "Para a Task 4") e não feito na Task 4.
- **Por que não foi corrigido:** descartar no leitor obriga o shell a ter leitura completa própria (a renovação relê o
  refresh token); separar o que a zona alcança no Redis exige outra chave ou outro formato. Decisão de desenho.
- **Risco aceito no D2 (revisão final, 2026-10-05):** o cliente é confidencial (`IDP_CLIENTE_SEGREDO` só no shell, fora
  da lista de inclusão da zona), então o refresh token sozinho não renova nada; o ADR-0013 traz a ressalva na decisão 2.
- **Fecha em:** o primeiro que vier entre cliente público no IdP, zona com o segredo do cliente, ou P1 (deploy).

## D18 — `/login/dev` aberto quando o shell sobe em produção sem `IDP_EMISSOR`

- **O que é:** os scripts `build` e `start` do `erp-shell` fixam `ERP_PERMITIR_IDENTIDADE_DEV=1`. Sem `IDP_EMISSOR`,
  um deploy que use `pnpm start` sobe com `identidadeDev`: qualquer um entra como qualquer ator, sem senha.
- **Evidência:** `erp-shell/package.json` (`"start": "ERP_PERMITIR_IDENTIDADE_DEV=1 next start -p 3000"`); a guarda
  em `erp-nucleo/src/adaptadores/identidade-dev.ts` só vale sem a variável. Achado menor da revisão da Task 4 do D2,
  anterior ao D2.
- **Por que não foi corrigido:** fora do escopo do D2; a verificação e o showcase dependem desse script.
- **Fecha em:** P1 (deploy, fim do plano): script de produção sem a variável, ou recusa explícita sem `IDP_EMISSOR`.

## Revisão final do D2 (2026-10-05) — classe B

> Achados da revisão final (`.superpowers/sdd/2026-09-29-d2-k6-oidc-pkce-renovacao/review-final-achados.md`, Parte 2)
> sem defeito de produto hoje. D12 e D14 receberam os seus nas tabelas acima; D17 e D18 seguem nas próprias entradas.

## D21 — Diagnóstico de falha de login

- **O que é:** `concluir` trata `invalid_client` como recusa (vai ao login como credencial ruim), e a causa do erro do IdP
  é descartada sem rastro no servidor; só o `supportId` liga a tela ao log.
- **Por que não foi corrigido:** os dois falham fechado e não vazam nada; só atrapalham o diagnóstico. O log do servidor
  pode guardar a causa sem violar o invariante 12.
- **Fecha em:** F5 (padronização de erro) ou P1 (deploy), o que vier primeiro.

## D22 — Menores do shell e da borda do login

| Item | Motivo de esperar | Gatilho |
|---|---|---|
| `GET /api/auth/entrar` grava transação sem autenticação: com `noeviction`, uma enxurrada enche o Redis | defesa certa é limite de taxa na borda | P1 (deploy) |
| resposta atrasada de uma aba apaga o `__Host-session` novo de outra | janela rara; o efeito é um novo login | relato de uso ou F4 |
| cola de `proxy.ts` (`Set-Cookie` no 307) sem teste próprio | sem defeito; correção barata: afirmar `Max-Age=0` no laço do N3 em `base.test.mjs` | F6 (camada de testes) |
| teste de tempo dos perdedores (< 200 ms) em `proxy-renovacao.test` pode oscilar | sem oscilação observada | primeira falha intermitente no CI (P1) |

## D23 — Stub dos domínios em modo JWT

| Item | Motivo de esperar | Gatilho |
|---|---|---|
| JWKS falha fechado depois do TTL com o IdP fora, sem linha em `CONFIGURACAO.md` §4 | comportamento certo, só não documentado | próxima mudança em §4 ou E5 |
| intervalo mínimo do JWKS medido de início a início | só importa com timeout maior que o intervalo | validar `ERP_DESTINO_TIMEOUT_MS < ERP_JWKS_INTERVALO_MIN_S` no stub, na próxima mudança do JWKS |
| `r.json()` do JWKS sem limite de tamanho | a origem é o emissor confiável | domínio real (fora do stub) |
| `azp` não conferido | hoje só o cliente `erp-shell` tem o mapper `erp-dominios` | segundo cliente no realm (client credentials do adendo 1) |

## D24 — Releitura da espera sem timeout próprio (menor 7 da Task 1 da D19-B)

- **O que é:** a espera do perdedor com o token vencido (ADR-0013, adendo 3) relê a sessão no store a cada passo, e a
  releitura não tem timeout próprio. Um Redis travado estica a espera além de `ERP_RENOVACAO_ESPERA_MS`.
- **Por que não foi corrigido:** o risco já existe em toda leitura do store (proxy, páginas, `renovarSessao`); um timeout
  só na espera não muda o resultado da requisição, que trava na leitura seguinte. Não é desta task.
- **Fecha em:** timeout de comando no cliente Redis das apps (configuração, `docs/CONFIGURACAO.md`), junto com a próxima
  mudança em `lib/redis.ts` ou em P1 (deploy), o que vier primeiro.

## D25 — Recuperação do stub com o JWKS frio (gate da D19-B, challenger_d19b_1)

- **O que é:** se o IdP cai antes de o domínio falso ter baixado o JWKS, o stub entra no intervalo mínimo entre buscas
  (`ERP_JWKS_INTERVALO_MIN_S`, 30 s) e só volta a aceitar tokens ~30 s depois de o IdP voltar. Com o JWKS já em cache, a
  recuperação é imediata.
- **Evidência:** `git show fa93c2c:.agents/challenger_d19b_1/out-c2-vencido-stop-tarefa.txt` (sem aquecimento)
  contra `out-c2-vencido-stop-tarefa-quente.txt`.
- **Por que não foi corrigido:** comportamento do domínio falso, fora do BFF; o intervalo é o que protege o IdP de rajadas.
- **Fecha em:** documentar em `docs/CONFIGURACAO.md` (linha de `ERP_JWKS_INTERVALO_MIN_S`) junto com o T5 da triagem
  ("JWKS falha fechado ≥ intervalo com IdP fora").

## D26 — `lib/redis.ts` das apps transforma GET que falha em `null` (gate da D19-B, auditor_d19b_2, V11)

- **O que é:** o invólucro do node-redis em `erp-shell/lib/redis.ts:15` (e o equivalente nas 3 zonas) devolve `null`
  quando o GET falha. Para o núcleo, `null` é sessão ausente: o proxy apaga o cookie e manda ao login com a sessão
  intacta no Redis (o sintoma do D19). O adaptador do núcleo trata certo (`sessao-redis.test.mjs`, V09 pega).
- **Evidência:** mutação V11/V11e em `.agents/auditor_d19b_2/mutacoes.txt` (passa em shell 108/108 e `verificar:redis`
  118/118). Código anterior à D19-B (D1 `8559367`, D2 `03ba9b0`).
- **Por que não foi corrigido:** fora do diff da D19-B; observação sem veto.
- **Fecha em:** junto com o D24 (próxima mudança em `lib/redis.ts`): teste "GET ou conexão que falha rejeita, nunca
  `null`" no shell e nas 3 zonas, e a correção se o teste reprovar.


## D27 — Menores das tasks do D2 (triagem de 2026-10-06)

- **O que é:** achados menores das revisões das Tasks 2–5 do D2, sem defeito de produto hoje (cópia do ledger; o detalhe
  está em `ledger/2026-09-29-d2-k6-oidc-pkce-renovacao/`). O D18 tem entrada própria.
- **T2:** tomada de lock velho no store de arquivo pode dar dois vencedores; teste de 20 renovações na fábrica sem Redis falso com NX; transações expiradas nunca limpas em arquivo/memória; `sessaoMemoria().adquirirLockRenovacao` sem `validarTtlDoLock`; `ERP_RENOVACAO_JANELA_S < ERP_TOKEN_VIDA_S/2` só documentado; teste de tempo dos perdedores (<200 ms) pode oscilar; `fronteira.mjs` com nomes genéricos como marcadores de escrita; `identidade-dev` sem `ERP_SESSAO_MAXIMA_S`.
- **T3:** `urlRetorno` aceita query/fragmento (o `redirect_uri` da troca diverge); `concluir` trata `invalid_client` como recusa; porta não documenta que `concluir`/`iniciar` lançam; `ehTransitorio` trata todo `TypeError` como transitório; causa do erro descartada sem rastro no servidor; sem `id_token_hint` o Keycloak pode não redirecionar no logout (conferir).
- **T4:** `vidaTransacaoS` do shell repete padrão/teto do núcleo; cola de `proxy.ts` (`Set-Cookie` em redirect/next) sem teste unitário; GET `/api/auth/entrar` grava no store sem autenticação (limitar taxa na borda); resposta atrasada com cookie morto pode apagar sessão nova de outra aba; V1 não vê chamador no próprio arquivo nem `import()` dinâmico; **D18** (`/login/dev` aberto em produção sem `IDP_EMISSOR`).
- **T5:** base64url sem forma canônica (só a assinatura); JWKS falha fechado ≥ `ERP_JWKS_INTERVALO_MIN_S` com IdP fora (documentar); intervalo mínimo medido início a início; `r.json()` do JWKS sem limite; `azp` não conferido; varredura de rotas do teste por regex.
- **Por que não foi corrigido:** sessão compartilhada e identidade não são funcionamento básico (humano, 2026-10-06); o
  objetivo segue por C1, C3, D7 e o showcase.
- **Fecha em:** quando a sessão voltar ao plano (G5 ou P1), um por um; o da documentação do JWKS junto com o D25.

## D28 — Menores e limites declarados do D7 (tasks e gate, 2026-10-06)

- **O que é:** achados sem defeito de produto das revisões das Tasks 1 e 2 e do gate do D7 (cópia do ledger em
  `ledger/2026-10-06-d7-zona-travada/`; handoffs em `git show aa26ba2:.agents/<nome>/handoff.md`).
- **Limites declarados (auditor_d7_1, contorno pela regra A2):** E3 `proxyTimeout` fixo no valor que o L9 usa; E5
  `Number(process.env.ERP_ZONA_TETO_MS) || 10_000` no `next.config.ts` perde a validação sem teste que note (nenhum teste liga
  o `next.config.ts` ao leitor validado; sugestão: teste estático ou caso ponta a ponta com 5000 recusado); M6b padrão/teto de
  `ERP_DESTINO_TIMEOUT_MS` copiados do núcleo no shell, sem teste de paridade (a deriva no núcleo é pega pelo teste de fixação dele).
- **Para o C3 (fechado em 2026-10-07):** página com várias chamadas lentas em sequência e `dominio-c` congelado agora recebem a página da base com `supportId` no teto (L9b e L9; shell `4eb47e2`, principal `5700aaf`).
- **Para o C2:** com `Accept-Encoding: gzip` o shell entrega a resposta da zona toda de uma vez no fim (com `identity`, aos pedaços).
- **Menores:** L9 com `??=` calcula teto 0 se `ERP_ZONA_TETO_MS` vier vazio (falha alta, sem falso verde); critério `ms >= 2000`
  do L9 sozinho não separa o teto de outra lentidão (o piso `teto - 500` cobre); contagens de teste de `docs/arquitetura/atual.md`
  defasadas; sonda 800 ms em `01-operacao.md` contra 500 ms de padrão em `CONFIGURACAO.md`; espera de domínio entre 5 e 10 s não
  exercitada (as zonas declaram 2 s por destino).
- **Fecha em:** o do C2 (gzip); os demais quando o shell ou a verificação forem tocados de novo.

## D30 — Menores e limites declarados do C1 (tasks e gate, 2026-10-06)

- **O que é:** achados sem defeito de produto das revisões das Tasks 1–3 e do gate do C1 (ledger em
  `ledger/2026-10-06-c1-fragmentos-entre-zonas/`; handoffs em `git show b091977:.agents/<nome>/handoff.md`).
- **Limites declarados (auditor_c1_3, regra A2):** a checagem estrutural do C1c olha só o primeiro nível do `<main>`; texto
  neutro dentro de uma seção da zona 1, no layout ou no `h1` só é pego pela guarda de texto. V-Z6d (filtro `versao === 1`) é contorno.
- **Grafias no shell (challenger_c1_1):** `//` e barra final dão 308 para a forma canônica (que dá 404); `%2F`, `%20`, `%00` e `;`
  passam pela guarda, mas não casam a rota da zona 2 (307 ao login sem cookie; 404 HTML da zona com cookie). Endurecimento
  opcional: colapsar `/+` e tratar `%2F` antes do regex.
- **Limites declarados da lista de permissão do 0.10.4 (revisão da Task 1 do D29):** (a) pilha balanceada não é aninhamento
  válido: `<p><ul></ul></p>`, `<a><a></a></a>` e `<li>` fora de lista passam; o parser reestrutura o DOM, sem vetor de
  execução. **Alcance maior (auditor_d29_1):** `<li><div><li>…</li></div></li>` passa e, no parse HTML5 da página, fecha o
  contêiner e os `div` ancestrais da zona 1 (o bloco "vaza" do contêiner no DOM); fuzz de 600 mil fragmentos sem execução nem
  captura de conteúdo da página. Fecha de vez com regras de conteúdo por tag (`li` só dentro de `ul`/`ol`, `p` sem bloco).
  (b) `id` e `class` aceitam qualquer valor limpo: DOM clobbering e reuso das classes CSS da consumidora. (c) `href`
  aceita qualquer caminho da mesma origem, inclusive rota GET com efeito colateral; exige clique do usuário e o domínio decide.
  Fecham quando o primeiro fragmento novo precisar (regra da lista: abrir é commit com teste).
- **Menores do gate do D29 (2026-10-07):** texto e valor aceitam U+202E (bidi) e U+FEFF (só engano visual; revisor_d29_1 e
  challenger_d29_1); o `escapar()` da zona 2 não trata controle, e um título com U+0000, U+000B ou U+007F reprova o bloco inteiro
  (a semente do stub não tem; auditor_d29_1); falta caso positivo de `href` com `%`; `ATRIBUTOS_DA_TAG` deveria ser objeto sem
  protótipo (hoje inofensivo: `TAGS.has` vem antes); fragmento direto na zona 2 sem cookie dá 307 ao `/login` (proxy), não o
  204 que o ADR-0011 (decisão 6) e `02-zonas.md` §2 dizem; a consumidora vê ausência igual (challenger_d29_1).
- **Menores:** o painel pede o fragmento também a quem não tem a zona 2 (um 204 por render); `ZONA2_URL` inválida derruba a
  página na carga; o ADR-0011 (adendo 1) cita o `alvo.md` §6, fora de commit; `atual.md` sem a aresta zona 1 → zona 2; o
  `p:relatorios` do `elementosDoPainel` casa a string exata (falso vermelho com um `title` inocente; usar o `href`); C1a sem o
  caso "nada pendente"; falha de domínio e acesso negado dão o mesmo 204 (intencional).
- **Fecha em:** o `atual.md` com o E4 (roteiro); os limites da lista de permissão, quando o primeiro fragmento novo precisar; a guarda do shell e o `p:relatorios` quando o shell ou o teste forem
  tocados de novo; o resto, um por um, se incomodar.

## D31: Limites declarados do C3 (mapa de zonas vivo e gateway, 2026-10-07, ADR-0015)

- **O que é:** limites aceitos do roteamento híbrido; nenhum é defeito de produto. Evidência em `.superpowers/sdd/2026-10-07-c3-mapa-de-zonas/` (relatórios das tarefas 4 e 5).
- **Corte sem página depois do primeiro byte.** Se a zona manda os cabeçalhos e para no meio, o gateway corta a conexão ao fim de `ERP_ZONA_OCIOSIDADE_MS` e o navegador vê a resposta truncada: o status já saiu e não há como trocá-lo pela página da base. Vale para qualquer repasse com streaming (L9c).
- **Server Action em zona travada.** A Server Action vai pelo caminho rápido (`NextResponse.rewrite`), e no estouro do `proxyTimeout` quem responde é o Next, com o erro cru. Só a navegação de documento tem a página da base.
- **Zona nova entra em instâncias do shell em momentos diferentes.** Cada instância relê o mapa pelo próprio TTL, sem coordenação: uma zona recém-registrada pode responder numa instância e dar 404 em outra por até um TTL mais uma releitura (a releitura não bloqueia quem chega). A zona removida some do mesmo modo. Medido numa instância com TTL de 2 s: zona nova roteada em 2217 ms e removida em 2002 ms (L10, mesma rodada de `verificar:redis` dos demais números).
- **`x-middleware-rewrite` no caminho rápido (decisão do humano, 2026-10-07).** No RSC, nos estáticos e nas Server Actions, o Next anota na resposta ao navegador `x-middleware-rewrite` com a origem interna da zona (`resolve-routes.js:466-469`, `router-server.js:395-397`; nenhuma configuração o remove). Vaza topologia interna, não credencial. Decisão: em produção a borda na frente do shell tira os cabeçalhos `x-middleware-*` da resposta (`docs/arquitetura/infraestrutura-alvo.md`, seções 1, 5 e 8; ADR-0015, adendo); na máquina local é um limite declarado, e a verificação (`base.test.mjs`) só confere que o documento pelo gateway mostra apenas o caminho relativo `/_gateway/...`.
- **`x-forwarded-proto` do navegador é repassado.** O gateway repassa o `x-forwarded-proto` que vier, como o caminho rápido já fazia; o balanceador tem de sobrescrevê-lo (`docs/CONFIGURACAO.md`, nota do `X-Forwarded-Proto`).
- **Fecha em:** a borda de produção (a regra de `x-middleware-*` vira configuração do balanceador); os demais ficam como limites do desenho.

## D32: Menores e observações do C3 (tarefas e gate, 2026-10-07)

- **O que é:** achados sem defeito de produto das revisões das Tarefas 1 a 6 e do gate do C3. Ledger em `ledger/2026-10-07-c3-mapa-de-zonas/`; handoffs em `git show 91fcefc:.agents/<nome>/handoff.md`.
- **Segurança, endurecimento opcional:** a rota interna `/_gateway` não confere uma marca de que o pedido veio do proxy (nenhuma grafia a alcançou no gate; marca por processo é defesa a mais); o `*` do padrão de `ERP_ZONAS_ORIGENS_PERMITIDAS` casa pontos (`zona-*.svc.local` aceita `zona-x.outro-ns.svc.local`), então valer um rótulo só ou avisar na documentação; o domínio aceita qualquer origem no registro e só o shell filtra; `lerOrigensPermitidas` não valida o formato do padrão (padrão sem porta descarta tudo em silêncio); `mapa-zonas.ts` sem `import 'server-only'`.
- **Comportamento a documentar ou ajustar:** sem teto total para uma resposta que pinga bytes devagar (só a ociosidade entre pedaços); mapa vazio legítimo, sem zona registrada, dá 503 para qualquer `/abc` (o 503 devia valer só para vazio por falha); entrada descartada do mapa vira 404, sem documentação; caminho muito longo entra inteiro no log `[zona]`; o fallback de RSC para documento com zona travada não foi executado ponta a ponta.
- **Testes:** o teste de `/_next/data` sem controle positivo; o teste de forma do `registrar-rota.ts` checa `redirect` e `exit` por regex no fonte; a N8 não olha o valor de `redirect`; latência de respostas não 200 entra no p99 do `medir:gateway`; caso com id válido e `supportId` hostil na página de erro.
- **Limpeza:** alias `REGISTRO_DE_MANIFESTO` sem importador; constante `MANIFESTO` e título da varredura JWT no stub; regex do id da zona mais larga que a do token; motivo `DEPLOY_ROTA` da N8 repete o de `DEPLOY`; `01-operacao.md` cita `caseSensitiveRoutes`, que o `next.config.ts` não define; diagrama do proxy no `atual.md` cortado no PDF; ternária morta no `medir-gateway.mjs`.
- **Fecha em:** os de segurança quando o shell ou o stub forem tocados de novo, ou no item F7 (testes de segurança); o resto, um por um, se incomodar.
