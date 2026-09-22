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
| `ERP_SESSAO_INATIVIDADE_S` | `1800` | **Sessão por inatividade (30 min).** Tempo sem uso depois do qual a sessão acaba. É a vida do refresh token, que recomeça a cada renovação; no BFF, o TTL da sessão no Redis acompanha o `refresh_expires_in` | Keycloak (`ssoSessionIdleTimeout`, por placeholder no realm); núcleo (D2) | Keycloak ✅; núcleo ⬜ D2 |
| `ERP_SESSAO_MAXIMA_S` | `36000` | Teto absoluto da sessão (10 h), mesmo com uso contínuo | Keycloak (`ssoSessionMaxLifespan`) | ✅ |
| `ERP_TOKEN_VIDA_S` | `300` | Vida do access token (teto 3600 no `identidadeDev`). O shell renova antes de vencer (ADR-0013) | Keycloak (`accessTokenLifespan`); `identidadeDev` (D2) | Keycloak ✅; dev ✅ (0.8.0) |
| `ERP_RENOVACAO_JANELA_S` | `60` | Renovar quando faltar menos que isto para o token vencer; tem de ser menor que metade de `ERP_TOKEN_VIDA_S` | núcleo, proxy do shell (D2) | ⬜ D2 |
| `ERP_RENOVACAO_LOCK_S` | `15` | Duração do lock de renovação (`SET NX PX`) | núcleo (D2) | ⬜ D2 |
| `ERP_LOGIN_TRANSACAO_S` | `600` | Validade da transação de login (`state`, `code_verifier`) | núcleo (D2) | ⬜ D2 |
| `IDP_EMISSOR` | — | URL do emissor OIDC. Presente: OIDC; ausente: identidade de desenvolvimento | shell (D2); stub dos domínios | ⬜ D2 |
| `IDP_CLIENTE_ID` | `erp-shell` | Cliente confidencial do shell no IdP | shell (D2) | ⬜ D2 |
| `IDP_CLIENTE_SEGREDO` | `dev-erp-shell-segredo` (só showcase) | Segredo do cliente. Só no servidor, nunca `NEXT_PUBLIC_*` (invariante 11); fora da máquina local, obrigatório e sem padrão | Keycloak (placeholder no realm); shell (D2) | Keycloak ✅; shell ⬜ D2 |
| `KEYCLOAK_ADMIN_USUARIO`, `KEYCLOAK_ADMIN_SENHA` | `admin` / `admin` (só showcase) | Administrador inicial do Keycloak | compose; `checar-keycloak.mjs` | ✅ |
| `ERP_PERMITIR_IDENTIDADE_DEV` | — | `1` permite `identidadeDev` com `NODE_ENV=production` (só verificação local) | núcleo | ✅ |
| `SESSAO_DIR` | temporário | Pasta do store de sessão em arquivo (desenvolvimento; some com o Redis) | núcleo, apps | ✅ |
| `REDIS_URL` | — | Store de sessão (ADR-0002). Definido: shell grava e zonas leem no Redis; ausente: arquivo em `SESSAO_DIR`. O showcase usa `redis://127.0.0.1:6379` | apps (`lib/redis.ts`) | ✅ D1 |
| `REDIS_URL_ZONA` | `REDIS_URL` | Conexão das **zonas** ao Redis, com um usuário ACL que só tem `GET` em `erp:sessao:*` (invariante 15). Fora da máquina local, obrigatório: sem ele a zona conectaria com o usuário do shell | zonas (`lib/redis.ts`) | ✅ |
| `ERP_REDIS_SENHA_ZONA` | `dev-zona-leitura` (só showcase) | Senha do usuário `zona` no Redis do showcase | `docker-compose` do showcase | ✅ |

## 2. Rede, destinos e zonas

| Variável | Padrão | Significado | Quem lê | Estado |
|---|---|---|---|---|
| `DOMINIO_A_URL`, `DOMINIO_B_URL`, `DOMINIO_C_URL`, `DOMINIO_PLATAFORMA_URL` | `http://127.0.0.1:400x` | Origem de cada domínio no registro de destinos | apps | ✅ |
| `ACESSO_URL` | `http://127.0.0.1:4020` | Gestão de acesso v2 (`GET /v2/eu`; manifesto em `/v2/modulos/manifesto`). Sem volta para a v1 (ADR-0014, adendo 1) | apps, `registrar-manifesto` das zonas 1 e 2 | ✅ (núcleo 0.9.0) |
| `ERP_TOKEN_SERVICO` | dev | Token de serviço para registrar o manifesto | `registrar-manifesto` | ✅ |
| `SHELL_HOSTS` | — | Hosts aceitos como origem do shell | apps | ✅ |
| `ERP_DESTINO_TIMEOUT_MS` | `5000` | Timeout de uma chamada a domínio; teto 60000 | núcleo (`interno/destinos.ts`) | ✅ (teto na 0.9.0) |
| `ERP_FRAGMENTO_TIMEOUT_MS` | `2000` | Timeout de um fragmento entre zonas; teto 30000 | núcleo (`fabricas/fragmento.ts`) | ✅ (teto na 0.9.0) |
| `ERP_SONDA_TTL_MS` | `1000` | Por quanto tempo o shell confia no resultado da sonda de saúde de uma zona; teto 10000 | shell (`lib/saude-zonas.ts`) | ✅ (B5a) |
| `ERP_SONDA_TIMEOUT_MS` | `500` | Timeout da sonda de saúde; teto 2000 (zona travada vira 503 em menos de 2 s). Só 2xx de `/{zona}/api/health` conta como no ar | shell | ✅ (B5a) |

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

## 5. Como um valor chega a cada peça

- **Keycloak:** `base/showcase/docker-compose.yml` repassa as variáveis `ERP_*` ao contêiner, e o realm
  (`keycloak/realm-erp.json`) as lê por placeholder (`${ERP_SESSAO_INATIVIDADE_S}`) no import. Mudou o
  valor: recrie o contêiner (`docker compose ... up -d --force-recreate keycloak`).
- **Apps Next:** leem no servidor (`process.env`), nunca com prefixo `NEXT_PUBLIC_` quando é credencial ou endpoint interno.
- **Padrão:** vale quando a variável falta; valor inválido (não numérico, fora da faixa) é erro na subida, não silêncio.

Os itens "⬜ D2" entram com o login OIDC (item D2 em `.agents/orchestrator/RETOMADA.md`). B5a (shell) e B5b (núcleo 0.8.0) já tiraram do código os tempos e limites marcados "✅".

Valor inválido (não inteiro, zero, negativo ou acima do teto) é erro na subida, com o nome da variável; nunca vira outro valor em silêncio.
