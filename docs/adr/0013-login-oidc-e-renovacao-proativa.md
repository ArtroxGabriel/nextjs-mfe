# ADR-0013 — Login OIDC e renovação proativa no shell

**Status:** aceito (humano, 2026-09-23), com os **adendos 1 e 2** no fim (humano, 2026-10-03); proposto em 2026-09-22 pelo `arquiteto-mfe`; **implementado no D2** (núcleo 0.10.2, 2026-10-03), verificado ponta a ponta contra o Keycloak do showcase (`task verificar:oidc`).
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
   *Ressalva (revisão final do D2, 2026-10-05):* não cumprida; o leitor devolve a sessão inteira. Ver
   `.agents/orchestrator/DEFERRED.md` D17.
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
   timeout; todo endpoint do discovery com a origem do emissor; `http://` só fora de produção (exceto loopback
   com `ERP_PERMITIR_HTTP_LOCAL=1`, adendo 2). O IdP **não**
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
8. **Versão:** núcleo **0.10.0** (quebra a porta), nas 4 apps no mesmo commit (ADR-0012, decisão 6). O texto original dizia 0.8.0; o adendo 1 do ADR-0014 (item 9) pôs o G3 antes, no 0.9.x.

## Consequências

- Testes exigidos (lista completa no handoff do arquiteto, resumida em `RETOMADA.md`): 20 renovações
  concorrentes → exatamente uma chamada ao IdP (P0-d), com memória e com Redis falso com NX; mutação que remove
  a releitura tem de ser pega; transação de uso único; `concluir` recusa `state`/`iss`/`nonce` divergentes;
  stub recusa `alg: none`, HS256 com a chave pública, `aud`/`iss`/`exp` errados; varredura de `refresh_token`,
  `id_token` e `eyJ` no HTML/JS; na verificação, página de zona ainda 200 depois do vencimento do primeiro token.
- Custo: um `GET` no Redis por requisição dinâmica do shell — medir o p95 do proxy antes e depois.
  **Medido em 2026-10-03** (`task medir:proxy`, `base/scripts/medir-proxy.mjs`): base em modo produção com a
  sessão no Redis do showcase, rota `/zona1`, 1000 requisições em série por cenário depois de 100 de aquecimento,
  duas rodadas. "Antes" é o proxy sem leitura (sem cookie → 307); "depois", o mesmo 307 com uma leitura
  (cookie de sessão inexistente: `renovarSessao` lê o store e devolve `ausente`).

  | Cenário | p50 | p95 | p99 |
  |---|---|---|---|
  | sem cookie, 0 leituras (307) | 1,54–1,60 ms | 2,56–2,61 ms | 3,66–3,94 ms |
  | cookie, 1 leitura do Redis (307) | 2,34–2,36 ms | 2,87–3,00 ms | 3,43–4,27 ms |
  | sessão válida: 1 leitura + página da zona (200) | 14,9 ms | 19,4–19,8 ms | 25,4–25,7 ms |

  A leitura soma ~0,8 ms no p50 e 0,3–0,4 ms no p95, menos de 2 % do p95 de uma página. Ressalvas: uma
  máquina de desenvolvimento (i7-13620H, 16 núcleos, Redis em Docker no loopback), uma requisição por vez,
  sem renovação no meio (o token não entrou na janela); com Redis em outra máquina, soma-se o RTT da rede.
  O "antes" de verdade (núcleo 0.9.2, sem leitura nenhuma no proxy) não foi medido: o cenário sem cookie
  isola o mesmo custo.
- Documentos a atualizar na implementação: `AGENTS.md` (invariantes 4 e 15), `02-nucleo.md` §2.1/§2.2/§6,
  `03-extensoes.md` §3.1, ADR-0002 (nota do lock), ADR-0009 (decisão 3 substituída), `PENDENCIAS.md` §4,
  `06-seguranca.md`, `11-testes.md`, `mfe/01-operacao.md` §3, `mfe/00-arquitetura.md` §12.2, `atual.md`/`alvo.md`.

## Em aberto

1. ~~Reuso de refresh token no Keycloak 26 com rotação: a segunda renovação concorrente só falha ou derruba a
   sessão? Medir no showcase.~~ **Respondido:** derruba. Uma renovação `200`, a outra `400 invalid_grant`
   ("Maximum allowed refresh token reuse exceeded"), e depois disso o access token novo dá `401` no
   `userinfo` e o refresh token novo dá `invalid_grant` ("Session doesn't have required client")
   ([medição 1](../../base/showcase/medicao-refresh-concorrente.md), 2026-09-23; repetida com o mesmo
   resultado em 2026-10-03). O lock com releitura (decisão 4) é o que impede isso. Pelo shell de verdade
   (`base/verificacao/oidc/oidc.test.mjs`): 20 requisições concorrentes com o token na janela (conferida no
   Redis antes do lote), todas `200`, a sessão gravada uma vez só, com refresh token novo e `tokenExpiraEm`
   adiante, e a renovação seguinte com o refresh token que sobrou funciona: a sessão não caiu. O teste reprova
   se o proxy só renovar token vencido (nenhuma gravação no lote) e se o lock sair (a sessão cai).
2. ~~**Base em modo OIDC na máquina local**~~ (achado da Task 6 do D2, 2026-10-03): a decisão 5 recusava o
   Keycloak `http://` do showcase com a base em `next start` (o shell dava 500 em toda rota). **Resolvido pelo
   adendo 2.**

## Decidido depois (humano, 2026-09-22)

- **Sessão por inatividade**, não absoluta: 30 min sem uso encerram a sessão. A inatividade é capturada
  pelos refresh tokens: o refresh token vale `ERP_SESSAO_INATIVIDADE_S` e recomeça a cada renovação; o TTL da
  sessão no Redis acompanha o `refresh_expires_in` a cada gravação. Teto absoluto em `ERP_SESSAO_MAXIMA_S`.
  Conferido no Keycloak (`base/showcase/checar-keycloak.mjs`: `refresh_expires_in` = 1800).
- **Nenhum tempo desta decisão fica fixo no código:** janela de renovação, lock, transação de login, vida do
  token e inatividade são variáveis de ambiente documentadas em `docs/CONFIGURACAO.md` §1; os números da
  seção "Decisão" acima são os padrões.

## Adendo 1 (2026-10-03) — token de serviço no stub em modo JWT

Decisão do humano na revisão da Task 5 do D2 (opção a). Emenda a decisão 7.

**Achado que motivou o adendo.** Em modo JWT (`IDP_EMISSOR` definido), o stub seguia aceitando `Bearer svc.<app>`
em qualquer rota, e esse token não tem segredo nenhum: basta escrever `svc.idp` para chamar
`POST /v2/primeiro-acesso` (liga um `sub` qualquer a uma pessoa pelo CPF e a ativa), `svc.<qualquer>` para
`POST /v2/decisoes` e `GET /v2/eventos`, e qualquer rota de domínio passava da checagem de credencial. A decisão 7
dizia "com `IDP_EMISSOR`, só JWT", e a primeira implementação leu isso como "só JWT para usuário".

1. **Em modo JWT, o token de serviço vale só para registrar o manifesto do próprio módulo.** As rotas de registro
   (`POST /v2/modulos/manifesto`; na v1, `POST /v1/manifestos`) admitem `svc.<app>`, e o domínio continua
   exigindo que o id do manifesto seja o nome do serviço (id do módulo = id da zona = nome do serviço, ADR-0014,
   adendo 1): `svc.zona1` só registra `zona1`; outro id é `403`.
2. **Todo outro uso de token de serviço é recusado nesse modo**, com o mesmo `401` normalizado de credencial
   ausente: inclusive `svc.idp` e as rotas `primeiro-acesso`, `decisoes` e `eventos`, e toda rota dos domínios
   de negócio.
3. **Sem `IDP_EMISSOR` (modo de desenvolvimento), nada muda:** o token de serviço segue valendo onde valia, como
   simulação dos serviços da API proposta de gestão de acesso.

**Por quê.** O script de deploy `registrar-manifesto.ts` (zonas 1 e 2) não tem identidade no IdP: ainda não há
fluxo de *client credentials*. Recusar o `svc.` também no registro quebraria a subida do showcase em modo OIDC.
O substituto previsto é um cliente de serviço por zona no IdP, com *client credentials*, e o domínio verificando
esse token como verifica o do usuário; aí o `svc.` sai do modo JWT.

**Risco residual.** O token continua sem autenticação: em modo JWT, quem alcança o domínio pelo loopback ainda pode
registrar de novo o manifesto de um módulo sob o id daquele módulo (e só dele). Os domínios nunca ficam expostos à
internet e recusam requisição com cabeçalho de navegador (invariante 10); o alcance é o da própria máquina.

**Verificação.** `erp-dominio-stub/test/jwt-verificacao.test.mjs`: varre toda rota declarada em todo domínio e
exige `401` para `svc.idp`, `svc.zona1` e `svc.acesso`, menos nas rotas de registro; registro com o próprio id
aceito (`200` na v2, `204` na v1) e com outro id `403`.

## Adendo 2 (2026-10-03) — `http://` de loopback em produção, só com flag

Decisão do humano na Task 6 do D2 (opção a). Emenda a decisão 5.

**Achado que motivou o adendo.** A base verifica o **build de produção** (`next start`, `NODE_ENV=production`), e a
decisão 5 recusa `http://` em produção. O Keycloak do showcase é `http://127.0.0.1:8080` e o shell local é
`http://localhost:3000`: com `IDP_EMISSOR` definido, a CSP do proxy lançava na carga e o shell respondia 500 em toda
rota; as zonas recusavam o mesmo valor e o `identidadeOidc` recusaria o emissor e as URLs de retorno. O caminho OIDC
nunca tinha rodado pelo shell construído.

1. **`ERP_PERMITIR_HTTP_LOCAL=1`** (valor exato, como `ERP_PERMITIR_IDENTIDADE_DEV`) aceita `http://` em produção
   **só para host de loopback**: `localhost`, `127.0.0.1` e `[::1]`, comparados por igualdade com o host já
   normalizado pelo `URL`. Vale para o emissor, `IDP_URL_RETORNO` e `IDP_URL_POS_LOGOUT` (`identidadeOidc`) e para a
   origem do IdP no `form-action` da CSP. `127.0.0.1.evil.example`, `localhost.example`, `localhost.`,
   `http://localhost@evil.example` (host `evil.example`) e qualquer outro host continuam recusados, com ou sem a flag.
2. **Uma regra só:** `@erp/nucleo` `borda/http-local.ts` (`httpPermitido`), usada pelo adaptador e pela CSP; o stub
   dos domínios, que não depende do núcleo, espelha a mesma regra para o emissor do JWKS (`src/jwt.mjs`), com teste
   próprio. Núcleo **0.10.2**, lockstep nas 4 apps.
3. **Sem a flag, nada muda.** Ela entra na lista de inclusão de zonas e domínios, e **só as tarefas do showcase e da
   verificação a ligam** (`task showcase:oidc`, `task verificar:oidc`); os scripts `build`/`start` das apps, não.

**Por quê.** A base verifica localmente o que vai para produção; trocar para `next dev` deixaria de verificar o build,
e TLS local exigiria certificado e proxy por máquina. A exceção fica estreita: só loopback, desligada por padrão.

**Risco residual.** Um deploy que defina a flag por engano aceita IdP `http://` em loopback, onde o tráfego não sai da
máquina; um IdP de verdade nunca está em loopback, então a configuração errada falha do mesmo jeito que antes. Não há
recusa ativa da flag fora da máquina local (não há como o núcleo saber onde roda); a defesa é a documentação
(`docs/CONFIGURACAO.md` §1) e a flag nunca estar nos scripts das apps.

**Verificação.** `erp-nucleo/test/http-local.test.mjs` (regra, CSP e adaptador: flag + loopback aceito, flag + outro
host recusado, sem flag nem loopback passa em produção, hosts enganosos e formas IPv6; 9 mutações pegas);
`erp-dominio-stub/test/http-local.test.mjs` (4 mutações pegas); `base/verificacao/oidc/oidc.test.mjs` (a base em modo
OIDC contra o Keycloak).
