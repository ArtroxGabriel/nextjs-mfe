// auditor_shell_4: testes mínimos para o que sobreviveu na iteração 4 (rodar SOZINHO, na cópia):
//   cp lacunas4.test.mjs <copia>/base/verificacao/ && node --test base/verificacao/lacunas4.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { subir, SHELL } from '../scripts/ambiente.mjs'
import { pedir, entrar } from './apoio.mjs'

let ambiente
before(async () => { ambiente = await subir({ construir: process.env.CONSTRUIR === '1' }) }, { timeout: 600_000 })
after(() => ambiente?.derrubar())

test('G11: gestao de acesso fora nao entrega pagina dinamica de modulo irma de uma literal (/zona1/[secao])', async () => {
  // So tem sentido com a pagina nova de anexos/np-cadeia.sh; sem ela o teste reprova nos dentes (404).
  const davi = (await entrar('davi')).cookie
  assert.match((await pedir('/zona1/secao-qualquer', { cookie: davi })).html, /Secao do modulo/, 'dentes: com a gestao no ar davi ve a secao')
  await ambiente.derrubarDominio('gestao-acesso')
  try {
    const r = await pedir('/zona1/secao-qualquer', { cookie: davi })
    assert.ok(!/Secao do modulo|Recurso do/.test(r.html), `conteudo de /zona1/[secao] chegou com a gestao de acesso fora (status ${r.status})`)
  } finally { await ambiente.subirDominio('gestao-acesso') }
})

test('G12: nonce da CSP imprevisivel (nao sequencial, sem prefixo comum longo)', async () => {
  const { cookie } = await entrar('ana')
  for (const c of ['/', '/login', '/zona1']) {
    const ns = []
    for (let i = 0; i < 6; i++) ns.push((await pedir(c, { cookie: c === '/login' ? undefined : cookie })).csp?.match(/'nonce-([^']+)'/)?.[1])
    assert.ok(ns.every(Boolean), `${c} sem nonce`)
    assert.equal(new Set(ns).size, ns.length, `${c}: nonce repetido`)
    for (let i = 1; i < ns.length; i++) {
      let p = 0
      while (p < ns[i].length && ns[i][p] === ns[i - 1][p]) p++
      assert.ok(p < 8, `${c}: nonces consecutivos com ${p} caracteres de prefixo comum (${ns[i - 1]} / ${ns[i]})`)
    }
  }
})

test('G13: nonce da CSP muda a cada requisicao tambem nas zonas', async () => {
  const { cookie } = await entrar('ana')
  for (const c of ['/zona1', '/zona2']) {
    const n = async () => (await pedir(c, { cookie })).csp?.match(/'nonce-([^']+)'/)?.[1]
    const [a, b] = [await n(), await n()]
    assert.ok(a && b, `${c} sem nonce`)
    assert.notEqual(a, b, `${c}: nonce repetido entre requisicoes`)
  }
})

test('G14: zona travada vira 503 em menos de 1 s (sonda de 500 ms, §1.1 e §8)', { timeout: 30_000 }, async () => {
  const ana = (await entrar('ana')).cookie
  ambiente.congelarApp('erp-zona-2')
  try {
    await new Promise((r) => setTimeout(r, 1200))
    const t0 = Date.now()
    const r = await fetch(`${SHELL}/zona2`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(5000) })
      .catch((e) => ({ status: `sem resposta (${e.name})` }))
    const ms = Date.now() - t0
    assert.equal(r.status, 503, `status ${r.status} em ${ms} ms`)
    assert.ok(ms < 1000, `levou ${ms} ms`)
  } finally { ambiente.descongelarApp('erp-zona-2') }
})
