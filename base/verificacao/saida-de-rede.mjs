// Checagem N8 (invariante 4 do AGENTS.md): nenhuma aplicação faz requisição de rede por conta
// própria; toda saída passa pelo registro de destinos do núcleo (`nucleo.destino(...)`), que é a
// allowlist: destino, caminho e método declarados, sem seguir redirecionamento, com timeout.
//
// Lê a ESTRUTURA do código com o compilador do TypeScript (já presente nas apps; nada a
// instalar), não o texto. A primeira versão procurava a palavra `fetch(` e foi contornada com
// `globalThis['fetch'](...)`; esta vê o `fetch` escrito de qualquer jeito.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { RAIZ } from '../scripts/ambiente.mjs'

const ts = createRequire(join(RAIZ, 'erp-shell', 'package.json'))('typescript')

/** Módulos que abrem conexão de rede. Importá-los numa aplicação é sair pela porta dos fundos. */
const MODULOS_DE_REDE = new Set(['http', 'https', 'http2', 'net', 'tls', 'dgram', 'undici', 'axios',
  'node-fetch', 'got', 'ky', 'superagent', 'ws'].flatMap((m) => [m, `node:${m}`]))
/** Globais que fazem rede. */
const GLOBAIS_DE_REDE = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'])
/** Portas para montar código em tempo de execução, que escaparia de qualquer análise. */
const EXECUCAO_DINAMICA = new Set(['eval', 'Function'])

/**
 * Exceções declaradas, cada uma com o motivo. Arquivo novo aqui exige revisão: é uma saída de
 * rede fora da allowlist do núcleo.
 */
export const EXCECOES = {
  'erp-shell/lib/saude-zonas.ts':
    'sonda de saúde das zonas: o alvo vem só de zonas.json (nunca da requisição), sem seguir ' +
    'redirecionamento, timeout de 500 ms; não é chamada a domínio',
}

/** Achados num fonte: `{ linha, motivo }`. Vazio = nenhuma saída de rede fora do registro. */
export function analisar(fonte, nome = 'arquivo.ts') {
  const sf = ts.createSourceFile(nome, fonte, ts.ScriptTarget.Latest, true,
    nome.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const achados = []
  const achar = (no, motivo) => achados.push({ linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, motivo })
  // nomes declarados localmente (import, variável, parâmetro, função) não são a global
  const declarados = new Set()
  const coletar = (no) => {
    if ((ts.isVariableDeclaration(no) || ts.isParameter(no) || ts.isFunctionDeclaration(no)
      || ts.isImportSpecifier(no) || ts.isImportClause(no) || ts.isNamespaceImport(no)) && no.name && ts.isIdentifier(no.name)) {
      declarados.add(no.name.text)
    }
    ts.forEachChild(no, coletar)
  }
  coletar(sf)
  const texto = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null

  const visitar = (no) => {
    // import ... from 'node:http'  /  export ... from 'axios'
    if ((ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) && no.moduleSpecifier && MODULOS_DE_REDE.has(texto(no.moduleSpecifier))) {
      achar(no, `importa modulo de rede '${texto(no.moduleSpecifier)}'`)
    }
    if (ts.isCallExpression(no)) {
      const [arg] = no.arguments
      // import('node:http') e require('http')
      if ((no.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(no.expression) && no.expression.text === 'require'))) {
        if (arg && MODULOS_DE_REDE.has(texto(arg))) achar(no, `carrega modulo de rede '${texto(arg)}'`)
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
      if (!ehNomeDePropriedade && !declarados.has(nome)) {
        if (GLOBAIS_DE_REDE.has(nome) && !ts.isTypeQueryNode(pai) && !ts.isTypeReferenceNode(pai)) achar(no, `usa a global de rede '${nome}'`)
        if (EXECUCAO_DINAMICA.has(nome)) achar(no, `usa '${nome}', que monta codigo em tempo de execucao`)
      }
    }
    // globalThis.fetch, window.fetch, self['fetch'], navigator.sendBeacon
    if (ts.isPropertyAccessExpression(no) && (GLOBAIS_DE_REDE.has(no.name.text) || no.name.text === 'sendBeacon')) {
      achar(no, `acessa '${no.name.text}' por propriedade`)
    }
    if (ts.isElementAccessExpression(no)) {
      const chave = texto(no.argumentExpression)
      if (chave !== null && (GLOBAIS_DE_REDE.has(chave) || chave === 'sendBeacon')) achar(no, `acessa '${chave}' por indice`)
      if (chave === null && ['globalThis', 'window', 'self', 'global'].includes(no.expression.getText(sf))) {
        achar(no, 'acessa a global por chave calculada (nao da para saber qual)')
      }
    }
    // Reflect.get(globalThis, 'fetch') e parecidos: o nome aparece como texto
    if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && GLOBAIS_DE_REDE.has(no.text)
      && !(ts.isElementAccessExpression(no.parent)) && !ts.isImportDeclaration(no.parent)) {
      achar(no, `menciona '${no.text}' como texto (acesso indireto)`)
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
  return achados
}

/** Varre `app/` e `lib/` (e `proxy.ts`) das aplicações; devolve achados fora das exceções. */
export function varrerAplicacoes(apps = ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
  const fontes = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n)
    return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx|mts|js|mjs|jsx)$/.test(n) ? [p] : []
  })
  const resultado = []
  for (const app of apps) {
    const arquivos = [...['app', 'lib'].flatMap((d) => fontes(join(RAIZ, app, d))), join(RAIZ, app, 'proxy.ts')]
    for (const f of arquivos) {
      const rel = relative(RAIZ, f)
      if (rel in EXCECOES) continue
      for (const a of analisar(readFileSync(f, 'utf8'), f)) resultado.push(`${rel}:${a.linha} ${a.motivo}`)
    }
  }
  return resultado
}
