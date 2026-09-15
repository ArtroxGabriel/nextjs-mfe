# nextjs-mfe — base Multi-Zones com Next.js

Prova de conceito de micro-frontends com **Next.js Multi-Zones nativo**: um shell (gateway) e
uma zona autônoma, cada um em seu próprio processo, conversando só por HTTP. Substituiu a
versão anterior com Module Federation (histórico em `WALKTHROUGH.md`).

| Parte | Onde | Porta | Papel |
|---|---|---|---|
| Shell | `apps/host` | 3000 | Página inicial, moldura, proxy das rotas da zona (`rewrites`), página de queda da zona |
| Zona | `apps/remote-app` | 3001 | `basePath: /remote-app`, `assetPrefix: /remote-app-static`, SSR, SSE, mapa, fragmento, health |
| Moldura compartilhada | `packages/shell-ui` | — | Header, navegação lateral, layout e toasts usados pelas duas apps (código-fonte, compilado em cada uma) |

O usuário acessa tudo por `http://localhost:3000`. `/remote-app/**` e `/remote-app-static/**`
são repassados à zona; se ela estiver fora, o shell responde 503 com a página `/erro-de-zona`.

---

## 1. Requisitos

- Node **24** (testado em 24.7.0). Os testes usam o runner nativo e a remoção de tipos do Node;
  não há `tsx`/`jest`.
- pnpm **11** (testado em 11.22.0).
- Portas 3000 e 3001 livres.

## 2. Instalar e rodar

```bash
pnpm install

# desenvolvimento (as duas apps, com recarga)
pnpm dev

# produção local
pnpm build
pnpm start
```

Abra `http://localhost:3000` e siga o link **Remote App** na navegação lateral. A troca de zona
é uma navegação de documento inteira (link `<a>` comum), por desenho.

Variável opcional do shell: `REMOTE_ZONE_URL` (ou `REMOTE_APP_URL`), origem da zona;
padrão `http://localhost:3001`. Os rewrites e a sonda de vivacidade usam o mesmo valor.

---

## 3. Como testar

Três camadas, da mais rápida para a mais completa. As duas primeiras não precisam de servidor.

### 3.1 Checagem rápida (sem servidores) — rode antes de todo commit

```bash
pnpm check
```

Equivale a `pnpm typecheck && pnpm test && node scripts/smoke-test.mjs --offline`:

| Etapa | O que verifica |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` em `packages/shell-ui`, `apps/remote-app` e `apps/host` |
| `pnpm test` | suítes unitárias das três partes (abaixo) |
| `smoke-test --offline` | invariantes estáticos STATIC-01..07: nada de Module Federation, `<a>` entre zonas, shell sem DAL, rewrites e `basePath` corretos |

Para rodar uma suíte só, entre na pasta e use **sempre o glob explícito**
(no Node 24.7, `node --test <pasta>` roda zero testes e sai com 0):

```bash
cd apps/host && node --test test/*.test.ts
```

O que cada suíte cobre:

| Suíte | Cobre |
|---|---|
| `packages/shell-ui/test` | Moldura renderizada com `react-dom/server`: header, seletor de sessão, botão de toast, links `<a>` e link ativo, layout com `children` e portal de toasts; handlers chamados de verdade; imports só de `react`; CSS de toda classe renderizada |
| `apps/remote-app/test` | Health `{ok:true}`, contrato do fragmento (200 inerte / 204 / 405), `next.config` da zona, página da zona dentro da moldura, nomes de evento compartilhados |
| `apps/host/test` | Middleware real contra zona simulada (503 com `Retry-After`, TTL de 1 s, recuperação, timeout da sonda, caminhos que o rewrite repassa), rewrites, página `/erro-de-zona` sem rede, página inicial dentro da moldura |

### 3.2 Smoke com as apps no ar

Em um terminal: `pnpm build && pnpm start`. Em outro:

```bash
pnpm smoke            # = node scripts/smoke-test.mjs --strict
```

Esperado: `Total tests: 17, Passed: 17`. Além dos estáticos, ONLINE-01..10 checam a página do
shell, a zona pelo shell e direto, health, fragmento, assets pela `/remote-app-static` e que
`/REMOTE-APP` (maiúsculas) fica no shell.

`HOST_URL` e `ZONE_URL` mudam os alvos. Detalhe de cada checagem em `TEST_READY.md`.

### 3.3 Testes manuais que valem a pena

Com `pnpm start` no ar:

**Moldura na zona.** `http://localhost:3000/remote-app` mostra o mesmo header e a mesma
navegação do shell, com **Remote App** ativo.

**Queda da zona.** Pare só a zona (Ctrl+C no processo da 3001, ou `pnpm start:host` sozinho) e:

```bash
curl -si http://localhost:3000/remote-app | head -5          # 503, text/html, Retry-After: 5
curl -si http://localhost:3000/remote-app-static | head -1   # 503
curl -si http://localhost:3000/ | head -1                    # 200: o shell continua no ar
```

Ao subir a zona de novo, a primeira resposta 200 vem em cerca de 1 s (TTL da sonda).

**Fragmento.**

```bash
curl -si http://localhost:3000/remote-app/_fragmento/demo/42      # 200, HTML sem <script>
curl -si http://localhost:3000/remote-app/_fragmento/unknown/1    # 204
```

**Toast.** Clique em **Ping Toast** no header, no shell e na zona: deve aparecer uma notificação
no canto. Isto só é verificável no navegador (D10).

---

## 4. Limitações conhecidas

Registradas com evidência em `.agents/orchestrator/DEFERRED.md`. As que afetam quem usa a base:

- **Sessão entre zonas (D3):** não há cookie nem store de sessão. A zona espelha o usuário
  escolhido via `localStorage` depois de carregar; o HTML do servidor sempre mostra o usuário
  padrão. Um valor malformado nessa chave pode quebrar a página (D11).
- **Janela após a queda (§5.1 de `docs/design-bff/mfe/01-operacao.md`):** por até ~1 s depois que a
  zona cai, requisições ainda recebem o 500 cru do Next. Zona travada (processo vivo, sem resposta)
  segura requisições por até 30 s nessa janela (D7).
- **SSE (D1):** o intervalo do servidor não é liberado quando o cliente desconecta.
- **Sem renderizador de DOM nos testes (D9, D10):** o que roda só em `useEffect` no navegador
  (leitura do `localStorage`, assinatura do toast) não é coberto.
- **Visual (D11):** o CSS do shell sobrescreve parte da moldura compartilhada; o espaçamento difere
  entre shell e zona.

---

## 5. Escalar: adicionar uma zona

A base tem **uma** zona, e alguns pontos ainda a nomeiam diretamente. Para uma segunda zona
(`/{zona}`), altere estes lugares — os testes existentes apontam quando algo ficou de fora:

1. **Nova app** em `apps/{zona}` com `basePath: '/{zona}'`, `assetPrefix: '/{zona}-static'`,
   `transpilePackages: ['@mfe/shell-ui']`, `exactOptionalPropertyTypes: true` e
   `pages/api/health.ts` respondendo `{ ok: true }` sem tocar domínio. Envolva as páginas em
   `ShellLayout` com `activeRoute="/{zona}"`.
2. **Rewrites do shell** (`apps/host/next.config.js`): três regras — raiz, sub-rotas e assets.
3. **Matcher do middleware** (`apps/host/middleware.ts`): os mesmos três caminhos, **como literais**
   (o Next exige). `middleware.test.ts` falha se matcher e rewrites divergirem.
4. **Sonda de vivacidade** (`apps/host/lib/zoneLiveness.ts`): hoje há um cache para uma zona e o
   middleware nem lê a requisição. Uma segunda zona precisa de um cache por zona, e o middleware
   passa a ter de saber qual zona foi pedida — é a primeira mudança estrutural ao escalar.
   **Cuidado:** não decida pela `request.nextUrl.pathname`. Ela já vem normalizada
   (`/remote-app/..` vira `/`), enquanto matcher e rewrites olham o caminho cru; foi assim que um
   filtro por caminho deixou requisições chegarem à zona morta sem sonda (R1 em
   `.agents/challenger_final_1/handoff.md`). Na dúvida, sonde **todas** as zonas cujo prefixo cru
   case e ajuste o teste "never reads the request" de `middleware.test.ts` com casos de `..` e
   `%2e%2e` para cada zona.
5. **Navegação** (`packages/shell-ui/src/SideNavigation.tsx`): o link com `<a href="/{zona}">`.
6. **Scripts e verificações**: entradas `dev:/build:/start:` no `package.json` raiz, STATIC-06/07 em
   `test/e2e/static-invariants.mjs`, e testes da zona no mesmo modelo de `apps/remote-app/test`.

O desenho completo (mapa de zonas, contrato de fragmento, sessão, deploy) está em
`docs/design-bff/mfe/`; o checklist organizacional em `02-zonas.md` §4.

---

## 6. Documentação

| Documento | Para quê |
|---|---|
| `TEST_READY.md` | Cada checagem STATIC/ONLINE e semântica de saída do smoke |
| `TEST_INFRA.md` | Especificação ampla de testes (4 camadas); nem tudo ali está automatizado |
| `docs/design-bff/mfe/00-arquitetura.md`, `01-operacao.md`, `02-zonas.md` | Desenho de arquitetura, operação e zonas |
| `.agents/orchestrator/` | Estado da migração: `RETOMADA.md`, `GATE_STATUS.md` (vereditos), `DEFERRED.md` (dívidas com evidência) |
| `pedidos/` | Pedidos de pesquisa/elucidação para outra IA, aguardando resposta |
| `WALKTHROUGH.md`, `POC.md` | Histórico: a PoC com Module Federation e o pedido original |
