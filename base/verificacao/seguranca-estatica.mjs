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
  ['server-only', 'next/headers', '@erp/moldura/servidor', 'redis', 'ioredis'].includes(mod) || mod.startsWith('@redis/') ||
  mod === '@erp/nucleo' || (mod.startsWith('@erp/nucleo/') && mod !== '@erp/nucleo/permissoes') ||
  // `lib/` das apps é a raiz de composição do servidor (núcleo, sessão, destinos)
  mod.startsWith('@/lib/')

/** Pedaços de nome que denunciam dado que não pode ir ao navegador. Comparados sem caixa e sem `_`. */
const SENSIVEIS = ['custo', 'token', 'senha', 'secret', 'segredo', 'password', 'cpf', 'credencial', 'refresh', 'accesstoken']
const ehSensivel = (nome) => { const n = nome.toLowerCase().replace(/[_-]/g, ''); return SENSIVEIS.some((s) => n.includes(s)) }

/**
 * As únicas `NEXT_PUBLIC_*` aceitas (invariante 11). Lista do que pode, não do que não pode: o
 * auditor_b1_d1_3 (V7) passou `NEXT_PUBLIC_BEARER` por uma lista de termos proibidos.
 */
export const PUBLICAS_PERMITIDAS = new Set(['NEXT_PUBLIC_APP_NAME', 'NEXT_PUBLIC_APP_VERSION'])

/** Chaves do `next.config` que embutem valor do servidor no bundle do navegador sem `NEXT_PUBLIC_` (V7). */
const CHAVES_QUE_EMBUTEM = new Set(['env', 'define', 'defineServer', 'webpack'])

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
    // `import x = require('m')` (auditor_b1_d1_3, XE32)
    if (ts.isImportEqualsDeclaration(no) && ts.isExternalModuleReference(no.moduleReference)) {
      lista.push({ no, mod: texto(no.moduleReference.expression), dinamico: true })
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
  return lista
}

/** A diretiva de um prólogo ('use client' / 'use server'), lida da árvore. */
function diretiva(fonte, qual) {
  const sf = ts.createSourceFile('d.tsx', fonte, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  for (const st of sf.statements) {
    if (!ts.isExpressionStatement(st) || !ts.isStringLiteral(st.expression)) break
    if (st.expression.text === qual) return true
  }
  return false
}

/** `import 'server-only'` como declaração de topo, sem cláusula (comentário e string não contam). */
export function temServerOnly(fonte) {
  const sf = ts.createSourceFile('d.ts', fonte, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  return sf.statements.some((st) => ts.isImportDeclaration(st) && !st.importClause
    && ts.isStringLiteral(st.moduleSpecifier) && st.moduleSpecifier.text === 'server-only')
}

/**
 * O nome `nome` exportado por `arquivo` é um componente de cliente? Segue reexportações
 * (`export { X as Y } from`, `export * from`) até o módulo 'use client' (auditor_b1_d1_3, V4: ilha por barril).
 */
function exportaIlha(arquivo, nome, raizDaApp, vistos = new Set()) {
  if (!arquivo || vistos.has(`${arquivo}#${nome}`)) return false
  vistos.add(`${arquivo}#${nome}`)
  const fonte = readFileSync(arquivo, 'utf8')
  if (ehCliente(fonte)) return true
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  for (const st of sf.statements) {
    if (!ts.isExportDeclaration(st) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) continue
    const alvo = resolverLocal(st.moduleSpecifier.text, arquivo, raizDaApp)
    if (!st.exportClause) { if (exportaIlha(alvo, nome, raizDaApp, vistos)) return true; continue }
    if (ts.isNamedExports(st.exportClause)) {
      for (const e of st.exportClause.elements) {
        if (e.name.text === nome && exportaIlha(alvo, (e.propertyName ?? e.name).text, raizDaApp, vistos)) return true
      }
    }
  }
  return false
}

/** O arquivo local chega ao servidor, por ele mesmo ou pelo que importa? */
function arrastaServidor(arquivo, raizDaApp, vistos = new Set(), fonte = null) {
  if (vistos.has(arquivo)) return false
  vistos.add(arquivo)
  fonte ??= readFileSync(arquivo, 'utf8')
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
  const ehNextConfig = /(^|\/)next\.config\.[cm]?[jt]s$/.test(nomeArquivo)

  // --- 0a. invariante 5: toda Server Action começa pela verificação -------------------------------
  // (auditor_b1_d1_3, V5/P09: a action que chamava o domínio antes do `acaoProtegida` passava 71/71)
  if (diretiva(fonte, 'use server')) {
    const ehChamadaProtegida = (e) => {
      while (e && (ts.isAwaitExpression(e) || ts.isParenthesizedExpression(e))) e = e.expression
      return !!e && ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'acaoProtegida'
    }
    const corpoDaAcao = (st) => {
      const exportado = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (ts.isFunctionDeclaration(st) && exportado) return [st.name?.text ?? 'default', st.body]
      if (ts.isVariableStatement(st) && exportado) {
        const d = st.declarationList.declarations[0]
        const f = d?.initializer
        if (f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f))) return [d.name.getText(sf), f.body]
        return [d?.name.getText(sf) ?? '?', null]
      }
      if (ts.isExportAssignment(st) || (ts.isExportDeclaration(st))) return ['export', null]
      return null
    }
    for (const st of sf.statements) {
      const acao = corpoDaAcao(st)
      if (!acao) continue
      const [nome, corpo] = acao
      const primeiro = corpo && (ts.isBlock(corpo) ? corpo.statements[0] : null)
      const ok = corpo && (ts.isBlock(corpo) ? primeiro && ts.isReturnStatement(primeiro) && ehChamadaProtegida(primeiro.expression) : ehChamadaProtegida(corpo))
      if (!ok) achar(st, `Server Action '${nome}' nao comeca por 'return acaoProtegida(...)'`, 'P0-acao-protegida')
    }
    // o núcleo (domínio, sessão) só é tocado dentro da função passada ao `acaoProtegida`
    const dentroDaProtegida = (no) => {
      for (let n = no; n.parent; n = n.parent) {
        if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isCallExpression(n.parent)
          && ehChamadaProtegida(n.parent) && n.parent.arguments.includes(n)) return true
      }
      return false
    }
    const nucleoForaDaProtegida = (no) => {
      if (ts.isIdentifier(no) && no.text === 'nucleo' && !ts.isImportSpecifier(no.parent) && !ts.isImportClause(no.parent) && !dentroDaProtegida(no)) {
        achar(no, "Server Action usa o nucleo fora do corpo de 'acaoProtegida'", 'P0-acao-protegida')
      }
      ts.forEachChild(no, nucleoForaDaProtegida)
    }
    nucleoForaDaProtegida(sf)
  }

  // --- 0. invariante 3: módulo de servidor fora de app/ declara `import 'server-only'` -------------
  // (auditor_b1_d1_3, V3: lib/redis.ts, lib/nucleo.ts, lib/pagina.ts sem o import passavam)
  if (opcoes.exigirServerOnly && !cliente && !temServerOnly(fonte) && arrastaServidor(nomeArquivo, raizDaApp, new Set(), fonte)) {
    achados.push({ linha: 1, motivo: "modulo que chega ao servidor sem import 'server-only'", regra: 'P0-server-only' })
  }

  // --- 1. 'use client' não chega ao servidor ---------------------------------------------------
  const importados = new Map()   // nome local → módulo
  const ilhas = new Set(opcoes.componentesCliente ?? [])
  const espacosDeIlha = new Set()
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
          if (r && exportaIlha(r, original, raizDaApp)) ilhas.add(local)
        }
      }
      // `import * as ns from './Ilha'`: `<ns.Qualquer>` é ilha
      const nb = no.importClause.namedBindings
      if (nb && ts.isNamespaceImport(nb) && (mod.startsWith('.') || mod.startsWith('@/'))) {
        const r = resolverLocal(mod, nomeArquivo, raizDaApp)
        if (r && ehCliente(readFileSync(r, 'utf8'))) espacosDeIlha.add(nb.name.text)
        importados.set(nb.name.text, { mod, original: '*' })
      }
      if (nb && ts.isNamespaceImport(nb) && mod === '@erp/moldura') espacosDeIlha.add(nb.name.text)
      if (nb && ts.isNamespaceImport(nb) && !importados.has(nb.name.text)) importados.set(nb.name.text, { mod, original: '*' })
    }
  }
  // `const Outra = Ilha`: o apelido também é ilha
  const apelidos = (no) => {
    if (ts.isVariableDeclaration(no) && ts.isIdentifier(no.name) && no.initializer) {
      const alvo = no.initializer.getText(sf)
      if (ilhas.has(alvo) || [...espacosDeIlha].some((ns) => alvo.startsWith(`${ns}.`))) ilhas.add(no.name.text)
    }
    ts.forEachChild(no, apelidos)
  }
  apelidos(sf)
  const ehIlha = (tag) => ilhas.has(tag) || [...espacosDeIlha].some((ns) => tag.startsWith(`${ns}.`)
    && (importados.get(ns)?.mod !== '@erp/moldura' || daMoldura.has(tag.slice(ns.length + 1))))
  // <Link> por import direto, barril local, namespace (`L.default`) ou apelido (auditor_b1_d1_3, L5)
  const exportaLink = (arquivo, nome, vistos = new Set()) => {
    if (!arquivo || vistos.has(`${arquivo}#${nome}`)) return false
    vistos.add(`${arquivo}#${nome}`)
    const f = ts.createSourceFile(arquivo, readFileSync(arquivo, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
    return f.statements.some((st) => ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)
      && (st.exportClause && ts.isNamedExports(st.exportClause)
        ? st.exportClause.elements.some((e) => e.name.text === nome && (st.moduleSpecifier.text === 'next/link'
          ? (e.propertyName ?? e.name).text === 'default'
          : exportaLink(resolverLocal(st.moduleSpecifier.text, arquivo, raizDaApp), (e.propertyName ?? e.name).text, vistos)))
        : !st.exportClause && exportaLink(resolverLocal(st.moduleSpecifier.text, arquivo, raizDaApp), nome, vistos)))
  }
  const nomesDeLink = new Set([...importados].filter(([, v]) => (v.mod === 'next/link' && v.original === 'default')
    || ((v.mod.startsWith('.') || v.mod.startsWith('@/')) && v.original !== '*' && exportaLink(resolverLocal(v.mod, nomeArquivo, raizDaApp), v.original))).map(([k]) => k))
  for (const [k, v] of importados) if (v.mod === 'next/link' && v.original === '*') nomesDeLink.add(`${k}.default`)
  const apelidosDeLink = (no) => {
    if (ts.isVariableDeclaration(no) && ts.isIdentifier(no.name) && no.initializer && nomesDeLink.has(no.initializer.getText(sf))) nomesDeLink.add(no.name.text)
    ts.forEachChild(no, apelidosDeLink)
  }
  apelidosDeLink(sf)
  const ehOutraZona = (valor) => PREFIXOS_DE_ZONA.some((p) => (valor === p || valor.startsWith(`${p}/`) || valor.startsWith(`${p}?`)) && p !== `/${idZona}`)

  // Ação importada de um módulo 'use server' (a única referência que atravessa para a ilha).
  const ehAcao = (nome) => {
    const imp = importados.get(nome)
    if (!imp) return false
    if (opcoes.acoes?.includes(nome)) return true
    const r = (imp.mod.startsWith('.') || imp.mod.startsWith('@/')) && resolverLocal(imp.mod, nomeArquivo, raizDaApp)
    return !!r && diretiva(readFileSync(r, 'utf8'), 'use server')
  }
  const nomeSensivel = (e) => ts.isPropertyAccessExpression(e) && ehSensivel(e.name.text)
  /**
   * Valor que pode ir a uma ilha: escalar, nunca o objeto do domínio (auditor_b1_d1_3, V4). Aceita
   * literal, template de escalares, `x.campo` (sem chamada), `String/Number/Boolean(escalar)`,
   * condicional e `+ ?? || &&` de escalares, objeto/array de escalares, JSX e ação 'use server'.
   * Recusa chamada qualquer (`JSON.stringify(p)`), identificador local e objeto espalhado.
   */
  const valorSeguro = (e) => {
    if (!e) return true
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return valorSeguro(e.expression)
    if (ts.isStringLiteral(e) || ts.isNumericLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)
      || e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword || e.kind === ts.SyntaxKind.NullKeyword
      || ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return true
    if (ts.isIdentifier(e)) return e.text === 'undefined' || ehAcao(e.text)
    if (ts.isTemplateExpression(e)) return e.templateSpans.every((t) => valorSeguro(t.expression))
    if (ts.isPropertyAccessExpression(e)) {
      if (nomeSensivel(e)) return false
      let x = e.expression
      while (ts.isPropertyAccessExpression(x) || ts.isNonNullExpression(x)) x = x.expression
      return ts.isIdentifier(x) || x.kind === ts.SyntaxKind.ThisKeyword
    }
    if (ts.isConditionalExpression(e)) return valorSeguro(e.whenTrue) && valorSeguro(e.whenFalse)
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) return valorSeguro(e.left) && valorSeguro(e.right)
    if (ts.isPrefixUnaryExpression(e)) return valorSeguro(e.operand)
    if (ts.isArrayLiteralExpression(e)) return e.elements.every(valorSeguro)
    if (ts.isObjectLiteralExpression(e)) {
      return e.properties.every((p) => ts.isPropertyAssignment(p) && !ehSensivel(p.name.getText(sf)) && valorSeguro(p.initializer))
    }
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && ['String', 'Number', 'Boolean'].includes(e.expression.text)) {
      return e.arguments.length <= 1 && e.arguments.every(valorSeguro)
    }
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
          } else if (ehIlha(tag) && !valorSeguro(e)) {
            achar(attr, `objeto espalhado na ilha <${tag}>: passe so os campos que ela usa`, 'P0-dto-sensivel')
          }
        } else if (ehIlha(tag) && attr.initializer && ts.isJsxExpression(attr.initializer) && !valorSeguro(attr.initializer.expression)) {
          achar(attr, `valor nao projetado na prop '${attr.name.getText(sf)}' da ilha <${tag}>`, 'P0-dto-sensivel')
        }
      }
      // filhos da ilha também são prop (`children`) e vão serializados no payload RSC
      if (ts.isJsxOpeningElement(no) && ehIlha(tag)) {
        for (const filho of no.parent.children) {
          if (ts.isJsxExpression(filho) && filho.expression && !valorSeguro(filho.expression)) {
            achar(filho, `valor nao projetado entre as tags da ilha <${tag}>`, 'P0-dto-sensivel')
          }
        }
      }
      // --- 3. <Link> entre zonas -------------------------------------------------------------
      if (nomesDeLink.has(tag)) {
        const href = no.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'href')
        const valor = href?.initializer && (ts.isStringLiteral(href.initializer) ? href.initializer.text
          : ts.isJsxExpression(href.initializer) ? texto(href.initializer.expression) : null)
        if (valor === null || valor === undefined) {
          achar(href ?? no, `<${tag}> com href nao literal: entre zonas use <a href>`, 'P1-link-entre-zonas')
        } else if (ehOutraZona(valor)) {
          achar(href, `<Link> para outra zona '${valor}' deve ser <a href>`, 'P1-link-entre-zonas')
        }
      }
    }
    // navegação de cliente para outra zona (`router.push('/zona2')`) também quebra a fronteira
    if (ts.isCallExpression(no) && ts.isPropertyAccessExpression(no.expression)
      && ['push', 'replace', 'prefetch'].includes(no.expression.name.text)) {
      const alvo = no.arguments[0]
      const valor = texto(alvo) ?? (alvo && ts.isTemplateExpression(alvo) ? alvo.head.text : null)
      if (valor && ehOutraZona(valor)) achar(no, `navegacao de cliente para outra zona '${valor}': use <a href> ou window.location`, 'P1-link-entre-zonas')
    }
    // --- 4. NEXT_PUBLIC_*: nome, índice, destruturação ou texto ------------------------------
    if ((ts.isIdentifier(no) || ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && no.text.startsWith('NEXT_PUBLIC_')
      && !PUBLICAS_PERMITIDAS.has(no.text)) {
      achar(no, `variavel de ambiente publica fora da lista permitida: '${no.text}'`, 'P2-next-public')
    }
    if (ts.isTemplateExpression(no) && no.head.text.includes('NEXT_PUBLIC_')) {
      achar(no, 'nome de NEXT_PUBLIC_ montado em tempo de execucao', 'P2-next-public')
    }
    if (ehNextConfig && (ts.isPropertyAssignment(no) || ts.isShorthandPropertyAssignment(no) || ts.isMethodDeclaration(no))
      && no.name && CHAVES_QUE_EMBUTEM.has(no.name.getText(sf).replace(/['"]/g, ''))) {
      achar(no, `next.config com '${no.name.getText(sf)}': embute valor do servidor no bundle do navegador`, 'P2-next-public')
    }
    if (ehNextConfig && ts.isIdentifier(no) && no.text === 'DefinePlugin') {
      achar(no, 'next.config com DefinePlugin: embute valor do servidor no bundle do navegador', 'P2-next-public')
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
  return achados
}

/** Fontes de uma app inteira, fora de dependências e build (auditor_b1_d1_3, V6/V7: pasta nova não escapa). */
export function fontesDaApp(raizDaApp) {
  const andar = (d) => !existsSync(d) ? [] : readdirSync(d).flatMap((n) => {
    if (['node_modules', '.next', '.git', 'test'].includes(n)) return []
    const p = join(d, n)
    return statSync(p).isDirectory() ? andar(p) : /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/.test(n) && !n.endsWith('.d.ts') ? [p] : []
  })
  return andar(raizDaApp)
}

/** Varre as apps inteiras e devolve as violações. */
export function varrerSeguranca(apps = ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
  const resultado = []
  for (const app of apps) {
    const raizDaApp = join(RAIZ, app)
    const idZona = { 'erp-zona-1': 'zona1', 'erp-zona-2': 'zona2', 'erp-zona-acesso': 'acesso' }[app] ?? null
    for (const f of fontesDaApp(raizDaApp)) {
      const rel = relative(raizDaApp, f)
      // app/ é servidor por convenção do Next; scripts/ roda fora do Next (sem a condição react-server)
      const exigirServerOnly = !/^(app|scripts)\//.test(rel) && !/^(proxy|next\.config|next-env)\./.test(rel)
      for (const a of analisarSeguranca(readFileSync(f, 'utf8'), f, idZona, { raizDaApp, exigirServerOnly })) {
        resultado.push(`${relative(RAIZ, f)}:${a.linha} [${a.regra}] ${a.motivo}`)
      }
    }
  }
  return resultado
}
