# Configuração — todo parâmetro de comportamento, num lugar só

> **Regra (decisão do humano, 2026-09-22):** definições de comportamento, como tempo de sessão,
> timeouts, TTLs e limites, **não ficam fixas no código**. Ficam em configuração visível: variável
> de ambiente ou arquivo de configuração versionado. Cada uma aparece neste documento com o
> significado, o padrão e quem lê. O código só lê o valor e aplica um padrão seguro quando ele falta.
> Parâmetro novo entra aqui no mesmo commit em que entra no código.

Exemplo de ambiente do showcase: [`base/showcase/.env.example`](../base/showcase/.env.example).

## 1. Sessão e identidade

| Variável | Padrão | Significado | Quem lê | Estado |
|---|---|---|---|---|
| `ERP_SESSAO_INATIVIDADE_S` | `1800` | **Sessão por inatividade (30 min).** Tempo sem uso depois do qual a sessão acaba. É a vida do refresh token, que recomeça a cada renovação; no BFF, o TTL da sessão no Redis acompanha o `refresh_expires_in` | Keycloak (`ssoSessionIdleTimeout`, por placeholder no realm); núcleo (`identidadeDev`: vida do refresh token e fim da sessão de dev; `identidadeOidc`: fim da sessão quando o IdP não manda `refresh_expires_in`; teto 86400) | Keycloak ✅; dev ✅ (0.10.0); OIDC ✅ (0.10.0) |
| `ERP_SESSAO_MAXIMA_S` | `36000` | Teto absoluto da sessão (10 h), mesmo com uso contínuo | Keycloak (`ssoSessionMaxLifespan`) | ✅ |
| `ERP_TOKEN_VIDA_S` | `300` | Vida do access token (teto 3600 no `identidadeDev`). O shell renova antes de vencer (ADR-0013) | Keycloak (`accessTokenLifespan`); `identidadeDev` (D2) | Keycloak ✅; dev ✅ (0.8.0) |
| `ERP_RENOVACAO_JANELA_S` | `60` | Renovar quando faltar menos que isto para o token vencer; tem de ser menor que metade de `ERP_TOKEN_VIDA_S`; teto 3600. Conferido por sessão (0.10.3, D20): a vida medida ao gravar fica na sessão (`tokenVidaMs`); se a janela não couber, o núcleo registra a falha no servidor (`{ motivo: 'janela-de-renovacao', codigo, supportId }`, no shell pela linha `[auth] renovacao: …`; sem registrador injetado, o núcleo escreve `[renovacao] … motivo=janela-de-renovacao …`) e usa metade da vida como janela daquela sessão, sem renovar em laço. O registro é **uma vez por sessão, aproximadamente**: a renovação que recebe um token cortado pelo fim da sessão não mede a vida e apaga o campo, e a seguinte registra de novo; num deploy gradual, uma sessão gravada por shell ainda no 0.10.2 também registra de novo (ADR-0013, adendo 3) | núcleo (`criarNucleoDoShell`, na criação; usado por `renovarSessao`, que o proxy do shell chama) | núcleo ✅ (0.10.0; conferida por sessão na 0.10.3); shell ✅ (`proxy.ts`, D2) |
| `ERP_RENOVACAO_LOCK_S` | `15` | Duração do lock de renovação (`SET NX PX`); não há liberação explícita, então é também o intervalo mínimo entre tentativas depois de erro transitório do IdP; teto 300. **Tem de ser maior que 2 × `ERP_DESTINO_TIMEOUT_MS`/1000** (discovery mais troca do token, cada uma até o timeout): se o lock vencer no meio de uma renovação, outra requisição ganha o lock e faz a segunda renovação com o mesmo refresh token, e o Keycloak (detecção de reuso) revoga a sessão inteira. Validado na criação: lock×1000 ≤ 2×timeout é recusado (0.10.3, D20) | núcleo (`criarNucleoDoShell`, na criação) | núcleo ✅ (0.10.0; validação 0.10.3) |
| `ERP_RENOVACAO_ESPERA_MS` | `2000` | Com o token **já vencido**, quanto quem perde o lock de renovação espera o vencedor, relendo a sessão no store a cada `ERP_RENOVACAO_ESPERA_PASSO_MS` (nunca chama o IdP); volta no máximo um passo depois do teto. `0` desliga (volta a seguir com o token vencido). Com o token ainda válido, ninguém espera. Inteiro de 0 a 300000, e **menor que `ERP_RENOVACAO_LOCK_S`×1000**: o padrão de 2000 exige `ERP_RENOVACAO_LOCK_S` ≥ 3 pela regra espera < lock; o lock também tem de passar de 2 × `ERP_DESTINO_TIMEOUT_MS` (com o timeout padrão de 5000, lock ≥ 11). Custo: com o IdP fora, o lock fica preso como backoff e cada requisição com o token vencido espera isto antes de ir ao login; a sessão fica no store e volta quando o IdP voltar (ADR-0013, adendo 3) | núcleo (`criarNucleoDoShell`, na criação; usado por `renovarSessao`) | núcleo ✅ (0.10.3, D19-B) |
| `ERP_RENOVACAO_ESPERA_PASSO_MS` | `50` | Intervalo entre releituras da sessão durante a espera acima. Inteiro de 10 a 300000; **só com a espera ligada** (`ERP_RENOVACAO_ESPERA_MS` > 0) tem de ser menor que ela. Com a espera em `0`, o passo não é comparado | núcleo (`criarNucleoDoShell`, na criação) | núcleo ✅ (0.10.3, D19-B) |
| `ERP_LOGIN_TRANSACAO_S` | `600` | Validade da transação de login (`state`, `code_verifier`, `nonce`); é também o TTL da chave no Redis; teto 3600 | núcleo (provedor de identidade, na criação: `identidadeDev` e `identidadeOidc`). O shell não lê a variável: o `Max-Age` do cookie `__Host-erp-login` vem do `expiraEm` que `iniciarLogin` devolve (0.10.3, D20) | dev ✅ (0.10.0); OIDC ✅ (0.10.0); shell ✅ (`expiraEm` desde a 0.10.3) |
| `IDP_EMISSOR` | — | URL do emissor OIDC. Presente: OIDC; ausente: identidade de desenvolvimento. `https://` obrigatório em produção (exceto loopback com `ERP_PERMITIR_HTTP_LOCAL=1`, ADR-0013 adendo 2) | shell (`lib/nucleo.ts`), que passa a `identidadeOidc({ emissor })`; sem ele, `identidadeDev` e a página `/login/dev`. Shell (`lib/csp.ts`) e zonas (`criarProxy` do núcleo, na criação) tiram dele só a **origem** do IdP para o `form-action` da CSP, que o formulário "Sair" da moldura precisa para seguir o 303 ao logout (ADR-0013, decisão 6); não é segredo e entra na lista de inclusão das zonas. Stub dos domínios: modo JWT (§4) | núcleo ✅ (0.10.0; CSP na 0.10.1); shell ✅ (D2); zonas ✅ (0.10.1); stub ✅ (D2) |
| `IDP_CLIENTE_ID` | `erp-shell` | Cliente confidencial do shell no IdP | shell (`lib/nucleo.ts`), que passa a `identidadeOidc({ clienteId })` | núcleo ✅ (0.10.0); shell ✅ (D2) |
| `IDP_CLIENTE_SEGREDO` | `dev-erp-shell-segredo` (só showcase) | Segredo do cliente. Só no servidor, nunca `NEXT_PUBLIC_*` (invariante 11); fora da máquina local, obrigatório e sem padrão | Keycloak (placeholder no realm); shell (`lib/nucleo.ts`), que passa a `identidadeOidc({ clienteSegredo })`; com `IDP_EMISSOR` e sem segredo, o shell não sobe | Keycloak ✅; núcleo ✅ (0.10.0); shell ✅ (D2) |
| `IDP_URL_RETORNO` | `http://localhost:3000/api/auth/retorno` | URL absoluta de `/api/auth/retorno` do shell, registrada no IdP como `redirect_uri`; sem query nem fragmento. O padrão é o do realm do showcase e usa `http://`, que o núcleo recusa em produção (exceto loopback com `ERP_PERMITIR_HTTP_LOCAL=1`, ADR-0013 adendo 2): fora da máquina local, obrigatória | shell (`lib/nucleo.ts`, só com `IDP_EMISSOR`), que passa a `identidadeOidc({ urlRetorno })` | ✅ (D2) |
| `IDP_URL_POS_LOGOUT` | `http://localhost:3000/login` | Para onde o IdP manda o navegador depois do logout (`post_logout_redirect_uri`, registrada no IdP). Mesma regra de `http://` do item acima | shell (`lib/nucleo.ts`, só com `IDP_EMISSOR`), que passa a `identidadeOidc({ urlPosLogout })` | ✅ (D2) |
| `KEYCLOAK_ADMIN_USUARIO`, `KEYCLOAK_ADMIN_SENHA` | `admin` / `admin` (só showcase) | Administrador inicial do Keycloak | compose; `checar-keycloak.mjs` | ✅ |
| `ERP_PERMITIR_IDENTIDADE_DEV` | — | `1` permite `identidadeDev` com `NODE_ENV=production` (só verificação local) | núcleo | ✅ |
| `ERP_PERMITIR_HTTP_LOCAL` | — (desligado) | `1` (valor exato) aceita `http://` com `NODE_ENV=production` **só para host de loopback** (`localhost`, `127.0.0.1`, `[::1]`): emissor, `IDP_URL_RETORNO` e `IDP_URL_POS_LOGOUT` do OIDC e a origem do IdP no `form-action` da CSP. Qualquer outro host `http://` continua recusado em produção, com ou sem ela. Existe para a base verificar o build de produção contra o Keycloak local (ADR-0013, adendo 2). **Só o showcase e a verificação ligam** (`task showcase:oidc`, `task verificar:oidc`); os scripts `build`/`start` das apps nunca. Fora da máquina local, não defina | núcleo (`borda/http-local.ts`: `identidadeOidc` e CSP do shell e das zonas, na criação); stub dos domínios (§4); entra na lista de inclusão de zonas e domínios | ✅ (núcleo 0.10.2) |
| `SESSAO_DIR` | temporário | Pasta do store de sessão em arquivo (desenvolvimento; some com o Redis) | núcleo, apps | ✅ |
| `REDIS_URL` | — | Store de sessão (ADR-0002). Definido: shell grava e zonas leem no Redis; ausente: arquivo em `SESSAO_DIR`. Leva a senha do usuário de escrita, que só o shell conhece. O showcase usa `redis://default:dev-shell-escrita@127.0.0.1:6379` | apps (`lib/redis.ts`) | ✅ D1 |
| `REDIS_URL_ZONA` | — (obrigatório com `REDIS_URL`) | Conexão das **zonas** ao Redis, com um usuário ACL que só tem `GET` em `erp:sessao:*` (invariante 15). Sem fallback: com `REDIS_URL` e sem ele, a zona recusa ler sessão (erro na carga de `lib/redis.ts`) em vez de conectar com o usuário de escrita do shell | zonas (`lib/redis.ts`) | ✅ |
| `ERP_REDIS_SENHA_SHELL` | `dev-shell-escrita` (só showcase) | Senha do usuário `default` (escrita) no Redis do showcase. Sem senha, quem soubesse o endereço gravaria sessão | `docker-compose` do showcase | ✅ |
| `ERP_REDIS_SENHA_ZONA` | `dev-zona-leitura` (só showcase) | Senha do usuário `zona` no Redis do showcase | `docker-compose` do showcase | ✅ |

## 2. Rede, destinos e zonas

| Variável | Padrão | Significado | Quem lê | Estado |
|---|---|---|---|---|
| `DOMINIO_A_URL`, `DOMINIO_B_URL`, `DOMINIO_C_URL`, `DOMINIO_PLATAFORMA_URL` | `http://127.0.0.1:400x` | Origem de cada domínio no registro de destinos | apps | ✅ |
| `ACESSO_URL` | `http://127.0.0.1:4020` | Gestão de acesso v2 (`GET /v2/eu`; manifesto em `/v2/modulos/manifesto`). Sem volta para a v1 (ADR-0014, adendo 1) | apps, `registrar-manifesto` das zonas 1 e 2 | ✅ (núcleo 0.9.0) |
| `ERP_TOKEN_SERVICO` | dev | Token de serviço para registrar o manifesto | `registrar-manifesto` | ✅ |
| `SHELL_HOSTS` | `localhost:3000` | Hosts aceitos como origem do shell, separados por vírgula; espaço em volta de cada host é ignorado (`a.exemplo, b.exemplo:8443`) e item vazio some. No shell: páginas e `POST /api/auth/sair`; nas zonas: páginas (`hostsPermitidos`) e Server Actions (`allowedOrigins` do `next.config.ts`). Uma leitura só por app (`lerHostsDoShell`). Atrás de um proxy que termina TLS, ver a nota sobre `X-Forwarded-Proto` abaixo da tabela | shell (`lib/configuracao.ts`); zonas (`lib/hosts-do-shell.ts`) | ✅ (espaço aceito no shell e nas zonas desde a D19-B) |
| `ERP_DESTINO_TIMEOUT_MS` | `5000` | Timeout de uma chamada a domínio e de cada requisição ao IdP (discovery, token); teto 60000. No shell, `criarNucleoDoShell` também o lê, na criação, e recusa `ERP_RENOVACAO_LOCK_S`×1000 ≤ 2 × este valor (§1): subir o timeout pode exigir subir o lock | núcleo (`interno/destinos.ts`; `identidadeOidc` e `criarNucleoDoShell`, na criação); stub dos domínios (JWKS, §4) | ✅ (teto na 0.9.0; IdP na 0.10.0; regra do lock na 0.10.3; stub no D2) |
| `ERP_FRAGMENTO_TIMEOUT_MS` | `2000` | Timeout de um fragmento entre zonas; teto 30000 | núcleo (`fabricas/fragmento.ts`) | ✅ (teto na 0.9.0) |
| `ERP_SONDA_TTL_MS` | `1000` | Por quanto tempo o shell confia no resultado da sonda de saúde de uma zona; teto 10000 | shell (`lib/saude-zonas.ts`) | ✅ (B5a) |
| `ERP_SONDA_TIMEOUT_MS` | `500` | Timeout da sonda de saúde; teto 2000 (zona travada vira 503 em menos de 2 s). Só 2xx de `/{zona}/api/health` conta como no ar | shell | ✅ (B5a) |

**Proxy que termina TLS (`X-Forwarded-Proto`).** O proxy na frente do shell tem de **definir** `X-Forwarded-Proto` com o
esquema que o navegador usou, sobrescrevendo o que vier do cliente. O Next monta a URL da requisição com esse cabeçalho, e o
`POST /api/auth/sair` compara o esquema do `Origin` com o dela quando o navegador não manda `Sec-Fetch-Site`. Sem o cabeçalho, o
navegador que não manda `Sec-Fetch-Site` leva `403` no sair. Forjar o cabeçalho só muda a checagem da requisição de quem forja:
não abre CSRF nem é destino de rede.

## 3. Telemetria

| Variável | Padrão | Significado | Quem lê | Estado |
|---|---|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Coletor OTLP para onde o gateway do shell repassa | shell | ✅ |
| `ERP_TELEMETRIA_MAX_BYTES` | `262144` | Tamanho máximo de um lote (256 KB); teto 1 MiB | shell (`lib/telemetria.ts`) | ✅ (B5a) |
| `ERP_TELEMETRIA_LOTES_POR_MINUTO` | `60` | Lotes por minuto por usuário; teto 600 | shell | ✅ (B5a) |

## 4. Domínios falsos (stub)

| Variável | Padrão | Significado | Estado |
|---|---|---|---|
| `DADOS_DIR` | — | Com valor, cada domínio grava o estado em `<DADOS_DIR>/<dominio>.json` (showcase); sem, parte da semente em memória | ✅ (E1) |
| `IDP_EMISSOR` | — | **Um modo por processo** (ADR-0013, decisão 7). Presente: o domínio só aceita o access token do IdP (JWT RS256, chave do JWKS do emissor, `iss` igual a este valor, `aud` com `erp-dominios`, `exp`/`nbf`, `preferred_username` = ator) e recusa o token dev; ausente: só o token dev, e todo JWT é recusado. O JWKS vem do discovery do emissor e só da origem dele; `http://` só fora de produção (exceto loopback com `ERP_PERMITIR_HTTP_LOCAL=1`, ADR-0013 adendo 2). Token de serviço `svc.<aplicacao>`, que não tem segredo: sem `IDP_EMISSOR`, vale em toda rota que o aceita (simula os serviços da gestão de acesso: `primeiro-acesso`, `decisoes`, `eventos`, registro de manifesto); com ele, **só** no registro do manifesto do próprio módulo (id = nome do serviço), e em toda outra rota é `401` (ADR-0013, adendo 1). Lido na subida (`src/jwt.mjs`) | ✅ (D2) |
| `ERP_DESTINO_TIMEOUT_MS` | `5000` | Mesma variável do §2, com o mesmo sentido (cada requisição ao IdP): timeout do discovery e do JWKS; teto 60000 | ✅ (D2) |
| `ERP_JWKS_TTL_S` | `300` | Por quanto tempo as chaves do JWKS valem no cache; vencido, a próxima requisição busca de novo; teto 86400 | ✅ (D2) |
| `ERP_JWKS_INTERVALO_MIN_S` | `30` | Intervalo mínimo entre duas buscas ao JWKS, inclusive por `kid` desconhecido ou depois de falha: um `kid` escolhido pelo atacante não multiplica as buscas ao IdP. Não pode passar de `ERP_JWKS_TTL_S`; teto 3600 | ✅ (D2) |
| `ERP_JWT_TOLERANCIA_S` | `5` | Tolerância de relógio para `exp` e `nbf`, em segundos; `0` desliga; teto 60 | ✅ (D2) |
| `ERP_PERMITIR_HTTP_LOCAL` | — | Mesma variável do §1: com `1`, o emissor `http://` de loopback vale com `NODE_ENV=production` (regra espelhada em `src/jwt.mjs`, o stub não depende do núcleo) | ✅ (D2) |

## 5. Como um valor chega a cada peça

- **Keycloak:** `base/showcase/docker-compose.yml` repassa as variáveis `ERP_*` ao contêiner, e o realm
  (`keycloak/realm-erp.json`) as lê por placeholder (`${ERP_SESSAO_INATIVIDADE_S}`) no import. Mudou o
  valor: recrie o contêiner (`docker compose ... up -d --force-recreate keycloak`).
- **Apps Next:** leem no servidor (`process.env`), nunca com prefixo `NEXT_PUBLIC_` quando é credencial ou endpoint interno.
- **Zonas e domínios falsos recebem o ambiente por lista de inclusão** (`AMBIENTE_PERMITIDO` em
  `base/scripts/ambiente.mjs`), em todas as fases (build, start, registrar): só as variáveis que cada um lê.
  O shell é o único que recebe o ambiente inteiro, porque só ele grava sessão; assim `REDIS_URL`,
  `ERP_REDIS_SENHA_SHELL` ou qualquer variável nova com o segredo de escrita não chegam às zonas (invariante 15).
  Variável nova lida por zona ou domínio entra na lista no mesmo commit; o teste da lista reprova se faltar.
  O teste conta, no núcleo, só o que a zona carrega (os subpaths menos `/shell`); leitura dentro de função que só o
  shell chama (`ERP_RENOVACAO_JANELA_S`, `ERP_RENOVACAO_LOCK_S`, `ERP_RENOVACAO_ESPERA_MS`, `ERP_RENOVACAO_ESPERA_PASSO_MS`, `ERP_LOGIN_TRANSACAO_S`) fica em `LIDAS_SO_NO_SHELL`
  (`base/scripts/ambiente.test.mjs`), com o motivo, e o teste prova que a função não é usada pelo que a zona carrega.
- **Padrão:** vale quando a variável falta. Valor inválido (não inteiro, fora da faixa, regra entre duas variáveis violada)
  é erro com o nome da variável, nunca outro valor em silêncio.
- **Quando o erro aparece.** Nas apps Next, a validação roda quando o módulo que lê a variável é carregado, e o `next start`
  carrega os módulos na primeira requisição que precisa deles, não na subida. O processo sobe e escuta a porta; a
  primeira requisição (e cada uma depois dela) responde `500`, com a mensagem no log do servidor. Conferido em
  2026-10-05 com `ERP_RENOVACAO_ESPERA_MS=abc` no shell construído: porta aberta, `/login` e `/zona1` em `500`,
  `configuracao invalida: ERP_RENOVACAO_ESPERA_MS …` no log. Depois de mudar configuração, faça uma requisição antes de
  dar o deploy por bom (a sonda de saúde do shell, `/{zona}/api/health`, não lê configuração e não serve para isso). Os
  domínios falsos (§4) leem na subida.

Todas as variáveis do D2 (login OIDC e renovação, ADR-0013) estão em uso desde o núcleo 0.10.1 (2026-10-03).
B5a (shell) e B5b (núcleo 0.8.0) já tinham tirado do código os tempos e limites marcados "✅".

**Modo OIDC na máquina local:** `next start` roda em produção, e o Keycloak do showcase é `http://`. As tarefas
`task showcase:oidc` e `task verificar:oidc` definem `IDP_EMISSOR`, `IDP_CLIENTE_SEGREDO` (o padrão do compose) e
`ERP_PERMITIR_HTTP_LOCAL=1` (ADR-0013, adendo 2). `task showcase` e `task verificar` seguem no login de desenvolvimento.

## 6. Ferramentas de medição e de verificação

| Variável | Padrão | Significado | Quem lê |
|---|---|---|---|
| `MEDIR_N` | `1000` | Requisições por cenário em `task medir:proxy` (mínimo 10), depois de até 100 de aquecimento | `base/scripts/medir-proxy.mjs` |
| `VERIFICAR_OIDC_TOKEN_VIDA_S` | `20` | Vida do access token do cliente `erp-shell` durante `task verificar:oidc`: o teste a grava no Keycloak pela API de administração (atributo `access.token.lifespan`) e a tira no fim, voltando à do realm (`ERP_TOKEN_VIDA_S`); se a verificação morrer no meio, `task showcase:recriar-keycloak` reimporta o realm. A tarefa usa `ERP_RENOVACAO_JANELA_S=5` e `ERP_RENOVACAO_LOCK_S=5`, que cabem nela; mínimo 10 e mais que o dobro da janela | `base/verificacao/oidc/oidc.test.mjs` |
| `ERP_DESTINO_TIMEOUT_MS` (na tarefa `verificar:oidc`) | `5000` (§2); a tarefa fixa `2000` | A tarefa baixa para 2 s para o lock de 5 s passar da regra lock > 2 × timeout (§1); vale para shell, zonas e stub (JWKS) durante a tarefa | `Taskfile.yml` (`verificar:oidc`) |
| `ERP_RENOVACAO_ESPERA_MS` (na tarefa `verificar:oidc`) | `2000` (§1); a tarefa fixa `4000` | Abaixo do lock de 5 s (a espera tem de ser menor que ele) e acima do timeout de 2 s: um refresh lento do Keycloak não vira `307` para quem perdeu o lock no teste do token vencido | `Taskfile.yml` (`verificar:oidc`) |
| `VERIFICAR_OIDC_EXIGIR` | vazio (`1` na tarefa) | Com `1`, `base/verificacao/oidc/*.test.mjs` falha em vez de pular quando falta uma pré-condição (Keycloak fora do ar, `IDP_EMISSOR` diferente do do showcase, `ERP_PERMITIR_HTTP_LOCAL` ou `REDIS_URL` ausentes, vida do token incompatível com a janela). `task verificar:oidc` a define: no gate, verde quer dizer rodado. Fora da tarefa (`node --test` à mão) o arquivo pula | `base/verificacao/oidc/oidc.test.mjs` |

