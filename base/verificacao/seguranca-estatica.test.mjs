// Testes do analisador de segurança estática (B4 e B6 do plano).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analisarSeguranca, varrerSeguranca, fontesDaApp, programaDaApp } from './seguranca-estatica.mjs'

const pega = (fonte, nome = 'teste.tsx', zona = null, opcoes = {}) =>
  assert.ok(analisarSeguranca(fonte, nome, zona, opcoes).length > 0, `nao pegou violacao:\n${fonte}`)

const passa = (fonte, nome = 'teste.tsx', zona = null, opcoes = {}) =>
  assert.deepEqual(analisarSeguranca(fonte, nome, zona, opcoes), [], `falso positivo:\n${fonte}`)

test('P0-server-only: reprova import de server-only ou servidor dentro de "use client"', () => {
  pega("'use client'\nimport 'server-only'\nexport function C() { return <div /> }")
  pega("'use client'\nimport { criarNucleoDoShell } from '@erp/nucleo/shell'")
  pega("'use client'\nimport { cookies } from 'next/headers'")
})

test('P0-server-only: permite uso normal de server-only em arquivos de servidor', () => {
  passa("import 'server-only'\nexport function S() { return <div /> }")
  passa("import { cookies } from 'next/headers'")
})

test('P0-dto-sensivel: reprova passagem de campo sensivel como prop em JSX', () => {
  pega("export function Painel({ custo }) { return <Card custo={custo} /> }")
  pega("export function Ilha({ token }) { return <Widget token={token} /> }")
  pega("export function S({ access_token }) { return <Botao access_token={access_token} /> }")
})

test('P0-dto-sensivel: permite props comuns e nao sensiveis', () => {
  passa("export function Painel({ nome, id }) { return <Card nome={nome} id={id} /> }")
  passa("export function Tabela({ itens }) { return <Lista itens={itens} total={10} /> }")
})

test('P1-link-entre-zonas: reprova <Link> apontando para prefixo de outra zona', () => {
  pega(
    "import Link from 'next/link'\nexport function M() { return <Link href='/zona2/tarefas'>Ir</Link> }",
    'app/zona1/page.tsx',
    'zona1'
  )
  pega(
    "import Link from 'next/link'\nexport function M() { return <Link href='/acesso/usuarios'>Ir</Link> }",
    'app/zona1/page.tsx',
    'zona1'
  )
})

test('P1-link-entre-zonas: permite <Link> dentro da propria zona e <a href> para fora', () => {
  passa(
    "import Link from 'next/link'\nexport function M() { return <Link href='/zona1/relatorios'>Relatorios</Link> }",
    'app/zona1/page.tsx',
    'zona1'
  )
  passa(
    "export function M() { return <a href='/zona2/tarefas'>Ir para Zona 2</a> }",
    'app/zona1/page.tsx',
    'zona1'
  )
})

test('P2-next-public: reprova variaveis NEXT_PUBLIC_ com termos sensiveis', () => {
  pega("const chave = process.env.NEXT_PUBLIC_API_KEY")
  pega("const token = process.env.NEXT_PUBLIC_AUTH_TOKEN")
  pega("const segredo = process.env.NEXT_PUBLIC_CLIENT_SECRET")
})

test('P2-next-public: so as NEXT_PUBLIC_ da lista permitida passam', () => {
  passa("const appName = process.env.NEXT_PUBLIC_APP_NAME")
  passa("const versao = process.env.NEXT_PUBLIC_APP_VERSION")
  pega("const t = process.env.NEXT_PUBLIC_BEARER")                       // XE39
  pega("const t = process.env.NEXT_PUBLIC_QUALQUER_OUTRA")
  pega("const t = process.env[`NEXT_PUBLIC_${nome}`]")
})

// --- contornos do auditor_b1_d1_2 (anexos/contornos-estatica.log): cada um reprova -------------
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('E01-E06: a diretiva e o import de servidor nao se contornam', () => {
  pega("'use client';\nimport 'server-only'")                                         // E01
  pega("// ilha\n/* comentario */\n'use client'\nimport { cookies } from 'next/headers'") // E02
  pega("'use client'\nimport { nucleo } from '@/lib/nucleo'")                          // E03 (lib é servidor)
  pega("'use client'\nimport { criarNucleo } from '@erp/nucleo'")                      // E04
  pega("'use client'\nexport { default } from 'server-only'")                          // E05
  pega("'use client'\nconst m = await import('next/headers')")                        // E06
  pega("'use client'\nconst m = await import(nome)")
  passa("'use client'\nimport { temPermissao } from '@erp/nucleo/permissoes'")
})

test('E03 transitivo: ilha que importa modulo local que chega ao servidor', () => {
  const app = mkdtempSync(join(tmpdir(), 'app-'))
  mkdirSync(join(app, 'app'))
  writeFileSync(join(app, 'app', 'util.ts'), "import { lerCookie } from './mais-fundo'\nexport const u = 1\n")
  writeFileSync(join(app, 'app', 'mais-fundo.ts'), "import 'server-only'\nexport const lerCookie = 1\n")
  writeFileSync(join(app, 'app', 'limpo.ts'), "export const x = 1\n")
  const ilha = join(app, 'app', 'Ilha.tsx')
  assert.ok(analisarSeguranca("'use client'\nimport { u } from './util'", ilha, null, { raizDaApp: app }).length > 0)
  assert.deepEqual(analisarSeguranca("'use client'\nimport { x } from './limpo'", ilha, null, { raizDaApp: app }), [])
})

test('E07-E10: DTO nao chega a ilha por spread, objeto inteiro ou nome parecido', () => {
  const ilha = { componentesCliente: ['Ilha'] }
  const pegaIlha = (f) => assert.ok(analisarSeguranca(f, 't.tsx', null, ilha).length > 0, f)
  pegaIlha('export function P({ recurso }) { return <Ilha {...recurso} /> }')              // E07
  pegaIlha('export function P({ recurso }) { return <Ilha recurso={recurso} /> }')          // E08
  pega('export function P({ r }) { return <Card {...{ custo: r.custo }} /> }')              // E09
  pega('export function P({ r }) { return <Card custoTotal={r.total} /> }')                // E10
  pega('export function P({ r }) { return <Card dados={{ cpf: r.cpf }} /> }')
  pegaIlha('export function P({ r }) { return <Ilha campos={{ ...r }} /> }')
  // projetado: literal, template, objeto literal de campos, ação importada de 'use server'
  const app = mkdtempSync(join(tmpdir(), 'app-'))
  mkdirSync(join(app, 'app'))
  writeFileSync(join(app, 'app', 'acoes.ts'), "'use server'\nexport async function acao() {}\n")
  assert.deepEqual(analisarSeguranca("import { acao } from './acoes'\nexport function P({ r }) { return <Ilha texto={`${r.n} itens`} campos={{ id: r.id, versao: String(r.v) }} acao={acao} /> }",
    join(app, 'app', 'p.tsx'), null, { ...ilha, raizDaApp: app }), [])
})

test('E12-E18: <Link> so com href literal da propria zona, com qualquer nome e tambem no shell', () => {
  const z1 = (f) => pega(f, 'app/zona1/page.tsx', 'zona1')
  z1("import Link from 'next/link'\nexport const M = () => <Link href={'/zona' + 2}>x</Link>")   // E12
  z1("import Link from 'next/link'\nexport const M = ({ z }) => <Link href={`/${z}`}>x</Link>")  // E13
  z1("import Link from 'next/link'\nconst d = '/zona2'\nexport const M = () => <Link href={d}>x</Link>") // E14
  z1("import Ir from 'next/link'\nexport const M = () => <Ir href='/zona2'>x</Ir>")              // E15
  z1("import LINK from 'next/link'\nexport const M = () => <LINK href='/acesso'>x</LINK>")       // E16
  pega("import Link from 'next/link'\nexport const M = () => <Link href='/zona1'>x</Link>", 'app/page.tsx', null) // E17
  z1("import Link from 'next/link'\nexport const M = () => <Link href={{ pathname: '/zona2' }}>x</Link>") // E18
  passa("import Link from 'next/link'\nexport const M = () => <Link href={'/zona1/relatorios'}>x</Link>", 'app/zona1/page.tsx', 'zona1')
})

test('E19-E22: NEXT_PUBLIC_ sensivel escrito de qualquer forma', () => {
  pega("const u = process.env['NEXT_PUBLIC_API_URL']")                 // E19
  pega("const u = process.env.NEXT_PUBLIC_DOMINIO_A_ORIGEM")           // E20
  pega("const { NEXT_PUBLIC_SECRET_X } = process.env")                 // E21
  pega("const t = process.env.NEXT_PUBLIC_ACCESS_ID")                  // E22
  pega("export default { env: { NEXT_PUBLIC_REDIS_URL: process.env.REDIS_URL } }", 'next.config.ts')
})

test('as quatro aplicacoes reais passam 100% nas regras estaticas de seguranca', () => {
  const violacoes = varrerSeguranca()
  assert.deepEqual(violacoes, [], `encontrou violacoes nas aplicacoes:\n${violacoes.join('\n')}`)
})

// --- contornos do auditor_b1_d1_3 (mutacoes.txt): cada um reprova -----------------------------
test('XE23-XE31/E10b/E10c (V4): so valor escalar vai para a ilha', () => {
  const app = mkdtempSync(join(tmpdir(), 'app-'))
  mkdirSync(join(app, 'app'))
  writeFileSync(join(app, 'app', 'Ilha.tsx'), "'use client'\nexport function Ilha() { return null }\n")
  writeFileSync(join(app, 'app', 'index.ts'), "export { Ilha as Outra } from './Ilha'\n")
  writeFileSync(join(app, 'app', 'dados.ts'), "export const pessoa = { cpf: '1' }\n")
  const pg = join(app, 'app', 'p.tsx')
  const pegaIlha = (f) => assert.ok(analisarSeguranca(f, pg, null, { raizDaApp: app }).length > 0, f)
  const imp = "import { Ilha } from './Ilha'\n"
  pegaIlha(imp + 'export const P = ({ p }) => <Ilha texto={`${p}`} />')                                  // XE23
  pegaIlha(imp + 'export const P = ({ p }) => <Ilha texto={String(JSON.stringify(p))} />')              // XE24
  pegaIlha(imp + 'export const P = ({ p }) => <Ilha campos={{ a: Object.assign({}, p) }} />')           // XE25
  pegaIlha(imp + 'export const P = ({ p }) => <Ilha campos={{ a: p.cpf }} />')                          // XE26
  pegaIlha(imp + 'export const P = ({ p }) => <Ilha>{p}</Ilha>')                                         // XE27
  pegaIlha(imp + 'export const P = ({ p }) => <Ilha>{JSON.stringify(p)}</Ilha>')
  pegaIlha("import { Outra } from './index'\nexport const P = ({ p }) => <Outra dados={p} />")          // XE28
  pegaIlha(imp + 'const I = Ilha\nexport const P = ({ p }) => <I dados={p} />')                         // XE29
  pegaIlha(imp + "import { pessoa } from './dados'\nexport const P = () => <Ilha dados={pessoa} />")   // XE30
  pegaIlha(imp + 'export const P = async ({ f }) => <Ilha campos={{ a: await f() }} />')                // XE31
  pegaIlha("import * as I from './Ilha'\nexport const P = ({ p }) => <I.Ilha dados={p} />")
  pegaIlha(imp + 'export const P = ({ p }) => <Ilha campos={{ cadastro: JSON.stringify(p) }} />')       // E10c
  pegaIlha(imp + 'export const P = ({ r }) => <Ilha texto={`${JSON.stringify(r)}`} />')                 // E10b
  // o que as apps reais fazem continua passando
  assert.deepEqual(analisarSeguranca(imp + 'export const P = ({ a, p, n }) => <Ilha texto={`${n.length} itens`} campos={{ acesso: a.id, versao: String(a.versao) }}>{a.situacao}{a.perfil ? ` · ${a.perfil}` : \'\'}<b aria-label={`x ${p.id}`} /></Ilha>',
    pg, null, { raizDaApp: app }), [])
})

test('XE32/XE33 (L6): ilha nao chega ao servidor por import = require nem pelo redis', () => {
  pega("'use client'\nimport m = require('next/headers')")
  pega("'use client'\nimport { createClient } from 'redis'")
})

test('V3 (E02, E02b, E02c): fora de app/, modulo que chega ao servidor declara server-only (pela arvore)', () => {
  const app = mkdtempSync(join(tmpdir(), 'app-'))
  mkdirSync(join(app, 'lib'))
  writeFileSync(join(app, 'lib', 'nucleo.ts'), "import 'server-only'\nexport const n = 1\n")
  const lib = join(app, 'lib', 'x.ts')
  const exigir = (f) => analisarSeguranca(f, lib, null, { raizDaApp: app, exigirServerOnly: true })
  for (const f of [
    "import { createClient } from 'redis'\nexport const c = 1",                          // E02
    "import { criarNucleo } from '@erp/nucleo'\nexport const n = 1",                     // E02b
    "import { nucleo } from './nucleo'\nexport const p = 1",                             // E02c (transitivo)
    "// import 'server-only'\nimport { cookies } from 'next/headers'",
    "const t = `\nimport 'server-only'\n`\nimport { cookies } from 'next/headers'",    // N08b/XF01
  ]) assert.ok(exigir(f).length > 0, f)
  assert.deepEqual(exigir("import 'server-only'\nimport { createClient } from 'redis'\nexport const c = 1"), [])
  assert.deepEqual(exigir("export const puro = 1"), [])
})

test('XE34-XE37 (L5): <Link> e navegacao de cliente para outra zona, por barril, namespace, apelido e router', () => {
  const app = mkdtempSync(join(tmpdir(), 'app-'))
  mkdirSync(join(app, 'app'))
  writeFileSync(join(app, 'app', 'nav.ts'), "export { default as Ir } from 'next/link'\n")
  const pg = join(app, 'app', 'zona1', 'page.tsx')
  const pegaZ1 = (f) => assert.ok(analisarSeguranca(f, pg, 'zona1', { raizDaApp: app }).length > 0, f)
  pegaZ1("import { Ir } from '../nav'\nexport const M = () => <Ir href='/zona2'>x</Ir>")            // XE34
  pegaZ1("import * as L from 'next/link'\nexport const M = () => <L.default href='/zona2'>x</L.default>") // XE35
  pegaZ1("import Link from 'next/link'\nconst Ir = Link\nexport const M = () => <Ir href='/zona2'>x</Ir>") // XE36
  pegaZ1("'use client'\nimport { useRouter } from 'next/navigation'\nexport function M() { const r = useRouter(); r.push('/zona2') }") // XE37
  pegaZ1("'use client'\nexport function M({ r, id }) { r.push(`/acesso/${id}`) }")
  assert.deepEqual(analisarSeguranca("'use client'\nexport function M({ r }) { r.push('/zona1/relatorios') }", pg, 'zona1', { raizDaApp: app }), [])
})

test('XE38/XE40 (V7): next.config nao embute valor do servidor no bundle', () => {
  const nc = (f) => pega(f, 'next.config.ts')
  nc("export default { env: { DOMINIO_A: process.env.DOMINIO_A_URL } }")                    // XE38
  nc("export default { compiler: { define: { API: process.env.DOMINIO_A_URL } } }")         // XE40
  nc("export default { webpack: (c) => c }")
  nc("import webpack from 'webpack'\nexport default { x: new webpack.DefinePlugin({}) }")
  nc("const env = {}\nexport default { env }")
  passa("export default { poweredByHeader: false, assetPrefix: '/zona1-static' }", 'next.config.ts')
})

test('V6/V7 (XR16, XE41): a varredura cobre a app inteira, nao so app/ e lib/', () => {
  const app = mkdtempSync(join(tmpdir(), 'app-'))
  mkdirSync(join(app, 'componentes'))
  mkdirSync(join(app, 'node_modules'))
  writeFileSync(join(app, 'componentes', 'x.ts'), "export const t = process.env.NEXT_PUBLIC_API_TOKEN\n")
  writeFileSync(join(app, 'node_modules', 'y.ts'), "export const t = 1\n")
  assert.deepEqual(fontesDaApp(app), [join(app, 'componentes', 'x.ts')])
})

test('V5 (P09): Server Action comeca pela verificacao e so toca o nucleo dentro dela', () => {
  const imp = "'use server'\nimport { nucleo } from '@/lib/nucleo'\nimport { acaoProtegida } from '@/lib/pagina'\n"
  const ok = imp + "export async function a(f) {\n  return acaoProtegida({ administra: true }, '/x', async () => {\n    await nucleo.destino('d').post('/v', {})\n    return { destino: '/x' }\n  })\n}"
  passa(ok, 'app/x/acoes.ts')
  // P09: o dominio antes da verificacao, por closure montada fora
  pega(imp + "const adm = (enviar) => acaoProtegida({ administra: true }, '/x', async () => { await enviar(); return { destino: '/x' } })\n" +
    "export async function a(f) { return adm(() => nucleo.destino('d').post('/v', {})) }", 'app/x/acoes.ts')
  pega(imp + "export async function a(f) {\n  await nucleo.destino('d').post('/v', {})\n  return acaoProtegida({ administra: true }, '/x', async () => ({ destino: '/x' }))\n}", 'app/x/acoes.ts')
  pega(imp + "export async function a(f) { const n = nucleo; return acaoProtegida({ administra: true }, '/x', async () => ({ destino: '/x' })) }", 'app/x/acoes.ts')
  pega(imp + "export const b = async () => ({ destino: '/x' })", 'app/x/acoes.ts')
  pega(imp + "const x = nucleo.destino('d')\n" + ok.slice(imp.length), 'app/x/acoes.ts')
})

// --- auditor_b1_d1_4: V3 (E10d, XE26), V5 (XN01p, XN02-XN04) ---
test('V3 (E10d, XE26): reprova campos complexos e objetos aninhados passados a ilhas', () => {
  pega("import { Ilha } from './Ilha'\nexport function P({ envio }) { return <Ilha extra={envio.lista} /> }", 'app/p.tsx', null, { componentesCliente: ['Ilha'] })
  pega("import { Ilha } from './Ilha'\nexport function P({ p }) { return <Ilha extra={{ a: p.cadastro }} /> }", 'app/p.tsx', null, { componentesCliente: ['Ilha'] })
  pega("import { Ilha } from './Ilha'\nexport function P() { return createElement(Ilha, { x: 1 }) }", 'app/p.tsx', null, { componentesCliente: ['Ilha'] })
  pega("const Ilha = dynamic(() => import('./Ilha'))\nexport function P() { return <Ilha /> }", 'app/p.tsx', null, { componentesCliente: ['Ilha'] })
})

test('V5 (XN01p): reprova atribuicao a .env no next.config e process.env fora da allowlist em use client', () => {
  pega("const config = {}; config.env = { ZONA2_INTERNO: 'x' }; export default config", 'next.config.ts')
  pega("const config = {}; config['env'] = { ZONA2_INTERNO: 'x' }; export default config", 'next.config.ts')
  pega("'use client'\nexport const db = process.env.DATABASE_URL")
  pega("'use client'\nexport const secret = process.env.APP_SECRET")
  passa("'use client'\nexport const name = process.env.NEXT_PUBLIC_APP_NAME")
})


test('V3 (K4, auditor_b1_d1_4): com o programa da app, o tipo decide o que vai a ilha, nao o nome do campo', () => {
  const app = mkdtempSync(join(tmpdir(), 'app-'))
  mkdirSync(join(app, 'app'))
  writeFileSync(join(app, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'react-jsx', strict: true, noEmit: true }, include: ['**/*.ts', '**/*.tsx'] }))
  writeFileSync(join(app, 'app', 'Ilha.tsx'), "'use client'\nexport function Ilha(_: Record<string, unknown>) { return null }\n")
  writeFileSync(join(app, 'app', 'tipos.ts'),
    'export type Envio = { titulo: string; total: number; ativo: boolean; nota?: string; resumo: { centro: string; custo: number }; recurso: { id: string } }\n')
  const imp = "import { Ilha } from './Ilha'\nimport type { Envio } from './tipos'\n"
  const casos = {
    resumo: [imp + 'export const P = ({ envio }: { envio: Envio }) => <Ilha extra={envio.resumo} />', true],
    recurso: [imp + 'export const P = ({ envio }: { envio: Envio }) => <Ilha campos={{ t: envio.recurso }} />', true],
    qualquer: [imp + 'export const P = ({ envio }: { envio: any }) => <Ilha extra={envio.titulo} />', true],
    escalares: [imp + 'export const P = ({ envio }: { envio: Envio }) => <Ilha a={envio.titulo} b={envio.total} c={envio.ativo} d={envio.nota} e={envio.resumo.centro} />', false],
  }
  const arquivos = Object.keys(casos).map((k) => { const f = join(app, 'app', `${k}.tsx`); writeFileSync(f, casos[k][0]); return f })
  const programa = programaDaApp(app, arquivos)
  for (const [k, [fonte, reprova]] of Object.entries(casos)) {
    const achados = analisarSeguranca(fonte, join(app, 'app', `${k}.tsx`), null, { raizDaApp: app, programa })
    assert.equal(achados.length > 0, reprova, `${k}: ${JSON.stringify(achados)}`)
  }
})
