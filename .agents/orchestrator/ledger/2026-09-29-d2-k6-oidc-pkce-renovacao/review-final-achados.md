# Revisão final D2 (final)

Escopo: conjunto das Tasks 1-6 (ADR-0013 + adendos 1 e 2), pacote `review-final.diff` e fontes em `repos/*`. Só leitura.
Rodado: `pnpm test` no núcleo (225/225), no shell (73/73) e no stub (75/75).

**Veredito: pronto após as correções (A).** Nenhum Critical nem Important de produto. As correções (A) são de
documentação, mais um passo novo no ponta a ponta OIDC. Nenhuma exige versão nova do núcleo.

## Parte 1: o conjunto

### Decisões do ADR-0013 × implementação × teste
| Decisão | Estado | Prova |
|---|---|---|
| 1. Porta `iniciar/concluir/renovar/encerrar`; dev com a mesma forma | ok | núcleo `identidade.test`, shell `rotas-auth.test` |
| 2. Leitor das zonas descarta `refreshToken`/`idToken` | **não cumprida** (D17); o ADR afirma como feito | — |
| 3. Transação no store, TTL, uso único (`GETDEL`), cookie `__Host-erp-login` | ok | `rotas-auth.test`, oidc.test (reuso recusado) |
| 4. Janela, `SET NX PX`, perdedor não espera, releitura, `regravar XX`, revogada remove | ok | shell `proxy-renovacao.test` (memória e Redis falso NX), oidc.test (1 gravação no Redis real) |
| 5. `openid-client` só no adaptador, `redirect: 'manual'`, timeout, origem do emissor, N8, adendo 2 | ok | núcleo `http-local.test`, N8 |
| 6. `GET entrar`, `retorno` apaga cookie e cunha id novo, `sair` remove antes, CSP `formularioPara` | ok | `rotas-auth.test`, oidc.test (CSP no shell e na zona) |
| 7. Stub em modo JWT; realm com mapper só no access token, `revokeRefreshToken`, reuso 0; adendo 1 | ok | stub `jwt-verificacao.test` |
| 8. Versão (0.10.2, lockstep nas 4 apps) | ok | `task lockstep` |

Costuras verificadas sem problema:
- O contrato da porta bate com o uso. O proxy só chama `renovarSessao` e trata o `throw` como "segue".
  `entrar`, `retorno` e `sair` têm `try/catch` e normalizam para `{ codigo, supportId }` (inv. 12).
- Lista de inclusão: a zona recebe `IDP_EMISSOR` e `ERP_PERMITIR_HTTP_LOCAL`, mas não `IDP_CLIENTE_SEGREDO`. O
  domínio recebe as variáveis do JWKS.
- Os padrões e tetos de janela, lock, transação e inatividade no código são os de `CONFIGURACAO.md` §1.
- Invariantes 1, 3, 4, 11, 13 e 15 continuam inteiros. Nenhum `NEXT_PUBLIC_*`. Nenhuma zona importa `/shell` nem
  `openid-client`. A ACL das zonas é só `+get` em `erp:sessao:*`, e a transação e o lock ficam fora desse prefixo.

### Achados novos
- **N1 (Minor).** `repos/erp-shell/lib/decisao-proxy.ts:54-55` diz "Um IdP instável não desloga ninguém". Isso só
  vale com o token ainda na janela. Com o token **já vencido** (volta depois de mais de 5 min parado, ou erro
  transitório do IdP com o lock segurando), quem perde o lock e o próprio vencedor que falhou seguem com o token
  vencido. O domínio responde 401, `criarPaginas` trata como `SessaoInvalida` e manda ao login.
  - Corrigir o comentário (A5).
  - Comportamento: (B). A opção seria o perdedor com token vencido reler a sessão por até X ms, o que vai contra
    "quem perde não espera" do ADR e pede decisão.
- **N2 (Minor, anterior ao D2).** `repos/erp-shell/lib/rotas-auth.ts:80`: `POST /api/auth/sair` não confere
  `Origin` nem `Sec-Fetch-Site`. Um formulário de outro site apaga `__Host-session` (logout CSRF; a sessão fica
  órfã no store até o TTL). (B). Correção: recusar com 403 quando `Sec-Fetch-Site` não é `same-origin` (ou quando
  o `Origin` difere do shell). Teste em `rotas-auth.test`.
- **N3 (Minor, configuração).** `ERP_RENOVACAO_LOCK_S` tem de ser maior que a duração de uma renovação, que pode
  chegar a 2 × `ERP_DESTINO_TIMEOUT_MS` (discovery mais token). Se o lock vencer antes, um segundo vencedor usa o
  mesmo refresh token e o Keycloak revoga a sessão inteira (medição 1).
  - Os tetos permitem isso: timeout até 60 s, lock a partir de 1 s.
  - A `verificar:oidc` usa lock de 5 s com o mesmo timeout padrão de 5 s.
  - Documentar em `CONFIGURACAO.md` §1 (A4). Validar em `criarNucleoDoShell` na próxima versão do núcleo (B).
- **N4 (doc).** `docs/desenho/bff/11-testes.md` §3.2 ("Falta: a variante com Redis falso (NX)") e
  `docs/desenho/bff/PENDENCIAS.md:246-247` ("ainda não existe") estão errados: a variante existe em
  `repos/erp-shell/test/proxy-renovacao.test.mjs` (P0-d × `STORES`, com `redisFalso` e `sessaoRedisDeEscrita`).
  Correção em A2.
- **N5 (doc).** A decisão 2 do ADR-0013 diz "O leitor (zonas) descarta" sem ressalva, num ADR marcado como
  "implementado". Correção em A1.

### Correções (A)
- **A1.** ADR-0013, decisão 2: acrescentar "não cumprida no D2: o leitor devolve a sessão inteira; ver
  `DEFERRED.md` D17". Atualizar o "Fecha em" do D17 conforme a triagem. Prova: leitura (é documento).
- **A2.** `11-testes.md` §3.2 e `PENDENCIAS.md` §4: trocar "falta / não existe a variante Redis falso" pela
  referência a `erp-shell/test/proxy-renovacao.test.mjs`. Prova: `cd repos/erp-shell && pnpm test` (P0-d "redis
  falso").
- **A3 (M4 da Task 6).** `base/verificacao/oidc/oidc.test.mjs`, teste "sair":
  - fazer `loginNoKeycloak` devolver o pote de cookies do Keycloak;
  - seguir o 303 com esse pote e afirmar 200, sem "Invalid redirect uri" nem "Invalid parameter";
  - enviar o formulário de confirmação e afirmar o 302 para `IDP_URL_POS_LOGOUT` (`http://localhost:3000/login`);
  - afirmar que um novo `/api/auth/entrar` mostra de novo o formulário de senha (a sessão SSO acabou).

  Ajustar também `docs/ROTEIRO-DE-VERIFICACAO.md:30`: "o Keycloak pede confirmação (a URL não leva
  `id_token_hint`) e volta a `/login`". Prova: `task verificar:oidc`, com 5 testes passando, mais o passo novo.
- **A4.** `docs/CONFIGURACAO.md:19` (`ERP_RENOVACAO_LOCK_S`): "maior que 2 × `ERP_DESTINO_TIMEOUT_MS`; se não for,
  duas renovações com o mesmo refresh token revogam a sessão no IdP". Prova: leitura. A validação no código fica em B.
- **A5.** `repos/erp-shell/lib/decisao-proxy.ts:54-55`: "Com o token ainda válido, um IdP instável não desloga
  ninguém; com o token já vencido, a requisição segue e o domínio responde 401 (login)". Entrada nova no
  `DEFERRED.md` para N1. Prova: `pnpm test` do shell continua com 73/73 (é só o comentário).

## Parte 2: triagem

| Item | Classe | Motivo |
|---|---|---|
| T2 lock de arquivo: tomar o lock velho pode dar dois vencedores | B (D12) | o store de arquivo é de desenvolvimento, com um processo de shell; gatilho: store de arquivo servindo mais de um processo |
| T2 teste de 20 renovações sem Redis falso NX | C | existe em `erp-shell/test/proxy-renovacao.test.mjs` (STORES) e com Redis real no oidc.test; só a doc estava errada (A2) |
| T2 transações vencidas nunca limpas em arquivo e memória | B (D12) | só desenvolvimento e teste; o Redis tem TTL; gatilho: store de arquivo fora do desenvolvimento |
| T2 `sessaoMemoria` sem `validarTtlDoLock` | C | só em `@erp/nucleo/testing`; o TTL de verdade vem de `lerNumeroPositivo` na fábrica e os stores de produção validam |
| T2 `JANELA < VIDA/2` só documentado | B | o núcleo não conhece a vida antes do token; se violado, renova a cada vencimento do lock, sem perder sessão; gatilho: próxima versão do núcleo (validar por sessão) |
| T2 teste de tempo dos perdedores (<200 ms) pode oscilar | B | sem oscilação observada; gatilho: primeira falha intermitente no CI (P1) |
| T2 `fronteira.mjs` usa nomes genéricos | C | falso positivo reprova alto (falha fechada) e nunca deixa escrita passar |
| T2 `identidade-dev` sem `ERP_SESSAO_MAXIMA_S` | C | o teto é do IdP (`CONFIGURACAO.md:16`, quem lê: Keycloak); no OIDC o `refresh_expires_in` já vem limitado; dev não é produção (D18) |
| T3 `urlRetorno` aceita query e fragmento | B | erro só de configuração (todo login vira `null`); correção: `validarUrl(..., true)` em `identidade-oidc.ts:93`; gatilho: próxima versão do núcleo |
| T3 `concluir` trata `invalid_client` como recusa | B | falha fechada; só atrapalha o diagnóstico; junto com "causa descartada"; gatilho: F5 ou P1 |
| T3 porta não documenta que `iniciar`/`concluir` lançam | B | as rotas já têm `try/catch`; ajustar o JSDoc em `portas/identidade.ts:29-31` na próxima versão do núcleo |
| T3 `ehTransitorio` trata todo `TypeError` como transitório | C | sem efeito: no `concluir`, `null` e `ERRO_INTERNO` levam os dois ao login; no `renovar`, todo erro que não é `invalid_grant` já lança |
| T3 causa do erro descartada sem rastro no servidor | B | o log do servidor pode ter a causa sem violar o inv. 12; gatilho: F5 (padronização de erro) ou P1 |
| T3 / M4 Keycloak sem `id_token_hint` no logout | **A** | A3: seguir o logout no oidc.test e corrigir o ROTEIRO A11 |
| T4 `vidaTransacaoS` do shell repete padrão e teto | B | hoje os dois são iguais; gatilho: mudar o padrão ou o teto de `ERP_LOGIN_TRANSACAO_S` no núcleo (ideal: `iniciarLogin` devolve `expiraEm`) |
| T4 cola de `proxy.ts` (`Set-Cookie` no 307) sem teste | B | sem defeito; correção barata: afirmar `Max-Age=0` no laço do N3 em `base.test.mjs:371-374`; gatilho: F6 |
| T4 `GET /api/auth/entrar` grava sem autenticação | B | com `noeviction`, uma enxurrada enche o Redis; defesa: limite de taxa na borda; gatilho: P1 (deploy) |
| T4 resposta atrasada apaga o `__Host-session` novo de outra aba | B | janela rara e o efeito é só um novo login; gatilho: relato de uso ou F4 |
| T4 V1 não vê o chamador no próprio arquivo nem `import()` | B (D14) | mesma classe dos limites declarados dos analisadores; acrescentar à tabela do D14 |
| T4 D18 `/login/dev` aberto em produção sem `IDP_EMISSOR` | B (mantém) | já registrado; fecha em P1 com recusa explícita |
| T5 base64url sem forma canônica | C | a assinatura é verificada sobre os segmentos crus (`jwt.mjs:155`): não há maleabilidade do conteúdo |
| T5 JWKS falha fechado depois do TTL com o IdP fora | B | acrescentar uma linha em `CONFIGURACAO.md` §4; gatilho: próxima mudança em §4 ou E5 |
| T5 intervalo mínimo medido de início a início | B | só com timeout maior que o intervalo; gatilho: validar `ERP_DESTINO_TIMEOUT_MS < ERP_JWKS_INTERVALO_MIN_S` no stub |
| T5 `r.json()` do JWKS sem limite | B | a origem é o emissor confiável; gatilho: domínio real (fora do stub) |
| T5 `azp` não conferido | B | hoje só o cliente `erp-shell` tem o mapper `erp-dominios`; gatilho: segundo cliente no realm (client credentials do adendo 1) |
| T5 varredura de rotas por regex | B (D14) | o piso de 117 chamadas reduz o risco; limite declarado |
| D17 zonas leem `refreshToken`/`idToken` | B (+ A1) | o cliente é confidencial (`IDP_CLIENTE_SEGREDO` só no shell, fora da lista de inclusão da zona) e a ACL da zona não lista chaves; gatilho: cliente público, zona com o segredo, ou P1 |
