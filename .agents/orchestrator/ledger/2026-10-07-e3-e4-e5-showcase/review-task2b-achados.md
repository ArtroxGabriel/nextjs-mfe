# Revisão Task 2b (final)

## Spec Compliance
- ✅ `FalhaDeZona` com `motivo: 'sonda'` (tipo ampliado em `rotas-auth.ts` e doc do tipo atualizada), `codigo: 'ERRO_INTERNO'`, `supportId: randomUUID()`: igual ao `mapaVazio`.
- ✅ `registrarNoConsole(falha)` uma vez; `supportId` na página (`renderizarPaginaErroDeZona(zona.id, falha.supportId)`) e na decisão.
- ✅ Sem outra mudança: status 503, `retry-after`, `CABECALHOS_DA_PAGINA_DA_BASE` e o cache de saúde intactos; `proxy.ts` devolve `decisao.html`, que já leva o id.
- ✅ Teste novo (`test/proxy.test.mjs`) cobre decisão, `data-support-id` na página e a linha exata do log (captura `console.error`, restaura em `finally`); RED e mutação relatados no task-2b-report.md.
- ⚠️ Não reexecutei os testes (revisão somente leitura); confio no relatório (161/161, tsc, e2e 135/135).

## Strengths
- Mesmo padrão do `mapaVazio` e do gateway (`paginaDaBase`); sem abstração nova.
- Teste verifica o formato do log, não só a chamada.

## Issues
### Critical
Nenhum.
### Important
Nenhum.
### Minor
1. `repos/erp-shell/lib/decisao-proxy.ts:25`: comentário desatualizado: "Só no 503 de mapa vazio, que é falha a registrar; a sonda negativa é estado conhecido da zona." Agora também a sonda leva `supportId`. Fix: "Nos dois 503 (mapa vazio e sonda negativa): o id que a página mostra e a linha do log."
2. `repos/erp-shell/lib/decisao-proxy.ts:178-179` (`falha` com `motivo: 'sonda'`): o `mapaVazio` e este ramo repetem a montagem da falha + log + decisão; duplicação de 3 linhas, aceitável (não vale extrair).
3. O teste só cobre a sonda via `/zona1` com cookie; sem cookie a ordem (sonda antes do cookie) é a mesma, então não é lacuna real.

## Risco nomeado: log por requisição
- A sonda é cacheada ~1 s (`TTL_SAUDE_PADRAO_MS`, teto 10 s), mas o cache guarda o booleano; toda requisição a zona fora passa por aqui e gera uma linha com `supportId` novo. O volume é proporcional ao tráfego para a zona caída, não a 1/s.
- O caminho do gateway faz o mesmo: `paginaDaBase` chama `registrarFalha` com novo `randomUUID()` a cada 503 (`lib/gateway-zona.ts:62-64`), sem agregação; e o `mapaVazio` também. Logo é consistente com o padrão existente e com o invariante 12 (cada 503 mostrado ao usuário tem um id rastreável no log).
- Sob carga: uma linha curta (~90 bytes) por 503 em `console.error`; custo baixo e já aceito nos outros dois ramos. Não é bloqueante. Se virar problema, amostrar/agrupar por zona seria mudança nos três ramos juntos (fora do escopo), e perderia a correspondência 1 id = 1 linha.

## Assessment
**Task quality:** Approved. Correção mínima, fiel ao padrão do `mapaVazio`, com teste que falha sem ela; só resta o comentário do tipo `supportId` (Minor 1) a atualizar. O log por requisição é igual ao do gateway e não é problema novo.
