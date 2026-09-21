# PoC `apps/` — congelada em 2026-09-21

> **Histórico.** Esta é a arquitetura da prova de conceito em `apps/` (Pages Router), congelada
> pelo [ADR-0009](../design-bff/comum/docs/adr/0009-base-generica.md). A base que vale hoje está
> em [`atual.md`](atual.md). O documento fica porque os testes da PoC continuam rodando e as
> lições (queda isolada, janela da sonda) valem para a base nova.
>
> Diagramas em Mermaid: o GitHub e a maioria dos editores os renderizam direto.

---

## 1. Visão geral

Dois processos Next.js independentes e um pacote de código-fonte compartilhado. O navegador
só conversa com o **shell**; o shell repassa por HTTP tudo o que é da **zona**.

```mermaid
flowchart LR
    B["🌐 Navegador<br/>http://localhost:3000"]

    subgraph SHELL["apps/host — Shell · porta 3000"]
        MW["middleware.ts<br/>sonda a zona antes do rewrite"]
        RW["next.config.js · rewrites()<br/>/remote-app · /remote-app/:path* · /remote-app-static/:path*"]
        HP["páginas do shell<br/>/ · /erro-de-zona"]
    end

    subgraph ZONA["apps/remote-app — Zona · porta 3001<br/>basePath /remote-app · assetPrefix /remote-app-static"]
        ZP["páginas<br/>/ (abas por ?tab=) · /mapa/[cidade]"]
        API["APIs<br/>/api/health · /api/server-data · /api/sse-events"]
        FR["/_fragmento/[name]/[id]<br/>HTML inerte"]
    end

    UI[["packages/shell-ui<br/>Header · SideNavigation · ShellLayout · ToastContainer · MFE_EVENTS"]]

    B -->|"/"| HP
    B -->|"/remote-app/**"| MW
    MW -->|"zona saudável"| RW
    MW -->|"zona fora: 503"| B
    RW -->|"proxy HTTP"| ZP
    RW -->|"proxy HTTP"| API
    RW -->|"proxy HTTP"| FR
    MW -.->|"GET /remote-app/api/health<br/>cache de 1 s"| API

    UI -. "compilado dentro (transpilePackages)" .-> SHELL
    UI -. "compilado dentro (transpilePackages)" .-> ZONA
```

| Peça | Responsabilidade | Não faz |
|---|---|---|
| **Shell** (`apps/host`) | Porta de entrada; página inicial; repassa `/remote-app/**` à zona; responde a queda da zona com `/erro-de-zona` | Não acessa dados de domínio (sem DAL); não renderiza nada da zona |
| **Zona** (`apps/remote-app`) | Painel com SSR, abas por query, rota de caminho, SSE, mapa, cache de servidor, fragmento, health | Não conhece o shell; só sabe que vive sob `/remote-app` |
| **`@mfe/shell-ui`** | A moldura visual idêntica nas duas apps e o nome dos eventos entre elas | Não é carregado em runtime: é código-fonte compilado separadamente em cada app |

---

## 2. Um pedido com a zona no ar

```mermaid
sequenceDiagram
    autonumber
    participant N as Navegador
    participant S as Shell :3000<br/>(middleware + rewrites)
    participant C as Cache de vivacidade<br/>(1 s, no processo do shell)
    participant Z as Zona :3001

    N->>S: GET /remote-app?tab=map
    S->>C: a zona está saudável?
    alt cache vazio ou vencido
        C->>Z: GET /remote-app/api/health (timeout 800 ms)
        Z-->>C: 200 {"ok":true}
    end
    C-->>S: saudável
    S->>Z: proxy GET /remote-app?tab=map
    Note over Z: getServerSideProps lê ?tab=map<br/>renderiza ShellLayout + abas + mapa
    Z-->>S: 200 HTML
    S-->>N: 200 HTML
    N->>S: GET /remote-app-static/_next/static/chunks/…
    S->>Z: proxy (sem passar pela página)
    Z-->>N: JS/CSS da zona
```

Pontos que o diagrama mostra e que costumam surpreender:

- **O navegador nunca vê a porta 3001.** Assets da zona saem por `/remote-app-static/…`,
  não por `/_next/…`, porque as duas apps teriam `/_next` e colidiriam.
- **O middleware não olha o caminho.** Quem decide se o pedido é da zona é o `matcher`
  (os mesmos três literais dos rewrites). Olhar `request.nextUrl.pathname` já deixou pedidos
  como `/remote-app/..` chegarem à zona morta sem sonda; há teste que proíbe ler a requisição.
- **Rotas diferenciam maiúsculas** (`experimental.caseSensitiveRoutes`): `/REMOTE-APP` fica
  no shell e recebe 404.

## 3. Um pedido com a zona fora

```mermaid
sequenceDiagram
    autonumber
    participant N as Navegador
    participant S as Shell :3000
    participant C as Cache de vivacidade
    participant Z as Zona :3001 (fora)

    N->>S: GET /remote-app
    S->>C: a zona está saudável?
    C->>Z: GET /remote-app/api/health
    Z--xC: conexão recusada / timeout 800 ms
    C-->>S: fora (guardado por 1 s)
    S-->>N: 503 · text/html · Retry-After: 5<br/>página /erro-de-zona (sem JS, sem rede)
    N->>S: GET /
    S-->>N: 200 — o shell continua no ar
```

**Exceções medidas** (detalhe em `docs/design-bff/mfe/01-operacao.md` §5.1):

| Situação | O que acontece |
|---|---|
| Até ~1 s depois de a zona **cair** | o cache ainda diz "saudável": o pedido vai à zona e volta 500 cru do Next |
| Zona **travada** (processo vivo, sem resposta) dentro dessa janela | o pedido espera o timeout do proxy do Next (30 s) e recebe 500 |
| Zona travada fora da janela | a cada expiração do cache, quem chega espera o resto da sonda (até 800 ms) e recebe 503 |
| Zona sobe de novo | a primeira resposta 200 vem em ~1 s |

---

## 4. Como a moldura é compartilhada

Não há Module Federation nem bundle compartilhado em runtime. O pacote é **código-fonte**,
e cada app o compila no próprio build.

```mermaid
flowchart TB
    subgraph PKG["packages/shell-ui/src"]
        H[Header.tsx]
        SN[SideNavigation.tsx]
        SL[ShellLayout.tsx]
        TC[ToastContainer.tsx]
        EV["events.ts<br/>MFE_EVENTS.TOAST = 'mfe:toast'"]
        CSS[shell-layout.css]
    end

    subgraph HB["build do shell (.next de apps/host)"]
        HL["components/HostLayout.tsx"]
        HE["lib/events.ts<br/>re-exporta MFE_EVENTS"]
    end

    subgraph ZB["build da zona (.next de apps/remote-app)"]
        ZI["pages/index.tsx"]
        ZE["lib/events.ts<br/>re-exporta MFE_EVENTS"]
    end

    PKG ==>|"transpilePackages: ['@mfe/shell-ui']"| HB
    PKG ==>|"transpilePackages: ['@mfe/shell-ui']"| ZB
    HL --> SL
    ZI --> SL
    EV --> HE
    EV --> ZE
```

Consequências práticas:

- **Mudou a moldura? Rebuild das duas apps.** Cada uma leva uma cópia compilada.
- **O nome dos eventos tem uma definição só** (`events.ts`). Emissor e ouvinte não podem
  divergir sem um teste falhar.
- **Custo:** no primeiro salto shell → zona o navegador baixa de novo o framework do React
  (~45 kB gzip), porque o cache do navegador é por URL e cada app serve o seu.
- **Diferença visual conhecida (D11):** `apps/host/styles/globals.css` ainda redefine parte
  das classes da moldura, então o espaçamento difere entre shell e zona.

---

## 5. O que acontece dentro da zona

```mermaid
flowchart LR
    subgraph URL["O que vem na URL"]
        Q1["/remote-app"]
        Q2["/remote-app?tab=telemetry&filter=warn"]
        Q3["/remote-app?tab=map"]
        Q4["/remote-app/mapa/tokyo"]
        Q5["/remote-app/mapa/atlantis"]
    end

    PQ["lib/dashboardQuery.ts<br/>valida tab · filter · city<br/>(valor desconhecido → padrão)"]

    subgraph ABAS["Aba renderizada no servidor"]
        A1["overview<br/>ServerCard (SSR + cache 5 s)"]
        A2["telemetry<br/>RemoteTelemetry → EventSource"]
        A3["map<br/>RemoteMap (MapLibre)"]
        A4["metrics<br/>ServerCard + telemetria"]
    end

    Q1 --> PQ --> A1
    Q2 --> PQ --> A2
    Q3 --> PQ --> A3
    Q4 -->|"pages/mapa/[cidade].tsx"| PQ
    PQ -->|"cidade conhecida"| A3
    Q5 -->|"cidade desconhecida"| NF["404"]

    A2 -. "GET /remote-app/api/sse-events<br/>(mesma origem, passa pelo shell)" .-> SSE[("/api/sse-events<br/>text/event-stream")]
    A1 -. "getServerData()" .-> CACHE[("cache em memória<br/>TTL 5 s por usuário")]
```

- **Troca de aba é navegação de documento** (`<a>` comum): o servidor relê a query e
  renderiza de novo. Nada de estado de aba no cliente.
- **SSE usa caminho com `basePath`** (`/remote-app/api/sse-events`): funciona pelo shell e
  direto na zona. Sem o prefixo, o pedido cairia no 404.
- **Mapa**: o motor MapLibre carrega no navegador; os ladrilhos vêm de
  `tile.openstreetmap.org` (precisa de internet).

---

## 6. Estado entre as páginas

```mermaid
flowchart TB
    subgraph DOC1["Documento do shell (/)"]
        H1["Header · seletor de sessão"]
        T1["ToastContainer"]
    end
    subgraph DOC2["Documento da zona (/remote-app)"]
        H2["Header · seletor de sessão"]
        T2["ToastContainer"]
        S2["RemoteTelemetry · EventSource"]
    end

    LS[("localStorage da origem :3000<br/>chave host_user_session")]

    H1 -- "grava ao trocar usuário" --> LS
    LS -- "lido depois de carregar (useEffect)" --> H2
    H2 -- "grava ao trocar usuário" --> LS

    H1 -- "CustomEvent 'mfe:toast' no window" --> T1
    H2 -- "CustomEvent 'mfe:toast' no window" --> T2

    DOC1 == "clique em <a href=/remote-app><br/>o documento é destruído" ==> DOC2
```

| Estado | Como vive hoje | Limite |
|---|---|---|
| **Sessão** | espelhada no `localStorage` da origem do shell | só no cliente e depois do carregamento; o HTML do servidor mostra sempre o usuário padrão (D3) |
| **Toast** | `CustomEvent` no `window` do documento atual | não atravessa navegação (nem deve) |
| **SSE** | um `EventSource` por documento | cai a cada troca de zona; o servidor não libera o intervalo quando o cliente sai (D1) |
| **Cache de servidor** | `Map` em memória na zona, 5 s | por processo; some ao reiniciar |
| **Aba, filtro, cidade** | na URL | é estado de tela: não precisa sobreviver |

---

## 7. O que cada teste protege

```mermaid
flowchart LR
    subgraph T["pnpm check (sem servidores)"]
        U1["packages/shell-ui/test<br/>15 testes"]
        U2["apps/remote-app/test<br/>36 testes"]
        U3["apps/host/test<br/>47 testes"]
        ST["smoke --offline<br/>STATIC-01..07"]
    end
    subgraph O["pnpm smoke (apps no ar)"]
        ON["ONLINE-01..10"]
    end

    U1 --> M1["moldura renderizada, handlers, imports, CSS"]
    U2 --> M2["health, fragmento, abas/query, rota /mapa, SSE path, espelho de sessão, emissão de toast"]
    U3 --> M3["middleware real: 503, TTL, recuperação, caminhos repassados; página inicial; /erro-de-zona"]
    ST --> M4["sem Module Federation, <a> entre zonas, shell sem DAL, rewrites, basePath"]
    ON --> M5["shell, zona via shell e direto, fragmento, assets, /REMOTE-APP no shell"]
```

Fora da cobertura automática: o que roda só em `useEffect` no navegador (leitura do
`localStorage`, assinatura do toast, abertura do `EventSource`, motor do mapa) — D9/D10.
Esses itens estão no [roteiro de verificação manual](../ROTEIRO-DE-VERIFICACAO.md).
