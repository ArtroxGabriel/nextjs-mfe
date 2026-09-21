# Arquitetura alvo

> **O que isto descreve:** para onde a base deve chegar, resumido do desenho completo em
> `docs/design-bff/mfe/` (`00-arquitetura.md`, `01-operacao.md`, `02-zonas.md`). Aquele
> desenho manda; este arquivo é o mapa visual dele. O que existe hoje está em
> [`atual.md`](atual.md). A tabela do fim mostra o que falta.

A base genérica em `repos/` (ADR-0009) já tem shell, três zonas, gestão de acesso, registro de
destinos e moldura comum. O alvo é um ERP com **várias zonas de times diferentes**, cada uma com
BFF próprio e um ou mais domínios, com sessão, autorização e composição feitas no servidor.

---

## 1. Topologia

```mermaid
flowchart TB
    B["🌐 Navegador<br/>uma aba · um SharedWorker"]

    subgraph SHELL["erp-shell — gateway (deploy próprio)"]
        GW["rewrites por prefixo<br/>gerados do mapa de zonas"]
        AUTH["/login · /api/auth/*<br/>sessão OIDC"]
        STREAM["/api/stream<br/>uma conexão SSE por aba"]
        OTEL["/api/otel/*<br/>proxy de telemetria"]
        ERR["/erro-de-zona"]
    end

    subgraph ZP["erp-mfe-pedidos · /pedidos/*"]
        BP["BFF Pedidos<br/>proxy.ts = criarProxy()"]
    end
    subgraph ZE["erp-mfe-estoque · /estoque/*"]
        BE["BFF Estoque"]
    end
    subgraph ZC["erp-mfe-comercial · /comercial/*"]
        BC["BFF Comercial"]
    end

    DP[("Domínio Pedidos")]
    DL[("Domínio Logística")]
    DC[("Domínio Comercial")]
    R[("Redis<br/>store de sessão compartilhado")]
    IDP["Provedor OIDC"]

    B --> SHELL
    GW --> ZP & ZE & ZC
    BP --> DP
    BE --> DL
    BC --> DC
    AUTH <--> IDP
    AUTH --> R
    BP & BE & BC -. "lê a sessão pelo id do cookie" .-> R
```

Regras que a figura carrega:

- **Uma zona fala com um domínio.** Precisando de dado de outro, pede um *fragmento* à zona
  dona (§3), que aplica a ACL dela.
- **A zona não é alcançável pelo navegador em produção.** Só existe atrás do shell.
- **O shell nunca delega** `/api/auth/*`, `/api/stream`, `/api/otel/*`, `/login`,
  `/erro-de-zona`: precisam existir mesmo com toda zona fora.

## 2. Pacotes e deploy

```mermaid
flowchart LR
    C["@erp/contratos<br/>tipos · códigos de erro · eventos"]
    N["@erp/nucleo<br/>portas · adaptadores · fábricas<br/>criarNucleo · criarProxy · criarFragmento"]
    U["@erp/ui<br/>tokens · primitivos · layout"]

    C --> N --> U
    C & N & U -->|"registry (npm)"| Z1["zonas"] --> S["shell"]

    G{{"gate de lockstep no CI<br/>todas as zonas na mesma versão do núcleo"}}
    N -.-> G -.-> Z1
```

Ordem de publicação e deploy: **contratos → núcleo → ui → zonas → shell**. Zonas revertem
de forma independente, mas nunca abaixo do lockstep do núcleo. Contrato só cresce (janela de
depreciação de duas minors).

## 3. Composição entre zonas: `FragmentoRemoto`

```mermaid
sequenceDiagram
    autonumber
    participant N as Navegador
    participant P as Zona Pedidos (RSC)
    participant C as Zona Comercial (BFF)
    participant D as Domínio Comercial

    N->>P: GET /pedidos/8821 (cookie __Host-session)
    P->>C: GET /comercial/_fragmento/condicao/8821<br/>com a sessão · timeout 2 s
    C->>D: consulta com a identidade do usuário
    alt usuário autorizado
        D-->>C: dados
        C-->>P: 200 HTML pronto (sem JS)
    else não autorizado
        D-->>C: negado
        C-->>P: 204 (ausência total)
    else Comercial fora ou lento
        P-->>P: circuit breaker: esqueleto do bloco
    end
    P-->>N: página de Pedidos com ou sem o bloco
```

- A autorização é avaliada **pelo dono do dado, antes de qualquer byte sair**.
- O `try/catch` e o timeout do fragmento são **núcleo**: sem eles, a queda do Comercial
  derruba o Pedidos.
- Nenhuma parte da URL do fragmento vem do cliente; o destino sai do mapa de zonas.

## 4. Sessão ponta a ponta

```mermaid
sequenceDiagram
    autonumber
    participant N as Navegador
    participant S as Shell
    participant I as Provedor OIDC
    participant R as Redis
    participant Z as Qualquer zona

    N->>S: /login
    S->>I: redireciona para autenticar
    I-->>S: /api/auth/callback
    S->>R: grava { sub, roles, accessToken, expiraEm }
    S-->>N: cookie __Host-session = id opaco
    N->>Z: GET /estoque/… (mesmo cookie)
    Z->>R: lê a sessão pelo id
    Note over N,Z: sair: /api/auth/sair remove do Redis PRIMEIRO,<br/>depois expira o cookie → vale em todas as zonas
```

O cookie leva só um id opaco, nunca o token. Uma zona nunca implementa saída: redireciona
para a do shell.

## 5. Estado de cliente entre zonas

```mermaid
flowchart LR
    subgraph ORIGEM["mesma origem (domínio do shell)"]
        W["SharedWorker<br/>uma conexão SSE /api/stream"]
    end
    A["documento da zona A"] -- "porta MessagePort" --> W
    B["documento da zona B"] -- "porta nova após a navegação" --> W
    A == "<a> · hard navigation<br/>documento destruído" ==> B
```

| O que sobrevive à troca de zona | Como |
|---|---|
| conexão SSE | `SharedWorker` na origem, multiplexando portas de documentos distintos |
| sessão | cookie `__Host-session` + Redis |
| filtro, aba, rascunho | não sobrevive, por desenho: é estado de tela |

---

## 6. Da base atual ao alvo

| Tema | Hoje (`atual.md`) | Alvo | Primeiro passo sugerido |
|---|---|---|---|
| Framework | Next 16, App Router, `proxy.ts` | igual | — |
| Zonas | shell + 3 zonas; rewrites gerados de `zonas.json` | mapa de zonas gerado dos manifestos registrados | ler prefixos e origens do domínio de gestão de acesso no boot do shell |
| Login | `identidadeDev` (4 atores, sem senha) | OIDC + PKCE | adaptador OIDC da porta de identidade |
| Store de sessão | arquivo em disco compartilhado | Redis compartilhado | adaptador `sessaoRedis` (leitor e escritor) |
| Renovação de token | não existe; sessão de dev dura 30 min | endpoint interno do shell (ADR-0009, decisão 3) | depende das respostas do IdP (PENDENCIAS §4) |
| Acesso a módulo | gestão de acesso federada, 404 para módulo negado | igual, com cache por versão de política se a medição pedir | medir a consulta por renderização |
| Falha isolada de zona | **não existe**: zona fora devolve erro do gateway | shell serve página própria (a PoC fazia 503 com `Retry-After`) | portar a sonda de vivacidade da PoC para o `proxy.ts` do shell |
| Composição | não há fragmento | `FragmentoRemoto` com timeout e circuit breaker | primeiro consumidor entre zona 1 e zona 2 |
| SSE | não há | `/api/stream` no shell + `SharedWorker` | — |
| Design system | `@erp/moldura` (moldura e toast) | `@erp/ui` publicado com semver tolerante | medir duplicação de bundle entre zonas antes |
| Deploy | local; Verdaccio local | repositórios e deploys independentes, lockstep do núcleo no CI | gate de lockstep (task 11 do plano antigo) |
| Operação | sem rate limiting nem rastreamento | rate limiting na borda, `trace_id` entre zonas | — |

Referências: `docs/design-bff/mfe/00-arquitetura.md` (solução), `01-operacao.md`
(roteamento, sessão, falha, deploy), `02-zonas.md` (estrutura e criação de zona),
`limitações-mfe-multizone.md` (as limitações que o desenho responde).
