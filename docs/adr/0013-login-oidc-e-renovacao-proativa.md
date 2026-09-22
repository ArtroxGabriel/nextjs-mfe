# ADR-0013 — Login OIDC e renovação proativa no shell

**Status:** proposto (2026-09-22), decisão do `arquiteto-mfe`; implementação no item D2 do plano, depois de B1 e D1.
**Substitui:** ADR-0009, decisão 3 (endpoint interno do shell que a zona chamaria para renovar).

## Contexto

O showcase usa Keycloak (`base/showcase/`): access token de 300 s, sessão de 1800 s. Sem renovação, o domínio
responde `401` aos 5 min e o usuário volta ao login — a resposta muda, então é **núcleo** (elemento 1, sessão
opaca no servidor), não extensão. A porta atual, `ProvedorDeIdentidade.autenticar(credencial)`, não serve para
um fluxo com redirecionamento.

## Decisão

1. **Porta nova** (`portas/identidade.ts`, exportada por `@erp/nucleo/shell`): `iniciar()` →
   `{ url, transacao }`; `concluir(retorno, transacao)` → sessão ou `null`; `renovar(s)` → `renovada` |
   `revogada` (`invalid_grant`); erro transitório **lança**; `encerrar(s)` → URL de logout no IdP ou `null`.
   `autenticar` sai. `identidadeDev` segue a mesma forma (`/login/dev?state=…`, token de vida configurável),
   para a verificação ponta a ponta exercitar o mesmo código de transação.
2. **Sessão:** `expiraEm` continua sendo o fim da sessão (invariante 14). Campos novos só do escritor:
   `tokenExpiraEm`, `refreshToken?`, `idToken?`. O leitor (zonas) descarta `refreshToken` e `idToken`.
3. **Transação de login** (`state`, `code_verifier`, `nonce`, destino) guardada **no store de sessão**, TTL
   10 min, uso único; o navegador leva só um id opaco em `__Host-erp-login`. Cookie assinado recusado (segredo
   novo, sem uso único).
4. **Renovação proativa e serializada no `proxy.ts` do shell** (toda requisição a zona passa por ele): se o
   token vence em menos de 60 s, `SET NX PX` de 15 s; quem perde **não espera**; quem ganha **relê** a sessão
   (evita reusar refresh token com rotação), renova e grava; `revogada` remove a sessão; erro transitório
   mantém a sessão e segura o lock (backoff). O lock não é liberado explicitamente. O `criarProxy` das zonas
   continua sem I/O; zona nenhuma renova (invariante 15).
5. **`openid-client` v6** como `peerDependency` opcional do núcleo, importado só por
   `adaptadores/identidade-oidc.ts` (`server-only`, só em `/shell`); `customFetch` com `redirect: 'manual'` e
   timeout; todo endpoint do discovery com a origem do emissor; `http://` só fora de produção. O IdP **não**
   entra no registro de destinos (semântica de transporte errada para o token endpoint); o N8 passa a recusar
   `openid-client` importado direto por app.
6. **Shell:** `GET /api/auth/entrar` (link, não formulário: `form-action 'self'` barra o 303 para o IdP
   depois de um POST), `GET /api/auth/retorno` (apaga sempre o cookie de transação; id de sessão novo; destino
   vem da transação), `sair` remove do store antes de pedir a URL ao IdP. A CSP ganha
   `politicaDeSeguranca(nonce, { formularioPara })` para o logout.
7. **Stub dos domínios:** um modo por processo — com `IDP_EMISSOR`, só JWT (JWKS com `node:crypto`, só RS256,
   `iss`, `exp`/`nbf`, `aud` contém `erp-dominios`, cache por `kid`); sem ele, só token dev. Ator =
   `preferred_username`. Realm ganha o mapper de audiência `erp-dominios`, `revokeRefreshToken: true` e
   `refreshTokenMaxReuse: 0`.
8. **Versão:** núcleo **0.8.0** (quebra a porta), nas 4 apps no mesmo commit (ADR-0012, decisão 6).

## Consequências

- Testes exigidos (lista completa no handoff do arquiteto, resumida em `RETOMADA.md`): 20 renovações
  concorrentes → exatamente uma chamada ao IdP (P0-d), com memória e com Redis falso com NX; mutação que remove
  a releitura tem de ser pega; transação de uso único; `concluir` recusa `state`/`iss`/`nonce` divergentes;
  stub recusa `alg: none`, HS256 com a chave pública, `aud`/`iss`/`exp` errados; varredura de `refresh_token`,
  `id_token` e `eyJ` no HTML/JS; na verificação, página de zona ainda 200 depois do vencimento do primeiro token.
- Custo: um `GET` no Redis por requisição dinâmica do shell — medir o p95 do proxy antes e depois.
- Documentos a atualizar na implementação: `AGENTS.md` (invariantes 4 e 15), `02-nucleo.md` §2.1/§2.2/§6,
  `03-extensoes.md` §3.1, ADR-0002 (nota do lock), ADR-0009 (decisão 3 substituída), `PENDENCIAS.md` §4,
  `06-seguranca.md`, `11-testes.md`, `mfe/01-operacao.md` §3, `mfe/00-arquitetura.md` §12.2, `atual.md`/`alvo.md`.

## Em aberto

1. Reuso de refresh token no Keycloak 26 com rotação: a segunda renovação concorrente só falha ou derruba a
   sessão? Medir no showcase.

## Decidido depois (humano, 2026-09-22)

- **Sessão por inatividade**, não absoluta: 30 min sem uso encerram a sessão. A inatividade é capturada
  pelos refresh tokens: o refresh token vale `ERP_SESSAO_INATIVIDADE_S` e recomeça a cada renovação; o TTL da
  sessão no Redis acompanha o `refresh_expires_in` a cada gravação. Teto absoluto em `ERP_SESSAO_MAXIMA_S`.
  Conferido no Keycloak (`base/showcase/checar-keycloak.mjs`: `refresh_expires_in` = 1800).
- **Nenhum tempo desta decisão fica fixo no código:** janela de renovação, lock, transação de login, vida do
  token e inatividade são variáveis de ambiente documentadas em `docs/CONFIGURACAO.md` §1; os números da
  seção "Decisão" acima são os padrões.
