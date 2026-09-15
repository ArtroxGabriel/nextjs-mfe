# Roteiro de verificação manual

Passo a passo para conferir, com as próprias mãos, que os micro-frontends estão integrados e
que as funcionalidades base da PoC (`POC.md`) funcionam. Leva uns 15 minutos. Todos os comandos `curl` abaixo foram executados em 2026-09-15 contra o commit que introduziu este roteiro (saída em `.agents/worker_base_features/roteiro-live.txt`).

Cada item diz **o que fazer**, **o que deve acontecer** e o **estado atual**:
✅ funciona · ⚠️ funciona com limite conhecido · ❌ não existe ainda.
A arquitetura por trás de cada item está em [`arquitetura/atual.md`](arquitetura/atual.md).

---

## 0. Preparar

```bash
pnpm install
pnpm check          # typecheck + testes unitários + invariantes estáticos, sem servidores
pnpm build
pnpm start          # shell em :3000 e zona em :3001, no mesmo terminal
```

Em outro terminal, confirme que os dois estão de pé:

```bash
pnpm smoke          # esperado: Total tests: 17, Passed: 17
```

Use **sempre** `http://localhost:3000` no navegador. A porta 3001 só aparece nos passos que
dizem "direto na zona".

---

## 1. A zona aparece dentro da moldura do shell — ✅

**Fazer:** abra `http://localhost:3000`. Na navegação lateral, clique em **Remote App**.

**Esperado:**
- A barra de endereço vai para `/remote-app` e a página recarrega inteira (troca de zona é
  navegação de documento, não SPA).
- O mesmo header (logo, seletor de sessão, botão **Ping Toast**) e a mesma navegação lateral
  continuam lá, agora com **Remote App** marcado.
- Abaixo aparece o painel da zona com as abas **Visão geral**, **Telemetria**, **Mapa**,
  **Métricas**.

**Limite:** o espaçamento da moldura difere um pouco entre shell e zona (D11).

## 2. Server-Side Rendering — ✅

**Fazer:**

```bash
curl -s http://localhost:3000/remote-app | grep -o 'class="federated-card"\|class="app-header"\|Active Zone Session'
```

**Esperado:** as três marcas aparecem no HTML que o servidor devolve, antes de qualquer
JavaScript rodar. No navegador, *Ver código-fonte* mostra o card com `Request ID` e
`Timestamp` já preenchidos.

## 3. Query params e rotas de caminho — ✅

**Fazer:** clique nas abas e observe a barra de endereço. Depois teste as URLs:

| URL | Esperado |
|---|---|
| `/remote-app?tab=telemetry` | aba Telemetria ativa; aparecem os filtros `all · info · warn · critical` |
| `/remote-app?tab=telemetry&filter=warn` | filtro `warn` marcado; a lista mostra só eventos `warn` |
| `/remote-app?tab=map` | aba Mapa; aparecem os links de cidade |
| `/remote-app/mapa/tokyo` | **rota de caminho**: mapa já com *Tokyo Datacenter* selecionado |
| `/remote-app/mapa/atlantis` | 404 (cidade desconhecida) |
| `/remote-app?tab=qualquer` | cai na Visão geral (valor desconhecido nunca chega aos componentes) |

## 4. SSE: conexão mantida pela zona — ⚠️

**Fazer (navegador):** abra `/remote-app?tab=telemetry`.

**Esperado:** o indicador vai de `CONNECTING` para `CONNECTED` e eventos começam a chegar a
cada ~1,5 s. **Pause** e **Resume** fecham e reabrem o stream. Um evento `critical` também
dispara um toast. Nas ferramentas do navegador (aba *Network*), o pedido
`/remote-app/api/sse-events` fica aberto com tipo `eventsource`, passando pelo shell na 3000.

**Fazer (terminal):**

```bash
curl -sN http://localhost:3000/remote-app/api/sse-events    # Ctrl+C para sair
```

**Esperado:** `event: connected` com `data: {"status":"connected",…}`, e depois um `data: {…}` por evento, a cada ~1,5 s.

**Limite:** ao sair da aba, o servidor da zona continua gerando eventos para a conexão
fechada (D1). A conexão cai a cada troca de zona; o alvo é um `SharedWorker` no shell
(`arquitetura/alvo.md` §5).

## 5. Mapa com MapLibre GL — ✅

**Fazer:** abra `/remote-app?tab=map`. Clique nos botões de *Quick Jump* e nos pinos.

**Esperado:** o mapa carrega (precisa de internet para os ladrilhos do OpenStreetMap), os
botões fazem o mapa voar até a cidade e clicar num pino mostra o popup, preenche o banner
da cidade e dispara um toast.

## 6. Estado global: toast — ✅

**Fazer:** clique em **Ping Toast** no header, primeiro em `/` e depois em `/remote-app`.
Na zona, clique também em **Increment Counter (+1) & Dispatch Toast** no card da Visão geral.

**Esperado:** uma notificação aparece no canto e some sozinha em ~4,5 s, nas duas páginas.
Emissor e ouvinte usam o mesmo nome de evento, definido uma vez em `@mfe/shell-ui`.

## 7. Sessão no host, herdada pela zona — ⚠️

**Fazer:** em `/`, troque o usuário no seletor do header para *Mariana Lima (Viewer)*. Clique
em **Remote App**.

**Esperado:** na zona, o header e o banner *Active Zone Session* mostram Mariana, com tenant
`tenant-public-demo` e papel `viewer`. Trocando o usuário na zona e voltando para `/`, o
shell mostra a nova escolha.

**Limite:** é uma simulação no cliente. A escolha vive no `localStorage` da origem e só é
lida **depois** de a página carregar: por um instante (e em *Ver código-fonte*) aparece o
usuário padrão, Ana Souza. Não há cookie nem store de sessão; o servidor da zona não sabe
quem é o usuário (D3). O desenho alvo está em `arquitetura/alvo.md` §4.

## 8. Cache de servidor e de cliente — ✅

**Fazer:**

```bash
for i in 1 2; do curl -s http://localhost:3000/remote-app/api/server-data | grep -o '"requestId":"[^"]*"\|"cached":[a-z]*'; done
sleep 6
curl -s http://localhost:3000/remote-app/api/server-data | grep -o '"requestId":"[^"]*"\|"cached":[a-z]*'
curl -s -D - -o /dev/null http://localhost:3000/remote-app/api/server-data | grep -i cache-control
```

**Esperado:**
- As duas primeiras respostas têm o **mesmo** `requestId`, e a segunda vem com `"cached":true`
  (cache em memória da zona, TTL de 5 s).
- Depois de 6 s chega um `requestId` novo, com `"cached":false`.
- O cabeçalho `cache-control: public, s-maxage=5, stale-while-revalidate=10` orienta caches
  intermediários e o navegador.

## 9. Isolamento: a zona cai, o shell fica — ✅

**Fazer:** pare só a zona. O jeito mais simples é parar o `pnpm start` e subir apenas o shell:

```bash
pnpm start:host
```

Em outro terminal:

```bash
curl -si http://localhost:3000/remote-app | head -5
curl -si http://localhost:3000/remote-app-static | head -1
curl -si http://localhost:3000/ | head -1
```

**Esperado:**
- `/remote-app` → `503`, `content-type: text/html`, `retry-after: 5`, página "zona
  indisponível" (sem JavaScript).
- `/remote-app-static` → `503`.
- `/` → `200`: o shell continua funcionando.
- No navegador, clicar em **Remote App** mostra a página de erro servida pelo shell (HTML simples, sem a moldura).

Suba a zona de novo (`pnpm start:remote`): em ~1 s `/remote-app` volta a responder 200.

**Limite:** até ~1 s logo depois da queda ainda pode vir um 500 cru do Next
(`docs/design-bff/mfe/01-operacao.md` §5.1).

## 10. Fragmento entre zonas — ✅ (contrato) · ❌ (consumidor)

**Fazer:**

```bash
curl -si http://localhost:3000/remote-app/_fragmento/demo/42 | sed -n '1p;/content-type/Ip'
curl -s  http://localhost:3000/remote-app/_fragmento/demo/42 | grep -c '<script'
curl -si http://localhost:3000/remote-app/_fragmento/unknown/1 | head -1
curl -si -X POST http://localhost:3000/remote-app/_fragmento/demo/1 | head -1
```

**Esperado:** `200` com `text/html` e **0** `<script>`; `204` para fragmento desconhecido;
`405` para `POST`.

**Limite:** ainda não há outra zona consumindo o fragmento no servidor
(`arquitetura/alvo.md` §3).

## 11. Navegação entre zonas usa `<a>`, nunca `<Link>` — ✅

**Fazer:** com o *Network* aberto, clique em **Remote App** e depois em **Shell Home**.

**Esperado:** cada clique é um pedido de documento completo (tipo `document`), não uma
navegação do lado do cliente. `pnpm smoke:offline` (STATIC-03) falha se alguém trocar por
`<Link>`.

---

## Resumo

| # | Funcionalidade (POC.md) | Estado |
|---|---|---|
| 1 | Zona dentro da tela do shell (header + navegação) | ✅ |
| 2 | Server-Side Rendering | ✅ |
| 3 | Query params e rotas de caminho | ✅ |
| 4 | SSE | ⚠️ vazamento de intervalo (D1); reconecta a cada troca de zona |
| 5 | MapLibre GL | ✅ precisa de internet para os ladrilhos |
| 6 | Estado global: toast | ✅ |
| 7 | Sessão no host herdada pela zona | ⚠️ só no cliente, depois do carregamento (D3) |
| 8 | Cache servidor e cliente | ✅ |
| 9 | Queda isolada da zona | ✅ com janela de ~1 s (§5.1) |
| 10 | Fragmento | ✅ contrato · ❌ consumidor |
| 11 | `<a>` entre zonas | ✅ |

Os ✅ dos itens 1, 2, 3, 8, 9, 10 e 11 também são checados automaticamente
(`pnpm check`, `pnpm smoke`). Os itens 4 a 7 dependem de JavaScript no navegador e só
são verificáveis aqui (D9, D10 em `.agents/orchestrator/DEFERRED.md`).
