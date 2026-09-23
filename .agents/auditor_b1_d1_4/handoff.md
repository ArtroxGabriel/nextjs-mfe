# auditor_b1_d1_4 — handoff

Gate B1+D1+G3+K, iteração 4. Auditor forense com veto (Opus). 2026-09-23.

## Veredito: **INTEGRITY VIOLATION**

**127 mutações e contornos: 72 pegos, 55 sobreviventes** — destes, 7 são equivalentes ou cobertos por outra checagem
(XA15, XA19, XS01, XS02, XN07, XR34, XP11) e 5 do P0-acao-protegida são pegos pelo ponta a ponta no produto (XP01, XP03–XP06).
Os 9 de produto que sobrevivem ao `verificar:redis` inteiro, todos com efeito medido: E01f, N38d, N38e, N38f, E10d,
XR20p, XR38p, XR23p, XN01p (+ P16b e S17b, lacunas).

Registro completo: `mutacoes.txt` (uma linha por mutação ou contorno). Logs: `anexos/lote/<id>.log` (cada rodada),
`anexos/contornos.mjs` + `contornos.log` (contornos novos chamando os analisadores direto),
`anexos/contornos-it3.mjs` + `.log` (contornos da iteração 3 reaplicados), `anexos/prova-lote1.mjs` + `.log`
e `anexos/E01f-chave-forjada.txt` (efeito das mutações sobreviventes com a base no ar).

## O que a K2 fechou (reaplicado e agora pego)
- Unidade/scripts: N08b, N36b, N38b, N38c, N53, A05, G02, G05, S05, S17, AM1, AM2, AM3 (+ AM1b).
- Produto, estático: E01b, E02, E02b, E02c, E10b, E10c, XR15, XR16, XE41, XR17, P12.
- Produto, ponta a ponta: E01e (E01b/E01c com cliente persistente e o nome montado — pego pelo CLIENT KILL), P09b
  (domínio no argumento do `acaoProtegida`, com apelido do núcleo: o estático NÃO pega, o teste de Origin com campos
  reais pega), P12c (adaptador que mente a origem), P10 (L3), E05 (L1), K2a (zona sem a recusa → zona avulsa), SEM1.
- Contornos da iteração 3: XE23–XE25, XE27–XE40, XR08–XR12, XF01 pegos.
- Não reaplicado por decisão do humano: P07 (DEFERRED D13).

## Vetos

- **V1 — inv. 15 (E01f).** A zona recebe `REDIS_URL` (a credencial de escrita do shell) no ambiente — no
  `verificar:redis` e no showcase — e nada impede de usá-la. Mutação em `erp-zona-1/lib/redis.ts`: a cada leitura,
  uma conexão de passagem com `process.env['REDIS_' + 'URL']` grava a sessão forjada da carla (admin) com o comando
  montado (`'s' + 'et'`) e sai com `quit` antes do `CLIENT LIST`. **88/88**; depois da rodada a chave estava no
  Redis e o cookie `__Host-session=forjada-aud4`, nunca emitido pelo shell, abriu `/`, `/acesso` e `/zona1` como
  carla (`anexos/E01f-chave-forjada.txt`; chave apagada). O teste novo só vê conexão viva; o estático só vê `set` escrito.
  *Correção:* a zona não recebe a credencial de escrita: `subir()` (e o compose/Taskfile do showcase) passa às zonas
  só `REDIS_URL_ZONA`, e a zona decide Redis × arquivo por `REDIS_URL_ZONA` (sem ler `REDIS_URL`); teste ponta a ponta
  que lê `/proc/<pid>/environ` de cada processo de zona (ou o `process.env` exposto só em teste) e exige que
  `REDIS_URL` não esteja lá; e/ou shell com usuário ACL próprio e senha que só o processo do shell conhece.

- **V2 — inv. 15 (N38d, N38e, N38f).** O teste de identidade compara só o valor de topo: um **embrulho** do escritor
  passa. `src/index.ts` com `export const sessaoRedisCompleta = (...a) => sessaoRedisDeEscrita(...a)` (a raiz não é
  camada da fronteira), `src/app/index.ts` com `criarNucleoCompleto = (c) => criarNucleoDoShell(c)` ou
  `kit = { criar: criarNucleoDoShell }` (`app/` pode importar `fabricas/`): **135/135** nos três.
  *Correção:* regra estrutural em `scripts/fronteira.mjs`: os símbolos exportados por `src/shell/index.ts` só podem ser
  importados (por nome, seguindo apelido) por `src/shell/`; tratar `src/index.ts` como camada (`raiz`) com a mesma
  regra; teste com os três embrulhos.

- **V3 — inv. 2 (E10d; XE26, XA01–XA06, XA16, XA18; XA07–XA10, XA12, XA13).** `valorSeguro` aceita qualquer
  `x.campo` (e `x?.campo`, spread de `x.campo`, `x.campo ?? …`, `[x.campo]`, `{ a: x.campo }`), sem saber se é
  escalar. Mutação em `erp-zona-1/app/zona1/page.tsx`: `const envio = { lista: recursos }` e
  `<BotaoDeAviso … extra={envio.lista} />` põe a lista do domínio A **com custo** no payload; **88/88**, e com a base
  no ar o HTML de `/zona1` do bruno traz `CC-10`, que a página não renderiza (`anexos/prova-lote1.log`). O XE26 da
  iteração 3 (`{ a: p.cadastro }`) continua passando: o teste da K2 usa `p.cpf`, pego só pelo nome. Ilha não
  reconhecida: `createElement(Ilha, …)`, `next/dynamic`, barril com `export const Outra = Ilha` ou
  `export { Ilha as T }` sem `from`, apelido condicional, `{ Ilha }.Ilha`.
  *Correção:* usar o verificador de tipos (`ts.createProgram` com o tsconfig da app) para exigir que cada prop e filho
  de ilha tenha tipo primitivo (string/number/boolean/null/undefined), array/objeto só de primitivos, ou ação
  `'use server'`; ou restringir `x.campo` ao que o tipo declara primitivo. Resolver ilha pelo símbolo (checker), não por
  nome; reprovar `createElement` e `dynamic` com ilha. E2E: procurar `CC-` no HTML/RSC de `/zona1` e de `/zona1/relatorios`
  para quem vê custo em outra página (bruno), como já se faz com CPF em `/acesso`.

- **V4 — inv. 4/N8 (XR20p, XR38p, XR23p; XR27, XR28, XR31).** Três saídas de rede sobreviventes, com efeito medido
  (alvo externo recebeu `/xr20`, `/xr38` e `upgrade /xr23`; LOTE1 **88/88**):
  (a) `declarados` é por arquivo: um parâmetro `fetch` em qualquer função esconde o `fetch` global do arquivo inteiro;
  (b) `fontesDaApp` pula `test` em **qualquer** nível: `lib/test/rede.ts` importado pela lib não é varrido (vale também
  para `NEXT_PUBLIC_*` e `server-only`); (c) a allowlist aceita todo `next/*`, e `next/dist/compiled/ws`, `httpxy`,
  `http-proxy-agent` estão no `node_modules`. E `['const' + 'ructor']`/`process['bind' + 'ing']` com chave calculada
  fora da global passam.
  *Correção:* resolver o `fetch` pelo escopo (checker: `getSymbolAtLocation` é a global do lib.dom/undici) em vez do
  conjunto de nomes; pular só `test/` na raiz da app (ou nenhuma pasta importada pelo grafo); allowlist de subpaths de
  `next` (`next/server`, `next/headers`, `next/navigation`, `next/link`, `next/font/*`, `next/dynamic`, `next/cache`…),
  nunca `next/dist/*`; reprovar acesso por chave calculada a qualquer objeto quando a chave não é literal e o alvo não é
  local. Um teste por contorno.

- **V5 — inv. 11 (XN01p; XN02–XN04).** `next.config` com `config.env = { ZONA2_INTERNO: … }` (atribuição, não
  propriedade de objeto literal) e `process.env.ZONA2_INTERNO` numa ilha: **88/88**, e `127.0.0.1:4003` foi parar num
  chunk de `.next/static` da zona 2. Chave calculada (`['env']`) e config espalhada de outro arquivo também passam; e
  nenhuma regra olha `process.env.X` (sem `NEXT_PUBLIC_`) em arquivo `'use client'`.
  *Correção:* no `next.config`, reprovar qualquer escrita/leitura do nome `env`/`define`/`webpack` (propriedade, atribuição,
  chave calculada, spread de import); em `'use client'`, reprovar `process.env.<qualquer>` fora da allowlist pública; E2E
  que varre `.next/static` de cada app atrás das origens internas (`127.0.0.1:40xx`, `REDIS_URL`).

## Lacunas sem veto
- L1 (XP01, XP03–XP06): a regra `P0-acao-protegida` é contornável (apelido do núcleo, helper local, `acaoProtegida`
  falsa ou importada de outro módulo, action inline em `page.tsx`). Para as actions existentes o ponta a ponta de
  Origin tem dentes (P09b pego) e action nova reprova por falta de `CAMPOS_VALIDOS`. Correção: exigir que
  `acaoProtegida` venha de `@/lib/pagina`, que nenhum argumento dele chame função, e varrer `'use server'` inline.
- L2 (P16b): `If-Match` fixo em `"3"` passa — N4 conclui justamente a t-1, que nasce na 3. Correção: o N4 (ou outro
  teste) conclui também a t-2 (versão 1) ou manda uma versão velha e exige `REGISTRO_DESATUALIZADO`.
- L3 (S17b): "fora" no cache com validade de 1 ms passa; o teste confere o `set`, não a validade.
- L4 (XL01–XL04): `router.push(variavel)`, `push` desestruturado, `r['push']`, `Link` reexportado por `const` (P1).
- L5 (XN08, XR30, XN09): `rewrites()`/`NextResponse.rewrite` de zona para a origem do domínio, e `assetPrefix` com
  endereço interno, passam (inv. 10/11).
- Equivalentes: XA15, XA19 (coberto pelo N8), XS01, XS02, XN07, XR34.

## Estado final conferido
- Linha de base: `CONSTRUIR=1 task verificar:redis` 88/88 (`anexos/e2e-base-redis.log`).
- Fontes dos 8 submódulos iguais ao início (HEADs e `git status`); só os `pnpm-lock.yaml` de stub e moldura modificados,
  byte a byte iguais às cópias do início. `dados/` do stub igual à cópia (restaurado depois de cada rodada).
- `task test` limpo: contratos 20, núcleo 135 (o `dist` local do núcleo foi reconstruído), moldura 26, stub 43, shell 42.
- `dist` instalado do núcleo não foi mutado nesta rodada: hash da árvore `4f81c920…` nas 4 apps, o mesmo do início
  (= tarball 0.9.2, conferido na iteração 3).
- Redis: a única chave forjada (`erp:sessao:<sha256('forjada-aud4')>`, do E01f) foi apagada (`DEL` 1, `EXISTS` 0); as
  demais `erp:sessao:*` são sessões normais dos `entrar()` das rodadas, com TTL.
- `CONSTRUIR=tudo task verificar:redis`: **88/88** (`anexos/e2e-final-redis.log`); contraprova do E10d no código limpo:
  o HTML de `/zona1` do bruno não tem `CC-10`.
- Portas 3000–3003, 3012, 4001–4004, 4010, 4020 (e 4999, do alvo das provas) livres; nenhum `next`/stub residual.
  Verdaccio, Redis e Keycloak intocados. Nada commitado, instalado nem enviado.
