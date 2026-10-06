# C1: fragmentos entre zonas (zona 1 ← zona 2)

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, task por
> task. Passos com `- [ ]`.

**Objetivo:** o painel da zona 1 mostra, no HTML do servidor, um bloco que pertence à zona 2 ("Tarefas pendentes"),
pedido por fragmento (ADR-0011). Quem não tem o módulo da zona 2 não vê nada; a zona 2 fora ou travada apaga só o
bloco; o navegador nunca alcança `/{zona}/_fragmento/` pelo shell.

**Arquitetura:** o núcleo já tem as duas pontas desde a 0.5.0 (`criarFragmento` e `responderFragmento`,
`repos/erp-nucleo/src/fabricas/fragmento.ts`); nada muda no núcleo. A zona 2 ganha a rota dona
`/zona2/_fragmento/tarefas/{id}`, o shell passa a responder 404 a `/{zona}/_fragmento/...` vindo do navegador, e a zona 1
pede o fragmento direto à origem interna da zona 2 (servidor→servidor, sem passar pelo shell), com a origem em
`ZONA2_URL`.

**Tecnologia:** Next 16.3.4 (App Router), `@erp/nucleo` 0.10.3, `node --test`, verificação ponta a ponta em
`base/verificacao/`.

**Decisões já tomadas:** ADR-0011 (aceita) e `docs/desenho/mfe/02-zonas.md` §2 (contrato HTTP). Ordem D7 → C1 → C3 pelo
humano (2026-10-06).

**Escolhas deste plano (sem decisão nova do humano):**
- **O bloco é "Tarefas pendentes" e o `{id}` é `pendentes`.** O contrato pede `{nome}/{id}`; a zona 1 não conhece
  nenhum id de tarefa, e ligar tarefa a recurso exigiria mudar a semente e os testes do domínio C. `pendentes` é a
  única chave aceita; qualquer outra dá 204. Sem mudança em `erp-dominio-stub`.
- **Com acesso e nada pendente, o fragmento é 200 com "Nenhuma tarefa pendente."**, não 204. A verificação ponta a
  ponta conclui tarefas em outros testes; um bloco que some quando a lista esvazia tornaria os testes dependentes da
  ordem e confundiria "não pode" com "não há" no próprio showcase.
- **A pasta da rota é `%5Ffragmento`, não `_fragmento`.** No App Router, pasta que começa com `_` é privada e fica fora
  do roteamento; `%5F` é a forma documentada de ter um segmento de URL com `_`. A URL continua
  `/zona2/_fragmento/tarefas/{id}`. O ADR-0011 (decisão 5) e o `02-zonas.md` §1 escrevem `_fragmento/` como pasta; a
  Task 3 registra a correção.

Nenhuma instalação.

## Restrições globais

- Invariantes do `AGENTS.md`. Em especial:
  - **4:** a zona 1 não faz `fetch`: quem chama a zona 2 é `criarFragmento` do núcleo (ADR-0011, decisão 2). A
    checagem N8 (`base/verificacao/saida-de-rede.mjs`) não ganha exceção.
  - **8:** sem o módulo da zona 2, o bloco não existe (nem título, nem aviso). Nada de "sem acesso".
  - **10:** a rota de fragmento exige sessão (o proxy da zona 2 já a cobre: sem cookie, 307 para o login) e o navegador
    não a alcança pelo shell.
  - **16:** a rota dona chama `nucleo.acesso.exigirModulo('zona2', 'tarefas.ver')`, com os dois argumentos.
  - **2:** o HTML do fragmento só leva título de tarefa; nada de token, grupo ou dado de sessão.
- Fragmento é **inerte**: sem `<script>`, manipulador inline, `javascript:`, `iframe`. O núcleo confere nas duas pontas
  (`ehHtmlInerte`).
- **Configuração** (regra do `AGENTS.md`): `ZONA2_URL`, padrão `http://127.0.0.1:3002`, só origem (sem caminho), lida
  pela zona 1; entra na lista de inclusão `AMBIENTE_PERMITIDO.zona` (`base/scripts/ambiente.mjs`) e em
  `docs/CONFIGURACAO.md` §2 **no mesmo commit** que leva a zona 1 a lê-la. `ERP_FRAGMENTO_TIMEOUT_MS` (padrão 2000) já
  existe e não muda.
- Ponta a ponta usa os atores do login de desenvolvimento: **ana** tem zona 1 e zona 2; **eva** só `tarefas.ver` na zona 2;
  **bruno** e **davi** só a zona 1.
- **Fora de commit, de propósito** (`RETOMADA.md`, "Ambiente"):
  - `docs/README.md`, `docs/arquitetura/alvo.md` e `docs/arquitetura/infraestrutura-alvo.md`: trabalho do humano. **Não
    editar** (a linha "Composição" do `alvo.md` §6 fica para o orquestrador avisar o humano);
  - os `pnpm-lock.yaml` de `erp-dominio-stub` e `erp-moldura`.

  Adicionar arquivo por arquivo; nunca `git add -A`, `git add .` nem `git add docs/`.
- Commits sem rodapé de coautoria (hook `no-ai-authorship`). Submódulo enviado antes do principal (`AMBIENTE.md` §2).
- Revisor de task grava o rascunho desde o começo: `.superpowers/sdd/2026-10-06-c1-fragmentos-entre-zonas/review-task<N>-achados.md`,
  primeiro "(parcial)", no fim "(final)". Ao fechar cada task, `task orquestrador:ledger`.
- Antes de qualquer ponta a ponta: portas 3000–3003 e 4001–4120 livres; Redis, Keycloak e Verdaccio (Docker) ficam no ar;
  nada da base fica rodando no fim. As apps mudadas são reconstruídas com `CONSTRUIR=1`.

## Arquivos

| Arquivo | Repositório | Task | Responsabilidade |
|---|---|---|---|
| `lib/fragmento-tarefas.ts` (novo) | erp-zona-2 | 1 | HTML inerte do bloco, com escape |
| `app/zona2/%5Ffragmento/tarefas/[id]/route.ts` (novo) | erp-zona-2 | 1 | rota dona: sessão, módulo, chave, domínio C |
| `base/verificacao/base.test.mjs` | raiz | 1, 2, 3 | C1a (dono), C1b (shell), C1c e C1d (painel) |
| `lib/decisao-proxy.ts` | erp-shell | 2 | ação `nao-encontrado` para `/{zona}/_fragmento/...` |
| `proxy.ts` | erp-shell | 2 | responde 404 sem corpo a essa ação |
| `test/proxy.test.mjs` | erp-shell | 2 | unidades da recusa e dos dentes |
| `lib/fragmentos.ts` (novo) | erp-zona-1 | 3 | cliente `criarFragmento` com a allowlist da zona 1 |
| `app/zona1/page.tsx` | erp-zona-1 | 3 | bloco da zona 2 no painel |
| `base/scripts/ambiente.mjs` | raiz | 3 | `ZONA2_URL` na lista de inclusão das zonas |
| `docs/CONFIGURACAO.md` §2 | raiz | 3 | linha de `ZONA2_URL` |
| `docs/adr/0011-fragmento-entre-zonas.md` | raiz | 3 | adendo 1: pasta `%5Ffragmento` e o primeiro uso |
| `docs/desenho/mfe/02-zonas.md` §1 | raiz | 3 | a pasta na árvore da zona |
| `docs/arquitetura/atual.md` | raiz | 3 | composição por fragmento em uso |

---

### Task 1: rota dona do fragmento na zona 2 (erp-zona-2 + teste C1a)

**Arquivos:**
- Criar: `repos/erp-zona-2/lib/fragmento-tarefas.ts`
- Criar: `repos/erp-zona-2/app/zona2/%5Ffragmento/tarefas/[id]/route.ts` (o nome da pasta tem literalmente `%5F`)
- Modificar: `base/verificacao/base.test.mjs` (import de `APPS`; constantes e teste C1a logo depois do teste L9)
- Ponteiro do submódulo `repos/erp-zona-2`

**Interfaces:**
- Consome: `responderFragmento(req, produzir)` de `@erp/nucleo` (200 com o HTML; `null` → 204; `ErroDeAplicacao` → 204;
  HTML ativo → 500; `Sec-Fetch-Dest` diferente de `empty` → 404; `Accept-Fragmento-Versao` diferente de `1` → 204;
  `Cache-Control: private, no-store`). `nucleo.acesso.exigirModulo` lança `NaoEncontrado` ou `SessaoInvalida`, as duas
  `ErroDeAplicacao`.
- Produz: `GET /zona2/_fragmento/tarefas/pendentes` na origem da zona 2 (porta 3002). O HTML tem
  `data-fragmento="zona2/tarefas"` e o título `Tarefas pendentes (zona 2)`; as Tasks 2 e 3 procuram esses textos.
- Produz (teste): `ZONA2_DIRETO`, `FRAGMENTO_TAREFAS`, `BLOCO_TAREFAS` e `pedirFragmento` em `base.test.mjs`, usados
  pelas Tasks 2 e 3.

- [ ] **Passo 1: escrever o teste ponta a ponta que falha**

Em `base/verificacao/base.test.mjs`, trocar a linha de import do ambiente por:

```js
import { subir, RAIZ, SHELL as SHELL_URL, APPS, ambienteDoPapel } from '../scripts/ambiente.mjs'
```

Logo depois do fim do teste `L9 (D7): …`, acrescentar:

```js
// C1 (ADR-0011): a zona 1 embute um bloco da zona 2. O fragmento é servidor→servidor, direto na origem interna da zona.
const ZONA2_DIRETO = `http://127.0.0.1:${APPS.find((a) => a.dir === 'erp-zona-2').porta}`
const FRAGMENTO_TAREFAS = '/zona2/_fragmento/tarefas/pendentes'
const BLOCO_TAREFAS = /data-fragmento="zona2\/tarefas"/
const pedirFragmento = (caminho, { cookie, cabecalhos = {} } = {}) => fetch(`${ZONA2_DIRETO}${caminho}`, {
  headers: { accept: 'text/html', ...(cookie ? { cookie } : {}), ...cabecalhos }, redirect: 'manual',
})

test('C1a (ADR-0011): a zona 2 serve o fragmento de tarefas so a quem tem tarefas.ver, inerte e sem cache', async () => {
  for (const u of ['ana', 'eva']) {
    const r = await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: (await entrar(u)).cookie, cabecalhos: { 'accept-fragmento-versao': '1' } })
    assert.equal(r.status, 200, u)
    assert.match(r.headers.get('content-type') ?? '', /^text\/html/, u)
    assert.equal(r.headers.get('cache-control'), 'private, no-store', u)
    const html = await r.text()
    assert.match(html, BLOCO_TAREFAS, u)
    assert.match(html, /Tarefas pendentes \(zona 2\)/, u)
    assert.doesNotMatch(html, /<script|<html|<body|\son[a-z]+\s*=|javascript:/i, `fragmento ativo ou documento inteiro para ${u}`)
  }
  // sem o modulo da zona 2: ausencia, sem corpo (invariante 8; ADR-0011, decisao 6)
  for (const u of ['bruno', 'davi']) {
    const r = await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: (await entrar(u)).cookie })
    assert.equal(r.status, 204, u)
    assert.equal(await r.text(), '', u)
  }
  const ana = (await entrar('ana')).cookie
  // sem cookie, a camada 1 da zona manda ao login (o consumidor trata como ausencia); cookie forjado morre na camada 2
  assert.equal((await pedirFragmento(FRAGMENTO_TAREFAS)).status, 307)
  assert.equal((await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: '__Host-session=forjado' })).status, 204)
  // so a chave `pendentes` existe; outra versao do contrato e ausencia
  assert.equal((await pedirFragmento('/zona2/_fragmento/tarefas/todas', { cookie: ana })).status, 204)
  assert.equal((await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: ana, cabecalhos: { 'accept-fragmento-versao': '2' } })).status, 204)
  // navegacao de documento ou iframe nao e composicao (ADR-0011, decisao 8)
  for (const destino of ['document', 'iframe']) {
    assert.equal((await pedirFragmento(FRAGMENTO_TAREFAS, { cookie: ana, cabecalhos: { 'sec-fetch-dest': destino } })).status, 404, destino)
  }
})
```

- [ ] **Passo 2: rodar e ver falhar**

Conferir portas livres (`ss -ltn | grep -E ':(300[0-3]|40[0-9][0-9]|41[0-2][0-9]) '` sem saída). Rodar:
`CONSTRUIR=1 node --test --test-name-pattern='C1a' base/verificacao/base.test.mjs`
Esperado: FAIL no primeiro `assert.equal(r.status, 200, 'ana')`, com 404 (a rota ainda não existe).

- [ ] **Passo 3: HTML do bloco**

Criar `repos/erp-zona-2/lib/fragmento-tarefas.ts`:

```ts
import 'server-only'

type Tarefa = { titulo: string; concluida: boolean }

const ENTIDADES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ENTIDADES[c] ?? c)

/**
 * Bloco "Tarefas pendentes" que a zona 2 entrega como fragmento (ADR-0011). HTML inerte (`02-zonas.md` §2.3): sem
 * script, sem manipulador, só o título de cada tarefa, escapado. Lista vazia ainda é bloco: "não há" não é "não pode".
 */
export function htmlDasTarefasPendentes(tarefas: readonly Tarefa[]): string {
  const pendentes = tarefas.filter((t) => !t.concluida)
  const corpo = pendentes.length > 0
    ? `<ul>${pendentes.map((t) => `<li>${escapar(t.titulo)}</li>`).join('')}</ul>`
    : '<p>Nenhuma tarefa pendente.</p>'
  return '<section data-fragmento="zona2/tarefas" aria-labelledby="fragmento-zona2-tarefas">'
    + '<h2 id="fragmento-zona2-tarefas">Tarefas pendentes (zona 2)</h2>'
    + `${corpo}<p><a href="/zona2">Abrir as tarefas</a></p></section>`
}
```

- [ ] **Passo 4: rota dona**

Criar `repos/erp-zona-2/app/zona2/%5Ffragmento/tarefas/[id]/route.ts` (com `mkdir -p 'app/zona2/%5Ffragmento/tarefas/[id]'`):

```ts
import { responderFragmento } from '@erp/nucleo'
import { nucleo } from '@/lib/nucleo'
import { htmlDasTarefasPendentes } from '@/lib/fragmento-tarefas'

type Tarefa = { id: string; titulo: string; concluida: boolean }

/**
 * Fragmento `tarefas` da zona 2 (ADR-0011): a zona 1 o embute no painel. URL `/zona2/_fragmento/tarefas/{id}`; a pasta
 * é `%5Ffragmento` porque pasta com `_` é privada no App Router. Sessão e módulo são verificados aqui; cache, navegação
 * direta, versão do contrato e HTML inerte ficam com o helper do núcleo. Negado, sem sessão ou chave desconhecida: 204.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return responderFragmento(req, async () => {
    await nucleo.acesso.exigirModulo('zona2', 'tarefas.ver')
    const { id } = await params
    if (id !== 'pendentes') return null
    const tarefas = (await nucleo.destino('dominio-c').get<Tarefa[]>('/v1/tarefas')).body ?? []
    return htmlDasTarefasPendentes(tarefas)
  })
}
```

- [ ] **Passo 5: tipos e build da zona 2**

`cd repos/erp-zona-2 && pnpm typecheck` (0 erros) e `pnpm build` (sem erro; a saída lista a rota
`/zona2/_fragmento/tarefas/[id]` como dinâmica, `ƒ`). Se a rota aparecer como `/zona2/%5Ffragmento/...` ou não
aparecer, **parar e reportar**: é a premissa da pasta `%5F`.

- [ ] **Passo 6: rodar e ver passar**

`CONSTRUIR=1 node --test --test-name-pattern='C1a' base/verificacao/base.test.mjs` → PASS.

- [ ] **Passo 7: commits**

```bash
cd repos/erp-zona-2
git add lib/fragmento-tarefas.ts 'app/zona2/%5Ffragmento/tarefas/[id]/route.ts'
git commit -m "feat(zona2): tarefas fragment for other zones (ADR-0011), inert HTML, 204 without the module"
git push
cd ../..
git add repos/erp-zona-2 base/verificacao/base.test.mjs
git commit -m "test(c1): zone 2 serves the tarefas fragment only with tarefas.ver, inert and uncached (C1a); zone 2 pointer"
git push
```

---

### Task 2: o shell recusa `/{zona}/_fragmento/` vindo do navegador (erp-shell + teste C1b)

**Arquivos:**
- Modificar: `repos/erp-shell/lib/decisao-proxy.ts`
- Modificar: `repos/erp-shell/proxy.ts`
- Modificar: `repos/erp-shell/test/proxy.test.mjs` (dois testes no fim)
- Modificar: `base/verificacao/base.test.mjs` (teste C1b logo depois do C1a)
- Ponteiro do submódulo `repos/erp-shell`

**Interfaces:**
- Consome: `FRAGMENTO_TAREFAS` e `SHELL_URL` em `base.test.mjs` (Task 1). Depois da Task 1, a rota existe na zona 2 e o
  shell a repassa: é isso que o C1b pega antes desta task.
- Produz: `DecisaoProxy` ganha `{ readonly acao: 'nao-encontrado' }`, devolvida para todo caminho de zona cujo segundo
  segmento, depois de decodificado e sem diferenciar caixa, é `_fragmento` — **antes** da sonda e da verificação de
  cookie (não revela se a zona está no ar nem pede login).

- [ ] **Passo 1: testes de unidade que falham**

No fim de `repos/erp-shell/test/proxy.test.mjs`:

```js
// --- C1 (ADR-0011, decisao 8): fragmento e servidor->servidor; do navegador, nao existe ---
test('C1: /{zona}/_fragmento/ e 404 no shell, com ou sem cookie, em qualquer grafia, sem consultar a sonda', async () => {
  const sondaProibida = { verificar: async () => { throw new Error('a sonda nao deveria rodar') }, limpar() {} }
  const caminhos = [
    '/zona2/_fragmento/tarefas/pendentes', '/ZONA2/_FRAGMENTO/tarefas/pendentes', '/zona1/_fragmento/x/y',
    '/zona2/%5Ffragmento/tarefas/pendentes', '/zona2/%5ffragmento/x', '/zona2/_fragmento', '/zona2/_fragmento/',
  ]
  for (const caminho of caminhos) {
    for (const temCookieSessao of [true, false]) {
      const d = await decidirAcaoDoProxy({ caminho, temCookieSessao }, sondaProibida)
      assert.equal(d.acao, 'nao-encontrado', `${caminho} cookie=${temCookieSessao}`)
    }
  }
})

test('C1: so o segmento _fragmento logo depois do prefixo da zona e recusado (dentes do teste acima)', async () => {
  const sondaOk = { verificar: async () => true, limpar() {} }
  for (const caminho of ['/zona2/_fragmentos/x', '/zona2/x/_fragmento/y', '/zona2/tarefas_fragmento', '/zona2/%zz/_fragmento']) {
    const d = await decidirAcaoDoProxy({ caminho, temCookieSessao: true }, sondaOk)
    assert.equal(d.acao, 'prosseguir', caminho)
  }
  // fora de zona nao ha fragmento a proteger: o shell segue a regra de sempre
  assert.equal((await decidirAcaoDoProxy({ caminho: '/_fragmento/x', temCookieSessao: false }, sondaOk)).acao, 'redirecionar-login')
})
```

- [ ] **Passo 2: rodar e ver falhar**

`cd repos/erp-shell && node --conditions react-server --test test/proxy.test.mjs`
Esperado: o primeiro teste novo FAIL (`'zona-inativa'` ou erro "a sonda nao deveria rodar" no lugar de
`'nao-encontrado'`); o segundo já passa (é o dente).

- [ ] **Passo 3: implementar a decisão**

Em `repos/erp-shell/lib/decisao-proxy.ts`:

1. Na união `DecisaoProxy`, logo depois de `| { readonly acao: 'telemetria' }`, acrescentar:

```ts
  // `/{zona}/_fragmento/...` é composição servidor→servidor (ADR-0011, decisão 8): do navegador, não existe
  | { readonly acao: 'nao-encontrado' }
```

2. Logo depois da função `paraLogin`, acrescentar:

```ts
/** Segundo segmento `_fragmento`, em qualquer caixa. Decodifica antes: `%5Ffragmento` chega à zona como `_fragmento`. */
const FRAGMENTO = /^\/[^/]+\/_fragmento(?:\/|$)/i
function ehFragmento(caminho: string): boolean {
  let decodificado = caminho
  try { decodificado = decodeURIComponent(caminho) } catch { /* `%` solto: fica como veio */ }
  return FRAGMENTO.test(decodificado)
}
```

3. No passo 3 de `decidirAcaoDoProxy`, logo depois de `if (zona) {` e **antes** de `const saudavel = …`:

```ts
    // antes da sonda e do cookie: não revela se a zona está no ar nem manda ao login
    if (ehFragmento(caminho)) return { acao: 'nao-encontrado' }
```

- [ ] **Passo 4: responder no `proxy.ts`**

Em `repos/erp-shell/proxy.ts`, no `switch (decisao.acao)`, logo depois do `case 'zona-estatica': return NextResponse.next()`:

```ts
    case 'nao-encontrado':
      return new NextResponse(null, { status: 404, headers: { 'cache-control': 'no-store' } })
```

- [ ] **Passo 5: unidades, tipos e build**

`cd repos/erp-shell && node --conditions react-server --test test/proxy.test.mjs` → PASS. Depois `pnpm typecheck`
(0 erros), `pnpm test` (eram 114, passam a 116) e `pnpm build` (sem erro).

- [ ] **Passo 6: teste ponta a ponta que falha antes da task**

Em `base/verificacao/base.test.mjs`, logo depois do teste C1a:

```js
test('C1b (ADR-0011, decisao 8): o navegador nao alcanca _fragmento pelo shell, em nenhuma grafia, com ou sem cookie', async () => {
  const ana = (await entrar('ana')).cookie
  const caminhos = [FRAGMENTO_TAREFAS, '/ZONA2/_Fragmento/tarefas/pendentes', '/zona2/%5Ffragmento/tarefas/pendentes', '/zona1/_fragmento/x/y']
  for (const caminho of caminhos) {
    for (const cookie of [ana, undefined]) {
      const r = await fetch(`${SHELL_URL}${caminho}`, { headers: cookie ? { cookie } : {}, redirect: 'manual' })
      assert.equal(r.status, 404, `${caminho} ${cookie ? 'com' : 'sem'} cookie`)
      assert.equal(await r.text(), '', `${caminho}: 404 com corpo`)
      assert.equal(r.headers.get('cache-control'), 'no-store', caminho)
    }
  }
  // dente: a mesma ana pelo shell chega a zona 2
  assert.equal((await pedir('/zona2', { cookie: ana })).status, 200)
})
```

Prova do RED: com a Task 1 aplicada e o shell **sem** os passos 3 e 4, o C1b reprova (o shell repassa
`/zona2/_fragmento/tarefas/pendentes` com cookie e a zona 2 devolve 200). Para ver: `git -C repos/erp-shell stash`,
`CONSTRUIR=1 node --test --test-name-pattern='C1b' base/verificacao/base.test.mjs` (FAIL), `git -C repos/erp-shell stash pop`.
Conferir `git -C repos/erp-shell status --short` igual ao de antes do stash.

- [ ] **Passo 7: ver passar**

`CONSTRUIR=1 node --test --test-name-pattern='C1' base/verificacao/base.test.mjs` → C1a e C1b PASS.

- [ ] **Passo 8: commits**

```bash
cd repos/erp-shell
git add lib/decisao-proxy.ts proxy.ts test/proxy.test.mjs
git commit -m "feat(shell): /{zone}/_fragmento/ is 404 from the browser, before the probe and the cookie check (ADR-0011, decision 8)"
git push
cd ../..
git add repos/erp-shell base/verificacao/base.test.mjs
git commit -m "test(c1): the browser cannot reach _fragmento through the shell in any spelling (C1b); shell pointer"
git push
```

---

### Task 3: a zona 1 embute o bloco da zona 2 (erp-zona-1 + C1c, C1d + configuração e documentos)

**Arquivos:**
- Criar: `repos/erp-zona-1/lib/fragmentos.ts`
- Modificar: `repos/erp-zona-1/app/zona1/page.tsx`
- Modificar: `base/scripts/ambiente.mjs` (`AMBIENTE_PERMITIDO.zona`)
- Modificar: `base/verificacao/base.test.mjs` (testes C1c e C1d logo depois do C1b)
- Modificar: `docs/CONFIGURACAO.md` §2, `docs/adr/0011-fragmento-entre-zonas.md`, `docs/desenho/mfe/02-zonas.md` §1,
  `docs/arquitetura/atual.md`
- Ponteiro do submódulo `repos/erp-zona-1`

**Interfaces:**
- Consome: a rota da Task 1 (`data-fragmento="zona2/tarefas"`, `Tarefas pendentes (zona 2)`), `BLOCO_TAREFAS` em
  `base.test.mjs`, `ambiente.congelarApp/descongelarApp/derrubarApp/subirApp`.
- Consome: `criarFragmento({ zonas, lerCookieDeSessao, timeoutMs?, fetch? })` → `{ buscar(zona, nome, id): Promise<string | null> }`
  (nunca lança; HTML inerte ou `null`; timeout `ERP_FRAGMENTO_TIMEOUT_MS`, padrão 2000).
- Produz: `fragmentos` exportado de `repos/erp-zona-1/lib/fragmentos.ts`.

- [ ] **Passo 1: testes ponta a ponta que falham**

Em `base/verificacao/base.test.mjs`, logo depois do teste C1b:

```js
test('C1c: o painel da zona 1 mostra o bloco de tarefas da zona 2 so para quem tem os dois modulos', async () => {
  const r = await pedir('/zona1', { cookie: (await entrar('ana')).cookie })
  assert.equal(r.status, 200)
  assert.match(r.html, BLOCO_TAREFAS, 'ana (zona 1 e zona 2) nao viu o bloco')
  assert.match(r.html, /Tarefas pendentes \(zona 2\)/)
  for (const u of ['bruno', 'davi']) {
    const s = await pedir('/zona1', { cookie: (await entrar(u)).cookie })
    assert.equal(s.status, 200, u)
    assert.doesNotMatch(s.html, BLOCO_TAREFAS, `${u} (so zona 1) viu o bloco`)
    assert.doesNotMatch(s.html, /Tarefas pendentes/, `${u}: titulo do bloco sem o bloco`)
    assert.ok(!/sem acesso|não autorizado|acesso negado/i.test(s.html), `placeholder de sem acesso para ${u} (invariante 8)`)
  }
})

test('C1d: zona 2 travada ou fora apaga so o bloco dela no painel da zona 1, dentro do timeout do fragmento', { timeout: 90_000 }, async () => {
  const ana = (await entrar('ana')).cookie
  const limite = (Number(process.env.ERP_FRAGMENTO_TIMEOUT_MS) || 2_000) + 2_000
  const semBloco = (r, quando) => {
    assert.equal(r.status, 200, quando)
    assert.match(r.html, /Painel da zona 1/, quando)
    assert.doesNotMatch(r.html, BLOCO_TAREFAS, quando)
  }
  ambiente.congelarApp('erp-zona-2')
  try {
    const t0 = Date.now()
    const r = await pedir('/zona1', { cookie: ana })
    const ms = Date.now() - t0
    semBloco(r, 'zona 2 travada')
    assert.ok(ms < limite, `painel levou ${ms} ms com a zona 2 travada (limite ${limite} ms)`)
  } finally { ambiente.descongelarApp('erp-zona-2') }
  await ambiente.derrubarApp('erp-zona-2')
  try {
    semBloco(await pedir('/zona1', { cookie: ana }), 'zona 2 fora')
  } finally { await ambiente.subirApp('erp-zona-2') }
  // o bloco volta sozinho quando a zona 2 volta
  const t0 = Date.now()
  let html = ''
  while (Date.now() - t0 < 10_000 && !BLOCO_TAREFAS.test(html)) {
    html = (await pedir('/zona1', { cookie: ana })).html
    if (!BLOCO_TAREFAS.test(html)) await new Promise((r) => setTimeout(r, 200))
  }
  assert.match(html, BLOCO_TAREFAS, 'o bloco nao voltou em 10 s depois de a zona 2 voltar')
})
```

- [ ] **Passo 2: rodar e ver falhar**

`CONSTRUIR=1 node --test --test-name-pattern='C1c|C1d' base/verificacao/base.test.mjs`
Esperado: C1c FAIL em "ana (zona 1 e zona 2) nao viu o bloco"; C1d FAIL no laço final ("o bloco nao voltou").

- [ ] **Passo 3: a variável na lista de inclusão**

Em `base/scripts/ambiente.mjs`, em `AMBIENTE_PERMITIDO.zona`, na linha que termina em `'DOMINIO_C_URL',`, acrescentar
`'ZONA2_URL',` logo depois de `'DOMINIO_C_URL',`. Sem isso a zona 1 nunca recebe a variável e fica sempre no padrão.

- [ ] **Passo 4: cliente de fragmento da zona 1**

Criar `repos/erp-zona-1/lib/fragmentos.ts`:

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { criarFragmento } from '@erp/nucleo'

/**
 * Fragmentos que a zona 1 pede a outras zonas (ADR-0011). A origem vem do ambiente (decisão 4: o `zonas.json` é do
 * shell) e é a rede interna da zona dona, sem passar pelo shell; os nomes permitidos ficam aqui. O cookie de sessão
 * segue como veio: quem diz quem é o usuário é a zona dona.
 */
export const fragmentos = criarFragmento({
  zonas: {
    zona2: { origem: process.env.ZONA2_URL ?? 'http://127.0.0.1:3002', fragmentos: ['tarefas'] },
  },
  lerCookieDeSessao: async () => (await cookies()).get('__Host-session')?.value,
})
```

- [ ] **Passo 5: o bloco no painel**

Em `repos/erp-zona-1/app/zona1/page.tsx`:

1. Acrescentar o import, depois de `import { listarRecursos } from '@/lib/dominio-a'`:

```tsx
import { fragmentos } from '@/lib/fragmentos'
```

2. Trocar o `Promise.all` por:

```tsx
  // Cada bloco depende de um domínio ou de outra zona. Um deles fora apaga o bloco dele, não a página.
  const [recursos, indicadores, tarefas] = await Promise.all([
    listarRecursos().catch(() => null),
    nucleo.destino('dominio-b').get<Indicador[]>('/v1/indicadores').then((r) => r.body ?? [], () => null),
    fragmentos.buscar('zona2', 'tarefas', 'pendentes'),
  ])
```

   (o comentário `// Cada bloco depende de um domínio. Um domínio fora apaga o bloco dele, não a página.` que estava
   acima do `Promise.all` sai, substituído pelo novo).

3. Logo antes de `{recursos && <BotaoDeAviso …`, acrescentar:

```tsx
      {/* Bloco da zona 2 (ADR-0011): HTML inerte, conferido pelo núcleo. Sem o módulo dela, não existe (invariante 8). */}
      {tarefas && <div dangerouslySetInnerHTML={{ __html: tarefas }} />}
```

- [ ] **Passo 6: tipos e build da zona 1**

`cd repos/erp-zona-1 && pnpm typecheck` (0 erros) e `pnpm build` (sem erro).

- [ ] **Passo 7: ver passar**

`CONSTRUIR=1 node --test --test-name-pattern='C1' base/verificacao/base.test.mjs` → C1a, C1b, C1c e C1d PASS.

- [ ] **Passo 8: documentos**

1. `docs/CONFIGURACAO.md` §2: logo depois da linha de `DOMINIO_A_URL`, … (a que começa por
   ``| `DOMINIO_A_URL`, `DOMINIO_B_URL` ``), acrescentar:

```markdown
| `ZONA2_URL` | `http://127.0.0.1:3002` | Origem interna da zona 2 para os fragmentos que a zona 1 pede (ADR-0011, decisão 4). Só origem, sem caminho; rede interna, nunca o endereço do shell | zona 1 (`lib/fragmentos.ts`) | ✅ (C1) |
```

2. `docs/adr/0011-fragmento-entre-zonas.md`, no fim do arquivo:

```markdown

## Adendo 1 (2026-10-06): a pasta é `%5Ffragmento`; primeiro uso

- No App Router, pasta que começa com `_` é privada e fica fora do roteamento. A rota dona mora em
  `app/{zona}/%5Ffragmento/{nome}/[id]/route.ts`; a URL continua `/{zona}/_fragmento/{nome}/{id}`. A decisão 5 vale
  com esse nome de pasta.
- Primeiro uso (C1): a zona 2 serve `tarefas/pendentes` (o bloco "Tarefas pendentes") e a zona 1 o embute no painel,
  com a origem da zona 2 em `ZONA2_URL`. O shell responde 404 a `/{zona}/_fragmento/...` vindo do navegador, antes da
  sonda e do cookie (decisão 8). Verificações C1a–C1d em `base/verificacao/base.test.mjs`.
- Continua fora: circuit breaker e `<Suspense>` em volta do bloco (`alvo.md` §6); hoje o limite é o timeout de 2 s.
```

3. `docs/desenho/mfe/02-zonas.md` §1: na linha `    _fragmento/                   ← o que esta zona expõe a outras      ← NOVO`,
   trocar `_fragmento/` por `%5Ffragmento/` e manter o alinhamento das setas (a URL continua `_fragmento`; ver ADR-0011,
   adendo 1). Se a árvore tiver um comentário de rodapé, acrescentar a frase "pasta `%5F`: no App Router, `_` é pasta
   privada".

4. `docs/arquitetura/atual.md`: procurar a menção a fragmentos (`grep -n fragment docs/arquitetura/atual.md`). Onde o
   texto disser ou der a entender que nenhuma zona usa fragmento, trocar para "a zona 1 embute o bloco de tarefas da
   zona 2 por fragmento (C1); o shell recusa `_fragmento` do navegador". Não mexer nas contagens de teste (dívida já
   registrada em `DEFERRED.md` D28).

- [ ] **Passo 9: verificação completa**

`task test` (todas as unidades verdes; shell 116) e `task verificar` (esperado: 119 passando + 4 pulados, porque eram
115 + 4 e entram C1a, C1b, C1c e C1d). Depois `task verificar:redis` (esperado 123/123) e `task verificar:estatica`
(sem falha; a N8 não pode ter exceção nova). Anotar os números exatos no relatório. Portas livres no fim.

- [ ] **Passo 10: commits**

```bash
cd repos/erp-zona-1
git add lib/fragmentos.ts app/zona1/page.tsx
git commit -m "feat(zona1): panel embeds the zone 2 tarefas fragment (ADR-0011), origin from ZONA2_URL"
git push
cd ../..
git add repos/erp-zona-1 base/scripts/ambiente.mjs base/verificacao/base.test.mjs docs/CONFIGURACAO.md \
  docs/adr/0011-fragmento-entre-zonas.md docs/desenho/mfe/02-zonas.md docs/arquitetura/atual.md
git status --short   # conferir: docs/README.md, alvo.md, infraestrutura-alvo.md e os lockfiles continuam fora
git commit -m "feat(c1): zone 1 panel shows the zone 2 block by fragment, gone when zone 2 is down or frozen (C1c, C1d); ZONA2_URL documented; ADR-0011 addendum 1; zone 1 pointer"
git push
```

---

## Depois das tasks (orquestrador)

- **Gate do C1**, pelo `LEIA-PRIMEIRO.md`: revisor (`revisor-mfe`, Sonnet), challenger (`simulador-condicoes`, Sonnet) e
  auditor forense (Opus, com veto). O auditor muta pelo menos:
  - a guarda `ehFragmento` no shell (remover; trocar `/i`; tirar o `decodeURIComponent`; mover para depois da sonda);
  - `exigirModulo('zona2', 'tarefas.ver')` na rota dona (remover; trocar a funcionalidade);
  - `if (id !== 'pendentes') return null` (remover);
  - o `escapar` do HTML (remover) e um `<script>` no HTML do bloco (o dono tem de dar 500 e a zona 1 não mostrar nada);
  - `ZONA2_URL` fora da lista de inclusão; o `fragmentos.buscar` no painel trocado por `fetch` direto (a N8 tem de pegar).

  O challenger tenta alcançar `_fragmento` pelo shell com grafias novas (barra dupla, `%2F`, `..`, ponto e vírgula,
  maiúsculas), pede o fragmento direto com cookie de outro ator e sem cookie, mede o painel com a zona 2 travada e
  confere que o bloco não vaza para quem só tem a zona 1, inclusive no payload RSC (`rsc: 1`).
- Registrar em `GATE_STATUS.md`, atualizar `ATIVIDADES.md` (#10), `RETOMADA.md` (C1 ✅; próximo C3) e avisar o humano que
  a linha "Composição" do `alvo.md` §6 (arquivo dele, fora de commit) ficou desatualizada.
