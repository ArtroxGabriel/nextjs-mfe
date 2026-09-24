# auditor_b1_d1_8 — handoff

Gate B1+D1+G3+K3/K4, iteração 8. Auditor forense com veto (Opus). 2026-09-23. Critério: Decisão A2.

## Veredito: **FAIL (veto)** — 4 vetos

Registro: `mutacoes.txt` (uma linha por mutação ou contorno, evidência em cada uma; classificação no fim).
Logs: `anexos/lote/<id>.log`, `anexos/it8-contornos*.log`, `anexos/contornos-novos.log`, `anexos/prova-senha-shell.log`,
`anexos/alvo-XR20q4.log`, `anexos/e2e-base-redis.log`, `anexos/e2e-final-redis.log`. Executor: `anexos/mut.mjs` + `lote.mjs`
(edição por texto exato, restauração byte a byte conferida, dados do stub restaurados a cada rodada).

**Catálogo da iteração 4 reaplicado inteiro** (unidades 18, produto 25, contornos dos analisadores 84 nos dois modos,
com e sem o programa TypeScript): tudo o que era veto na iteração 4 agora é pego (N38d–f, E10d, XR20p, XR38p, XR23p,
XN01p, P16b, S17b, XE26, XA01–XA08, XA16–XA18, XR20, XR27, XR28, XR31, XN01, XN09); E01f/E01e ficam sem efeito (a zona
não tem `REDIS_URL` no `start`). Sobreviventes restantes do catálogo: só classes D14, equivalentes ou controles.
**Mutações novas:** ~60 (K3/K4: ambiente, Taskfile, `ehTipoEscalar`/`programaDaApp`, XN09, N8, fronteira, tipos na ilha).

## Vetos

- **V1 — inv. 15. A barreira de ambiente da K4-3/K4-4 é lista de exclusão aplicada só ao `start`.**
  (a) `base/scripts/ambiente.mjs:131-136` (`envDaApp`) e `:80-82` (`envDoDominio`) apagam só `REDIS_URL`/`REDIS_URL_ZONA`.
  Com `ERP_REDIS_SENHA_SHELL` definida — o que `docs/CONFIGURACAO.md` e o compose mandam fazer fora da máquina local —
  `base/showcase/subir.mjs:33` monta a `REDIS_URL` e a senha de escrita chega às 3 zonas e aos domínios
  (`/proc/<pid>/environ`). Só com o ambiente dela, a zona 1 gravou a sessão forjada da carla e o cookie nunca emitido
  abriu `/`, `/acesso`, `/zona1` (`anexos/prova-senha-shell.log`); `ERP_REDIS_SENHA_SHELL=… task verificar:redis` 100/100
  (o teste `:924` procura só `REDIS_URL=`). Código atual, sem mutação.
  (b) `ambiente.mjs:172` roda o `pnpm build` de cada zona com `env` inteiro (com `REDIS_URL`). E01g: a zona grava no
  carregamento do módulo se houver `REDIS_URL` (só no build): **100/100** e o cookie forjado abriu as três páginas
  (`anexos/lote/E01g.log`). Mesmo defeito do V1 da iteração 4, por outro caminho.
  *Erro de boa-fé:* a K4-4 criou `ERP_REDIS_SENHA_SHELL` e não a tirou do ambiente das zonas. *Correção:* ambiente das
  zonas e domínios por lista de inclusão (o que cada um precisa), também no build e no `registrar`; o segredo de escrita
  só no shell. *Teste que deveria existir:* nenhum valor do ambiente de zona ou domínio (start, build, registrar)
  contém a senha da `REDIS_URL` do shell, rodado com `ERP_REDIS_SENHA_SHELL` definida; e uma zona construída no teste
  não pode gravar chave (conferir `EXISTS` de uma chave-sentinela depois do build).

- **V2 — inv. 4 (N8). A pilha de escopos da K3 não abre escopo em `constructor`, acessor, `catch` nem `for`.**
  `base/verificacao/saida-de-rede.mjs` (`criaEscopo`: função, arrow, método, bloco): o parâmetro de `constructor(fetch)`,
  `set x(fetch)`, `catch (fetch)` e `for (const fetch of …)` é declarado no escopo de fora e o `fetch` global do arquivo
  inteiro some — o mesmo defeito do XR20p que a K3 disse fechar. XR20q4: `erp-zona-1/lib/dominio-a.ts` com
  `class Transporte { constructor(fetch) … }` (injeção de dependência) e `listarRecursos` fazendo `fetch` direto:
  **100/100** e o alvo externo recebeu 38× `GET /xr20q` (`anexos/alvo-XR20q4.log`). Contornos XR20c–i (inclusive
  `constructor(private WebSocket)` + `new WebSocket`). *Correção:* declarar o parâmetro no escopo da função dona
  (constructor, get/set accessor, catch clause, for/for-in/for-of abrem escopo) ou usar o checker
  (`getSymbolAtLocation` é a global?). *Teste:* um caso por forma (constructor, set, catch, for-of).

- **V3 — inv. 4 (N8)/inv. 11. A correção do XR38p não tem teste.** SR3: voltar `fontesDaApp`
  (`seguranca-estatica.mjs`) a pular `test/` em qualquer nível → estático **40/40** e `verificar:redis` sem teste
  que olhe isso (o teste chamado "V4 (XR38p)" em `saida-de-rede.test.mjs:142` testa chave calculada). Pela regra do
  gate, correção cujo teste não reprova quando revertida não conta. *Teste:* `fontesDaApp` de uma app com `lib/test/x.ts`
  inclui o arquivo; `test/` na raiz não.

- **V4 — inv. 15. A fronteira do núcleo (K3) é lista fixa de nomes e isenta o arquivo definidor inteiro.**
  `repos/erp-nucleo/scripts/fronteira.mjs` (`SIMBOLOS_EXCLUSIVOS_DO_SHELL`), núcleo 136/136 em todas:
  N38l — escritor novo do shell (`fabricas/renovacao.ts`, exportado por `/shell`) embrulhado em `/app`
  (`renovar = (...a) => renovarSessao(...a)`): a lista não é derivada de `shell/index.ts`; é exatamente o que o D2 vai
  acrescentar (renovação com lock). N38k — adaptador de escrita novo exportado pela raiz, como `sessaoArquivo`/`sessaoRedis`.
  N38g/N38h — embrulho no próprio arquivo definidor (`criarNucleo.ts`, `sessao-redis.ts`) reexportado por `/app`/raiz;
  N38i — `sessaoRedis` da raiz devolve o escritor com `{ escrita: true }`. É a mesma falha da iteração 4 (V2) com os nomes
  mudados. Efeito hoje limitado pela ACL do Redis (a zona não grava no modo Redis), não no modo arquivo.
  *Correção (a proposta da it.4):* derivar os símbolos de `src/shell/index.ts` (seguindo reexport) e proibir que qualquer
  arquivo fora de `shell/` os importe ou reexporte, sem isentar o definidor além da declaração; e/ou regra por tipo
  (nada fora de `/shell` exporta valor cujo tipo tenha `gravar`/`remover` ou devolva `StoreDeSessao`/`NucleoDoShell`).
  *Teste:* N38g, N38k e N38l.

## Lacunas sem veto
- L1 (V3 da ilha, K4-1): `every`→`some` em `ehTipoEscalar` (TA1) passa 40/40: o teste não tem união nem objeto opcional
  (os produtos T1/T2 são pegos hoje); tirar o `programa` de `varrerSeguranca` (TA9), o `allowJs` (TA5) ou os arquivos
  do `rootNames` (TA4) passa: nenhum teste liga o programa às apps reais. Os tipos T1–T8 (opcional, união, `string[]`,
  genérico, `any` implícito, `{}`, cast, elemento) são todos pegos.
- L2 (N8): bloco sem escopo (SR1), concatenação inline sem teste (SR6), `next/font` aberto (SR7; hoje só existem
  `google`/`local`, equivalente).
- L3 (XN09, K4-4): `export default { assetPrefix }` (shorthand) e `config.assetPrefix = process.env.X` passam
  (XN09a/b, também no produto: estático 40/40). Chave calculada (XN09d) é D14.
- L4: FR2 (`identidadeDev`/`ATORES_DE_DESENVOLVIMENTO` fora da lista: 136/136).
- L5: S17c ("fora" no cache por 1/10 do TTL passa; o teste espera 50 ms).
- L6 (ambiente): `subirDominio` com `env` inteiro (AMB4, 100/100: domínio que volta depois do teste `:459`);
  `pnpm registrar` da zona com `REDIS_URL` (AMB6, 100/100).
- Não executado: reverter `--requirepass` no compose (exigiria recriar o Redis, proibido; o teste `:459` fala com o Redis
  real e reprovaria); `subir.mjs` sem senha (nenhum teste roda o showcase; o login quebraria à vista).
- Observação: o TF1 (Taskfile sem senha) foi pego, mas a rodada estourou o timeout do executor e deixou a base de pé;
  derrubei os processos à mão antes de seguir (as rodadas XR20q2/q3 afetadas foram anuladas e refeitas).

## Limites D14 confirmados (sobrevivem, contorno deliberado)
XA09, XA10, XA12, XA13 (ilha por indireção); XP01, XP03–XP06 (P0-acao-protegida; P09b pego no ponta a ponta);
XN02, XN03, XN04, XN09d, XR28c, XR28d (chave calculada/sintaxe montada); XL01–XL04 (navegação indireta); XN08, XR30
(rewrite). Equivalentes/controles: XA15, XA19, XP11, XS01, XS02, XN07, XR21, XR22, XR25, XR29, XR33, XR34, XR36, XR37,
XL05, XU01–XU03, XR20j. Saíram de D14 (agora pegos): XR28, XR31, XN09 (forma literal).

## Estado final conferido
- Fontes dos 8 submódulos nos HEADs do principal, sem diff; só os `pnpm-lock.yaml` de stub e moldura modificados,
  byte a byte iguais às cópias do início. `dados/` do stub igual à cópia do início.
- `dist` do núcleo nas 4 apps: `9ff2f87f…` (find|sha256sum), igual ao tarball 0.9.2 do Verdaccio. Núcleo local 136/136.
- Redis: chaves forjadas desta rodada (`forjada-aud8-senha`, `-build`, `-e01f`, `forjada-anonima`) com `EXISTS 0`;
  nenhuma chave sem TTL.
- `CONSTRUIR=1 task verificar:redis` no código limpo: **100/100** (`anexos/e2e-final-redis.log`).
- Portas 3000–3003, 3012, 4001–4004, 4010, 4020 e 4999 (alvo) livres; nenhum `next-server`/stub residual. Verdaccio,
  Redis e Keycloak intocados. Nada commitado nem instalado por mim.
- Atenção: o commit `75daebc` do orquestrador (parcial deste auditor) levou a cópia transitória
  `anexos/.dados-antes/`; o executor a apaga ao fim de cada rodada, então ela aparece como removida no `git status`.
  Não deve ser restaurada (é lixo de execução); o próximo commit pode registrar a remoção.
