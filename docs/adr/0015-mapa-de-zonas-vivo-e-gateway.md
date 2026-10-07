# ADR-0015: mapa de zonas vivo e gateway de zona no shell

**Status:** aceito (humano, 2026-10-07), com o pacote recomendado do pedido [`pedidos/2026-10-07-c3-mapa-de-zonas.md`](../../pedidos/2026-10-07-c3-mapa-de-zonas.md): H1 i, H2 h (híbrido), H3 i, H4 i, H5 i, H6 i. Proposto pelo `arquiteto-mfe` e revisto depois da medição de custo.

**Atividade:** C3 (#14).

**Fecha, se aceito:** `DEFERRED.md` D7 e os itens de roteamento do D28.

## Contexto

O C3 pede que uma **zona nova entre sem editar o `zonas.json` nem republicar o shell**. Do D7 veio um segundo requisito: quando a zona trava, o shell responde com a **página de indisponível da base, dentro de `ERP_ZONA_TETO_MS`** (10 s), e não com o 500 cru do Next.

Hoje o shell gera `rewrites()` a partir do `zonas.json` (`repos/erp-shell/next.config.ts`, `lib/zonas.ts`). Conferido no Next 16 do shell (`node_modules/next/dist/server/lib/`):

- `rewrites()` é avaliado no build e fica congelado no `routes-manifest.json` (`router-utils/filesystem.js:229`, `:289-299`). Zona nova por esse caminho exige um build novo do shell.
- O rewrite para URL externa feito no `proxy.ts` (`NextResponse.rewrite`) cai no mesmo `proxyRequest` dos rewrites de configuração (`resolve-routes.js:466-476` e `:593-598`, que chegam em `router-server.js:415-417`). No estouro do `proxyTimeout`, o `onProxyError` escreve `Internal Server Error` sem gancho (`proxy-request.js:77-87`). Trocar o lugar do rewrite não resolve o requisito do D7.

O manifesto v2 da zona é só `{ id, nome, funcionalidades }` (invariante 17, ADR-0014 adendo 1): **não traz origem**.

## Opções consideradas

| | Mecanismo | Zona nova sem republicar | Página dentro do teto | Por que não / custo |
|---|---|---|---|---|
| a | `NextResponse.rewrite(urlExterna)` no `proxy.ts`, mapa lido em execução | sim | **não** (mesmo 500 cru) | o mais barato; reabre a decisão do D7 |
| **h** | **híbrido: documento pelo gateway, o resto pelo rewrite do `proxy.ts`** | sim | **sim, até o primeiro byte** | custo do gateway só nos pedidos de documento; Server Action em zona travada continua com o erro cru |
| b | gateway para tudo: route handler curinga do shell que faz o proxy reverso | sim | sim, até o primeiro byte | de 2 a 4,5 vezes mais CPU no shell por requisição (medido); WebSocket não atravessa |
| c | proxy reverso na borda (nginx/Traefik dinâmico) | sim | sim (`error_page`) | tira o `proxy.ts` do caminho da zona: caem renovação proativa (invariante 15), sonda, recusa de `_fragmento` (C1b) e `traceparent` |
| d | mapa lido no boot e reinício do shell | depende de H1 | depende de (a) ou (b) | não atende se "republicar" incluir o rollout do shell |

## Decisão

1. **Híbrido.** O `proxy.ts` lê o mapa vivo e decide por requisição. A navegação de documento (`Sec-Fetch-Dest: document`) vai para o gateway, um route handler interno do shell (`lib/gateway-zona.ts`), que entrega a página da base no estouro do teto. RSC, arquivos estáticos e Server Actions vão por `NextResponse.rewrite` para a origem do mapa, o caminho rápido do Next. Saem o `rewrites()` do `next.config.ts` e o `experimental.proxyTimeout` deixa de ser o teto dos documentos. Uma busca de RSC que falha vira navegação de documento no próprio Next (`fetch-server-response.js:143-148`) e cai no gateway.
2. **Prefixo por convenção:** `/{id}` (já é a regra em `lib/zonas.ts` e no ADR-0014). Prefixo não se registra.
3. **Origem por registro de rota no deploy**, separado do manifesto v2: `{ id, origem, registradaEm }`. O script de deploy da zona registra a origem lida do ambiente (`ERP_ZONA_ORIGEM_INTERNA`). O código da zona continua sem declarar origem (invariante 17 intacto).
4. **Fonte do mapa: o domínio de gestão de acesso.** `POST /v2/zonas/{id}/rota` só aceito de `svc.{id}`, com auditoria; `GET /v2/zonas` só de `svc.shell`. O shell lê pelo registro de destinos, com credencial de serviço própria (`@erp/nucleo/shell`, `nucleo.zonas.listar()`; invariante 4).
5. **O shell valida sozinho**, sem confiar só no domínio: `id` no formato e fora das rotas reservadas; origem `http`/`https` sem credencial, caminho nem query, com o host casando `ERP_ZONAS_ORIGENS_PERMITIDAS` (lista de padrões, para uma zona nova caber sem editar a configuração do shell). O alvo é montado com `new URL(caminho, origem)` a partir do mapa, nunca de cabeçalho; `redirect: 'manual'`.
6. **Mapa vivo com último mapa bom.** TTL `ERP_MAPA_ZONAS_TTL_MS`; o último mapa bom fica em memória e no Redis (chave gravada só pelo shell). Fonte fora: segue o último bom e registra. Boot frio sem fonte nem Redis: caminho com forma de zona responde 503 com a página da base. Esse cache **é núcleo**, não extensão: desligá-lo muda a resposta quando a fonte cai (padrão C-011). Não fere o invariante 13: o mapa não tem dado de usuário.
7. **Semântica do teto, nos documentos.** `ERP_ZONA_TETO_MS` passa a contar até os **cabeçalhos** da zona chegarem (`AbortSignal`); no estouro, página da base com `supportId` e `no-store`. Depois do primeiro byte, `ERP_ZONA_OCIOSIDADE_MS` corta a resposta parada, **sem página** (o status já saiu). Isso é limite declarado de qualquer mecanismo com streaming.
8. **Fica no `proxy.ts`:** sessão, renovação proativa, sonda (para o 503 rápido) e a recusa de `_fragmento`. O gateway repete a recusa de `_fragmento` como defesa em profundidade.
9. **Zona não expõe WebSocket nem upgrade.** O SSE do C2 é `/api/stream`, do shell (ADR-0008, decisão 8). Custo declarado: o HMR de zona não atravessa o shell no `next dev`.
10. Sem porta nova no núcleo: a origem do mapa não varia (é migração do `zonas.json` para a gestão de acesso, não coexistência).

## Consequências

- **Risco central:** o gateway repassa `__Host-session` à origem. Quem registra uma origem lê a sessão de quem abre aquele prefixo. Controle: só `svc.{id}` registra `{id}`; origem na lista de padrões do shell; registro auditado no domínio.
- **Trabalho de cabeçalhos no gateway, cada item com teste:** `Set-Cookie` múltiplo; hop-by-hop removidos; o corpo comprimido da zona repassado como veio, com `node:http` (com `fetch`, o Node descomprime e o Next não recomprime: a página chegava 18 vezes maior); `Location` repassado e reescrito se vier com a origem interna; `x-forwarded-host`/`proto` (sem eles a checagem de origem das Server Actions recusa); corpo com `duplex: 'half'`; cabeçalhos de RSC.
- **Desempenho (medido em 2026-10-07, detalhes no pedido):** o gateway acrescenta menos de 1 ms com pouca carga e custa de 2 a 4,5 vezes mais CPU no shell por requisição. No híbrido esse custo fica só nos pedidos de documento.
- **N8:** a exceção da sonda passa a ser "origens do mapa validado", e entra `erp-shell/lib/gateway-zona.ts` (só `node:http`, alvo só do mapa validado). Muda o `AGENTS.md` (invariante 4).
- **Fica como está:** o fragmento entre zonas segue com `ZONA2_URL` (ADR-0011, decisão 4); convergir com o mapa é futuro.

## Documentos a atualizar, se aceito

`AGENTS.md` (invariante 4, tabela "Onde colocar"); `docs/desenho/mfe/01-operacao.md` §2.1 e §4; `02-zonas.md` (criar zona ganha o registro de rota); adendos ao ADR-0008 e ao ADR-0014 (credencial de serviço do shell, H4); nota no ADR-0011; `docs/CONFIGURACAO.md` (`ERP_ZONA_TETO_MS` com a semântica nova, `ERP_ZONA_OCIOSIDADE_MS`, `ERP_MAPA_ZONAS_TTL_MS`, `ERP_ZONAS_ORIGENS_PERMITIDAS`, `ERP_ZONA_ORIGEM_INTERNA`); `docs/arquitetura/alvo.md` §6 e `atual.md`; `base/verificacao/saida-de-rede.mjs`; `DEFERRED.md` (fechar D7 e D28).

## Fatias de implementação (se aceito)

1. Stub de gestão de acesso: `POST /v2/zonas/{id}/rota` e `GET /v2/zonas`, com as recusas (outro id, origem fora da lista, id reservado, leitor que não é `svc.shell`).
2. Núcleo 0.11 (`@erp/nucleo/shell`): `nucleo.zonas.listar()` pelo destino da gestão de acesso; lockstep.
3. Shell, `lib/mapa-zonas.ts`: validação, TTL, último bom em memória e no Redis.
4. Shell, gateway: route handler, teto, página com `supportId`, cabeçalhos. Ponta a ponta: L9 exige a página (não mais 500) dentro do teto; L9b (chamadas lentas em sequência); L9c (streaming começado e parado: corte medido); RSC e Server Action seguem pelo caminho rápido; C1b sem mudança.
5. Deploy das zonas: registro de rota nos scripts e no `task`. Ponta a ponta: zona nova de teste registrada aparece em até um TTL sem reiniciar o shell; desregistrada some.
6. Limpeza: saem `rewrites()`, `proxyTimeout` e o `zonas.json` (H6); N8 e documentos.
7. Medição do custo contra as zonas de verdade, para confirmar a medição sintética.
