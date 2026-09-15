# TEST_READY — Refatoração Next.js Multi-Zones

> Para o passo a passo manual, veja `docs/ROTEIRO-DE-VERIFICACAO.md`; para os comandos do dia a dia, `README.md` §3.

## 1. Visão Geral e Status Operacional
A infraestrutura de testes End-to-End (E2E) opaque-box para a refatoração Multi-Zones está **PRONTA** e totalmente operacional.

A suíte de testes valida a transição arquitetural do Webpack Module Federation (`@module-federation/nextjs-mf`) para a arquitetura nativa Next.js Multi-Zones, conforme especificado em `PROJECT.md`, `ORIGINAL_REQUEST.md` e `docs/design-bff/mfe/`.

---

## 2. Como Executar os Testes

O executor de testes principal é `scripts/smoke-test.mjs`. Ele não requer dependências externas além do Node.js v18+ (testado no Node v26.8.1 e v24.7.0). Os caminhos são resolvidos a partir da própria localização do script, então ele pode ser iniciado de qualquer diretório.

As suítes unitárias rodam no executor de testes nativo do Node, sem `tsx`: `pnpm test` na raiz (packages/shell-ui, depois os dois apps), ou `node --test test/*.test.ts` dentro de um pacote ou app. Use o glob explícito: no Node 24.7, `node --test <dir>` executa zero testes e sai com 0.

### 2.1 Comandos Rápidos

```bash
# Standard Execution (Runs offline checks; probes and runs online checks if servers are online)
node scripts/smoke-test.mjs

# Offline Static Invariants Only (Zero-dependency audit for build/CI pipelines)
node scripts/smoke-test.mjs --offline

# Online Smoke Checks Only (Requires localhost:3000 and localhost:3001)
node scripts/smoke-test.mjs --online

# Strict CI Mode (Fails if any check fails OR if servers are unreachable)
node scripts/smoke-test.mjs --strict
```

### 2.2 Configuração de Ambiente
Você pode personalizar as URLs de destino do host e da zona via variáveis de ambiente:
```bash
HOST_URL=http://localhost:3000 ZONE_URL=http://localhost:3001 node scripts/smoke-test.mjs
```

---

## 3. O Que Realmente Roda

`TEST_INFRA.md` especifica uma matriz mais ampla de 4 camadas (173 casos documentados). Esse documento é uma
especificação: a maioria dos seus casos **não** é automatizada. O que roda hoje:

| Camada | Comando | Quantidade | Precisa de servidores |
|---|---|---|---|
| Unitário — chrome compartilhado | `node --test test/*.test.ts` em `packages/shell-ui` | 15 | não |
| Unitário — zona | idem, em `apps/remote-app` | 17 | não |
| Unitário — shell | idem, em `apps/host` | 46 | não |
| Invariantes estáticos | `node scripts/smoke-test.mjs --offline` | 7 (STATIC-01..07) | não |
| Smoke online | `node scripts/smoke-test.mjs --strict` | 17 (7 estáticos + ONLINE-01..10) | sim, 3000 e 3001 |

`pnpm check` roda o typecheck, todas as suítes unitárias e os invariantes estáticos. `pnpm smoke` roda o
smoke estrito. O comportamento de queda de zona é coberto pela suíte unitária do host contra uma zona simulada;
as checagens de queda ao vivo são manuais (veja `README.md` §3.3).

---

## 4. Casos de Teste de Smoke e Invariantes Executados

`scripts/smoke-test.mjs` executa tanto auditorias estáticas de invariantes via AST/grep quanto sondas HTTP dinâmicas ao vivo:

### 4.1 Checagens de Invariantes Estáticos (`STATIC-*`)
- `[STATIC-01]` **Zero referências a Module Federation**: varre `apps/` e `packages/` em busca de tokens banidos (`@module-federation`, `remoteEntry`, `NextFederationPlugin`, `remote/ServerCard`, `remote/RemoteDashboard`).
- `[STATIC-02]` **Propriedades opcionais estritas do TypeScript**: verifica `compilerOptions.exactOptionalPropertyTypes === true` em `apps/remote-app/tsconfig.json`.
- `[STATIC-03]` **Navegação com `<a>` HTML puro**: exige que a navegação entre zonas para `/remote-app` em `apps/host/pages/index.tsx` e no `packages/shell-ui/src/SideNavigation.tsx` compartilhado use tags `<a>` nativas e nunca o `<Link>` do Next.js; a navegação compartilhada não pode importar de `next/` de forma alguma.
- `[STATIC-04]` **Exclusão de DAL do shell**: verifica que não há pacotes de banco de dados nem camadas de acesso a domínio em `apps/host/package.json` ou `apps/host/pages/`.
- `[STATIC-05]` **Renomeação do diretório da zona**: verifica que `apps/remote` foi renomeado para `apps/remote-app` e que o nome em `package.json` foi atualizado.
- `[STATIC-06]` **Configuração de rewrites do host**: carrega `apps/host/next.config.js`, chama `rewrites()`, e exige exatamente as sources `/remote-app`, `/remote-app/:path*` e `/remote-app-static/:path*`, cada uma mantendo seu path em uma única origem de zona. (Antes de 2026-09-14 isso era uma checagem de substring que passava mesmo com a regra raiz removida, D4.)
- `[STATIC-07]` **Configuração da zona remota**: carrega `apps/remote-app/next.config.js` e exige `basePath === '/remote-app'` e `assetPrefix === '/remote-app-static'`.

### 4.2 Checagens de Smoke Online (`ONLINE-*`)
- `[ONLINE-01]` **Home do shell do host**: `GET http://localhost:3000/` retorna HTTP 200, renderiza os diagnósticos de runtime do shell, e inclui `<a href="/remote-app">`.
- `[ONLINE-02]` **Índice da zona via rewrite do shell**: `GET http://localhost:3000/remote-app` retorna HTTP 200, renderizando o conteúdo do índice do remote app.
- `[ONLINE-03]` **Health da zona via shell**: `GET http://localhost:3000/remote-app/api/health` retorna HTTP 200, `Content-Type: application/json`, e corpo `{"ok":true}`.
- `[ONLINE-04]` **Health da zona direto**: `GET http://localhost:3001/remote-app/api/health` retorna HTTP 200 `{"ok":true}` diretamente no processo da zona.
- `[ONLINE-05]` **Fragmento demo via shell**: `GET http://localhost:3000/remote-app/_fragmento/demo/42` retorna HTTP 200, `Content-Type: text/html; charset=utf-8`, contém `Demo fragment (id: 42)`, e estritamente não contém nenhuma tag `<script>` nem handlers inline.
- `[ONLINE-06]` **Fragmento demo direto**: `GET http://localhost:3001/remote-app/_fragmento/demo/42` retorna HTTP 200 com markup inerte diretamente na porta 3001.
- `[ONLINE-07]` **Fragmento desconhecido / não autorizado (mascaramento)**: `GET http://localhost:3000/remote-app/_fragmento/unknown/1` retorna HTTP 204 No Content com payload de 0 bytes.
- `[ONLINE-08]` **Método não permitido no fragmento**: `POST http://localhost:3000/remote-app/_fragmento/demo/1` retorna HTTP 405 Method Not Allowed.
- `[ONLINE-09]` **Proxy de asset estático**: `GET http://localhost:3000/remote-app-static/...` faz o proxy sem crash 5xx no servidor do host.
- `[ONLINE-10]` **Prefixo de zona com caixa mista permanece no shell**: `GET /REMOTE-APP` e `GET /Remote-App/api/health` no host retornam 404. Ambos respondem 200 vindos da zona se os rewrites derem match sem diferenciar maiúsculas de minúsculas, o que permitiria contornar o `middleware.ts` (veja `docs/design-bff/mfe/01-operacao.md` §5.1). Protege `experimental.caseSensitiveRoutes` entre upgrades do Next.

---

## 5. Semântica de Pass / Fail

### 5.1 Códigos de Saída
- **`0` (PASS)**: todos os casos de teste executados tiveram sucesso. No modo padrão sem `--strict`, se os servidores estiverem offline, checagens estáticas que passam resultam em saída `0`.
- **`1` (FAIL)**: uma ou mais asserções de teste falharam, ou os servidores de destino estavam offline quando `--strict` ou `--online` foi especificado.

### 5.2 Diagnóstico de Falhas
- Toda checagem que falha imprime o ID exato do teste, contexto descritivo, e a mensagem de falha subjacente (por exemplo, caminhos de arquivo específicos e tokens infratores para checagens estáticas, ou o status HTTP e corpo recebidos para checagens online).
- Quando os servidores de destino estão offline, o executor fornece instruções explícitas de como iniciá-los (`pnpm dev` ou `pnpm start`).

---

## 6. Documentos de Referência Autoritativos
- `TEST_INFRA.md`: especificação completa da filosofia de testes, metodologia de 4 camadas, e a matriz completa de mapeamento de 16 features.
- `PROJECT.md`: princípios de arquitetura do monorepo, responsabilidades por milestone, e contratos de interface.
- `ORIGINAL_REQUEST.md`: requisitos R1–R6 e critérios de aceitação.
