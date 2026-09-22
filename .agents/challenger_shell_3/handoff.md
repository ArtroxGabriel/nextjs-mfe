APPROVE

# challenger_shell_3 — gate "Shell novo", iteração 3

Commit avaliado: HEAD de `bff-multizone` no início da sessão (superprojeto — `git status`
limpo no principal no início). Instância própria em `localhost:3000-3003` +
`127.0.0.1:4001-4004,4010`, subida com `base/scripts/ambiente.mjs` (`subir`/`derrubarApp`/
`subirApp`/`derrubarDominio`/`subirDominio`, já existente, não editado). Builds já existentes
para os itens 1-5; item 6 rodou com `CONSTRUIR=1`. Verdaccio (`:4873`) não foi tocado
(`200` confirmado antes de começar, e ao final). Nenhum arquivo de `repos/` ou `base/` foi
editado por mim — só leitura e execução. Todos os artefatos brutos estão em
`.agents/challenger_shell_3/`.

**Navegador real usado em todos os itens que pediam** (1, 2, 5): Chrome via Flatpak, através de
`base/verificacao/navegador.mjs` (`abrirNavegador`), com login feito por `fetch` no próprio
contexto da página (cookies aplicados pelas regras do navegador) e navegação de cliente com
`window.next.router.push` (confirmado presente em `window.next.router` nesta build do Next
16.3.4) ou clique real em botão de Server Action.

Scripts (reutilizáveis) e evidência bruta, todos em `.agents/challenger_shell_3/`:
`item1-navegacao-real.mjs` (+ `item1-resultado.json`, `item1-log.txt`), `item2-trace.mjs`
(+ `item2-resultado.json`, `item2-log.txt`), `item3-prefixos.mjs` (+ `item3-resultado.json`),
`item4-csp.mjs` (+ `item4-cabecalhos-brutos.txt`), `item5-flash.mjs` (+ `item5-resultado.json`,
`item5-log.txt`), `item6-suite-verificacao.txt`. Cada script sobe e derruba o próprio ambiente.

---

## Achado de ambiente, fora do escopo dos 6 itens (não é achado sobre o shell/proxy)

Ao verificar o housekeeping final (`git status` nos submódulos), encontrei **mudanças não
commitadas em `repos/erp-nucleo` e `repos/erp-moldura`** que eu não fiz — nunca escrevi em
`repos/`. As mudanças em `erp-nucleo` (novo subpath `./app`, `src/app/`,
`src/fabricas/criarPaginas.ts`, `test/paginas.test.mjs`, versão `0.6.0` → `0.7.0`) têm
timestamp de arquivo **21:14:00–21:14:57**, exatamente durante a janela em que meu item 6
rodava (`node --test`, 21:14:02–21:14:32, `duration_ms 30188`). As mudanças em `erp-moldura`
(`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) têm timestamp **21:15:34**, depois do
meu item 6 ter terminado, enquanto eu já fazia a checagem final de housekeeping. Isto indica um
**processo concorrente** (outro agente ou sessão) editando ao vivo os mesmos submódulos que esta
verificação usa, na mesma árvore de trabalho compartilhada — não uma mutação minha, e não uma
mutação que eu revertí (não toquei nesses arquivos).

Isto **não invalida os resultados dos 6 itens**: as quatro aplicações (`erp-shell`,
`erp-zona-1`, `erp-zona-2`, `erp-zona-acesso`) fixam `@erp/nucleo` em `0.6.0` no `package.json`
(confirmado, inalterado) e consomem o pacote publicado no Verdaccio, não o código-fonte do
submódulo diretamente; os builds usados (`.next` existentes + o rebuild condicional do item 6)
não dependem da árvore suja de `erp-nucleo`/`erp-moldura`. Mas é um problema de **isolamento do
ambiente compartilhado** que o orquestrador precisa saber: alguém mais está mexendo em
`repos/erp-nucleo` e `repos/erp-moldura` ao vivo, possivelmente relacionado ao ADR-0008
(Module Federation / subpath `./app`), fora da disciplina "um dono por vez" que `AMBIENTE.md`
descreve para portas (aqui o recurso disputado é o arquivo, não a porta). Não fiz nada com essas
mudanças — nem commit, nem revert, nem build a partir delas.

---

## 1. Achados adversários

Nenhum. Este gate não pediu Família 1 completa (cookie forjado ao stub, timing de enumeração
n≥500, `If-Match`/concorrência etc.) — só os 6 itens abaixo, nenhum dos quais expôs um achado
binário/bloqueante.

---

## 2. Itens do pedido — resultado

### Item 1 — Navegação real com gestão de acesso fora — **Confirmado**
4 usuários (davi, bruno, ana, carla) × 4 páginas (`/zona1`, `/zona1/relatorios`, `/zona2`,
`/acesso`) = 16 combinações, `n=1` cada, execução única, mesma sessão de navegador.

Com `gestao-acesso` (porta 4010) derrubada, login real (fetch no contexto do navegador) e
navegação real (`window.next.router.push`, RSC de cliente):
- Em **todas as 16 combinações**, `document.querySelector('h1').textContent` =
  `"Serviço indisponível"` — exatamente o texto declarado em `atual.md` §8 e no componente
  `ServicoIndisponivel` de cada app.
- **Nenhum item de menu aparece** (moldura sem menu, confirmado por `document.body.innerText`
  em todas as 16 respostas).
- **Nenhum termo de conteúdo de módulo** (`Indicadores`, `Recursos`, `concluída`/`pendente`,
  `Concluir e ir para a zona 1`, `Zonas registradas`, `Alternar`/`aria-pressed`, `recursos no seu
  escopo` etc.) apareceu em nenhuma resposta de rede capturada — HTML de documento **e** payload
  RSC/flight (`_rsc=`), varredura de corpo completo, 16×.
- A navegação RSC de cliente para `/acesso` respondeu `200` (não `404`/`503`) — bate com
  `atual.md` §8 ("o status continua 200, o layout não o define").

Evidência: `item1-navegacao-real.mjs`, `item1-resultado.json` (16 registros com URL final, `h1`,
lista de respostas capturadas e termos sensíveis buscados), `item1-log.txt`.

### Item 2 — Trace (`traceparent`) — **Confirmado**
`dominio-a` (porta 4001) trocado por um `http.Server` que só registra o cabeçalho `traceparent`
recebido (mesma técnica do teste T1 de `base/verificacao/base.test.mjs`). Requisições feitas
**de dentro do navegador real** (`fetch` na página, cookies aplicados pelas regras do navegador,
sessão de `davi`) para `/zona1`, variando o `traceparent` enviado: válido, texto livre
(`"nao sou um traceparent"`), e-mail (`atacante@evil.com`), trace zerado, span zerado, 2 KB de
`'X'` repetido. `n=1` por caso, execução única.

Resultado, nos 6 casos: o domínio recebeu **exatamente um** `traceparent`, sempre no formato W3C
válido (`^00-[0-9a-f]{32}-[0-9a-f]{16}-01$`); **em nenhum caso** o texto forjado apareceu no
cabeçalho recebido pelo domínio. No caso válido, o grupo de trace foi preservado
(`4bf92f3577b34da6a3ce929d0e0e4736`, idêntico ao enviado) e o span mudou (span filho, não o
mesmo `00f067aa0ba902b7` enviado) — confirma `garantirTraceparent`/`filhoDe` em
`repos/erp-nucleo/src/borda/trace.ts` (li o código: regex de formato + checagem de zero em
ambos os grupos; se falhar, gera novo `00-<32 hex>-<16 hex>-01` com `crypto.getRandomValues`).

Evidência: `item2-trace.mjs`, `item2-resultado.json`, `item2-log.txt`.

### Item 3 — Prefixos escapando da sessão — **Confirmado (nenhum escapa)**
`/api/otelx`, `/api/authx`, `/api/auth-falso/x`, `/API/OTEL/v1/traces`, GET e POST, sem cookie
— 8 combinações, `n=1` cada. Todas devolveram `307` para `/login?de=<caminho urlencoded>`, corpo
= só o texto do redirecionamento, nenhuma delas alcançou um route handler protegido nem revelou
conteúdo. Bate com o código lido (`decisao-proxy.ts::noSegmento`, casamento por segmento exato,
não por prefixo textual simples — já fechava o achado U6 do auditor_shell_2 para
`/api/otelx`/`/api/authx`; a maiúscula em `/API/OTEL/...` também não escapa porque o casamento
de `/api/auth`/`/api/otel` é sensível a caixa e cai no `catch-all` que exige sessão).

Evidência: `item3-prefixos.mjs`, `item3-resultado.json`.

### Item 4 — CSP — **Confirmado**
`/`, `/login`, `/erro-de-zona` (públicas) e `/zona1` (com sessão de `davi`) via `curl -D -`
(cabeçalhos crus, sem a normalização que o `fetch` do Node faria em cabeçalhos duplicados):
**mesmas diretivas de CSP** nas 4 rotas (só o `nonce` muda por requisição) e **exatamente uma**
ocorrência do cabeçalho `Content-Security-Policy` por resposta, `n=1` por rota.

Observação, não achado: `/zona1` sem cookie (redirecionamento `307` para o login) **não tem
cabeçalho CSP** — o corpo é vazio, e no código (`proxy.ts`, ramo `redirecionar-login`) o
redirecionamento é devolvido direto, sem passar por `aplicarCsp`. Não é um risco de segurança
(não há conteúdo renderizável no corpo do redirecionamento), mas é uma diferença de
comportamento que nenhum documento menciona explicitamente — ver seção 3.

Evidência: `item4-csp.mjs`, `item4-cabecalhos-brutos.txt` (cabeçalhos completos das 5 respostas).

### Item 5 — Flash com navegador real — **Confirmado**
Fluxo real e completo, sem simular nenhuma chamada: `ana` entra (login real), abre `/zona2`
(navegação real), **clica no botão real** "Concluir e ir para a zona 1" (dispara a Server Action
de verdade via o próprio React/Next do navegador), a ação troca o documento para `/zona1` via
`location.assign` e o texto "Tarefa concluída." aparece **uma vez** no `document.body.innerText`.
Ao recarregar `/zona1` (`pagina.ir`, documento novo), o toast **não repete** — confirmado por
regex no texto da tela antes e depois. `n=1`.

Evidência: `item5-flash.mjs`, `item5-resultado.json`, `item5-log.txt`.

### Item 6 — Suíte automática — **Confirmado**
`CONSTRUIR=1 node --test base/verificacao/*.test.mjs`: **47/47 passam** (`tests 47`, `pass 47`,
`fail 0`), uma execução, `duration_ms 30188`. Portas confirmadas livres antes e depois.

Evidência: `item6-suite-verificacao.txt` (saída completa).

---

## 3. Divergências declarado × observado

| # | Declarado | Observado | Documento a corrigir |
|---|---|---|---|
| F1 | Nenhum documento afirma explicitamente que o redirecionamento de login (`307`) leva ou não leva CSP; `atual.md` §1.1 só diz que rotas `publico` e `prosseguir` recebem "CSP e nonce" | `/zona1` sem cookie devolve `307` **sem** nenhum cabeçalho `Content-Security-Policy` (corpo vazio, só `Location`). Não é uma contradição do que está escrito — é uma lacuna: o fluxograma de `atual.md` §1.1 rotula o ramo `C -- não --> L["307 /login?de=…"]` sem dizer se leva CSP, e o código (`proxy.ts`) de fato não chama `aplicarCsp` nesse ramo. | opcional: `atual.md` §1.1 poderia anotar explicitamente que o `307` de login não carrega CSP (consistente e inofensivo, já que não há corpo renderizável) |

Nenhuma outra divergência encontrada nos 6 itens: os 5 comportamentos declarados
(`atual.md` §8: "a moldura sem menu e 'Serviço indisponível'... sem a página... status continua
200"; N4 toast uma vez só; N8 trace contínuo sem dado pessoal; casamento de segmento exato para
rotas reservadas; CSP única por resposta com as mesmas diretivas) foram todos reproduzidos ao
vivo exatamente como escrito.

---

## Housekeeping

Portas próprias (3000-3003, 4001-4004, 4010) confirmadas **livres** antes de eu começar e ao
final de toda a sessão (`curl` a cada uma → `000`, conexão recusada). Verdaccio (`:4873`)
confirmado no ar (`200`) e não tocado. Nenhum processo `next start`/`next-server`/
`servidor.mjs`/`pnpm start` meu ficou rodando (`pgrep` vazio). `repos/` e `base/`: eu não editei
nada (ver a seção "Achado de ambiente" acima sobre mudanças de **terceiros** em
`repos/erp-nucleo` e `repos/erp-moldura`, não minhas, encontradas na checagem final e não
revertidas por mim).

---

## O que eu não consegui executar

- **Família 1 completa de sondas adversárias** (cookie forjado direto ao stub, timing de
  enumeração `n≥500`, `If-Match`/concorrência, CSRF em todas as combinações) — não fazia parte
  do escopo explícito dos 6 itens desta rodada (iteração 3, foco em navegação real, trace, CSP e
  flash). Cookie forjado e Server Action sem `Origin` já estão cobertos pela suíte automática
  (item 6, testes "cookie forjado passa da camada 1 e morre na camada 2" e "Server Action sem
  Origin... não executa em nenhuma app") e passaram.
- **Não medi contenção de CPU/rede da minha própria máquina** durante os itens 1, 2 e 5 (não
  registrei `load average` do SO) — as diferenças observadas são categóricas (presença/ausência
  de termo, texto exato de `h1`, contagem de cabeçalho), não de tempo, então o ruído de máquina
  tem baixo risco de ter mascarado o resultado, mas não tenho o dado para provar isso.
- **Não investiguei a fundo a mudança concorrente em `repos/erp-nucleo`/`repos/erp-moldura`**
  (não sei quem a fez, nem se está relacionada a um worker de outro gate ou a uma investigação do
  ADR-0008/Module Federation) — reportei o fato observável (arquivos, diffs, timestamps) e não
  fui além, porque investigar a fundo exigiria ler/alterar `repos/`, e a mudança não é minha
  para julgar ou reverter.
- **Não repeti nenhum item com n>1** — todos os 6 itens pedidos são testes de comportamento
  categórico (o mesmo texto, o mesmo cabeçalho, a mesma decisão), não de distribuição estatística;
  repetição adicional teria baixo valor incremental para o tipo de afirmação testada aqui (isto é
  diferente de uma medição de tempo/percentil, que exigiria `n` grande — não foi pedido nesta
  rodada).
