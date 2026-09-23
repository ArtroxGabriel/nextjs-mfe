# auditor_b1_d1_3 — handoff

Gate B1+D1+G3+K, iteração 3. Auditor forense com veto (Opus). 2026-09-22.

## Veredito: **INTEGRITY VIOLATION**

127 mutações e contornos (72 pegos, 55 sobreviventes), uma linha cada em `mutacoes.txt`:
65 de unidade (núcleo, moldura, shell, stub), 26 nas apps pelo ponta a ponta com Redis (`verificar:redis`), 2 no `dist`
instalado (`CONSTRUIR=tudo`), 7 de escopo/`ambiente.mjs`, 27 contornos chamando os analisadores direto.
Logs: `anexos/lote.log` (cada mutação), `contornos.log`, `E01c-chave-forjada.txt`, `prova-P09-E10c.log`,
`e2e-base-redis.log`, `e2e-final-redis.log`; rascunho da rodada em `anexos/handoff-parcial.md`.

## O que foi fechado desde a iteração 2 (pegos agora)
N08, N43 (comentário no lugar do `server-only`), N13, N17, N27 (fallback v1 reintroduzido), N32/N32b (erro do `/v2/eu`
como lista vazia), N33, N34, N38, N42, N15, E01 (escrita com a credencial da zona: NOPERM), E01d (`set` no cliente),
E06c, E07, E10 (spread), S01, S06, S10, A01 (CPF/papéis no acesso efetivo), `exigirPapel`/`acaoProtegida` (N44–N54),
moldura M08–M13, D01 (`force-cache` no dist → 9 testes), D02. O corte seco da v2 e o requisito completo estão bem testados.

## Vetos
- **V1 — inv. 15 (E01b, E01c).** Zona com `process.env.REDIS_URL // REDIS_URL_ZONA` e o comando montado em tempo de
  execução grava sessão forjada (com o token da carla, admin) a cada leitura; 71/71. A chave estava no Redis depois da
  rodada (`E01c-chave-forjada.txt`) e eu a apaguei. O "V1 estático" casa `REDIS_URL_ZONA` em comentário e `\bset\b` só
  escrito; o "V1 dinâmico" testa a ACL, não a credencial que a zona usa; e o `?? process.env.REDIS_URL` do código real
  já entrega a credencial de escrita quando `REDIS_URL_ZONA` falta (achado 1 do revisor).
  *Correção:* sem fallback — a zona com `REDIS_URL` e sem `REDIS_URL_ZONA` falha na subida; teste ponta a ponta que
  lê, da zona no ar, o usuário da conexão (`CLIENT INFO`/`ACL WHOAMI` exposto num teste ou `CLIENT LIST` pelo admin
  filtrando o `lib-name`/porta da zona) e exige `zona`; no estático, conferir `REDIS_URL_ZONA` sem comentários.
- **V2 — inv. 15 (N38b, N38c).** `@erp/nucleo/app` reexportando `sessaoRedisDeEscrita as lojaDeSessao` (aspas duplas, fora
  do regex de `fronteira.mjs`) e a raiz reexportando `sessaoArquivoDeEscrita as sessaoArquivoCompleta` passam: o teste
  compara nomes com uma lista. *Correção:* comparar identidade — importar `/shell`, coletar os valores exportados e
  exigir que nenhum outro subpath exporte o mesmo objeto; e `fronteira.mjs` aceitar aspas duplas e `import()`.
- **V3 — inv. 3 (E02, E02b, E02c; N08b/XF01).** `lib/redis.ts`, `lib/nucleo.ts`, `lib/pagina.ts` das zonas sem
  `import 'server-only'` passam (repetição do E02 da iteração 2; K3 dizia "lib/redis.ts coberto"). E `temServerOnly`
  continua regex por linha: um template literal cuja linha do meio é `import 'server-only'` o satisfaz.
  *Correção:* teste que exige a declaração `ImportDeclaration 'server-only'` (AST) em todo `lib/` das apps que importa
  `next/headers`, `redis` ou `@erp/nucleo`; usar o mesmo AST em `fronteira.mjs`.
- **V4 — inv. 2 (E10c, E10b; XE23–XE31).** `campos={{ …, cadastro: JSON.stringify(p) }}` na zona de acesso manda a pessoa
  inteira para a ilha: o HTML de `/acesso` da carla passa a ter o CPF da ana e 28 ocorrências de `cpf`
  (`prova-P09-E10c.log`); 71/71. `valorSeguro` aceita template com qualquer expressão, `String(...)`, chamada ou acesso de
  propriedade dentro de objeto literal, qualquer identificador importado; não vê filhos, ilha por barril nem por alias.
  *Correção:* valor de prop de ilha só literal, identificador de ação `'use server'`, ou `x.campo` escalar; recusar
  `JSON.stringify`, template com expressão não escalar e chamadas em objeto literal; resolver ilhas por reexportação;
  e no ponta a ponta procurar CPF/`"cpf"` no HTML+RSC de `/acesso` (como já se faz com o custo).
- **V5 — inv. 5 (P09).** `administrar` chamando o domínio antes de `acaoProtegida` passa 71/71; com a base no ar,
  `revogarAcesso` **sem `Origin`** e o cookie da carla revogou o davi (`/zona1` 200 → 404). O teste "Server Action sem
  Origin… não executa em nenhuma app" manda à zona de acesso os campos da v1 (`perfil`, `usuario`, `atribuir`…): o
  domínio recusaria com 422 de qualquer jeito, então o teste não tem dentes ali.
  *Correção:* campos válidos por action (os de `formularios()` da própria página, como no N6) e conferir o estado depois;
  estático: em arquivo `'use server'`, nenhuma chamada a `nucleo.destino` fora do corpo de `acaoProtegida`.
- **V6 — inv. 4/N8 (XR15, XR16, XR08–XR12).** A exceção do N8 pula o arquivo inteiro: `fetch` para fora dentro de
  `lib/redis.ts` da zona passa. Só `app/`, `lib/`, `proxy.ts` são varridos (um `servicos/rede.ts` importado passa).
  Contornos: alias de `globalThis` com chave calculada, `process.getBuiltinModule('node:http')`, `node:dns`, biblioteca
  HTTP fora da lista, `(() => {}).constructor`. *Correção:* exceção por construção permitida (só o `import` de `redis`),
  não por arquivo; varrer toda a app fora de `node_modules`/`.next`; reprovar `getBuiltinModule`, `.constructor` chamado,
  alias de global; e tratar como rede todo pacote fora de uma allowlist em vez de uma lista de proibidos.
- **V7 — inv. 11 (XE38, XE40, XE41, XE39).** `next.config` com `env: { DOMINIO_A: process.env.DOMINIO_A_URL }` ou
  `compiler.define` com o endpoint expõe endereço interno ao navegador sem `NEXT_PUBLIC_` e passa; `NEXT_PUBLIC_API_TOKEN`
  num arquivo fora de `app/`/`lib/` passa; `NEXT_PUBLIC_BEARER` passa. *Correção:* `next.config` sem `env`/`define`
  (ou allowlist), mesma varredura ampla do V6, e allowlist de `NEXT_PUBLIC_*` em vez de lista de termos.

## Lacunas sem veto
- L1 (E05): health que chama o domínio com a sessão e devolve dados e a origem interna passa (L1 da iteração 2 não virou
  teste estático). *Correção:* `api/health/route.ts` sem import de `@/lib/*`/`@erp/nucleo` e corpo fixo.
- L2 (P07, P16): nenhum ator tem `tarefas.ver` sem `tarefas.concluir`, e as tarefas estão na versão 1: action com a
  funcionalidade errada e `If-Match` fixo passam. *Correção:* ator/perfil só-leitura e tarefa em versão ≠ 1 na semente.
- L3 (P10): link de Relatórios para quem não tem a funcionalidade passa (inv. 8, UI). Teste no HTML do davi.
- L4 (AM1–AM3): `precisaConstruir` sem `app/` ou sem `acesso.manifesto.ts`/`zonas.json`, e `subir` sem checar portas,
  passam; AM1 faria o ponta a ponta rodar build velho. Teste por entrada e pela checagem de porta.
- L5 (XE34–XE37): `<Link>` por barril, namespace, alias e `router.push` para outra zona passam (P1).
- L6 (XE27, XE32, XE33, XR17): filho de ilha, `import x = require`, `redis` em `'use client'`; exceção nova do N8 só
  confere o tamanho do motivo.
- L7 (N36b, S05, S17, A05): `TIMEOUT_PADRAO_MS` conferido só por texto; TTL padrão da sonda 1→10 s; só "saudável" em
  cache; módulo com nome vazio aceito.
- L8 equivalentes/mock: N53 (same-site; o host da origem ainda barra), P12 (zona 1 sem action), G02/G05 (âncora `^` do
  token e `/v2/eu` sem usuário no mock).

## Estado final conferido
- Fontes de todos os submódulos iguais ao início (HEADs inalterados); só os `pnpm-lock.yaml` de stub e moldura
  modificados, byte a byte iguais às cópias do início. Nenhuma pasta nova nas apps.
- `dist` instalado do núcleo nas 4 apps com hash `4f81c920…` = tarball 0.9.2 do Verdaccio.
- Dados do stub iguais à cópia; a chave forjada do E01c foi apagada (`DEL` → 1, `EXISTS` → 0).
- `CONSTRUIR=tudo task verificar:redis`: **71/71** (`anexos/e2e-final-redis.log`). Portas 3000–3003, 4001–4004, 4010,
  4020 livres. Nada commitado, instalado nem enviado.
