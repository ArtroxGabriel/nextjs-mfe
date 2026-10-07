# Núcleo 0.10.4: `ehHtmlInerte` por lista de permissão (D29)

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, task por
> task. Passos com `- [ ]`. Começa **depois do gate do C1** (aprovado em 2026-10-06) e vem **antes do C3**.

**Objetivo:** trocar a lista de bloqueio de `ehHtmlInerte` (`repos/erp-nucleo/src/fabricas/fragmento.ts`) por uma
**lista de permissão** de tags, atributos e valores. Fragmento que sai dela é recusado: 500 no dono e ausência na
consumidora, como hoje.

**Evidência do problema:** auditor_c1_1 (gate do C1, iteração 1; `git show b091977~:.agents/auditor_c1_1/handoff.md` ou
`DEFERRED.md` D29). Hoje passam como inertes:
- `<img/onerror=…>`, `<svg/onload=…>` e `<body/onload=…>`: a regex exige espaço antes de `on`;
- atributo colado em aspas;
- entidades e tab dentro de `javascript:`;
- `meta`, `base`, `form`, `link` e `style`.

A CSP com nonce barra script, mas **não** barra `<meta http-equiv=refresh>`, `<base href>` nem `<form action>`.

**Decisão do humano (2026-10-06):** corrigir logo depois do gate do C1 com o núcleo 0.10.4 em lockstep nas 4 apps, por
lista de permissão e não de bloqueio, com gate próprio. Nenhuma instalação.

## Restrições

- Invariantes do `AGENTS.md`, em especial 3 (`server-only`) e 14 (o núcleo não muda a semântica do que já usa).
- **Validar, não sanitizar.** A função continua devolvendo `boolean`, sem reescrever o HTML. Um fragmento fora da lista é
  bug do dono (ADR-0011, decisão 7): 500 nele, ausência na consumidora.
- A assinatura não muda: `ehHtmlInerte(html: string): boolean`, no mesmo módulo, usada por `criarFragmento` e
  `responderFragmento`. Não entra no `index.ts`: hoje ela não é exportada pelo pacote, e continua assim.
- O único produtor atual (`repos/erp-zona-2/lib/fragmento-tarefas.ts`) precisa continuar passando, inclusive com os
  títulos hostis da semente do stub (`dominio-c.json`).
- Núcleo **0.10.4**, lockstep nas 4 apps (`task lockstep`). Em outra máquina: `task pacotes:publicar` e
  `task pacotes:alinhar-hashes`.
- Commits sem rodapé de coautoria (hook `no-ai-authorship`). Submódulo enviado antes do principal (`AMBIENTE.md` §2).

## Desenho

O fragmento é escrito por uma zona da própria base, em forma canônica. Por isso a gramática aceita pode ser estreita e
simples: o que não estiver nela é recusado, sem tentar entender HTML arbitrário.

**Tokens** (o texto inteiro precisa ser coberto por eles):

| Token | Forma aceita |
|---|---|
| abertura | `<tag>` ou `<tag a="v" b="v">`: tag em minúsculas, **um espaço** antes de cada atributo, valor sempre entre `"` |
| fechamento | `</tag>`, fechando a última tag aberta (pilha) |
| texto | qualquer caractere, exceto `<`, `>`, `&` solto e controle (tab, LF e CR são aceitos); entidade só `&amp;` `&lt;` `&gt;` `&quot;` `&#39;` `&nbsp;` |

Qualquer outro `<` ou `>` reprova: comentário, doctype, CDATA, `<img/onerror>`, maiúsculas, atributo sem aspas ou com
aspas simples. No fim do texto a pilha precisa estar vazia. Fechamento sobrando (por exemplo `</section></main>`)
quebraria o layout da consumidora, que embute o HTML com `dangerouslySetInnerHTML`.

**Listas:**

| | Permitido |
|---|---|
| tags | `section` `div` `span` `p` `h2` `h3` `h4` `ul` `ol` `li` `a` `strong` `em` `small` `time` `br` (`br` é vazia: sem fechamento) |
| atributos em qualquer tag | `id` `class` `aria-label` `aria-labelledby` `aria-describedby` `data-fragmento` |
| atributos por tag | `a`: `href`; `time`: `datetime` |
| valor de atributo | texto sem `"`, `<`, `>`, `` ` ``, controle nem `&` solto; entidade só as cinco de escape (sem `&nbsp;`) |
| `href` | caminho da mesma origem: começa com `/`, não com `//` nem `/\`; só `A-Za-z0-9-._~/?=%#`. Sem `:` (nenhum esquema), sem `&` (nenhuma entidade), sem espaço |

Atributo repetido na mesma tag reprova.

Ficam de fora de propósito (YAGNI): `img` (carrega recurso de outra origem), `table`, `style`, `form`, `button`,
`input` e `title`. Quem precisar de uma delas abre a lista com teste, no mesmo commit.

### Mutações declaradas

Prática nova, sugerida na avaliação de 2026-10-07: o worker roda estas mutações **antes** de pedir o gate e registra
no relatório da task que cada uma é pega. O auditor reaplica as mutações e procura outras.

Conferido ao escrever este plano (2026-10-07), num protótipo em JS fora do repositório: o código do Passo 3 passa nos
15 testes do Passo 1, e cada uma das mutações M1–M13 é pega por pelo menos um deles. A M4 só passou a ser pega depois que
`/a:b` entrou na lista de `href` recusados.

| # | Mutação em `fragmento.ts` | Teste que precisa reprovar |
|---|---|---|
| M1 | `meta`, `base`, `form`, `style`, `link`, `img`, `svg`, `script` ou `iframe` em `TAGS` (uma por vez) | "tags fora da lista" |
| M2 | `onclick` (ou qualquer `on*`) em `ATRIBUTOS_GLOBAIS` | "atributo fora da lista" |
| M3 | `href` aceito em qualquer tag (fora de `ATRIBUTOS_DA_TAG.a`) | "href só em a" |
| M4 | `HREF` aceitando `:` ou `&` | "href com esquema ou entidade" |
| M5 | `HREF` aceitando `//` no começo | "href de outra origem" |
| M6 | sem a checagem da pilha (fechamento errado ou tag aberta no fim) | "aninhamento" |
| M7 | separador de atributo `[ \t\n/]+` em vez de um espaço | "img/onerror e separadores" |
| M8 | valor de atributo sem aspas aceito | "atributo sem aspas" |
| M9 | `&` solto ou qualquer `&…;` aceito no texto ou no valor | "entidades" |
| M10 | `<` ou `>` solto aceito no texto | "sinal solto" |
| M11 | atributo repetido aceito | "atributo repetido" |
| M12 | `br` fora de `VAZIAS` (ou `</br>` aceito) | "br vazia" |
| M13 | regex de tag com a flag `i` (maiúsculas) | "maiúsculas" |

## Tasks

### Task 1: lista de permissão no núcleo (erp-nucleo)

**Arquivos:**
- modificar `repos/erp-nucleo/src/fabricas/fragmento.ts` (o bloco `ATIVO` / `ehHtmlInerte`);
- modificar `repos/erp-nucleo/test/fragmento.test.mjs`;
- modificar `repos/erp-nucleo/package.json` (`version` 0.10.4).

**Interfaces:**
- Consome: nada novo.
- Produz: `export const ehHtmlInerte = (html: string): boolean` (mesmo nome e tipo; agora também importável nos testes por
  `../dist/fabricas/fragmento.js`).

- [ ] **Passo 1: testes que reprovam.** Acrescentar ao fim de `test/fragmento.test.mjs` (e `ehHtmlInerte` no import da
  linha 3):

```js
// ---------- ehHtmlInerte: lista de permissão (D29) ----------

const aceita = (html) => assert.equal(ehHtmlInerte(html), true, html)
const recusa = (html) => assert.equal(ehHtmlInerte(html), false, html)

test('o bloco canonico da zona 2 passa, inclusive com titulos hostis escapados', () => {
  aceita('<section data-fragmento="zona2/tarefas" aria-labelledby="fragmento-zona2-tarefas">'
    + '<h2 id="fragmento-zona2-tarefas">Tarefas pendentes (zona 2)</h2>'
    + '<ul><li>&lt;img src=x onerror=alert(1)&gt;</li><li>a &amp; b &quot;c&quot; &#39;d&#39;</li></ul>'
    + '<p><a href="/zona2">Abrir as tarefas</a></p></section>')
  aceita('<p>Nenhuma tarefa pendente.</p>')
  aceita('')
  aceita('texto puro')
  aceita('<p>linha<br>outra</p>')
  aceita('<p class="t" id="x"><strong>a</strong> <em>b</em> <small>c</small> <span>d</span></p>')
  aceita('<ol><li><time datetime="2026-10-07">7 out</time></li></ol><div><h3>a</h3><h4>b</h4></div>')
  aceita('<a href="/zona1/relatorios?ano=2026#topo">r</a>')
  aceita('<p>a&nbsp;b</p>')
  aceita('<p>\tcom tab\nE quebra\r\n</p>')
})

test('tags fora da lista', () => {
  for (const t of ['script', 'iframe', 'object', 'embed', 'frame', 'meta', 'base', 'form', 'style', 'link', 'img', 'svg',
    'body', 'html', 'head', 'title', 'button', 'input', 'textarea', 'select', 'table', 'math', 'template', 'noscript']) {
    recusa(`<${t}></${t}>`)
    recusa(`<p><${t}></${t}></p>`)
  }
  recusa('<meta http-equiv="refresh" content="0;url=/sair">')
  recusa('<base href="/">')
})

test('atributo fora da lista', () => {
  for (const a of ['onclick', 'onerror', 'onload', 'onmouseover', 'style', 'src', 'srcdoc', 'action', 'formaction',
    'target', 'rel', 'http-equiv', 'content', 'xlink:href', 'data-x', 'aria-hidden', 'tabindex', 'hidden']) {
    recusa(`<p ${a}="x">a</p>`)
  }
  recusa('<time href="/a">a</time>')
  recusa('<p datetime="2026">a</p>')
})

test('href so em a', () => {
  for (const t of ['p', 'div', 'span', 'section', 'li']) recusa(`<${t} href="/a">a</${t}>`)
})

test('href com esquema ou entidade', () => {
  for (const h of ['javascript:x', 'JaVaScRiPt:x', ' javascript:x', 'java\tscript:x', '&#106;avascript:x',
    '&#x6A;avascript:x', 'javascript&colon;x', 'data:text/html,x', 'vbscript:x', 'https://fora.exemplo/a', 'mailto:a@b',
    '/a?b=1&amp;c=2', '/a:b', 'a/b', '', '#topo', '/a b', '/a\\b']) {
    recusa(`<a href="${h}">a</a>`)
  }
})

test('href de outra origem', () => {
  for (const h of ['//fora.exemplo/a', '/\\fora.exemplo/a', '///fora.exemplo']) recusa(`<a href="${h}">a</a>`)
})

test('aninhamento', () => {
  recusa('<section>')
  recusa('</section>')
  recusa('<p>a</p></div></main>')
  recusa('<ul><li>a</ul></li>')
  recusa('<p><strong>a</p></strong>')
})

test('img/onerror e separadores', () => {
  recusa('<img/onerror=alert(1)>')
  recusa('<svg/onload=alert(1)>')
  recusa('<body/onload=alert(1)>')
  recusa('<p/class="a">a</p>')
  recusa('<p\tclass="a">a</p>')
  recusa('<p\nclass="a">a</p>')
  recusa('<p  class="a">a</p>')
  recusa('<p class="a"class="b">a</p>')
  recusa('<p class="a" >a</p>')
  recusa('<p class = "a">a</p>')
})

test('atributo sem aspas', () => {
  recusa('<p class=a>a</p>')
  recusa("<p class='a'>a</p>")
  recusa('<p class>a</p>')
  recusa('<a href=/a>a</a>')
})

test('entidades', () => {
  recusa('<p>a & b</p>')
  recusa('<p>&#60;script&#62;</p>')
  recusa('<p>&lt</p>')
  recusa('<p>&colon;</p>')
  recusa('<p class="a&#34;b">a</p>')
  recusa('<p class="a&nbsp;b">a</p>')
  recusa('<p class="a&b">a</p>')
  recusa('<p class="a`b">a</p>')
  aceita('<p class="a&amp;b &lt;&gt;&quot;&#39;">a</p>')
})

test('sinal solto', () => {
  for (const h of ['a < b', 'a > b', '<', '>', '<<p>a</p>', '<p>a</p>>', '<!-- x -->', '<!doctype html>',
    '<![CDATA[x]]>', '<?xml?>', '< p>a</p>', '<p>a</ p>', '</>']) recusa(h)
})

test('atributo repetido', () => {
  recusa('<p class="a" class="b">a</p>')
  recusa('<a href="/a" href="/b">a</a>')
})

test('br vazia', () => {
  recusa('<p>a<br></br></p>')
  recusa('<p>a</br></p>')
  recusa('<br/>')
})

test('maiusculas', () => {
  recusa('<P>a</P>')
  recusa('<p CLASS="a">a</p>')
  recusa('<SCRIPT src=a>')
})

test('caracteres de controle fora de tab, LF e CR', () => {
  recusa('<p>a\u0000b</p>')
  recusa('<p>a\u0007b</p>')
  recusa('<p class="a\u0000b">a</p>')
  recusa('<p class="a\nb">a</p>')
})
```

- [ ] **Passo 2: rodar e ver reprovar.** `cd repos/erp-nucleo && pnpm test`. Esperado: reprovam "tags fora da lista"
  (`meta`, `base`…), "img/onerror e separadores", "aninhamento", "entidades" e outros. **Os testes antigos continuam
  verdes.**

- [ ] **Passo 3: implementação.** Em `src/fabricas/fragmento.ts`, trocar o comentário, `ATIVO` e `ehHtmlInerte` por:

```ts
/**
 * HTML de fragmento é inerte (`02-zonas.md` §2.3): só a gramática estreita abaixo, por lista de permissão. Cada zona tem
 * o próprio nonce de CSP, e script de outra zona rodaria com o nonce errado ou traria de volta o problema que tirou o
 * Module Federation. A CSP não barra `<meta http-equiv=refresh>`, `<base>` nem `<form>`; por isso a lista é de
 * permissão: tag, atributo ou valor fora dela reprova (D29, gate do C1).
 */
const TAGS = new Set(['section', 'div', 'span', 'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'small', 'time', 'br'])
const VAZIAS = new Set(['br'])
const ATRIBUTOS_GLOBAIS = new Set(['id', 'class', 'aria-label', 'aria-labelledby', 'aria-describedby', 'data-fragmento'])
const ATRIBUTOS_DA_TAG: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(['href']),
  time: new Set(['datetime']),
}
const TOKEN = /<[^<>]*>|[^<>]+|[<>]/g
const ABERTURA = /^<([a-z][a-z0-9]*)((?: [a-z][a-z0-9-]*="[^"]*")*)>$/
const ATRIBUTO = / ([a-z][a-z0-9-]*)="([^"]*)"/g
const FECHAMENTO = /^<\/([a-z][a-z0-9]*)>$/
const ESCAPE = '&(?:amp|lt|gt|quot|#39);'
const TEXTO = new RegExp(`^(?:[^<>&\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]|${ESCAPE}|&nbsp;)*$`)
const VALOR = new RegExp(`^(?:[^"<>&\`\\u0000-\\u001f\\u007f]|${ESCAPE})*$`)
/** Caminho da mesma origem: `/` sem `//` nem `/\`; sem `:` (esquema) e sem `&` (entidade). */
const HREF = /^\/(?![/\\])[A-Za-z0-9\-._~/?=%#]*$/

function atributosValidos(tag: string, atributos: string): boolean {
  const vistos = new Set<string>()
  for (const [, nome, valor] of atributos.matchAll(ATRIBUTO)) {
    if (vistos.has(nome)) return false
    vistos.add(nome)
    if (!ATRIBUTOS_GLOBAIS.has(nome) && !ATRIBUTOS_DA_TAG[tag]?.has(nome)) return false
    if (!VALOR.test(valor)) return false
    if (nome === 'href' && !HREF.test(valor)) return false
  }
  return true
}

export function ehHtmlInerte(html: string): boolean {
  const abertas: string[] = []
  for (const [token] of html.matchAll(TOKEN)) {
    if (!token.startsWith('<') && !token.startsWith('>')) {
      if (!TEXTO.test(token)) return false
      continue
    }
    const fecha = FECHAMENTO.exec(token)
    if (fecha) {
      if (abertas.pop() !== fecha[1]) return false
      continue
    }
    const abre = ABERTURA.exec(token)
    if (!abre) return false
    const [, tag, atributos] = abre
    if (!TAGS.has(tag) || !atributosValidos(tag, atributos)) return false
    if (!VAZIAS.has(tag)) abertas.push(tag)
  }
  return abertas.length === 0
}
```

  Observações para quem implementa:
  - `TOKEN` cobre o texto inteiro: um `<` sem `>` vira o token `<`, que reprova em `ABERTURA`;
  - `</br>` reprova porque `br` nunca entra na pilha;
  - `ABERTURA` exige exatamente um espaço antes de cada atributo e nenhum espaço antes do `>`.

- [ ] **Passo 4: rodar e ver passar.** `pnpm test` no `erp-nucleo`. Todos verdes, os antigos inclusive. Conferir que o
  teste "dono e consumidor juntos" (linha ~178) ainda usa HTML dentro da lista; se não usar, ajustar o **HTML do teste**,
  nunca a lista.

- [ ] **Passo 5: mutações declaradas.** Aplicar M1–M13 (tabela do Desenho) uma por vez no `src`, rodar
  `pnpm test` e reverter. Registrar no relatório da task, para cada uma, o teste que reprovou. Mutação que sobrevive
  significa um teste a mais neste mesmo passo.

- [ ] **Passo 6: versão e commit.** `version` 0.10.4 no `package.json`.

```bash
cd repos/erp-nucleo
git add src/fabricas/fragmento.ts test/fragmento.test.mjs package.json
git commit -m "fix(nucleo)!: ehHtmlInerte by allowlist of tags, attributes and values (D29, 0.10.4)"
```

### Task 2: publicar, lockstep e o produtor da zona 2

**Arquivos:**
- `repos/erp-{shell,zona-1,zona-2,zona-acesso}/package.json` e `pnpm-lock.yaml` (0.10.4);
- criar `repos/erp-zona-2/test/fragmento-tarefas.test.mjs`, ou acrescentar ao teste de unidade que já cobre
  `lib/fragmento-tarefas.ts`, se existir (`grep -rn fragmento-tarefas repos/erp-zona-2/test`).

**Interfaces:**
- Consome: `ehHtmlInerte` da Task 1, por `@erp/nucleo/dist/fabricas/fragmento.js` ou pela cópia do dist, como os outros
  testes da zona importam o núcleo (conferir o padrão em `repos/erp-zona-2/test/` antes de escrever).
- Produz: as 4 apps em 0.10.4.

- [ ] Ambiente: `docker ps`. Se Redis ou Keycloak não estiverem no ar, `task showcase:subir` e `task showcase:checar`.
- [ ] `task pacotes:publicar`, instalar 0.10.4 nas 4 apps e `task lockstep` (o padrão da Task 3 do plano da D19-B,
  `docs/superpowers/plans/2026-10-05-d19b-espera-com-token-vencido.md`).
- [ ] Teste de unidade na zona 2: `htmlDasTarefasPendentes` com a lista vazia, com os títulos hostis da semente
  (`repos/erp-dominio-stub/data/dominio-c.json` ou onde a semente estiver) e com a tarefa concluída. Em todos os casos,
  `ehHtmlInerte(html) === true`. Isso prova que o produtor real cabe na lista e protege a zona 2 de ser reprovada por
  uma mudança de layout.
- [ ] `pnpm test` em cada app; `task verificar:redis` (os testes C1a–C1d têm de seguir verdes com 0.10.4).
- [ ] Um commit por submódulo (`chore: @erp/nucleo 0.10.4 (D29)`, com o teste da zona 2 junto), depois o ponteiro no
  principal.

### Task 3: documentos e registros

- [ ] `docs/desenho/mfe/02-zonas.md` §2.3: a gramática e as listas do Desenho (tabelas curtas) e a regra "abrir a lista é
  commit com teste".
- [ ] No mesmo arquivo, §2.5: a linha que faltava do D30 ("sem `Accept-Fragmento-Versao`, a dona serve a versão 1; só
  recusa versão diferente").
- [ ] ADR-0011, adendo 2: "inerte" passa a ser lista de permissão. Motivo: o gate do C1 e o que a CSP não barra.
  Consequência: fragmento com tag nova reprova até a lista abrir.
- [ ] `DEFERRED.md`: fechar o D29 com a evidência (commits, M1–M13 pegas) e tirar do D30 a linha do §2.5.
- [ ] `RETOMADA.md` (item 2b ✅, próximo: C3), `ATIVIDADES.md` (#10: comentário opcional) e `task orquestrador:ledger`.

### Task 4: verificação final e gate

- [ ] Rodar e registrar:
  - `task test`;
  - `task typecheck`;
  - `task verificar:estatica`;
  - `task verificar:redis`;
  - `CONSTRUIR=1 task verificar:construir`;
  - `task verificar:oidc`;
  - `task lockstep`.
- [ ] Gate completo, porque a mudança toca código de produto: revisor, challenger e auditor, no padrão do
  `LEIA-PRIMEIRO.md`.
  - **O challenger** ataca o painel da zona 1 com fragmentos hostis servidos por uma zona 2 de teste: as grafias do
    handoff do auditor_c1_1 mais as da tabela "href com esquema ou entidade".
  - **O auditor** recebe a tabela M1–M13 e o relatório do Passo 5 da Task 1.
