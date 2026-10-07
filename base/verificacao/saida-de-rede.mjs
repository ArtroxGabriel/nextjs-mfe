// Checagem N8 (invariante 4 do AGENTS.md): nenhuma aplicação faz requisição de rede por conta
// própria; toda saída passa pelo registro de destinos do núcleo (`nucleo.destino(...)`), que é a
// allowlist: destino, caminho e método declarados, sem seguir redirecionamento, com timeout.
//
// Lê a ESTRUTURA do código com o compilador do TypeScript (já presente nas apps; nada a
// instalar), não o texto. A primeira versão procurava a palavra `fetch(` e foi contornada com
// `globalThis['fetch'](...)`; esta vê o `fetch` escrito de qualquer jeito.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { RAIZ } from '../scripts/ambiente.mjs'
import { fontesDaApp } from './seguranca-estatica.mjs'

const ts = createRequire(join(RAIZ, 'erp-shell', 'package.json'))('typescript')

/** Módulos que abrem conexão de rede. Importá-los numa aplicação é sair pela porta dos fundos. */
// Clientes de banco também são rede; `child_process`, `worker_threads`, `vm` e `module` (createRequire)
// são portas para carregar ou executar o que a análise não vê (auditor_b1_d1_2, V8).
const MODULOS_DE_REDE = new Set(['http', 'https', 'http2', 'net', 'tls', 'dgram', 'undici', 'axios',
  'node-fetch', 'got', 'ky', 'superagent', 'ws', 'redis', 'ioredis', '@redis/client', 'pg', 'mysql2', 'mongodb',
  'child_process', 'worker_threads', 'vm', 'module', 'cluster'].flatMap((m) => [m, `node:${m}`]))
/**
 * Módulos que uma app PODE importar (auditor_b1_d1_3, V6: uma lista de proibidos deixava passar
 * `node:dns` e qualquer biblioteca HTTP fora dela). Qualquer outro pacote é tratado como rede.
 * Locais (`./`, `@/`) seguem valendo: são varridos também.
 */
const PACOTES_PERMITIDOS = ['next', 'react', 'react-dom', 'server-only', '@erp/nucleo', '@erp/moldura', '@erp/contratos']
const SUBPATHS_NEXT_PERMITIDOS = new Set([
  'next', 'next/server', 'next/headers', 'next/navigation', 'next/link', 'next/dynamic', 'next/cache', 'next/image',
])
const EMBUTIDOS_PERMITIDOS = new Set(['crypto', 'path', 'url', 'fs', 'fs/promises', 'buffer', 'util', 'events',
  'assert', 'assert/strict', 'test', 'timers', 'timers/promises', 'string_decoder', 'querystring'])
export function moduloPermitido(mod) {
  if (mod.startsWith('.') || mod.startsWith('@/')) return true
  const embutido = mod.startsWith('node:') ? mod.slice(5) : mod
  if (EMBUTIDOS_PERMITIDOS.has(embutido)) return true
  if (mod.startsWith('next/')) {
    if (mod.startsWith('next/font/')) return true
    return SUBPATHS_NEXT_PERMITIDOS.has(mod)
  }
  return PACOTES_PERMITIDOS.some((p) => mod === p || mod.startsWith(`${p}/`))
}
/** Globais que fazem rede. */
const GLOBAIS_DE_REDE = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'])
/** Portas para montar código em tempo de execução, que escaparia de qualquer análise. */
const EXECUCAO_DINAMICA = new Set(['eval', 'Function'])
/** Nomes da global, que dão acesso a qualquer outra global por apelido ou chave calculada. */
const NOMES_DA_GLOBAL = new Set(['globalThis', 'window', 'self', 'global'])

/**
 * Exceções declaradas, cada uma com o motivo e com o QUE ela permite (`permite`: o módulo ou a
 * global). Vale só aquilo, não o arquivo inteiro (auditor_b1_d1_3, V6/XR15: um `fetch` para fora
 * dentro de `lib/redis.ts` passava). Exceção nova aqui exige revisão e muda o teste que fixa a lista.
 */
const STORE_DE_SESSAO = 'store de sessão (ADR-0002): endereço só do ambiente (`REDIS_URL`/`REDIS_URL_ZONA`), ' +
  'nunca da requisição; nas zonas, cliente só com `get` e usuário ACL só de leitura'
const DEPLOY = 'registro do manifesto no deploy (AGENTS.md, invariante 4, primeira exceção): roda fora do Next, ' +
  'origem fixa do ambiente, `redirect: manual` e timeout'
const DEPLOY_ROTA = 'registro da rota da zona no deploy (AGENTS.md, invariante 4, primeira exceção): roda fora do Next, ' +
  'origem fixa do ambiente, `redirect: manual` e timeout'
export const EXCECOES = {
  'erp-shell/lib/saude-zonas.ts': {
    permite: ['fetch'],
    motivo: 'sonda de saúde das zonas: o alvo vem só de zonas.json (nunca da requisição), sem seguir ' +
      'redirecionamento, timeout de 500 ms; não é chamada a domínio',
  },
  'erp-shell/lib/redis.ts': { permite: ['redis'], motivo: STORE_DE_SESSAO },
  'erp-zona-1/lib/redis.ts': { permite: ['redis'], motivo: STORE_DE_SESSAO },
  'erp-zona-2/lib/redis.ts': { permite: ['redis'], motivo: STORE_DE_SESSAO },
  'erp-zona-acesso/lib/redis.ts': { permite: ['redis'], motivo: STORE_DE_SESSAO },
  'erp-zona-1/scripts/registrar-manifesto.ts': { permite: ['fetch'], motivo: DEPLOY },
  'erp-zona-2/scripts/registrar-manifesto.ts': { permite: ['fetch'], motivo: DEPLOY },
  'erp-zona-1/scripts/registrar-rota.ts': { permite: ['fetch'], motivo: DEPLOY_ROTA },
  'erp-zona-2/scripts/registrar-rota.ts': { permite: ['fetch'], motivo: DEPLOY_ROTA },
  'erp-zona-acesso/scripts/registrar-rota.ts': { permite: ['fetch'], motivo: DEPLOY_ROTA },
}

/** Nomes de um padrão de ligação (`x`, `{ a, b: [c] }`), cada um com o nó que o declara. */
function nomesDoPadrao(nome, decl, mapa) {
  if (ts.isIdentifier(nome)) mapa.set(nome.text, decl)
  else if (ts.isObjectBindingPattern(nome) || ts.isArrayBindingPattern(nome)) {
    for (const e of nome.elements) if (!ts.isOmittedExpression(e)) nomesDoPadrao(e.name, e, mapa)
  }
}
function declaracoesDaLista(lista, mapa) {
  if (lista && ts.isVariableDeclarationList(lista)) for (const d of lista.declarations) nomesDoPadrao(d.name, d, mapa)
}
function nomesDasInstrucoes(instrucoes, mapa) {
  for (const s of instrucoes) {
    if (s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) continue
    if (ts.isVariableStatement(s)) declaracoesDaLista(s.declarationList, mapa)
    else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isEnumDeclaration(s)) && s.name) mapa.set(s.name.text, s)
    else if (ts.isImportEqualsDeclaration(s)) mapa.set(s.name.text, s)
    else if (ts.isImportDeclaration(s) && s.importClause && !s.importClause.isTypeOnly) {
      const { name, namedBindings } = s.importClause
      if (name) mapa.set(name.text, s.importClause)
      if (namedBindings && ts.isNamespaceImport(namedBindings)) mapa.set(namedBindings.name.text, namedBindings)
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const e of namedBindings.elements) if (!e.isTypeOnly) mapa.set(e.name.text, e)
      }
    }
  }
}
/**
 * Os nomes que um nó liga para os descendentes: arquivo, bloco e `case` (declarações), toda forma de
 * função (parâmetros e o nome da própria expressão de função: inclui constructor, get/set e método),
 * `catch`, os três `for` e o nome de uma expressão de classe. `var` fica no bloco onde está escrito:
 * mais estreito que o JavaScript, então um uso fora dele é tratado como global (reprova, nunca esconde).
 */
function nomesLigados(escopo) {
  const mapa = new Map()
  if (ts.isSourceFile(escopo) || ts.isBlock(escopo) || ts.isModuleBlock(escopo)) nomesDasInstrucoes(escopo.statements, mapa)
  else if (ts.isCaseBlock(escopo)) nomesDasInstrucoes(escopo.clauses.flatMap((c) => c.statements), mapa)
  else if (ts.isCatchClause(escopo)) { if (escopo.variableDeclaration) nomesDoPadrao(escopo.variableDeclaration.name, escopo.variableDeclaration, mapa) }
  else if (ts.isForStatement(escopo) || ts.isForInStatement(escopo) || ts.isForOfStatement(escopo)) declaracoesDaLista(escopo.initializer, mapa)
  else if (ts.isClassExpression(escopo) && escopo.name) mapa.set(escopo.name.text, escopo)
  else if (ts.isFunctionLike(escopo)) {
    for (const p of escopo.parameters) nomesDoPadrao(p.name, p, mapa)
    if (ts.isFunctionExpression(escopo) && escopo.name) mapa.set(escopo.name.text, escopo)
  }
  return mapa
}

/** Achados num fonte: `{ linha, motivo }`. Vazio = nenhuma saída de rede fora do registro. */
export function analisar(fonte, nome = 'arquivo.ts') {
  const sf = ts.createSourceFile(nome, fonte, ts.ScriptTarget.Latest, true,
    nome.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const achados = []
  // `coisa`: o módulo ou a global envolvida; uma exceção só perdoa o achado cuja coisa ela permite
  const achar = (no, motivo, coisa = null) => achados.push({ linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, motivo, coisa })
  // Resolução léxica (auditor_b1_d1_8, V2): um nome só é local se um ANCESTRAL do uso o liga. A pilha
  // de escopos da K3 só abria escopo em função, método e bloco; o parâmetro de `constructor(fetch)`,
  // `set x(fetch)`, `catch (fetch)` e `for (const fetch of …)` caía no escopo de fora e escondia o
  // `fetch` global do arquivo inteiro. Aqui cada nó que liga nomes diz quais, e o uso sobe até achar.
  const ligadosPor = new Map()
  const ligados = (escopo) => {
    if (!ligadosPor.has(escopo)) ligadosPor.set(escopo, nomesLigados(escopo))
    return ligadosPor.get(escopo)
  }
  /** A declaração que vale para `nome` no ponto `no`, ou `null` se é a global. */
  const declaracaoDe = (no, nome) => {
    for (let n = no.parent; n; n = n.parent) {
      const d = ligados(n).get(nome)
      if (d) return d
    }
    return null
  }
  const estaDeclarado = (no, nome) => declaracaoDe(no, nome) !== null
  /** Valor de string constante de um identificador: só de um `const` com inicializador constante, na declaração que vale ali. */
  const valorConstante = (id) => {
    const d = declaracaoDe(id, id.text)
    const ehConst = d && ts.isVariableDeclaration(d) && ts.isIdentifier(d.name) && ts.isVariableDeclarationList(d.parent)
      && (d.parent.flags & ts.NodeFlags.Const) !== 0
    return ehConst ? avaliarStringConstante(d.initializer) : null
  }

  const texto = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null
  const avaliarStringConstante = (n) => {
    if (!n) return null
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const e = avaliarStringConstante(n.left)
      const d = avaliarStringConstante(n.right)
      if (e !== null && d !== null) return e + d
    }
    return null
  }

  const visitar = (no) => {
    // import ... from 'node:http'  /  export ... from 'axios'
    if ((ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) && no.moduleSpecifier) {
      const mod = texto(no.moduleSpecifier)
      const soTipo = ts.isImportDeclaration(no) && no.importClause?.isTypeOnly
      if (mod !== null && !soTipo && (MODULOS_DE_REDE.has(mod) || !moduloPermitido(mod))) achar(no, `importa modulo fora da lista permitida '${mod}'`, mod)
    }
    // import x = require('dns')
    if (ts.isImportEqualsDeclaration(no) && ts.isExternalModuleReference(no.moduleReference)) {
      const mod = texto(no.moduleReference.expression)
      if (mod === null || MODULOS_DE_REDE.has(mod) || !moduloPermitido(mod)) achar(no, `carrega modulo por import = require '${mod}'`, mod)
    }
    if (ts.isCallExpression(no)) {
      // Reflect.get(globalThis, 'fe' + 'tch'), Object.getOwnPropertyDescriptor(window, x): a global
      // entregue a uma função sai do alcance de qualquer análise de nome
      for (const a of no.arguments) {
        if (ts.isIdentifier(a) && NOMES_DA_GLOBAL.has(a.text) && !estaDeclarado(a, a.text)) {
          achar(no, `passa '${a.text}' a uma funcao (acesso indireto a global)`)
        }
      }
      const [arg] = no.arguments
      // import('node:http') e require('http')
      if ((no.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(no.expression) && no.expression.text === 'require'))) {
        if (arg && texto(arg) !== null && (MODULOS_DE_REDE.has(texto(arg)) || !moduloPermitido(texto(arg)))) achar(no, `carrega modulo fora da lista permitida '${texto(arg)}'`, texto(arg))
        else if (arg && texto(arg) === null) achar(no, 'import/require com especificador dinamico (nao da para saber o que carrega)')
      }
    }
    if (ts.isIdentifier(no)) {
      const pai = no.parent
      // `x.fetch`, `{ fetch: ... }`, `import { fetch }` etc. são nomes de propriedade, tratados abaixo
      const ehNomeDePropriedade = (ts.isPropertyAccessExpression(pai) && pai.name === no)
        || (ts.isPropertyAssignment(pai) && pai.name === no) || ts.isPropertySignature(pai)
        || (ts.isMethodDeclaration(pai) && pai.name === no) || (ts.isPropertyDeclaration(pai) && pai.name === no)
      const nome = no.text
      const sensivel = GLOBAIS_DE_REDE.has(nome) || NOMES_DA_GLOBAL.has(nome) || EXECUCAO_DINAMICA.has(nome)
      if (!ehNomeDePropriedade && sensivel && !estaDeclarado(no, nome)) {
        if (GLOBAIS_DE_REDE.has(nome) && !ts.isTypeQueryNode(pai) && !ts.isTypeReferenceNode(pai)) achar(no, `usa a global de rede '${nome}'`, nome)
        // `const g = globalThis`, `f(globalThis)`, `[globalThis]`: só `globalThis.nome` literal é legível
        // (auditor_b1_d1_3, XR08: apelido da global e chave calculada)
        if (NOMES_DA_GLOBAL.has(nome) && !(ts.isPropertyAccessExpression(pai) && pai.expression === no)
          && !(ts.isElementAccessExpression(pai) && pai.expression === no) && !ts.isTypeQueryNode(pai)) {
          achar(no, `usa '${nome}' como valor (apelido da global)`)
        }
        if (EXECUCAO_DINAMICA.has(nome)) achar(no, `usa '${nome}', que monta codigo em tempo de execucao`)
      }
    }
    // globalThis.fetch, window.fetch, self['fetch'], navigator.sendBeacon
    if (ts.isPropertyAccessExpression(no) && (GLOBAIS_DE_REDE.has(no.name.text) || no.name.text === 'sendBeacon')) {
      achar(no, `acessa '${no.name.text}' por propriedade`, no.name.text)
    }
    // process.getBuiltinModule('node:http') (XR09) e `(() => {}).constructor('…')` (XR12)
    if (ts.isPropertyAccessExpression(no) && ['getBuiltinModule', 'constructor', 'binding', 'dlopen'].includes(no.name.text)) {
      achar(no, `acessa '${no.name.text}', que carrega modulo ou monta codigo fora da analise`)
    }
    if (ts.isElementAccessExpression(no)) {
      const chaveLiteral = texto(no.argumentExpression)
      const chaveCalculada = avaliarStringConstante(no.argumentExpression)
      // `?? null`: um identificador sem valor constante é chave calculada (antes virava `undefined` e a regra
      // da global por chave calculada nunca disparava: `globalThis[k]` com `k` parâmetro passava)
      const chaveIdentificador = ts.isIdentifier(no.argumentExpression) ? valorConstante(no.argumentExpression) : null
      const chave = chaveLiteral ?? chaveCalculada ?? chaveIdentificador
      if (chave !== null && (GLOBAIS_DE_REDE.has(chave) || chave === 'sendBeacon')) achar(no, `acessa '${chave}' por indice`, chave)
      if (chave !== null && ['getBuiltinModule', 'constructor', 'binding', 'dlopen'].includes(chave)) achar(no, `acessa '${chave}' por indice`)
      if (chave === null && ['globalThis', 'window', 'self', 'global'].includes(no.expression.getText(sf))) {
        achar(no, 'acessa a global por chave calculada (nao da para saber qual)')
      }
    }
    // Reflect.get(globalThis, 'fetch') e parecidos: o nome aparece como texto
    if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && GLOBAIS_DE_REDE.has(no.text)
      && !(ts.isElementAccessExpression(no.parent)) && !ts.isImportDeclaration(no.parent)) {
      achar(no, `menciona '${no.text}' como texto (acesso indireto)`, no.text)
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
  return achados
}

/** Varre as aplicações inteiras (fora de dependências, build e testes); devolve achados fora das exceções. */
export function varrerAplicacoes(apps = ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso'], raiz = RAIZ) {
  const resultado = []
  for (const app of apps) {
    for (const f of fontesDaApp(join(raiz, app))) {
      const rel = relative(raiz, f)
      const permite = EXCECOES[rel]?.permite ?? []
      for (const a of analisar(readFileSync(f, 'utf8'), f)) {
        if (a.coisa !== null && permite.includes(a.coisa)) continue
        resultado.push(`${rel}:${a.linha} ${a.motivo}`)
      }
    }
  }
  return resultado
}
