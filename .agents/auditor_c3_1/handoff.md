# Handoff auditor_c3_1 (final)

Gate do C3, iteração 1. Auditor forense com poder de veto.

**Veredito: VETO (só por teste).** Nenhum defeito de produto achado. Uma mutação de boa-fé, simétrica a uma declarada, sobrevive a toda a suíte (N06).

## Etapas
1. [x] Reaplicar amostra das mutações declaradas
2. [x] Mutações novas de boa-fé
3. [x] Integração ponta a ponta (5 mutações no shell)
4. [x] Regressão por família com o fonte limpo

## Números
59 mutações (registro completo em `mutacoes.txt`, com arquivo, mudança, comando, resultado e teste que reprovou): 51 pegas, 8 vivas.

## Etapa 1: mutações declaradas (14, todas pegas)
T3 M1, M2, M5; T4 M1, M3, M4, M8, M9 (no proxy e no gateway), M10, M11; T1 M1, M2; colapso de `//` no `Location` (Task 5). Cada uma reprovou o teste que o relatório do worker aponta.

## Etapa 2: mutações novas (40; 32 pegas, 8 vivas)
Pegas, entre outras: `Host` da requisição repassado (N01); alvo pelo `x-forwarded-host` (N03); `HEAD` no caminho rápido (N04); `OPTIONS` no gateway (N05); guarda do Redis sem revalidar (N08); TTL ignorado (N09); retentativa curta com mapa cheio (N10); nomeados em `Connection` nos dois sentidos (N11, N12); produção sem `ERP_ZONAS_ORIGENS_PERMITIDAS` (N14) e subida sem conferi-la (N15); ociosidade sem rearmar (N17); cliente que fecha sem soltar a zona (N18); 503 sem `no-store` (N19); `%5Fgateway` sem decodificar (N20); id `-static` (N21); `_fragmento` antes da sonda (N23); teto contando o corpo (N25); stub aceitando `svc.shell` para gravar (N26), `DELETE` de rota alheia (N27), origem com query (N28), `-static` dos reservados (N29), 403 em vez de 404 no mapa (N30); `registrar-rota.ts` lendo id do ambiente (N32, N32b) e seguindo redirecionamento (N34); N8 aceitando `fetch` no gateway (N33); estático indo ao gateway (N36); mapa vazio dando 503 fora da forma de zona (N38); falha da fonte martelando (N39); `@` no formato da origem (N45); zona sem cookie seguindo (N49).

Vivas e classificação:
- **N06** (`lib/mapa-zonas.ts`, `encontrar`: `startsWith(z.prefixoEstatico)` sem a barra): **falha de teste de boa-fé, motivo do veto.** É a M8 declarada aplicada ao ramo do prefixo estático. Com ela, `/zona1-staticx/...` casa a `zona1`; uma zona registrada com id `zona1-staticx` (id válido no stub e no shell) perde os documentos para a `zona1`, com o cookie de sessão. Impacto baixo (exige dois ids com essa forma), mas o teste "encontrar ... nao casa /zona10 nem /zona1x" não cobre o ramo estático, e nenhum caminho do ponta a ponta tem essa forma. Correção só em teste: em `test/mapa-zonas.test.mjs`, `encontrar('/zona1-staticx/a.js')` dá `null` (e, com as duas zonas no mapa, `zona1-staticx` acha a própria).
- N02 (`x-forwarded-host` do navegador preferido ao `host`): sem impacto a mais; o `host` que o gateway usa hoje também vem do navegador, e nenhuma zona nem o núcleo lê `x-forwarded-host`. Sugestão barata: mandar `x-forwarded-host` forjado no teste do eco.
- N07 (`caminhoNaZona` sem a barra): equivalente; só é chamada com caminho que já casou o prefixo com a barra.
- N13 (`renderizarPaginaErroDeZona` sem o `SEGURO`): equivalente com os chamadores atuais (todo id que chega já passou pelo formato `^[a-z0-9][a-z0-9-]*$`, e o `pathname` vem codificado). Defesa em profundidade sem teste; sugestão: um teste com id hostil, como o `escapar` do C1.
- N16 (gateway repassa `x-middleware-*` do pedido): sem exposição a mais que o caminho rápido, que repassa os mesmos cabeçalhos; o Next filtra os internos (`server-ipc/utils.js`).
- N22 (id repetido aceito): equivalente; a fonte não repete id (o stub substitui).
- N24 (`Location` comparado por host, não por origem): impacto nulo (só relativiza um destino interno de outro esquema).
- N31 (stub tratando o login da pessoa como serviço): artificial, não é edição de boa-fé.

## Etapa 3: integração (5 mutações no shell, todas pegas)
Ambiente do `task verificar:redis`, `CONSTRUIR=1` (build do shell refeito em cada uma), `node --test` filtrado por nome:
- E1 documento pelo caminho rápido: L9, L9b, L9c reprovam (500 em 6016 ms, não 503).
- E2 sem `skipProxyUrlNormalize` (só o ponta a ponta pega): L10, RSC 307.
- E3 `/_gateway` alcançável: `/_gateway/zona1` com cookie dá 200.
- E4 teto 5x na fiação da rota do gateway (só o ponta a ponta pega): L9 e L9b.
- E5 instância do mapa com `*:*` na fiação (só o ponta a ponta pega): L11, origem fora da lista roteou.

## Etapa 4: regressão com o fonte limpo
Shell `pnpm test` 158/158; stub `pnpm test` 83/83; `task scripts:test` 29/29; `task verificar:estatica` 52/52; `task verificar:redis` 135/135 (build do shell refeito do fonte limpo às 15:59; `precisaConstruir` do shell dá `false` depois).

## Estado das árvores
Limpas: `repos/erp-shell`, `repos/erp-zona-1`, `repos/erp-zona-2`, `repos/erp-zona-acesso`. `repos/erp-dominio-stub/pnpm-lock.yaml` e o ponteiro de `repos/erp-moldura` estavam modificados antes (não são meus). No principal, só `.agents/auditor_c3_1/` novo. Nenhum commit, nenhum token ou cookie gravado.

## Para a iteração seguinte (só auditor novo)
Reaplicar N06 e provar que o teste novo a pega; regressão por família. Opcionais, sem veto: testes para N02 e N13.
