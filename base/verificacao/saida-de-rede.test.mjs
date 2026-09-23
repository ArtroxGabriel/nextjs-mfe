// Testes do analisador N8 (saida-de-rede.mjs). Não precisam da base no ar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analisar, varrerAplicacoes, EXCECOES } from './saida-de-rede.mjs'

const pega = (fonte, nome) => assert.ok(analisar(fonte, nome).length > 0, `nao pegou:\n${fonte}`)
const passa = (fonte, nome) => assert.deepEqual(analisar(fonte, nome), [], `falso positivo:\n${fonte}`)

test('pega toda forma de chamar fetch que conheco, inclusive as que contornavam o regex', () => {
  for (const f of [
    "await fetch('http://x')",
    "await globalThis['fetch']('http://x')",           // o contorno encontrado no gate do shell
    "await globalThis.fetch('http://x')",
    "const f = globalThis.fetch; await f('http://x')",
    "const { fetch: f } = globalThis; await f('x')",
    "await window.fetch('x')",
    "await self['fetch']('x')",
    "const g = Reflect.get(globalThis, 'fetch'); await g('x')",
    "const k = 'fe' + 'tch'; await globalThis[k]('x')", // chave calculada
    "setTimeout(fetch, 0, 'x')",                         // passada como valor
    "await fetch `x`",
  ]) pega(f)
})

test('pega modulos de rede, estaticos e dinamicos, e as outras globais de rede', () => {
  for (const f of [
    "import http from 'node:http'",
    "import { request } from 'https'",
    "import axios from 'axios'",
    "export { request } from 'node:http'",
    "const { request } = await import('node:http')",
    "const h = require('http')",
    "const m = 'node:' + 'http'; await import(m)",       // especificador dinâmico
    "new WebSocket('ws://x')",
    "new EventSource('/x')",
    "new XMLHttpRequest()",
    "navigator.sendBeacon('/x', '')",
  ]) pega(f)
})

test('pega eval e Function, que montariam qualquer uma das anteriores em tempo de execucao', () => {
  pega("eval('fet' + 'ch(1)')")
  pega("new Function('return fetch')()")
})

test('nao acusa o uso normal da base', () => {
  passa("const r = await nucleo.destino('dominio-a').get('/v1/recursos/:id', { params: { id } })")
  passa("const site = h.get('sec-fetch-site')")                 // cabeçalho com "fetch" no nome
  passa("import { NextResponse } from 'next/server'")
  passa("function f(fetch: typeof globalThis.fetch) { return fetch('x') }".replace('typeof globalThis.fetch', 'unknown'))
  passa("const o = { busca: 1 }; o.busca")
  passa("// fetch direto seria errado\nconst x = 1")               // comentário não é código
  passa("type T = { fetch: number }")
  passa("export const dynamic = 'force-dynamic'")
}, )

test('tipos que citam fetch nao sao chamada', () => {
  passa("type F = typeof fetch")
  passa("let x: WebSocket | null = null")
})

test('as quatro aplicacoes reais nao tem saida de rede fora do registro (fora as excecoes declaradas)', () => {
  assert.deepEqual(varrerAplicacoes(), [])
})

test('as excecoes sao exatamente estas, cada uma com motivo e com o que permite; e cada uma e necessaria', () => {
  // XR17 (auditor_b1_d1_3): exceção nova passava só com um motivo longo. Agora a lista é fixa aqui:
  // acrescentar uma exige mudar este teste, e a revisão vê as duas coisas juntas.
  assert.deepEqual(Object.keys(EXCECOES).sort(), [
    'erp-shell/lib/redis.ts', 'erp-shell/lib/saude-zonas.ts', 'erp-zona-1/lib/redis.ts', 'erp-zona-1/scripts/registrar-manifesto.ts',
    'erp-zona-2/lib/redis.ts', 'erp-zona-2/scripts/registrar-manifesto.ts', 'erp-zona-acesso/lib/redis.ts',
  ])
  const { readFileSync } = require_('node:fs')
  for (const [arq, { motivo, permite }] of Object.entries(EXCECOES)) {
    assert.ok(motivo.length > 40, `${arq} sem motivo`)
    assert.ok(permite.length === 1 && ['fetch', 'redis'].includes(permite[0]), `${arq} permite ${permite}`)
    const achados = analisar(readFileSync(new URL(`../../repos/${arq}`, import.meta.url), 'utf8'), arq)
    assert.ok(achados.some((a) => a.coisa === permite[0]), `${arq}: a excecao nao e necessaria, remova-a de EXCECOES`)
  }
})

test('XR15 (V6): a excecao vale so para o que ela permite, nao para o arquivo', () => {
  const achados = analisar("import 'server-only'\nimport { createClient } from 'redis'\nawait fetch('http://fora')", 'lib/redis.ts')
  const sobra = achados.filter((a) => !EXCECOES['erp-zona-1/lib/redis.ts'].permite.includes(a.coisa))
  assert.ok(sobra.some((a) => /fetch/.test(a.motivo)), 'o fetch dentro de lib/redis.ts passou pela excecao')
})

test('XR08-XR12 (V6): apelido da global, getBuiltinModule, dns, biblioteca HTTP fora da lista, construtor de funcao', () => {
  pega("const g = globalThis; const k = 'fe' + 'tch'; await g[k]('x')")                // XR08
  pega("const h = process.getBuiltinModule('node:http')")                             // XR09
  pega("import { lookup } from 'node:dns'")                                           // XR10
  pega("import dns from 'dns'")
  pega("import { request } from 'undici-alternativo'")                                // XR11
  pega("const F = (() => {}).constructor; F('return 1')()")                           // XR12
  pega("const F = (async () => {})['constructor']")
  pega("import x = require('node:dns')")
  passa("import { randomUUID } from 'node:crypto'\nimport { NextResponse } from 'next/server'\nimport { nucleo } from '@/lib/nucleo'\nconst v = globalThis.crypto")
  passa("import type { Algo } from 'pacote-de-tipos'")
})

test('XR16 (V6): a varredura cobre a app inteira, inclusive pasta fora de app/ e lib/', () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = require_('node:fs')
  const { tmpdir } = require_('node:os')
  const { join } = require_('node:path')
  const raiz = mkdtempSync(join(tmpdir(), 'raiz-'))
  mkdirSync(join(raiz, 'erp-x', 'servicos'), { recursive: true })
  writeFileSync(join(raiz, 'erp-x', 'servicos', 'rede.ts'), "await fetch('http://fora')\n")
  assert.ok(varrerAplicacoes(['erp-x'], raiz).some((l) => l.startsWith('erp-x/servicos/rede.ts')))
})

import { createRequire } from 'node:module'
const require_ = createRequire(import.meta.url)

test('R01-R07 (auditor_b1_d1_2, V8): clientes de banco, global entregue a funcao, createRequire e child_process', () => {
  pega("import { createClient } from 'redis'")                                        // R01
  pega("import Redis from 'ioredis'")                                                // R02
  pega("import { Client } from 'pg'")                                                // R03
  pega("const f = Reflect.get(globalThis, 'fe' + 'tch')")                             // R04
  pega("const d = Object.getOwnPropertyDescriptor(globalThis, nome)")                 // R05
  pega("import { createRequire } from 'node:module'\nconst u = createRequire(import.meta.url)('undici')") // R06
  pega("import { execFile } from 'node:child_process'\nexecFile('curl', ['http://x'])") // R07
  pega("const cp = await import('child_process')")
})

test('toda excecao de store de sessao e mesmo o cliente Redis (a excecao nao sobra)', () => {
  const { readFileSync } = require_('node:fs')
  for (const arq of Object.keys(EXCECOES).filter((a) => a.endsWith('lib/redis.ts'))) {
    assert.ok(analisar(readFileSync(new URL(`../../repos/${arq}`, import.meta.url), 'utf8')).length > 0, `${arq} nao precisa de excecao`)
  }
})
