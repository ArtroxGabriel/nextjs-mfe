# Guia e Escopo dos Testes de Navegador / DOM

Este documento detalha o escopo, arquitetura, limitações e procedimentos de execução da suíte de testes de cliente/DOM integrada ao repositório `nextjs-mfe`.

---

## 1. Motivação e Abordagem Arquitetural

A suíte original de testes unitários do projeto validava contratos de renderização server-side (`react-dom/server`) e semântica de rede HTTP. No entanto, comportamentos de cliente que dependem de APIs do navegador (`localStorage`, `document.cookie`, `CustomEvent`, `EventSource`, WebGL / `maplibre-gl` e hooks de efeito `useEffect`) não eram exercitados por esses testes.

Para manter a filosofia de testes rápidos, independentes e sem dependências pesadas de orquestradores externos (evitando o peso e lentidão de Jest, Vitest ou Playwright completo para testes de componente), a infraestrutura utiliza:
- O test runner nativo do Node.js (`node --test`).
- `happy-dom` (ambiente de DOM leve e compatível com as Web APIs modernas).
- React 18 `createRoot` e utilitário `act` para orquestração de renderização e despache de efeitos de ciclo de vida.

---

## 2. Escopo Coberto

A suíte cobre 5 grandes áreas comportamentais em testes dedicados:

### 2.1 Persistência e Recuperação de Sessão em `localStorage`
- **Arquivo**: `apps/remote-app/test/dom-session-storage.test.ts`
- **Cenário 1 (Critério de Aceitação)**: Simulação de ciclo de vida de abas do navegador:
  - Aba 1 grava uma sessão atualizada no `localStorage`.
  - O DOM é descartado (simulando fechamento da aba).
  - Aba 2 é instanciada com novo DOM e inicializada com a sessão padrão de SSR; o hook de cliente detecta e reconcilia a sessão gravada pela Aba 1.
  - Aba 2 atualiza para um terceiro usuário; Aba 3 é aberta e lê com sucesso a nova sessão.
- **Resiliência a Falhas**: Validação de tolerância a exceções de storage (modo anônimo, restrições de segurança ou quotas esgotadas), garantindo que a aplicação degrade com segurança para estado em memória sem travar a interface.

### 2.2 Notificações e Barramento de Eventos de Toast
- **Arquivo**: `packages/shell-ui/test/dom-toast-and-header.test.ts`
- **Emissão e Consumo**: Disparo de eventos `mfe:toast` via `window.dispatchEvent` e renderização reativa no `ToastContainer`.
- **Interação**: Fechamento manual de toast via clique no botão de descarte e verificação de remoção do elemento no DOM.
- **Prevenção de Vazamento**: Limpeza de timeouts de auto-dismiss e desregistro de event listeners na desmontagem do componente (`root.unmount()`).

### 2.3 Streaming em Tempo Real com `EventSource` (SSE)
- **Arquivo**: `apps/remote-app/test/dom-telemetry-sse.test.ts`
- **Contrato de Conexão**: Instanciação de `EventSource` apontando para o caminho sob o `basePath` da zona (`/remote-app/api/sse-events`).
- **Processamento de Eventos**: Recebimento de mensagens, deserialização de telemetria e emissão automática de toasts para eventos de nível crítico.
- **Controles de Fluxo**: Teste de pausar/retomar transmissão e encerramento limpo do socket SSE na desmontagem.

### 2.4 Integração com Mapa (`RemoteMap` / MapLibre GL)
- **Arquivo**: `apps/remote-app/test/dom-map.test.ts`
- **Ciclo de Vida do Motor**: Inicialização de instância `maplibre.Map` com container, coordenadas iniciais e controles de navegação.
- **Carregamento e Pins**: Remoção de overlay de carregamento quando o evento `load` é disparado e injeção de marcadores personalizados.
- **Navegação Rápida (Quick Jump)**: Clique em botões de cidades, disparo de `flyTo` com as coordenadas correspondentes, atualização do banner e emissão de eventos `mfe:map-select` e `mfe:toast`.
- **Desmontagem**: Invocação garantida de `map.remove()` na desmontagem para evitar vazamento de memória WebGL.

### 2.5 Reconciliação do Host Shell e Regressão de Queda (D9)
- **Arquivos**: `apps/host/test/dom-host-session.test.ts` e `apps/host/test/dom-outage-page.test.ts`
- **Reconciliação no Host**: Sincronização entre `initialSession` (SSR), `localStorage` e escrita do cookie `host_user_session` no `document.cookie` após interação no seletor de usuário.
- **Garantia de Isolamento em Queda (D9)**: Montagem da página `ErroDeZonaPage` no DOM com espionagem de rede para assegurar matematicamente que **zero chamadas de rede ou efeitos colaterais** são disparados ao renderizar o estado de erro da zona.

---

## 3. Limitações Conhecidas e Escopo Não Coberto

| Característica | Comportamento no Teste de DOM | Limitação / Por que não é coberto |
|---|---|---|
| **Renderização WebGL / GPU** | O motor MapLibre é testado com mock estruturado de sua interface e ciclo de vida. | Ambientes headless em Node.js (CI / sem servidor gráfico X11/Wayland) não possuem aceleração por hardware ou compilador de shaders WebGL2. O teste valida chamadas de API, coordenadas e ciclo de vida, mas não a rasterização visual dos pixels. |
| **Navegação de Documento (`<a>`)** | O clique em links `<a>` é inspecionado estruturalmente (`href`, target e ausência de manipuladores cliente). | `happy-dom` não executa a requisição HTTP nem troca o documento de processo de forma completa como um navegador real faria. Para testes de transição de documento ponta a ponta, utiliza-se a suíte de smoke e testes E2E com servidores ativos. |
| **Cálculo de Layout Geométrico (Reflow/Repaint)** | O DOM possui estrutura e classes CSS válidas. | O DOM virtual não computa bounding boxes visuais precisos (`getBoundingClientRect`) com base em fontes do sistema operacional e mecanismo de renderização WebKit/Blink. |
| **Conexões de Rede Reais para Tiles** | Tiles de mapa (`tile.openstreetmap.org`) não são baixados durante os testes. | Testes devem ser herméticos e funcionar 100% offline sem depender de provedores externos de mapas. |

---

## 4. Como Executar os Testes

### 4.1 Execução da Suíte DOM Específica
Para rodar exclusivamente os testes de DOM em todos os workspaces:
```bash
pnpm test:dom
```

Para rodar em um workspace específico:
```bash
# Na zona remota:
pnpm --filter remote-app test:dom

# No host shell:
pnpm --filter @mfe/host test:dom

# Na biblioteca de interface:
pnpm --filter @mfe/shell-ui test:dom
```

### 4.2 Integração Contínua (CI) e Validação Geral
Os testes de DOM foram nomeados com o prefixo `dom-*.test.ts` dentro dos diretórios `test/`. Como os scripts existentes de teste executam `node --test test/*.test.ts`, **todos os testes de DOM já são executados automaticamente** durante as etapas padrão do fluxo de CI:

```bash
# Executa todos os testes unitários e de DOM:
pnpm test

# Executa o pipeline de checagem completa pré-commit (tipos, testes e smoke offline):
pnpm check
```
