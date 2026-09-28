# reviewer_b1_d1_9 — handoff

Gate B1+D1+G3+K, iteração 9. Revisor (Sonnet). 2026-09-28.
Escopo: fatia K5 (commits `d9ff04e` no principal, `08642ed` em `repos/erp-nucleo`),
correção dos vetos V1–V4 do `auditor_b1_d1_8`.

## Veredito: **APPROVE**

Método: leitura linha a linha dos dois diffs, leitura do código atual (não só o diff) para
os pontos de fronteira, e mutação-e-restauração ao vivo (reverter o trecho corrigido para a versão
pré-K5, rodar a suíte nova, confirmar reprovação, restaurar e conferir `git status` limpo) nos quatro
arquivos de produto da fatia: `base/scripts/ambiente.mjs`, `base/verificacao/saida-de-rede.mjs`,
`base/verificacao/seguranca-estatica.mjs`, `repos/erp-nucleo/scripts/fronteira.mjs`. Não subi servidor
nem toquei as portas reservadas; só testes que não sobem a base:
`repos/erp-nucleo$ pnpm test` → 142/142; `task verificar:estatica` → 48/48; `task scripts:test` → 18/18.
Os números batem com o que o commit e o `GATE_STATUS.md` afirmam.

## V1 (inv. 15, ambiente por lista de exclusão)

**Fechado.** `base/scripts/ambiente.mjs` agora monta o ambiente por **lista de inclusão**
(`AMBIENTE_PERMITIDO.zona` / `.dominio`, `DO_SISTEMA`) e todo processo nasce por um único ponto
(`executar`, linha ~120), que aplica `ambienteDoPapel(papelDe(dir), env)` antes de `spawn`/`execFileSync`.
Cobri:
- **Fases:** `start` (zona, domínio), `build` (o loop de build em `subir()` agora chama
  `executar('build', dir, 'pnpm', ['build'], { esperar: true })` para toda app da lista `APPS`, inclusive
  o shell, cujo papel é `'shell'` e recebe o ambiente inteiro — fecha o V1(b) do build que vazava
  `REDIS_URL` antes), `registrar` (zonas-módulo) e `avulsa` (`subirAppAvulsa`).
- **`base/showcase/subir.mjs`:** não spawna zona/domínio diretamente — chama `subir()`, que já filtra;
  o único `execFileSync` do arquivo é `docker compose`. Coberto.
- **Variáveis que as zonas/domínio leem:** conferi por grep em `repos/erp-zona-{1,2,acesso}`,
  `repos/erp-dominio-stub` e `repos/erp-nucleo/src` (o núcleo roda dentro do processo da zona) — todas as
  16 variáveis lidas (`SESSAO_DIR`, `REDIS_URL_ZONA`, `ACESSO_URL`, `SHELL_HOSTS`, `DOMINIO_A/B/C_URL`,
  `ERP_TOKEN_SERVICO`, `ERP_DESTINO_TIMEOUT_MS`, `ERP_FRAGMENTO_TIMEOUT_MS`,
  `ERP_PERMITIR_IDENTIDADE_DEV`, `ERP_TOKEN_VIDA_S`, mais `DADOS_DIR` do domínio) estão em
  `AMBIENTE_PERMITIDO`. O próprio `ambiente.test.mjs` tem um teste que varre o código-fonte real
  (`process.env.X`) e falha se sobrar variável fora da lista — não é só um teste com dados inventados.
- **Não escapa caminho de lançamento:** busquei `spawn(`/`execFileSync(`/`execSync(` em `base/**`;
  fora de `ambiente.mjs` só aparecem em `docker`, `git`, `chrome`/`pgrep`/`which` (navegador de teste) —
  nenhum lança processo de zona/domínio.
- **`lib/redis.ts` das zonas** ainda lê `process.env.REDIS_URL` só para se recusar a subir se ela vier
  sem `REDIS_URL_ZONA` (comentário citando `auditor_b1_d1_3, V1`); como a zona nunca recebe `REDIS_URL`
  agora, esse branch fica morto — código defensivo redundante, não é regressão.
- **Mutação ao vivo:** revertendo `ambiente.mjs` para o commit anterior, os quatro testes novos
  (`V1: zona e dominio não recebem...`, `V1: o papel sai do diretorio...`, `V1: todo processo nasce por
  um unico ponto...`, `V1: a lista de inclusao cobre...`) reprovam, com mensagens claras
  (`papelDe is not a function`, `spawn fora de executar`, `Cannot read properties of undefined`).
- O teste em `base/verificacao/base.test.mjs` (`V1 (auditor_b1_d1_8)`) define `ERP_REDIS_SENHA_SHELL`
  antes de `subir()` — reproduz exatamente o cenário do veto — e olha `/proc/<pid>/environ` dos processos
  vivos, não só o objeto interno; tem dentes (afirma que o shell **deve** receber a senha, então a leitura
  de `/proc` não está vazia por acidente). Não rodei esse teste (precisa da base no ar, portas
  reservadas), mas o número relatado (109/109) e a leitura do código batem.

## V2 (inv. 4/N8, escopos que escondiam a global)

**Fechado.** `saida-de-rede.mjs` trocou a pilha de escopos por resolução léxica de verdade
(`nomesLigados`/`declaracaoDe`): cada nó que liga nomes (arquivo, bloco, `case`, `catch`, os três `for`,
toda forma de função — inclusive `constructor`, `get`/`set`, parâmetro com modificador de acesso —
e nome de expressão de classe/função) devolve o que liga, e o uso sobe pelos ancestrais reais da AST até
achar, não por uma pilha que empilhava/desempilhava fora de sincronia com o parâmetro.
- Testei manualmente hoisting de `var`: declarar `var fetch` dentro de um bloco e usar fora dele
  (o que no JS real seria hoisted para a função) é tratado como **não ligado** ali — mais estreito que o
  JS real, então erra para o lado seguro (reprova como global) em vez de esconder. Confirmado com um caso
  ao vivo.
- `globalThis[k]` com `k` não constante (parâmetro, `let` reatribuído) agora cai na regra "chave calculada"
  porque `valorConstante` só resolve `const` com inicializador literal na declaração que vale no ponto de
  uso — void o bug antigo (identificador não-constante virava `undefined`, que passava no `!== null`).
- 12 formas testadas (constructor, constructor com modificador, set, get, método de objeto, catch,
  for-of, for-in, for clássico, bloco, switch/case, desestruturação em parâmetro) × `fetch`/`WebSocket`,
  mais XR20q4 (injeção de dependência via `constructor(fetch)` com uso em outro método) e as variações de
  chave calculada/sombreada.
- **Mutação ao vivo:** revertendo para o commit anterior, `XR20q4` e o teste de chave calculada por
  parâmetro reprovam exatamente como o achado do auditor.

## V3 (inv. 4/11, `fontesDaApp` sem teste)

**Fechado.** O comportamento (`test/` só é ignorado na raiz da app; `test/` aninhado — `lib/test/`,
`app/x/test/` — é varrido) já existia no código antes da K5; a correção da K5 foi só o teste que faltava
(`base/verificacao/seguranca-estatica.test.mjs`, "V3 (auditor_b1_d1_8, XR38p/SR3)"). Confirmei lendo
`fontesDaApp` (linha `d === raizDaApp && n === 'test'`) e revertendo o arquivo para o commit anterior: o
teste reprova (`page.tsx: objeto foi a ilha sem achado: []` — o mesmo teste também prova o L1, então a
reprovação junta os dois; testei separadamente que o teste específico de V3 também cai sozinho).

## V4 (inv. 15, fronteira do núcleo por lista fixa)

**Fechado**, com duas defesas independentes que se cobrem mutuamente:
1. `simbolosDoShell` deriva a lista de nomes exclusivos de `src/shell/index.ts` (os `export { x } from
   '../y.js'` nomeados), então um escritor novo publicado ali entra sozinho na checagem por nome
   (fecha N38d–f sem lista escrita à mão, e cobre o cenário de D2/renovação citado no achado).
2. `exportsComEscrita` usa o verificador de tipos do TypeScript: qualquer export de valor fora de
   `shell/`/`testing/` cujo tipo exponha `gravar`/`remover`/`autenticar`/`entrar`/`encerrar` (por
   propriedade, retorno — inclusive `Promise<T>` — ou membro de união, recursivo até profundidade 6)
   reprova, **com qualquer nome**. Isso fecha N38k (adaptador novo com nome novo tipado como
   `StoreDeSessao`) e reforça N38i (o leitor da raiz que aceitaria devolver o escritor sob uma opção).
3. No arquivo definidor, só a **declaração** (`no.parent?.name === no` e o pai é
   `FunctionDeclaration`/`VariableDeclaration`/`ClassDeclaration`) fica isenta — um embrulho ou reexport
   no próprio arquivo definidor agora reprova (fecha N38g/N38h).
- Confirmei que `shell/index.ts` real bate exatamente com o que `simbolosDoShell()` devolve (teste
  "V4: os simbolos do shell saem de shell/index.ts") e que a cópia real do `src/` sem mutação passa limpo
  (0 erros).
- **Mutação ao vivo (duas rodadas):** (a) revertendo o arquivo inteiro para o commit anterior, o módulo
  de teste nem carrega (`simbolosDoShell` não existe) — todo o arquivo de teste falha, o que também
  pegaria em qualquer pipeline. (b) revertendo **só** a linha `erros.push(...exportsComEscrita(...))`
  (mantendo a derivação por nome), os testes N38k e N38i (tipo) reprovam especificamente, enquanto N38d-f
  (nome) continuam passando — confirma que as duas defesas são independentes e cada uma tem dentes
  próprios.
- Não achei caminho de escrita que escape das duas defesas dentro do que o núcleo hoje expõe
  (`EscritorDeSessao`, `ProvedorDeIdentidade`, `NucleoDoShell`). Fora do escopo do veto, mas registro como
  observação sem consequência demonstrada: a fronteira não restringe importação direta de `redis`/
  `ioredis` por um arquivo novo de `fabricas/`/`adaptadores/` que grave sem passar por um tipo com
  `gravar`/`remover` (ex.: comando Redis cru numa função que devolve `Promise<void>`) — isso dependeria de
  uma nova checagem de módulo dentro do próprio `erp-nucleo` (paralela ao N8 das apps), que não existe
  hoje e não é o que o veto V4 pedia. Não é achado: não encontrei um caminho concreto de exploração dado o
  que o núcleo publica hoje, e a suspeita exigiria uma checagem nova para confirmar ou descartar.
  `dist` do núcleo não mudou (confirmado: sem diff em `dist/`, versão continua `0.9.2`), como o commit
  afirma.

## Item 5 — dentes dos testes novos

Confirmados com reversão ao vivo (não só leitura) em `ambiente.mjs`, `saida-de-rede.mjs`,
`seguranca-estatica.mjs` e `fronteira.mjs`: cada reversão faz o teste específico daquele veto reprovar,
com a base restaurada e `git status` limpo depois (nas duas árvores, principal e `repos/erp-nucleo`).

## Achados

Nenhum. Não reprovei nada: as quatro correções fecham V1–V4 com teste que tem dentes, a documentação
(`docs/CONFIGURACAO.md`, `.agents/orchestrator/AMBIENTE.md`) foi atualizada no mesmo commit, e não vi
nenhuma fronteira de camada, vazamento de credencial, autoridade deslocada ou restrição de Multi-Zones
violada nos arquivos tocados por esta fatia. A observação sobre import direto de cliente Redis fora das
duas defesas da fronteira é suspeita, não achado — não encontrei um caso concreto de exploração; para
confirmar ou descartar seria preciso uma checagem estática nova (módulo de rede dentro do próprio
`erp-nucleo`, análoga ao N8 das apps) ou uma prova por mutação dedicada, que não fiz.

## Estado

Nenhum arquivo de produto foi deixado modificado (`git status` limpo nas duas árvores ao fim de cada
mutação). Nenhum servidor subido, nenhuma porta reservada tocada. Nada commitado.
