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
}

/** Achados num fonte: `{ linha, motivo }`. Vazio = nenhuma saída de rede fora do registro. */
export function analisar(fonte, nome = 'arquivo.ts') {
  const sf = ts.createSourceFile(nome, fonte, ts.ScriptTarget.Latest, true,
    nome.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const achados = []
  // `coisa`: o módulo ou a global envolvida; uma exceção só perdoa o achado cuja coisa ela permite
  const achar = (no, motivo, coisa = null) => achados.push({ linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, motivo, coisa })
  // nomes declarados por escopo lexico (funcao, bloco, arquivo)
  const escopos = [new Set()]
  const escopoAtual = () => escopos[escopos.length - 1]
  const estaDeclarado = (nome) => escopos.some((e) => e.has(nome))

  const valoresConstantes = new Map()
  const declararNoEscopo = (no) => {
    if ((ts.isVariableDeclaration(no) || ts.isParameter(no) || ts.isFunctionDeclaration(no)
      || ts.isImportSpecifier(no) || ts.isImportClause(no) || ts.isNamespaceImport(no)) && no.name && ts.isIdentifier(no.name)) {
      escopoAtual().add(no.name.text)
    }
    if (ts.isVariableDeclaration(no) && no.name && ts.isIdentifier(no.name) && no.initializer) {
      const v = avaliarStringConstante(no.initializer)
      if (v !== null) valoresConstantes.set(no.name.text, v)
    }
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
    const criaEscopo = ts.isFunctionDeclaration(no) || ts.isFunctionExpression(no)
      || ts.isArrowFunction(no) || ts.isMethodDeclaration(no) || ts.isBlock(no)
    if (criaEscopo) escopos.push(new Set())

    declararNoEscopo(no)

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
        if (ts.isIdentifier(a) && ['globalThis', 'window', 'self', 'global'].includes(a.text) && !estaDeclarado(a.text)) {
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
      if (!ehNomeDePropriedade && !estaDeclarado(nome)) {
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
      const chaveIdentificador = ts.isIdentifier(no.argumentExpression) ? valoresConstantes.get(no.argumentExpression.text) : null
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
    if (criaEscopo) escopos.pop()
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
