// Testes do analisador de segurança estática (B4 e B6 do plano).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analisarSeguranca, varrerSeguranca } from './seguranca-estatica.mjs'

const pega = (fonte, nome = 'teste.tsx', zona = null) =>
  assert.ok(analisarSeguranca(fonte, nome, zona).length > 0, `nao pegou violacao:\n${fonte}`)

const passa = (fonte, nome = 'teste.tsx', zona = null) =>
  assert.deepEqual(analisarSeguranca(fonte, nome, zona), [], `falso positivo:\n${fonte}`)

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

test('P2-next-public: permite variaveis NEXT_PUBLIC_ normais', () => {
  passa("const appName = process.env.NEXT_PUBLIC_APP_NAME")
  passa("const versao = process.env.NEXT_PUBLIC_APP_VERSION")
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
  // projetado: literal, template, objeto literal de campos, ação importada
  assert.deepEqual(analisarSeguranca("import { acao } from './acoes'\nexport function P({ r }) { return <Ilha texto={`${r.n} itens`} campos={{ id: r.id, versao: String(r.v) }} acao={acao} /> }",
    't.tsx', null, ilha), [])
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
