// auditor_shell_2: testes de unidade mínimos (sem servidor) para o que a unidade do shell não prende.
// Copiar para repos/erp-shell/test/ e rodar com `node --test test/*.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarCacheSaudeZona, TIMEOUT_PROBE_PADRAO_MS } from '../lib/saude-zonas.ts'
import { decidirAcaoDoProxy } from '../lib/decisao-proxy.ts'
import { carregarZonas, encontrarZonaPorCaminho } from '../lib/zonas.ts'

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

test('U1 (M3/M3b/M3c): entrada saudavel expira depois do TTL e a sonda roda de novo', async () => {
  let chamadas = 0
  const cache = criarCacheSaudeZona(50, 500, async () => { chamadas++; return { status: 200 } })
  await cache.verificar('http://z/zona2'); await esperar(80); await cache.verificar('http://z/zona2')
  assert.equal(chamadas, 2)
})

test('U2 (M3d): entrada "fora" tambem expira: a zona volta sem reiniciar o shell', async () => {
  let viva = false
  const cache = criarCacheSaudeZona(50, 500, async () => { if (!viva) throw new Error('ECONNREFUSED'); return { status: 200 } })
  assert.equal(await cache.verificar('http://z/zona2'), false)
  viva = true; await esperar(80)
  assert.equal(await cache.verificar('http://z/zona2'), true)
})

test('U3 (M15): status >= 500 conta como fora', async () => {
  const cache = criarCacheSaudeZona(1000, 500, async () => ({ status: 502 }))
  assert.equal(await cache.verificar('http://z/zona2'), false)
})

test('U4 (M14/M14b): zona travada e dada como fora em ~500 ms (timeout padrao da sonda)', async () => {
  assert.equal(TIMEOUT_PROBE_PADRAO_MS, 500)
  const travada = (_u, { signal } = {}) => new Promise((_, rej) => signal?.addEventListener('abort', () => rej(signal.reason)))
  const cache = criarCacheSaudeZona(1000, undefined, travada)
  const t0 = Date.now()
  const r = await Promise.race([cache.verificar('http://z/zona2'), esperar(2000).then(() => 'pendurou')])
  assert.equal(r, false)
  assert.ok(Date.now() - t0 < 1000, `levou ${Date.now() - t0} ms`)
})

test('U5 (M13): zona fora e asset estatico dela: 503, nao rewrite cru', async () => {
  const zonas = carregarZonas({ zona2: 'http://127.0.0.1:3002' }, {})
  const fora = { verificar: async () => false, limpar() {} }
  const d = await decidirAcaoDoProxy({ caminho: '/zona2-static/_next/a.js', temCookieSessao: false }, fora, zonas)
  assert.equal(d.acao, 'zona-inativa')
})

test('U6 (M18): /api fora de /api/otel e /api/auth continua exigindo cookie', async () => {
  const d = await decidirAcaoDoProxy({ caminho: '/api/stream', temCookieSessao: false }, { verificar: async () => true, limpar() {} }, [])
  assert.equal(d.acao, 'redirecionar-login')
})

test('U7 (reviewer_shell_2 achado 2): id de zona com maiuscula e casado, ou recusado na carga', () => {
  let zonas
  try { zonas = carregarZonas({ ZonaA: 'http://127.0.0.1:3009' }, {}) } catch { return }   // recusar também serve
  if (zonas.length === 0) return
  for (const c of ['/zonaa', '/ZonaA', '/ZONAA/x']) assert.ok(encontrarZonaPorCaminho(c, zonas), `${c} escapou da sonda`)
})
