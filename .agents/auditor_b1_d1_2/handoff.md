# auditor_b1_d1_2 — handoff

Gate B1+D1, iteração 2. Auditor forense com veto. 2026-09-22.

## Veredito: **INTEGRITY VIOLATION**

106 mutações e contornos: 77 mutações no código (54 pegas, 23 sobreviventes) e 29 contornos das
checagens estáticas testados direto no analisador (1 pego, 28 sobreviventes). Uma linha por item em
`mutacoes.txt`. Saída bruta em `anexos/`: `lote.log` (cada mutação), `contornos-estatica.log`,
`redis-queda.log`, `e2e-base.log`, `e2e-final-arquivo.log`, `e2e-final-redis.log`.

## Método
- **Núcleo, moldura e shell (unidade):** mutação no `src`, depois `pnpm test` do repositório (o do
  núcleo roda tsc + fronteira + `node --test`), e restauração do arquivo. `rc=2` no log quer dizer
  que o tsc recusou a mutação.
- **Apps (ponta a ponta):** mutação no fonte, depois `CONSTRUIR=1 node --test base/verificacao/*.test.mjs`
  (E11 com `REDIS_URL`, no modo Redis).
- **Núcleo visto pelas apps (E12, E14):** mutação no `dist` instalado. O `dist` é um hardlink que as 4
  apps e o store do pnpm dividem, então a mutação foi escrita e restaurada no mesmo inode, com
  `CONSTRUIR=tudo`. Depois da interrupção, conferi o `dist` contra o backup e contra o tarball
  `nucleo-0.8.2.tgz` do Verdaccio: está igual, e o hash das 4 apps é `3318341c…`, o mesmo do início.
- **Contornos:** `analisarSeguranca` e `analisar` chamados direto com os fontes do contorno
  (`anexos/contornos-estatica.log`).
- **Fallback v2:** rodei um teste temporário no `test/` do núcleo contra um domínio falso (o arquivo
  já foi apagado). **Redis caindo:** o cliente de `lib/redis.ts` ligado por um proxy TCP que eu derrubei.
- `erp-dominio-stub` não foi mutado. Os dados dele, conferidos contra a cópia, estão iguais.

## Vetos
- **V1 — invariante 15.** A zona pode gravar e encerrar sessão (E01 SURVIVED, 60/60). O
  `lib/redis.ts` das zonas é igual ao do shell e expõe `set` e `del` num Redis único e sem ACL.
  `clienteRedis.set('erp:sessao:'+hash, …)` numa zona passa. O teste "N3 estático" só procura o texto
  `@erp/nucleo/shell`, e a zona ainda pode fazer SCAN/GET de toda sessão, com o accessToken.
  *Correção:* usuário ACL do Redis só de leitura para as zonas (`+get ~erp:sessao:*`) com `REDIS_URL`
  próprio; o `lib/redis.ts` da zona expõe só `get`; teste que reprove `.set(`/`.del(` ou import de
  `redis` fora de `lib/redis.ts` nas zonas; no showcase, verificar que um SET com a credencial da zona
  é recusado.
- **V2 — invariante 15.** `@erp/nucleo/app` exportando `criarNucleoDoShell` passa (N38 SURVIVED).
  O teste de fronteira só confere a raiz, e `fronteira.mjs` permite `app → fabricas`.
  *Correção:* estender o teste "invariante 15" a `dist/app/index.js` (e a todo subpath que não seja
  `/shell`).
- **V3 — invariante 3.** A checagem de `server-only` se contorna. N08 e N43 sobrevivem: um comentário
  com o texto `import 'server-only'` satisfaz `fronteira.mjs`, que usa `includes`. E02 sobrevive:
  nenhum teste confere `server-only` nos módulos das apps que tocam sessão (`lib/redis.ts`,
  `lib/nucleo.ts`, `lib/pagina.ts`). Nos contornos, `'use client';` com ponto e vírgula, ou com um
  comentário antes, desliga toda a regra P0 (XE01, XE02), e também passam import transitivo, reexport
  e `import()` dinâmico (XE03–XE06). Hoje o `next build` pega o server-only transitivo (E09), mas a
  regra própria não.
  *Correção:* conferir a diretiva pelo AST (primeira declaração `ExpressionStatement` de string);
  exigir o nó `ImportDeclaration` `'server-only'` e não o texto; aplicar a regra aos `lib/` das apps
  que importam `next/headers`, `redis` ou `@erp/nucleo`.
- **V4 — invariantes 9 e 16, fallback do acesso v2 (fail-open).** Qualquer erro no `/v2/eu` (403,
  401, 500, timeout, corpo sem `modulos`) cai no `/v1/modulos-permitidos` e **concede** o que o v1
  disser (sonda: 403 → `["zona1.painel"]`). Se o domínio nega no v2, o BFF ignora a negação.
  Nenhum teste cobre o fallback: N27 e N31 sobrevivem. O ponta a ponta nunca exercita o v2: o stub
  em 4010 não serve `/v2/eu`, então todo pedido paga um 404 antes de ir ao v1, e tirar `/v2/eu` do
  registro passa (E07). O comentário do código diz "se a rota não estiver declarada", mas o código
  cai em qualquer erro.
  *Correção:* cair no v1 só com `DestinoInvalido` (rota não declarada) e, se for mesmo desejado,
  com `NaoEncontrado`; propagar 401, 403, 5xx e timeout. Testes: 403, 500 e timeout no v2 não chamam
  o v1; o ponta a ponta sobe o `gestao-acesso-v2` (4020) ou serve `/v2/eu` no 4010.
- **V5 — invariante 2.** Um DTO inteiro vai para a ilha `'use client'` por spread (E10 SURVIVED,
  60/60, e o estático não viu). A regra só olha o **nome** do atributo JSX: `{...r}`, `dados={recurso}`,
  `{...{custo}}` e `custoTotal=` passam (XE07–XE10).
  *Correção:* no estático, reprovar `JsxSpreadAttribute` e prop de valor objeto em componente
  importado de módulo `'use client'`. No ponta a ponta, o teste do custo também deve procurar o
  objeto serializado (`"custo":`) no payload RSC da página do bruno, depois de uma ilha.
- **V6 — invariante 16.** `exigirModulo(id, funcionalidade)` de `@erp/nucleo/app` ignora a
  funcionalidade e passa (N17 SURVIVED). O teste de páginas nunca chama com funcionalidade; só o
  `nucleo.acesso.exigirModulo` é testado (N13). Nenhuma app usa isso ainda, mas é a API publicada
  do ADR-0014.
  *Correção:* testar em `paginas.test.mjs` funcionalidade concedida → passa, ausente → `naoEncontrado`,
  e módulo sem `funcionalidades` → `naoEncontrado`.
- **V7 — invariante 11.** A regra P2 não cobre "endpoint interno" (`NEXT_PUBLIC_DOMINIO_A_URL`
  passa, XE20) nem `ACCESS` (XE22), e não varre `next.config.ts` (`env:`).
  *Correção:* reprovar todo `NEXT_PUBLIC_*` fora de uma allowlist explícita e varrer
  `next.config.ts`.
- **V8 — invariante 4 (N8).** `Reflect.get(globalThis, 'fe'+'tch')`, `getOwnPropertyDescriptors`,
  `createRequire(...)('undici')` e `child_process` passam (XR04–XR07).
  *Correção:* reprovar `Reflect.get`/`getOwnPropertyDescriptor(s)` sobre `globalThis`/`window`,
  `createRequire` e `node:child_process`/`worker_threads`, e acrescentar cada contorno como caso do
  teste.

## Lacunas sem veto
- **L1 (B3).** O health não tem efeito algum. Um health que chama o domínio e devolve dados e a
  origem interna passa (E05), e um health que responde 404 continua "no ar" (E06c): a sonda aceita
  `< 500`, e o proxy da zona já dá 307. *Correção:* a sonda exigir `200` e `{status:'ok'}`, e um teste
  estático para que `api/health/route.ts` não importe `@/lib/*` nem `@erp/nucleo`.
- **L2 (B5a).** Configuração: não existe teto, então `ERP_SONDA_TIMEOUT_MS=600000` é aceito, apesar
  de `docs/CONFIGURACAO.md` dizer "fora da faixa é erro". O `lerNumeroPositivo` do núcleo não tem
  teste (N33, N34, N36), e o da telemetria aceita fração (S10). Valor inválido **não** cai no padrão:
  o erro sobe na subida, e isso é testado no shell. *Correção:* faixa mín./máx. por variável e um
  teste do núcleo.
- **L3.** A sonda aceita `redirect: 'follow'` (S01), TTL de 60 s (S05) e sem `no-store` (S06), sem
  teste que reprove.
- **L4.** Com o Redis caindo depois de conectado, a 1ª chamada falha em 2 ms. As seguintes esperam
  5 s (`connectTimeout` padrão do node-redis) antes do `ERRO_INTERNO`, e cada requisição trava 5 s.
  *Correção:* `socket.connectTimeout` e `disableOfflineQueue` configuráveis (docs/CONFIGURACAO.md).
  Nada no ponta a ponta derruba o Redis.
- **L5.** `acesso.test.mjs` sobe servidores sem `try/finally { s.close() }`. Quando um teste reprova,
  o processo trava (N13, N26, N28–N30b só terminaram por timeout). Sem `timeout` externo, a suíte
  nunca acaba.
- **L6.** `obterEu` traz CPF e e-mail (`/v2/eu`) e engole todo erro como `null`. Nenhuma app usa essa
  função hoje (N15 é equivalente, N32 sobrevive). Documentar que o `Eu` é DTO sensível (invariante 2)
  antes do primeiro uso.
- **L7.** `ehSessao` aceita sessão sem `accessToken` (N42), e `acaoProtegida` da moldura não repassa
  a funcionalidade.
- **L8.** Regra P1: `<Link>` com href em `{...}`, template, variável, objeto, renomeado, em
  maiúsculas ou no shell passa (XE12–XE18). No `saida-de-rede`, `redis`, `ioredis` e `pg` não contam
  como rede (XR01–XR03).

## O que foi bem
Sessão Redis (hash da chave, TTL, erro normalizado, leitor sem escrita), projeção da sessão sem
os tokens novos (N10–N12, N16), origem, sessão e módulo da action (N18–N25), moldura (M01–M07) e
fail-closed nas apps (E03, E04, E08, E14, E12) têm teste que reprova a mutação.

## Estado final conferido
- Fontes de todos os submódulos iguais ao início. Só `pnpm-lock.yaml` está modificado, byte a byte
  igual à cópia inicial. `erp-contratos` mudou de HEAD (b56320e) por commit do orquestrador,
  avisado e fora do escopo.
- `dist` instalado do núcleo igual ao tarball 0.8.2. Dados do stub iguais.
- `task test` verde (contratos 20 com o commit do orquestrador, núcleo 109, moldura 25, stub 39,
  shell 38); `task verificar:estatica` 16/16; ponta a ponta 60/60 com a sessão em arquivo e 60/60 com
  `REDIS_URL` (depois de `CONSTRUIR=tudo`/`CONSTRUIR=1`, sem mutação).
- Nada commitado, instalado nem enviado. Nenhum processo ou porta da base ficou em uso.
