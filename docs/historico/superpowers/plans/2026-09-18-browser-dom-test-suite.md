# Suíte de Testes de Navegador/DOM — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrir comportamentos do ecossistema que dependem diretamente de APIs do navegador (localStorage, emissão de toasts, EventSource e MapLibre GL) com uma suíte de testes de cliente/DOM integrada ao CI, fechando D9 e D10 com documentação explícita de escopo e limitações.

**Architecture:** Utilização do `happy-dom` integrado nativamente ao `node --test` e `react-dom/client` (`createRoot` e `act`), permitindo montar componentes com ciclo de vida completo de hooks e `useEffect`, simular eventos do DOM (`window.dispatchEvent`, `CustomEvent`), isolar armazenamento (`localStorage`) e interceptar chamadas de rede/streaming (`EventSource`).

**Tech Stack:** Node.js `node --test`, `happy-dom`, React 18 (`react-dom/client`, `act`), TypeScript.

## Global Constraints

- Testes devem rodar com o comando padrão do projeto: `pnpm test` e `pnpm check`.
- Nenhuma dependência pesada desnecessária (sem Jest ou Vitest); uso do runner nativo `node --test`.
- Isolamento estrito entre testes: cada teste reseta globals do DOM (`window`, `document`, `localStorage`).
- Prefixar todos os comandos de terminal com `rtk`.
- Manter padrões de código do repositório: TypeScript estrito, funções enxutas, sem `any`, nomes descritivos.

---

### Task 1: Scaffolding do Ambiente DOM e Suporte Compartilhado de Testes

**Files:**
- Create: `packages/shell-ui/test/support/dom-environment.ts`
- Create: `apps/remote-app/test/support/dom-environment.ts`
- Create: `apps/host/test/support/dom-environment.ts`
- Modify: `package.json`
- Modify: `packages/shell-ui/package.json`
- Modify: `apps/remote-app/package.json`
- Modify: `apps/host/package.json`

**Interfaces:**
- Produces: `setupDomEnvironment(): { window: Window, document: Document, cleanup: () => void }`
- Produces: scripts npm `test:dom` em cada pacote e no root `package.json`.

- [ ] **Step 1: Criar helper `dom-environment.ts` compartilhado/local**
  Implementar helper que instancia `GlobalWindow` do `happy-dom`, inicializa `globalThis.window`, `globalThis.document`, `globalThis.IS_REACT_ACT_ENVIRONMENT = true`, e exporta função de teardown limpa.
- [ ] **Step 2: Configurar scripts de teste no `package.json` de cada app/pacote**
  Adicionar `"test:dom": "node --test test/dom-*.test.ts"` em `packages/shell-ui`, `apps/remote-app`, `apps/host`, e no root `package.json`.
- [ ] **Step 3: Validar que `pnpm test:dom` roda sem erros**
  Run: `rtk pnpm test:dom`
  Expected: PASS (0 testes ou suíte vazia sem falhas).

---

### Task 2: Testes de DOM para Toasts e Header (`packages/shell-ui`)

**Files:**
- Create: `packages/shell-ui/test/dom-toast-and-header.test.ts`
- Test: `packages/shell-ui/test/dom-toast-and-header.test.ts`

**Interfaces:**
- Consumes: `<ToastContainer />`, `<Header />`, `emitToast`, `MFE_EVENTS`.
- Tests:
  - `ToastContainer` escuta evento `mfe:toast` no window e renderiza o card de toast no DOM.
  - Vários tipos de toast (`info`, `success`, `error`, `warning`) renderizam classes CSS corretas.
  - Botão de fechar toast (`button.toast-close`) remove o toast do DOM.
  - Botão de Ping no `<Header />` dispara evento `mfe:toast` que é capturado pelo `ToastContainer`.
  - Mudança de usuário no `<select>` do `<Header />` invoca `onSessionChange`.
  - Desmontagem de `ToastContainer` remove o event listener de `window`.

- [ ] **Step 1: Escrever teste de montagem e captura de eventos do `ToastContainer`**
- [ ] **Step 2: Rodar teste e verificar aprovação**
  Run: `rtk pnpm --filter @mfe/shell-ui test:dom`
- [ ] **Step 3: Escrever teste de interação com o Header e despacho de toast**
- [ ] **Step 4: Rodar teste e verificar aprovação**
- [ ] **Step 5: Commit atômico**

---

### Task 3: Testes de DOM para Sessão no `localStorage` e Reinicialização de Aba (Cenário 1)

**Files:**
- Create: `apps/remote-app/test/dom-session-storage.test.ts`
- Test: `apps/remote-app/test/dom-session-storage.test.ts`

**Interfaces:**
- Consumes: `RemoteHomePage`, `readMirroredSession`, `writeMirroredSession`, `SESSION_STORAGE_KEY`.
- Tests (Cenário 1):
  - **Aba 1**: Monta página com sessão inicial default. Altera sessão para `Carlos Silva (Operator)`. Valida atualização no DOM, no `localStorage` (`host_user_session`) e no `document.cookie`. Desmonta (fecha aba 1).
  - **Aba 2 (Simulação de nova aba)**: Nova janela/DOM limpo mantendo o mesmo `localStorage` populado. Monta a página. O efeito lê o `localStorage` no mount e atualiza o estado da página e o banner de sessão (`data-testid="remote-active-session"`), exibindo o usuário persistido sem flash do default.
  - Valida tolerância quando `localStorage` está bloqueado/lança erro (modo privado).

- [ ] **Step 1: Escrever o teste para o Cenário 1 (reinicialização de aba)**
- [ ] **Step 2: Rodar teste e verificar aprovação**
  Run: `rtk pnpm --filter remote-app test:dom`
- [ ] **Step 3: Commit atômico**

---

### Task 4: Testes de DOM para `RemoteTelemetry` (`EventSource`)

**Files:**
- Create: `apps/remote-app/test/dom-telemetry-sse.test.ts`
- Test: `apps/remote-app/test/dom-telemetry-sse.test.ts`

**Interfaces:**
- Consumes: `<RemoteTelemetry />`, `SSE_EVENTS_PATH`.
- Tests:
  - `RemoteTelemetry` instancia `EventSource` apontando exatamente para `SSE_EVENTS_PATH`.
  - Disparo de `onopen` atualiza status no DOM para `CONNECTED` com indicador online.
  - Mensagens recebidas (`onmessage`) são parseadas e renderizadas na lista `.events-stream-list`.
  - Mensagem com `level: 'critical'` dispara evento de toast de erro no `window`.
  - Botão "Pause SSE Stream" fecha a conexão (`close()`) e exibe status `PAUSED`.
  - Botão "Clear Log" esvazia a lista de eventos.
  - Desmontagem do componente invoca `es.close()` garantindo liberação de recursos (cleanup).

- [ ] **Step 1: Escrever teste com mock de `EventSource` no DOM**
- [ ] **Step 2: Rodar teste e verificar aprovação**
  Run: `rtk pnpm --filter remote-app test:dom`
- [ ] **Step 3: Commit atômico**

---

### Task 5: Testes de DOM para `RemoteMap` (`maplibre-gl`)

**Files:**
- Create: `apps/remote-app/test/dom-map.test.ts`
- Test: `apps/remote-app/test/dom-map.test.ts`

**Interfaces:**
- Consumes: `<RemoteMap />`, `SAMPLE_MARKERS`.
- Tests:
  - Montagem do componente instancia `maplibre-gl.Map` apontando para o container HTML.
  - Carregamento inicial exibe marcadores de infraestrutura e botões de atalho de cidades.
  - Clique no botão de cidade (ex: "Tokyo" ou "Lisbon") invoca `map.flyTo` e atualiza o banner de detalhes com coordenadas.
  - Clique no marcador dispara eventos e toast informando a seleção.
  - Desmontagem do componente invoca `map.remove()` e cancela inicializações pendentes.

- [ ] **Step 1: Escrever teste com mock de `maplibre-gl` no ambiente DOM**
- [ ] **Step 2: Rodar teste e verificar aprovação**
  Run: `rtk pnpm --filter remote-app test:dom`
- [ ] **Step 3: Commit atômico**

---

### Task 6: Testes de DOM no Shell Host e Regressão D9 (`apps/host`)

**Files:**
- Create: `apps/host/test/dom-host-session.test.ts`
- Create: `apps/host/test/dom-outage-page.test.ts`
- Test: `apps/host/test/dom-host-session.test.ts`
- Test: `apps/host/test/dom-outage-page.test.ts`

**Interfaces:**
- Consumes: `HostHomePage`, `ErroDeZonaPage`.
- Tests:
  - `HostHomePage`: sincronização da sessão no `localStorage` e cookie no browser.
  - `ErroDeZonaPage` (Regressão D9): monta página de erro de zona no DOM e comprova categoricamente que nenhuma requisição de rede (`window.fetch`, XMLHttpRequest) é invocada em `useEffect` durante ou após a montagem.

- [ ] **Step 1: Escrever teste de DOM para `HostHomePage` e `ErroDeZonaPage`**
- [ ] **Step 2: Rodar testes do host e verificar aprovação**
  Run: `rtk pnpm --filter @mfe/host test:dom`
- [ ] **Step 3: Commit atômico**

---

### Task 7: Documentação de Escopo, Limitações e Integração no CI

**Files:**
- Create: `docs/testes-navegador.md`
- Modify: `TEST_INFRA.md`
- Modify: `README.md`

**Content:**
- Documentação explícita:
  - Escopo coberto: Ciclo de vida de componentes no cliente, manipulação do DOM, `localStorage`, `document.cookie`, custom events no `window`, conexões cliente de `EventSource` (SSE), renderização do mapa `maplibre-gl`, ausência de efeitos de rede em páginas isoladas.
  - Limitações: Simulação de layout/pixel engine, limitações de WebGL sem GPU físico, e transições de documento completo entre origens/portas (hard navigations multi-zones).
  - Guia de execução local e no CI (`pnpm test`, `pnpm test:dom`, `pnpm check`).
- [ ] **Step 1: Criar `docs/testes-navegador.md`**
- [ ] **Step 2: Atualizar `TEST_INFRA.md` e `README.md` com as referências**
- [ ] **Step 3: Rodar `pnpm check` completo**
- [ ] **Step 4: Commit atômico e fechamento das pendências**
