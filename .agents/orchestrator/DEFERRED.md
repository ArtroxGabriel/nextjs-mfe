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

## D7 — Zona travada segura a requisição até o `proxyTimeout` do Next

- **Evidência:** zona congelada com `SIGSTOP` logo após uma sonda saudável: a requisição dentro da janela
  de 1 s esperou ~30 s e recebeu 500 cru (3/3); na PoC e de novo no `challenger_shell_1` (~0,6 s com a sonda nova).
- **Por que não foi corrigido:** a alavanca é `experimental.proxyTimeout`, que vale para toda resposta
  repassada, inclusive SSE. Escolher o valor é decisão operacional.
- **Fecha em:** C2 (SSE no shell), junto com o tempo de vida de respostas longas; registrar o valor em
  `docs/desenho/mfe/01-operacao.md` §5.1.

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
