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

test('as quatro aplicacoes reais passam 100% nas regras estaticas de seguranca', () => {
  const violacoes = varrerSeguranca()
  assert.deepEqual(violacoes, [], `encontrou violacoes nas aplicacoes:\n${violacoes.join('\n')}`)
})
