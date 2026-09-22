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

test('toda excecao declarada tem motivo, e a sonda de saude do shell e mesmo uma saida de rede', () => {
  for (const [arq, motivo] of Object.entries(EXCECOES)) assert.ok(motivo.length > 40, `${arq} sem motivo`)
  const { readFileSync } = require_('node:fs')
  const fonte = readFileSync(new URL('../../repos/erp-shell/lib/saude-zonas.ts', import.meta.url), 'utf8')
  assert.ok(analisar(fonte).length > 0, 'a excecao nao e necessaria: remova-a de EXCECOES')
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
