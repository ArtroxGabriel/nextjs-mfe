# reviewer_b1_d1_4 — handoff

Gate B1+D1+G3+K, iteração 4. Revisor (Sonnet). 2026-09-23.

## Veredito: **APPROVE**

## Escopo confirmado
`git diff 328fbd6..HEAD` = commit `1d4922e` (fatia K2, o único que muda produto/verificação) + `6d2b9d0`
(ADR-0013/0014: só status/versão, sem conteúdo de segurança) + `a92fc4f` (docs do despacho). Submódulos
fixados exatamente como descrito no despacho: núcleo 969b1b0→00c4c6e (só `scripts/fronteira.mjs` e testes;
fonte de `src/` e `package.json` 0.9.2 inalterados — conferido por `git diff --stat`), shell 46237f7→cdde1a2
(só `test/saude.test.mjs`), zona-1 39a38fd→5fbf4eb e zona-2 f18b72f→07ec796 (`lib/redis.ts`), zona-acesso
fdabd61→a1cc854 (`lib/redis.ts` + `app/acesso/acoes.ts`), dominio-stub 064dccf→8198145 (semente `dominio-c`
t-1 versão 3 + testes de armazém/domínios/mock v2).

## Testes rodados nesta máquina (sem portas, conforme o papel)
- `task test`: contratos **20/20**, núcleo **135/135**, moldura **26/26**, stub **43/43**, shell **42/42** —
  bate exatamente com o esperado do despacho.
- `task verificar:estatica`: **33/33**.
- `task scripts:test`: **14/14**.
- `task typecheck`: as 4 apps limpas, sem erro.
- Não rodei `task verificar:redis`/`verificar:construir` (portas 3000-3003/4001-4004/4010/4020 são do
  challenger). Confiei nos logs do auditor_b1_d1_3 (71/71 no fim da iteração 3, antes da K2) e conferi
  manualmente que o `Taskfile.yml` (linhas 91/93) já define `REDIS_URL` **e** `REDIS_URL_ZONA` na tarefa
  `verificar:redis` — a correção do V1 (zona recusa subir com `REDIS_URL` sem `REDIS_URL_ZONA`) não quebra
  o ambiente real; é uma checagem de configuração ausente, coerente com `docs/CONFIGURACAO.md`.

## Cada veto/lacuna, fechamento conferido (código + teste + execução)

**V1 (inv. 15, E01b/E01c)** — `repos/erp-{zona-1,zona-2,zona-acesso}/lib/redis.ts`: sem fallback para
`REDIS_URL`; lança na carga do módulo se `REDIS_URL` existe sem `REDIS_URL_ZONA`. Testes novos em
`base/verificacao/base.test.mjs` (`CLIENT LIST`/`CLIENT KILL USER default`, zona avulsa na porta 3012 sem
`REDIS_URL_ZONA` → 5xx sem conexão de escrita nova); estático agora ignora comentário e recusa
`?? process.env.REDIS_URL` / `|| process.env.REDIS_URL`. Fechado.

**V2 (inv. 15, N38b/N38c)** — `repos/erp-nucleo/test/fronteira.test.mjs`: comparação por **identidade** do
valor exportado (não por nome), carregando `/shell` de verdade e comparando contra os valores de cada
subpath; `scripts/fronteira.mjs` lê specifiers por AST (aceita aspas duplas, `export…from`, `import()`).
Teste de "dentes" próprio (renomear e confirmar que o teste pegaria). Fechado.

**V3 (inv. 3, E02/E02b/E02c, N08b/XF01)** — `temServerOnly` por AST (`ImportDeclaration` sem cláusula, texto
exato `'server-only'`) tanto em `scripts/fronteira.mjs` (núcleo) quanto em
`base/verificacao/seguranca-estatica.mjs` (as 4 apps); `exigirServerOnly` cobre todo módulo fora de
`app/`/`scripts/`/`proxy.*`/`next.config.*` que `arrastaServidor` (transitivo). Testado com template literal
cuja linha do meio é o import (N08b), e com `lib/redis.ts`/`lib/nucleo.ts` sem o import. Fechado.

**V4 (inv. 2, E10b/E10c, XE23-XE31)** — `valorSeguro` reescrito para só aceitar valor escalar (literal,
template de escalares, `x.campo` sem chamada, `String/Number/Boolean` de um único argumento escalar,
condicional/`??`/`||`/`&&` de escalares, array/objeto de escalares, JSX, identificador de ação `'use server'`);
recusa `JSON.stringify`, `Object.assign`, acesso de propriedade em chamada, `await` em objeto literal.
`exportaIlha` resolve barril (`export { X as Y } from`), alias local e namespace; filhos da ilha
(`children`) também são verificados. Produção real (`erp-zona-acesso/app/acesso/page.tsx`) já não passa
`cadastro: JSON.stringify(p)`. Testado contra os 12 contornos do auditor (XE23-XE31, E10b, E10c) — todos
pegos — e contra o padrão real das apps (continua passando limpo). Fechado.

**V5 (inv. 5, P09)** — regra estática nova `P0-acao-protegida`: toda função exportada de um módulo
`'use server'` tem de começar por `return acaoProtegida(...)`, e `nucleo` só pode ser tocado dentro do
corpo passado a ela (não numa closure montada fora e invocada de dentro). Produção real
(`erp-zona-acesso/app/acesso/acoes.ts`) refatorada: a chamada ao domínio saiu da função `administrar`
externa e foi para dentro do corpo de cada `acaoProtegida`. Teste estático com 6 contornos (closure externa,
domínio antes do envelope, `const n = nucleo`, action sem `acaoProtegida`, `const x = nucleo.destino(...)`
antes). Teste dinâmico (`base/verificacao/base.test.mjs`) troca a lista fixa de campos v1 por campos reais
lidos do formulário de cada página (`CAMPOS_VALIDOS`), com um teste-espelho que prova que os mesmos campos
COM `Origin` válido executam (dentes: sem essa prova, a suíte de Origin não teria como mostrar que os
campos são de verdade aceitos pelo domínio). Fechado.

**V6 (inv. 4/N8, XR08-XR17)** — `base/verificacao/saida-de-rede.mjs` virou allowlist (`moduloPermitido`) em
vez de lista de proibidos; as exceções (`EXCECOES`) valem só para o `permite` declarado (`fetch` ou `redis`
específico), não para o arquivo inteiro; a varredura cobre a app inteira via `fontesDaApp` (compartilhado
com `seguranca-estatica.mjs`), não só `app/`/`lib/`. `NOMES_DA_GLOBAL` cobre apelido/chave calculada de
`globalThis`/`window`/`self`/`global`; `getBuiltinModule`/`.constructor`/`binding`/`dlopen` bloqueados;
`import x = require(...)` coberto. Teste com lista fixa das 7 exceções (`erp-shell/lib/{redis,saude-zonas}`,
as 3 `lib/redis.ts` de zona, os 2 `scripts/registrar-manifesto.ts`) — cada uma com o `permite` conferido
contra o próprio arquivo (a exceção é necessária de verdade). Conferi manualmente que os dois
`scripts/registrar-manifesto.ts` existem e usam `fetch`, e que não há pasta nova (`componentes/`,
`servicos/`) nas 4 apps reais hoje. Fechado.

**V7 (inv. 11, XE38-XE41)** — `NEXT_PUBLIC_*` virou allowlist (`PUBLICAS_PERMITIDAS`, só `APP_NAME` e
`APP_VERSION`); `next.config` sem `env`/`define`/`defineServer`/`webpack`/`DefinePlugin`. Testado contra
`NEXT_PUBLIC_BEARER`, `next.config` com `env`/`compiler.define`/`DefinePlugin`, e nome de `NEXT_PUBLIC_`
montado em template (`` `NEXT_PUBLIC_${nome}` ``). Fechado.

**L1 (E05, health)** — teste que o corpo do `route.ts` é fixo (sem `import`/`nucleo`/`process.env`/`fetch`/
`cookies`/`headers`) nas 3 zonas, que a sonda pergunta sem cookie (200) e que o shell não expõe a rota sem
sessão (307). Conferido que `erp-zona-1/app/zona1/api/health/route.ts` já é só `Response.json({status:'ok'})`
— o código já estava certo, faltava o teste. Fechado.

**L2 (P07/P16)** — P16 (`If-Match` fixo) fechado nesta fatia: a semente `dominio-c.json` agora tem `t-1` na
versão 3, e o teste do N4 confere `campos.versao === '3'` antes de submeter. **P07 (ator só com
`tarefas.ver`) foi adiado para o D2, com aprovação do humano** — registrado em `DEFERRED.md` como **D13**,
com evidência (a mutação sobrevive porque nenhum ator tem a leitura sem a conclusão), motivo (precisa de um
ator novo em `identidadeDev` e na semente, junto do D2/núcleo 0.10.0) e critério de fechamento (ator "eva",
`zona2.leitor`). Conforme instrução do despacho, não reprovo por isso.

**L3 (P10, link de Relatórios)** — teste que confere o HTML: davi (só `painel.ver`) não vê o link; bruno
(`relatorios.ver`) vê. Fechado.

**L4 (AM1-AM3)** — `ENTRADAS_DO_BUILD` (`app`, `lib`, `proxy.ts`, `next.config.ts`, `package.json`,
`pnpm-lock.yaml`, `zonas.json`, `acesso.manifesto.ts`) e a checagem de porta ocupada em `subir()` já
existiam em `base/scripts/ambiente.mjs` antes da K2 — conferi contra `328fbd6`, é o mesmo código; só
faltava teste. Testes novos por entrada (uma por vez) e para porta ocupada (`AM3`, com fallback gracioso
se a porta já estiver ocupada por outra razão nesta máquina). Fechado.

**L5 (XE34-XE37, `<Link>`/`router.push`)** — `exportaLink` resolve barril, `import * as L`/`L.default`,
apelido local (`const Ir = Link`); `router.push/replace/prefetch` para outra zona também é achado. Testado
com os 5 padrões e um caso de não-regressão (navegação dentro da própria zona). Fechado.

**L6 (XE27/XE32/XE33, ilha por `import = require`/redis)** — coberto pelo mesmo analisador de fronteira
(filhos de ilha) e pela regra `P0-server-only`/`ehModuloDeServidor` (que agora inclui `redis`, `ioredis`,
`@redis/*`). Testado. Fechado.

**L7 (N36b, S05, S17, A05)** — `TIMEOUT_PADRAO_MS` do núcleo testado via processo filho com
`ERP_DESTINO_TIMEOUT_MS` no ambiente (não só por texto); `TTL_SAUDE_PADRAO_MS`/`TIMEOUT_PROBE_PADRAO_MS` do
shell (1000 ms / 500 ms, com teto) e o cache de zona "fora" (não sondada a cada pedido) já estavam corretos
no código — só faltava teste; `reduzirEu` recusa módulo com `nome` vazio (A05). Fechado.

**L8 (N53, P12, G02/G05)** — N53 (Sec-Fetch-Site `same-site` recusado, não só `cross-site`): já estava
correto em `origemPermitida` (`site !== 'same-origin'` recusa qualquer coisa que não seja same-origin
exato); só faltava o caso no teste. P12: teste que `hostsPermitidos` das 3 zonas vem só de
`(process.env.SHELL_HOSTS ?? 'localhost:3000').split(',')`, nunca de lista escrita no código — conferido
contra o fonte real. G02/G05 do mock: o token dev já é ancorado (`^Bearer dev\.([a-z0-9]+)(?:\.[0-9a-f-]{36})?$`)
e `/v2/eu` sem usuário já responde 401 — código já correto, teste novo (`gestao-acesso-v2.test.mjs`)
confirma com 6 variações (prefixo/sufixo, credencial de serviço, pessoa inexistente). Fechado.

## Observações que não bloqueiam
- A regra `P0-acao-protegida` é rígida (exige que a Server Action comece exatamente por
  `return acaoProtegida(...)`, sem nenhum statement — nem validação de entrada — antes). Isso é coerente
  com o invariante 5 ("revalide sessão no PRIMEIRO bloco") e as 4 apps reais passam limpo hoje; só registro
  para quem escrever a próxima zona não se surpreender.
- `exigirServerOnly` depende da convenção `app/` = servidor por padrão do Next e `lib/` = raiz de
  composição do servidor; se uma zona futura importar segredo fora dessas pastas por um caminho novo
  (ex.: `servicos/`), o teste `fontesDaApp`/`arrastaServidor` já cobre porque varre a árvore inteira e seguiu
  os imports transitivamente (testado com `XR16`/pasta fora de `app/`/`lib/`).
- Nenhum invariante do AGENTS.md (em particular 2, 3, 4, 5, 10, 11, 15, 16) foi violado pela mudança em si;
  as mudanças são estritamente de verificação (analisadores mais rígidos) e duas correções de produto
  pontuais (V1 sem fallback de credencial; V5 domínio movido para dentro do envelope), ambas com o teste
  correspondente.
- Não encontrei DTO sensível cruzando para `'use client'`, credencial no navegador, `fetch` direto para
  domínio fora das duas exceções documentadas, nem `<Link>`/`redirect()` cruzando zona nas mudanças revisadas.

## O que não confirmei (fica para o challenger/auditor, que usam portas)
- Os números exatos "88/88 com Redis" e "85 + 3 pulados com arquivo" do ponta a ponta — não rodei
  `verificar:redis`/`verificar` por não poder usar portas. Os testes novos de `base.test.mjs` que dependem
  de Redis (V1 dinâmico, zona avulsa na porta 3012) estão com `skip` condicionado a `REDIS_URL_ZONA`, e o
  código deles bate com o que o auditor pediu; peço ao challenger/auditor confirmar a contagem final.
