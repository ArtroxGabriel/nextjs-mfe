# auditor_b1_d1_3 — handoff (parcial)

Gate B1+D1+G3+K, iteração 3. Auditor forense com veto. 2026-09-22.

## Estado inicial (conferido)
- Submódulos: contratos b56320e, stub 064dccf, moldura a875c21, núcleo 969b1b0, shell 46237f7,
  zona-1 39a38fd, zona-2 f18b72f, zona-acesso fdabd61. Só os lockfiles de stub e moldura modificados
  (cópias em scratchpad).
- `dist` instalado do núcleo 0.9.2: mesmo inode nas 4 apps; hash da árvore `4f81c920…` = tarball do Verdaccio.
- Dados do stub copiados antes de qualquer mutação.

## Progresso
- [x] leitura do código novo (núcleo, moldura, apps, shell, stub v2, base/verificacao, ambiente.mjs)
- [x] mutações de unidade (lote 1 núcleo: 44; lote 2 moldura/shell/stub: 23) — ver mutacoes.txt
- [ ] mutações repetidas da iteração 2 nas apps (ponta a ponta)
- [ ] mutações novas
- [ ] contornos dos analisadores
- [ ] estado final

## Unidade (65 mutações, 11 sobreviventes) — achados parciais
- **N38b / N38c (inv. 15, candidato a veto):** `@erp/nucleo/app` reexportando `sessaoRedisDeEscrita as lojaDeSessao`
  (com aspas duplas, fora do regex da fronteira) e a raiz reexportando `sessaoArquivoDeEscrita as sessaoArquivoCompleta`
  passam: o teste de fronteira compara NOMES exportados com uma lista, não a identidade das funções de `/shell`.
- **N08b (inv. 3, candidato a veto):** `temServerOnly` é regex por linha após tirar comentários; um template literal de
  várias linhas cuja linha do meio é `import 'server-only'` satisfaz a fronteira sem importar nada.
- N37 (`force-cache` no destino) sobrevive na unidade; conferir no ponta a ponta (mutação no dist instalado).
- Sem veto: N36b (TIMEOUT_PADRAO_MS não usado), N53 (same-site; equivalente pela checagem de host), A05 (nome vazio),
  S05 (TTL padrão 1→10 s), S17 (só "saudável" em cache), G02/G05 (mock: âncora ^; /v2/eu sem usuário 200).

## Ponta a ponta — achado confirmado
- **E01c (inv. 15, VETO):** zona 1 com `const url = process.env.REDIS_URL // REDIS_URL_ZONA` e o comando de escrita
  montado em tempo de execução (`['s','e','t'].join('')`) grava a cada leitura uma sessão forjada com o token de carla
  (admin). `task verificar:redis` (71 testes) passa. A chave existia depois da rodada (`anexos/E01c-chave-forjada.txt`,
  PTTL 590 s) e foi apagada por mim. Motivos: o "V1 estático" procura o texto `REDIS_URL_ZONA` (casa comentário) e
  `\bset\b` (não casa nome montado); o "V1 dinâmico" testa a ACL do Redis, não a credencial que a zona usa; e o
  `?? process.env.REDIS_URL` do código real já cai na credencial de escrita se `REDIS_URL_ZONA` faltar.
  (A 1ª tentativa de E01c não compilava — erro de tipo — e foi refeita; a linha inválida foi retirada.)

## Contornos dos analisadores (chamada direta; `anexos/contornos.log`) — 26 casos, 24 passaram
- inv. 2 (`valorSeguro`): template literal, `String(JSON.stringify(r))`, chamada ou acesso de propriedade dentro de objeto
  literal, filho da ilha, ilha por barril ou alias, qualquer identificador importado, `await` (XE23–XE31).
- inv. 3: `import x = require(...)` em `'use client'` (XE32); `redis` em ilha (XE33); `temServerOnly` com template (XF01).
- P1: `<Link>` por barril, namespace, alias; `router.push` para outra zona (XE34–XE37).
- inv. 11: `next.config` `env:` sem `NEXT_PUBLIC_` e `compiler.define` com endpoint interno (XE38, XE40); `NEXT_PUBLIC_BEARER` (XE39).
- N8: alias de `globalThis` + chave calculada (XR08), `process.getBuiltinModule` (XR09), `node:dns` (XR10), biblioteca HTTP
  fora da lista (XR11), construtor de função sem o nome `Function` (XR12).

## Lote 3 (apps, `verificar:redis`) — parcial
- CAUGHT: E01 (escrita com a ACL: NOPERM), E01d (`set` no cliente: V1 estático), E06c, E07, E10 (spread), P01, P03, P04.
- **E01b (inv. 15, 2ª camada):** zona sem `REDIS_URL_ZONA` (usa `REDIS_URL`) passa — base do E01c.
- **E02/E02b/E02c (inv. 3, VETO — repetição do E02 da iteração 2):** `lib/redis.ts`, `lib/nucleo.ts` e `lib/pagina.ts` das
  zonas sem `import 'server-only'` passam; nenhum teste confere `server-only` nos `lib/` das apps (K3 dizia que sim).
- **E10b (inv. 2):** recurso inteiro em `` texto={`${JSON.stringify(recurso)}`} `` na ilha passa (estático e ponta a ponta).
- **E10c (inv. 2, VETO):** na zona de acesso, `campos={{ …, cadastro: JSON.stringify(p) }}` manda a pessoa inteira (CPF,
  e-mail funcional) de cada linha para a ilha `FormularioDeAcao`; 71/71.
- E05 (lacuna L1 da iteração 2 sem teste): health que chama o domínio com a sessão e devolve dados e origem interna passa.
- Resto do lote 3: CAUGHT P05, P06, P08, P15, P17. SURVIVED P07 (nenhum ator tem `tarefas.ver` sem `tarefas.concluir`),
  P10 (link de Relatórios para todos; a página continua 404), P12 (`evil.com` nos hosts da zona 1: equivalente hoje, a
  zona 1 não tem action), P16 (`If-Match` fixo `"1"`: os dados de teste estão na versão 1).
- **P09 (inv. 5, VETO):** `administrar` chama o domínio antes de `acaoProtegida` (erro engolido) e 71/71. Prova com a base
  no ar (`anexos/prova-P09-E10c.log`): `revogarAcesso` **sem `Origin`** com o cookie da carla revogou o acesso do davi
  (`/zona1` 200 → 404). O teste "Server Action sem Origin… não executa em nenhuma app" manda à zona de acesso campos da
  v1 (`perfil`, `usuario`, `atribuir`…), sem `pessoa`/`acesso`: o domínio recusa com 422 e nada mudaria de qualquer jeito.
- **E10c confirmado:** com a mutação, o HTML de `/acesso` da carla tem o CPF da ana (`52601815906`) e 28 ocorrências de `cpf`.

## Lote 4 (escopo dos analisadores, `ambiente.mjs`) — todos sobreviveram
- XR15: `fetch` para fora dentro de `lib/redis.ts` da zona — a exceção do N8 pula o arquivo inteiro.
- XR16 / XE41: `fetch` e `NEXT_PUBLIC_API_TOKEN` em arquivo fora de `app/`, `lib/`, `proxy.ts` (ex.: `servicos/`,
  `componentes/`) importado pela zona: nenhum dos dois analisadores varre.
- XR17: exceção nova no N8 com motivo longo passa (só o tamanho do motivo é conferido).
- AM1–AM3: `precisaConstruir` sem `app/`, sem `acesso.manifesto.ts`/`zonas.json`, e `subir` sem checar portas — nenhum
  teste reprova (AM1 faria toda mutação em página rodar contra build velho).
