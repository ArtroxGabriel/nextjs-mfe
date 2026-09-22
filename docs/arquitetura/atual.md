# Arquitetura atual — base genérica em `repos/`

> **O que isto descreve:** o código de `repos/` hoje, e nada além. Decisões no
> [ADR-0009](../adr/0009-base-generica.md). Para onde a base ainda vai,
> veja [`alvo.md`](alvo.md); a distância entre os dois está no fim dele. A PoC anterior (`apps/`)
> foi removida e está preservada na tag `poc-final`.

---

## 1. Visão geral

O navegador fala só com o shell (`:3000`). O shell repassa cada prefixo de zona por rewrite. Cada
aplicação tem o próprio BFF e só chama domínio pelo **registro de destinos** do `@erp/nucleo`.

```mermaid
flowchart TB
    B["🌐 Navegador<br/>cookie __Host-session (id opaco)"]

    subgraph SHELL["erp-shell :3000"]
        GW["proxy.ts + rewrites gerados de zonas.json<br/>/zona1 · /zona2 · /acesso (+ /&lt;id&gt;-static)<br/>sonda de saúde por zona → 503"]
        OT["/api/otel/v1/traces<br/>gateway de telemetria"]
        AUTH["/login · /api/auth/entrar · /api/auth/sair<br/>ÚNICO escritor da sessão"]
        SH["/ (shell.inicio)"]
    end
    Z1["erp-zona-1 :3001<br/>/zona1 · /zona1/relatorios · /zona1/recursos/[id]"]
    Z2["erp-zona-2 :3002<br/>/zona2 (Server Action com If-Match)"]
    ZA["erp-zona-acesso :3003<br/>/acesso"]

    ST[("store de sessão<br/>arquivo em SESSAO_DIR<br/>shell escreve · todos leem")]
    DP[("plataforma :4004")]
    DA[("domínio A :4001")]
    DB[("domínio B :4002")]
    DC[("domínio C :4003")]
    GA[("gestão de acesso :4010")]

    B --> SHELL
    GW --> Z1 & Z2 & ZA
    AUTH --> ST
    SH & Z1 & Z2 & ZA -. lê .-> ST
    SH --> DP
    Z1 --> DA & DB
    Z2 --> DC
    ZA --> GA
    SH & Z1 & Z2 & ZA -. "módulos permitidos" .-> GA
```

Todos os domínios são falsos (`repos/erp-dominio-stub`), escutam só em `127.0.0.1` e recusam
requisição com cabeçalho de navegador (`Origin`, `Sec-Fetch-*`).

### 1.1 O que o `proxy.ts` do shell decide, em ordem

`repos/erp-shell/lib/decisao-proxy.ts` é uma função pura, testada sem o Next; o `proxy.ts` só a
traduz para `NextResponse`. Os rewrites de `next.config.ts` e a busca de zona saem do mesmo
`zonas.json`, então rota nova de zona entra nos dois de uma vez.

```mermaid
flowchart TD
    R["requisição"] --> P{"/login, /api/auth,<br/>/erro-de-zona?"}
    P -- sim --> PUB["segue, com CSP e nonce"]
    P -- não --> T{"/api/otel?"}
    T -- sim --> TEL["route handler de telemetria<br/>sem sessão: 204, descarta sem ler<br/>> 256 KB lidos: 413 · > 60 lotes/min: 429<br/>repasse pelo registro de destinos"]
    T -- não --> Z{"prefixo de zona<br/>(/zona1, /zona1-static…)?"}
    Z -- sim --> S{"sonda de saúde da zona<br/>(cache 1 s, timeout 500 ms)"}
    S -- "fora (erro de rede ou status ≥ 500)" --> E503["503 · Retry-After: 5<br/>página de zona indisponível"]
    S -- ok --> ST{"asset estático?"}
    ST -- sim --> REW["segue para o rewrite"]
    ST -- não --> C{"cookie __Host-session?"}
    Z -- não --> C
    C -- não --> L["307 /login?de=…"]
    C -- sim --> OK["segue com CSP, x-erp-caminho<br/>e flash consumido"]
```

Escrita pelo Gabriel em 2026-09-21. O primeiro gate reprovou e a correção entrou em `erp-shell`
`f3d8803`; falta a segunda rodada de gate. O prefixo de zona é casado **sem diferenciar
maiúsculas**, como o rewrite do Next (`/ZONA2` também passa pela sonda). O caminho que o Next
entrega ao proxy já vem normalizado, e o revisor mediu que rewrite e proxy usam o mesmo parser:
a armadilha R1 da PoC não se repete aqui.

## 2. Pacotes

| Pacote | Versão | O que tem | Quem usa |
|---|---|---|---|
| `@erp/contratos` | 0.2.1 | códigos de erro e mensagens; `ManifestoDeZona`, `ModuloPermitido`, `validarManifesto` | todos |
| `@erp/nucleo` | 0.6.0 (as 4 apps) | `criarNucleo`, registro de destinos, leitores de sessão (`sessaoArquivo`, `sessaoRedis`), fragmentos (`criarFragmento`, `responderFragmento`), `acessoHttp`, `criarProxy`, `pode`; em `@erp/nucleo/shell`: `criarNucleoDoShell`, escritores de sessão, `identidadeDev` | shell e zonas (`/shell` só o shell) |
| `@erp/moldura` | 0.3.0 | `<Moldura>` (topo, menu com `aria-current`, host de toast), `emitirToast`, flash, `FormularioDeAcao` | shell e zonas |

Publicados no Verdaccio local (`:4873`). Cada aplicação é um repositório com lockfile próprio.

## 3. Uma navegação, do login ao módulo

```mermaid
sequenceDiagram
    participant N as Navegador
    participant S as Shell
    participant ST as Store de sessão
    participant Z as Zona 1
    participant GA as Gestão de acesso
    participant A as Domínio A

    N->>S: POST /api/auth/entrar (usuario)
    S->>ST: grava { sub, nome, token, expira } — só o shell
    S-->>N: 303 · Set-Cookie __Host-session=<uuid> HttpOnly Secure
    N->>S: GET /zona1/relatorios
    S->>Z: rewrite (cookie repassado)
    Note over Z: camada 1 — proxy: cookie existe? senão 307 /login
    Z->>ST: lê a sessão pelo id (modo leitura)
    Z->>GA: GET /v1/modulos-permitidos (Bearer do usuário)
    Note over Z: camada 2 — módulo na lista? senão 404
    Z->>A: GET /v1/recursos (destino do registro)
    A-->>Z: projeção do ator (custo só para FINANCEIRO)
    Z-->>N: HTML com <Moldura> e menu dos módulos permitidos
```

## 4. Registro de destinos (N8)

Cada aplicação declara, em `lib/nucleo.ts`, os destinos que pode chamar:

```ts
'dominio-a': {
  origem: process.env.DOMINIO_A_URL ?? 'http://127.0.0.1:4001',
  caminhos: ['/v1/recursos', '/v1/recursos/:id'], metodos: ['GET'], credencial: 'usuario', timeoutMs: 2000,
}
```

A página chama `nucleo.destino('dominio-a').get('/v1/recursos/:id', { params: { id } })`. O núcleo:

- recusa destino, modelo ou método não declarado, **antes de qualquer chamada de rede**;
- codifica o parâmetro e recusa `.`, `..`, vazio e byte de controle;
- confere que a URL final tem a origem e o caminho esperados;
- exige `If-Match` em PUT, PATCH e DELETE;
- injeta `Authorization` e `x-erp-chamador`; nunca segue redirecionamento; aplica timeout;
- normaliza o erro para `{ codigo, supportId }`.

## 5. Gestão de acesso (N5, N6)

```mermaid
flowchart LR
    subgraph ZONAS["cada aplicação"]
        M["acesso.manifesto.ts<br/>módulos · perfis · concessões padrão"]
    end
    M -- "pnpm registrar<br/>token de serviço svc.&lt;zona&gt;" --> GA[("gestão de acesso")]
    ZA["zona /acesso<br/>(carla)"] -- "perfil × módulo · restrito · usuário × perfil" --> GA
    GA -- "módulos permitidos do usuário" --> MENU["menu da moldura<br/>e exigirModulo (404)"]
```

- Uma zona só registra o **próprio** manifesto; módulos e perfis têm o prefixo dela.
- Perfil de zona só concede módulo da própria zona; perfis globais são `plataforma.*`.
- Módulo livre: toda sessão válida vê. Módulo restrito: só perfis com concessão.
- Revogação vale na próxima navegação: os módulos são consultados a cada renderização.

| Ator | Perfis | Vê |
|---|---|---|
| ana | plataforma.usuario, zona2.operador | Início, Painel da zona 1, Tarefas |
| bruno | plataforma.usuario, zona1.analista | Início, Painel da zona 1, Relatórios; `custo` no domínio A |
| carla | plataforma.usuario, plataforma.admin-acesso | Início, Painel da zona 1, Gestão de acesso; **sem `custo`** |
| davi | — | Início, Painel da zona 1 |

## 6. Moldura e toast entre zonas (N4)

Cada aplicação renderiza `<Moldura>` com o menu que a gestão de acesso devolveu. Toast no mesmo
documento: `emitirToast({ tipo, texto })`. Toast que atravessa zona: a Server Action grava o
cookie `__Host-flash` e devolve o destino; a ilha `FormularioDeAcao` troca o documento com
`location.assign`; no documento seguinte, de qualquer zona, o **proxy consome o cookie**: entrega
o toast ao layout num cabeçalho interno e apaga o cookie na mesma resposta. Por isso o toast
aparece uma vez só, com ou sem JavaScript. A action não usa `redirect()` para outra zona: ver a limitação 11 em
`docs/desenho/mfe/infraestrutura-fora-da-vercel.md`.

```mermaid
sequenceDiagram
    participant N as Navegador
    participant Z2 as Zona 2
    participant C as Domínio C
    participant Z1 as Zona 1
    N->>Z2: POST /zona2 · Next-Action (Server Action concluirTarefa)
    Z2->>Z2: exigirNaAcao: sessão + módulo zona2.tarefas
    Z2->>C: POST /v1/tarefas/t-1/concluir · If-Match "1"
    Z2-->>N: { destino: "/zona1" } · Set-Cookie __Host-flash
    N->>Z1: location.assign("/zona1") — novo documento
    Note over Z1: proxy: lê __Host-flash, passa ao layout, apaga o cookie
    Z1-->>N: HTML com o toast "Tarefa concluída." · Set-Cookie __Host-flash Max-Age=0
```

## 7. O que cada teste protege

| Suíte | Comando | Protege |
|---|---|---|
| `erp-contratos` | `pnpm test` (15) | manifesto: prefixo de zona, concessão entre zonas (D8), duplicatas |
| `erp-nucleo` | `pnpm test` (107) | registro de destinos, sessão leitor/escritor (arquivo e Redis: chave com hash, TTL, erro sem vazar), fragmentos (allowlist, cookie, timeout, HTML inerte, 204/404/500), acesso, fronteira entre camadas, exports |
| `erp-moldura` | `pnpm test` (16) | menu e `aria-current`, um `<h1>`, barramento e host de toast (executado com hooks falsos), flash, `FormularioDeAcao` |
| `erp-dominio-stub` | `pnpm test` (16) | projeção e escopo do domínio A, If-Match no C, regras da gestão de acesso |
| `erp-shell` | `pnpm test` (36) | decisão do proxy (rotas públicas, telemetria, zona fora, login), prefixo de zona sem diferenciar maiúsculas, sonda de saúde com cache de 1 s, mapa de zonas e rotas reservadas, limite de tamanho em streaming e expiração do limitador |
| ponta a ponta | `node --test base/verificacao/*.test.mjs` (50, com navegador real e análise de saída de rede) | N3–N8 pelo shell, com os quatro atores; toda Server Action pelo caminho do navegador (`Next-Action`), sem `Origin`, com sessão expirada e por quem não tem o módulo; toast uma vez só; domínios derrubados um a um; gestão de acesso fora sem vazar módulo no payload; zona 2 derrubada (503 em qualquer caixa, volta) e travada (503 em < 2 s); nonce da CSP novo a cada requisição; telemetria anônima não repassada |

## 8. Quando uma peça cai (medido em 2026-09-21; verificado em `base/verificacao`)

| Cai | O usuário vê |
|---|---|
| um domínio de negócio (ex.: A) | a página abre; o bloco daquele domínio diz "indisponível no momento" |
| o domínio de gestão de acesso | a moldura sem menu e "Serviço indisponível" no HTML do servidor, sem a página: sem ele ninguém entra em módulo. O status continua 200 (o layout não o define) |
| uma zona | o shell responde 503 com `Retry-After: 5` e uma página própria, em qualquer caixa do caminho; as outras zonas seguem. **Exceção medida:** logo depois da queda, enquanto a última sonda boa vale (cache de 1 s), requisições recebem o 500 cru do Next (até ~0,8 s, challenger_shell_1). Zona travada segura a requisição ~0,6 s (timeout da sonda). Ao voltar, a zona responde de novo em 0,8–1,2 s (0,8 s se a última sonda já venceu; até 1,2 s se ainda vale; challenger_shell_1 e _2) |
| o domínio falso de gestão de acesso é reiniciado | perde manifestos e concessões (estado em memória); `pnpm registrar` em cada app os recria. O domínio real persiste |

Como rodar e conferir à mão: [`../ROTEIRO-DE-VERIFICACAO.md`](../ROTEIRO-DE-VERIFICACAO.md).
