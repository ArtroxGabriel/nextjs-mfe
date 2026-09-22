// Verificações estáticas de segurança e invariantes (B4 e B6 do plano; endurecidas pelo auditor_b1_d1_2):
// 1. Invariante 3: 'use client' nunca importa servidor, nem direto, nem por reexportação, nem por import
//    dinâmico, nem por um módulo local que por sua vez importe servidor;
// 2. Invariante 2: Server Component nunca passa DTO sensível para ilha: nome sensível em qualquer prop,
//    e, em componente de cliente, só valores projetados (literal, objeto literal com chaves seguras, ação);
// 3. P1: <Link> de next/link (com qualquer nome) só com href literal da própria zona;
// 4. Invariante 11: NEXT_PUBLIC_* com credencial ou endpoint, escrito de qualquer forma, e next.config.
// Lê a ESTRUTURA do código com o compilador do TypeScript; todo contorno achado vira caso de teste.
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { RAIZ } from '../scripts/ambiente.mjs'

const ts = createRequire(join(RAIZ, 'erp-shell', 'package.json'))('typescript')

/** Módulos que só existem no servidor. `@erp/nucleo` inteiro é servidor, menos `/permissoes` (feito para ilhas). */
const ehModuloDeServidor = (mod) =>
  ['server-only', 'next/headers', '@erp/moldura/servidor'].includes(mod) ||
  mod === '@erp/nucleo' || (mod.startsWith('@erp/nucleo/') && mod !== '@erp/nucleo/permissoes') ||
  // `lib/` das apps é a raiz de composição do servidor (núcleo, sessão, destinos)
  mod.startsWith('@/lib/')

/** Pedaços de nome que denunciam dado que não pode ir ao navegador. Comparados sem caixa e sem `_`. */
const SENSIVEIS = ['custo', 'token', 'senha', 'secret', 'segredo', 'password', 'cpf', 'credencial', 'refresh', 'accesstoken']
const ehSensivel = (nome) => { const n = nome.toLowerCase().replace(/[_-]/g, ''); return SENSIVEIS.some((s) => n.includes(s)) }

/** NEXT_PUBLIC_ com cara de credencial ou de endereço interno (invariante 11). */
const PUBLICA_PROIBIDA = /TOKEN|SECRET|SEGREDO|KEY|SENHA|PASS|AUTH|ACCESS|CRED|SESS|URL|URI|HOST|ORIGEM|ORIGIN|ENDPOINT|API|DOMINIO|INTERNO|REDIS|IDP/

const PREFIXOS_DE_ZONA = ['/zona1', '/zona2', '/acesso']

/** Componentes `'use client'` da moldura, lidos do fonte dela (não de uma lista mantida à mão). */
function clientesDaMoldura() {
  const src = join(RAIZ, 'erp-moldura', 'src')
  if (!existsSync(src)) return new Set()
  return new Set(readdirSync(src).filter((n) => n.endsWith('.tsx')).flatMap((n) => {
    const t = readFileSync(join(src, n), 'utf8')
    return ehCliente(t) ? [...t.matchAll(/export (?:function|const) ([A-Z]\w*)/g)].map((m) => m[1]) : []
  }))
}

/** A diretiva 'use client' no prólogo, com ou sem ponto e vírgula, depois de comentários. */
export function ehCliente(fonte) {
  const sf = ts.createSourceFile('d.tsx', fonte, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  for (const st of sf.statements) {
    if (!ts.isExpressionStatement(st) || !ts.isStringLiteral(st.expression)) break
    if (st.expression.text === 'use client') return true
  }
  return false
}

/** Resolve `@/x` e `./x` para um arquivo da app; `null` se não for local ou não existir. */
function resolverLocal(mod, arquivo, raizDaApp) {
  let base
  if (mod.startsWith('@/')) base = raizDaApp && join(raizDaApp, mod.slice(2))
  else if (mod.startsWith('.')) base = join(dirname(arquivo), mod)
  if (!base) return null
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

/** Especificadores de módulo de um fonte: import, export…from, import() e require(). */
function especificadores(sf) {
  const lista = []
  const texto = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null)
  const visitar = (no) => {
    if ((ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) && no.moduleSpecifier) {
      if (!(ts.isImportDeclaration(no) && no.importClause?.isTypeOnly)) lista.push({ no, mod: texto(no.moduleSpecifier) })
    }
    if (ts.isCallExpression(no) && (no.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(no.expression) && no.expression.text === 'require'))) {
      lista.push({ no, mod: texto(no.arguments[0]), dinamico: true })
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
  return lista
}

/** O arquivo local chega ao servidor, por ele mesmo ou pelo que importa? */
function arrastaServidor(arquivo, raizDaApp, vistos = new Set()) {
  if (vistos.has(arquivo)) return false
  vistos.add(arquivo)
  const fonte = readFileSync(arquivo, 'utf8')
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  return especificadores(sf).some(({ mod }) => mod && (ehModuloDeServidor(mod) ||
    ((mod.startsWith('.') || mod.startsWith('@/')) && (() => { const r = resolverLocal(mod, arquivo, raizDaApp); return r ? arrastaServidor(r, raizDaApp, vistos) : false })())))
}

/**
 * Achados estáticos num arquivo: `{ linha, motivo, regra }`.
 * `opcoes.raizDaApp` resolve `@/…`; `opcoes.componentesCliente` acrescenta nomes de ilha (testes).
 */
export function analisarSeguranca(fonte, nomeArquivo = 'arquivo.tsx', idZona = null, opcoes = {}) {
  const sf = ts.createSourceFile(nomeArquivo, fonte, ts.ScriptTarget.Latest, true,
    /\.(tsx|jsx)$/.test(nomeArquivo) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const achados = []
  const achar = (no, motivo, regra) => achados.push({ linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, motivo, regra })
  const texto = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null)
  const cliente = ehCliente(fonte)
  const { raizDaApp = null } = opcoes

  // --- 1. 'use client' não chega ao servidor ---------------------------------------------------
  const importados = new Map()   // nome local → módulo
  const ilhas = new Set(opcoes.componentesCliente ?? [])
  const daMoldura = clientesDaMoldura()
  for (const { no, mod, dinamico } of especificadores(sf)) {
    if (cliente) {
      if (mod === null) achar(no, "'use client' com import de especificador dinamico", 'P0-server-only')
      else if (ehModuloDeServidor(mod)) achar(no, `'use client' importa modulo de servidor '${mod}'`, 'P0-server-only')
      else if (mod.startsWith('.') || mod.startsWith('@/')) {
        const r = resolverLocal(mod, nomeArquivo, raizDaApp)
        if (r && arrastaServidor(r, raizDaApp)) achar(no, `'use client' importa '${mod}', que chega ao servidor`, 'P0-server-only')
      }
    }
    if (!dinamico && ts.isImportDeclaration(no) && mod && no.importClause) {
      const nomes = [no.importClause.name?.text, ...(no.importClause.namedBindings && ts.isNamedImports(no.importClause.namedBindings)
        ? no.importClause.namedBindings.elements.map((e) => ({ local: e.name.text, original: (e.propertyName ?? e.name).text })) : [])]
      for (const n of nomes.filter(Boolean)) {
        const local = typeof n === 'string' ? n : n.local
        const original = typeof n === 'string' ? 'default' : n.original
        importados.set(local, { mod, original })
        if (mod === '@erp/moldura' && daMoldura.has(original)) ilhas.add(local)
        if (mod.startsWith('.') || mod.startsWith('@/')) {
          const r = resolverLocal(mod, nomeArquivo, raizDaApp)
          if (r && ehCliente(readFileSync(r, 'utf8'))) ilhas.add(local)
        }
      }
    }
  }
  const nomesDeLink = new Set([...importados].filter(([, v]) => v.mod === 'next/link' && v.original === 'default').map(([k]) => k))

  // valor que pode ir a uma ilha: projetado, nunca o objeto do domínio inteiro
  const valorSeguro = (e) => {
    if (!e) return true
    if (ts.isParenthesizedExpression(e)) return valorSeguro(e.expression)
    if (ts.isStringLiteral(e) || ts.isNumericLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)
      || e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword || e.kind === ts.SyntaxKind.NullKeyword
      || ts.isArrowFunction(e) || ts.isFunctionExpression(e) || ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return true
    // ação ou constante importada (ex.: `acao={concluirTarefa}`), não variável local com dado
    if (ts.isIdentifier(e)) return importados.has(e.text)
    if (ts.isObjectLiteralExpression(e)) {
      return e.properties.every((p) => ts.isPropertyAssignment(p) && !ehSensivel(p.name.getText(sf))
        && (ts.isPropertyAccessExpression(p.initializer) || ts.isCallExpression(p.initializer) || valorSeguro(p.initializer)))
    }
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && ['String', 'Number', 'Boolean'].includes(e.expression.text)) return true
    return false
  }

  const visitar = (no) => {
    // --- 2. DTO sensível ---------------------------------------------------------------------
    if (ts.isJsxAttribute(no) && no.name) {
      const nome = no.name.getText(sf)
      if (ehSensivel(nome)) achar(no, `prop sensivel '${nome}' passada via JSX`, 'P0-dto-sensivel')
      // chave sensível dentro de objeto literal passado como prop, em qualquer profundidade
      const chaves = (e) => (e && ts.isObjectLiteralExpression(e)
        ? e.properties.flatMap((p) => [p.name?.getText(sf) ?? '', ...(ts.isPropertyAssignment(p) ? chaves(p.initializer) : [])]) : [])
      const valor = no.initializer && ts.isJsxExpression(no.initializer) ? no.initializer.expression : null
      const sensivel = chaves(valor).find(ehSensivel)
      if (sensivel) achar(no, `campo sensivel '${sensivel}' em objeto passado na prop '${nome}'`, 'P0-dto-sensivel')
    }
    if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) {
      const tag = no.tagName.getText(sf)
      for (const attr of no.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attr)) {
          const e = attr.expression
          if (ts.isObjectLiteralExpression(e) && e.properties.some((p) => (p.name && ehSensivel(p.name.getText(sf))) || ts.isSpreadAssignment(p))) {
            achar(attr, `spread com campo sensivel em <${tag}>`, 'P0-dto-sensivel')
          } else if (ilhas.has(tag) && !valorSeguro(e)) {
            achar(attr, `objeto espalhado na ilha <${tag}>: passe so os campos que ela usa`, 'P0-dto-sensivel')
          }
        } else if (ilhas.has(tag) && attr.initializer && ts.isJsxExpression(attr.initializer) && !valorSeguro(attr.initializer.expression)) {
          achar(attr, `valor nao projetado na prop '${attr.name.getText(sf)}' da ilha <${tag}>`, 'P0-dto-sensivel')
        }
      }
      // --- 3. <Link> entre zonas -------------------------------------------------------------
      if (nomesDeLink.has(tag)) {
        const href = no.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'href')
        const valor = href?.initializer && (ts.isStringLiteral(href.initializer) ? href.initializer.text
          : ts.isJsxExpression(href.initializer) ? texto(href.initializer.expression) : null)
        if (valor === null || valor === undefined) {
          achar(href ?? no, `<${tag}> com href nao literal: entre zonas use <a href>`, 'P1-link-entre-zonas')
        } else if (PREFIXOS_DE_ZONA.some((p) => (valor === p || valor.startsWith(`${p}/`) || valor.startsWith(`${p}?`)) && p !== `/${idZona}`)) {
          achar(href, `<Link> para outra zona '${valor}' deve ser <a href>`, 'P1-link-entre-zonas')
        }
      }
    }
    // --- 4. NEXT_PUBLIC_*: nome, índice, destruturação ou texto ------------------------------
    if ((ts.isIdentifier(no) || ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && no.text.startsWith('NEXT_PUBLIC_')
      && PUBLICA_PROIBIDA.test(no.text.slice('NEXT_PUBLIC_'.length).toUpperCase())) {
      achar(no, `variavel de ambiente publica sensivel '${no.text}'`, 'P2-next-public')
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
  return achados
}

/** Varre as apps (app/, lib/, proxy.ts, next.config.ts) e devolve as violações. */
export function varrerSeguranca(apps = ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
  const fontes = (d) => !existsSync(d) ? [] : readdirSync(d).flatMap((n) => {
    const p = join(d, n)
    return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx|mts|js|mjs|jsx)$/.test(n) ? [p] : []
  })
  const resultado = []
  for (const app of apps) {
    const raizDaApp = join(RAIZ, app)
    const idZona = { 'erp-zona-1': 'zona1', 'erp-zona-2': 'zona2', 'erp-zona-acesso': 'acesso' }[app] ?? null
    const arquivos = [...['app', 'lib'].flatMap((d) => fontes(join(raizDaApp, d))),
      ...['proxy.ts', 'next.config.ts', 'next.config.mjs'].map((f) => join(raizDaApp, f)).filter(existsSync)]
    for (const f of arquivos) {
      for (const a of analisarSeguranca(readFileSync(f, 'utf8'), f, idZona, { raizDaApp })) {
        resultado.push(`${relative(RAIZ, f)}:${a.linha} [${a.regra}] ${a.motivo}`)
      }
    }
  }
  return resultado
}
