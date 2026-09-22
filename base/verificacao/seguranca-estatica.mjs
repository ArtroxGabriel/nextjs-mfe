// Verificações estáticas de segurança e invariantes (B4 e B6 do plano):
// 1. Invariante 3: 'use client' nunca importa 'server-only' nem submódulos de servidor;
// 2. Invariante 2: Server Component nunca passa DTO sensível como prop de componente/ilha;
// 3. P1 / B4-3: Zonas nunca usam <Link> de next/link apontando para outra zona;
// 4. Invariante 11: Nenhuma variável NEXT_PUBLIC_* com credencial ou endpoint interno.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { RAIZ } from '../scripts/ambiente.mjs'

const ts = createRequire(join(RAIZ, 'erp-shell', 'package.json'))('typescript')

const SUBMODULOS_DE_SERVIDOR = new Set([
  'server-only',
  '@erp/nucleo/shell',
  '@erp/moldura/servidor',
  'next/headers',
])

const CAMPOS_SENSIVEIS = new Set([
  'custo',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'senha',
  'secret',
])

const PREFIXOS_DE_ZONA = ['/zona1', '/zona2', '/acesso']

/** Verifica diretiva 'use client' no topo do arquivo. */
export function ehCliente(fonte) {
  const primeiraLinha = fonte.trim().split(/\r?\n/)[0]?.trim()
  return primeiraLinha === "'use client'" || primeiraLinha === '"use client"'
}

/** Achados estáticos num arquivo: `{ linha, motivo, regra }`. */
export function analisarSeguranca(fonte, nomeArquivo = 'arquivo.tsx', idZona = null) {
  const sf = ts.createSourceFile(
    nomeArquivo,
    fonte,
    ts.ScriptTarget.Latest,
    true,
    nomeArquivo.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const achados = []
  const cliente = ehCliente(fonte)

  const achar = (no, motivo, regra) => {
    const linha = sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1
    achados.push({ linha, motivo, regra })
  }

  const texto = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null)

  const visitar = (no) => {
    // 1. Regra server-only / servidor em 'use client'
    if (ts.isImportDeclaration(no) && no.moduleSpecifier) {
      const mod = texto(no.moduleSpecifier)
      if (mod) {
        if (cliente && SUBMODULOS_DE_SERVIDOR.has(mod)) {
          achar(no, `'use client' importa modulo de servidor '${mod}'`, 'P0-server-only')
        }
      }
    }

    // 2. Regra DTO sensível como prop de elemento JSX (ex: custo={...}, token={...})
    if (ts.isJsxAttribute(no) && no.name && ts.isIdentifier(no.name)) {
      const nomeProp = no.name.text.toLowerCase()
      if (CAMPOS_SENSIVEIS.has(nomeProp)) {
        achar(no, `prop sensivel '${no.name.text}' passada via JSX`, 'P0-dto-sensivel')
      }
    }

    // 3. Regra Link entre zonas (B4-3 / P1)
    if (ts.isJsxElement(no) || ts.isJsxSelfClosingElement(no)) {
      const tag = ts.isJsxElement(no) ? no.openingElement.tagName : no.tagName
      if (ts.isIdentifier(tag) && tag.text === 'Link' && idZona) {
        const attrs = ts.isJsxElement(no) ? no.openingElement.attributes : no.attributes
        for (const attr of attrs.properties) {
          if (ts.isJsxAttribute(attr) && attr.name && attr.name.text === 'href' && attr.initializer) {
            const href = texto(attr.initializer)
            if (href) {
              for (const pref of PREFIXOS_DE_ZONA) {
                if (href.startsWith(pref) && !pref.startsWith(`/${idZona}`)) {
                  achar(attr, `<Link> para outra zona '${href}' deve ser <a href>`, 'P1-link-entre-zonas')
                }
              }
            }
          }
        }
      }
    }

    // 4. Regra NEXT_PUBLIC_* sensível (Invariante 11)
    if (ts.isPropertyAccessExpression(no) && no.name && ts.isIdentifier(no.name)) {
      const nome = no.name.text
      if (nome.startsWith('NEXT_PUBLIC_')) {
        const upper = nome.toUpperCase()
        if (
          upper.includes('TOKEN') ||
          upper.includes('SECRET') ||
          upper.includes('KEY') ||
          upper.includes('SENHA') ||
          upper.includes('AUTH')
        ) {
          achar(no, `variavel de ambiente publica sensivel '${nome}'`, 'P2-next-public')
        }
      }
    }

    ts.forEachChild(no, visitar)
  }

  visitar(sf)
  return achados
}

/** Varre os repositórios das apps e verifica regras estáticas. */
export function varrerSeguranca(apps = ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
  const fontes = (d) =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n)
      return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx|mts|js|mjs|jsx)$/.test(n) ? [p] : []
    })

  const resultado = []
  for (const app of apps) {
    const idZona = app === 'erp-zona-1' ? 'zona1' : app === 'erp-zona-2' ? 'zona2' : app === 'erp-zona-acesso' ? 'acesso' : null
    const arquivos = [...['app', 'lib'].flatMap((d) => fontes(join(RAIZ, app, d))), join(RAIZ, app, 'proxy.ts')]
    for (const f of arquivos) {
      const rel = relative(RAIZ, f)
      const achados = analisarSeguranca(readFileSync(f, 'utf8'), f, idZona)
      for (const a of achados) {
        resultado.push(`${rel}:${a.linha} [${a.regra}] ${a.motivo}`)
      }
    }
  }
  return resultado
}
