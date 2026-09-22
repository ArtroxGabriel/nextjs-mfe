// auditor_shell_3: testes mínimos para as mutações que sobreviveram (rodar SOZINHO, na cópia):
//   cp lacunas3.test.mjs <copia>/base/verificacao/ && node --test base/verificacao/lacunas3.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { subir, SHELL } from '../scripts/ambiente.mjs'
import { pedir, entrar } from './apoio.mjs'

let ambiente
before(async () => { ambiente = await subir({ construir: process.env.CONSTRUIR === '1' }) }, { timeout: 600_000 })
after(() => ambiente?.derrubar())

const pidNaPorta = (porta) => execFileSync('ss', ['-ltnpH', `sport = :${porta}`]).toString().match(/pid=(\d+)/)?.[1]

test('G6: gestao de acesso fora nao entrega o detalhe do recurso (pagina de modulo que o L1 nao visita)', async () => {
  const bruno = (await entrar('bruno')).cookie
  // dentes: no ar, o detalhe aparece
  assert.match((await pedir('/zona1/recursos/r-1', { cookie: bruno })).html, /Identificador:/)
  await ambiente.derrubarDominio('gestao-acesso')
  try {
    const r = await pedir('/zona1/recursos/r-1', { cookie: bruno })
    assert.ok(!/Identificador:|CC-10/.test(r.html), 'detalhe do recurso chegou com a gestao de acesso fora')
  } finally { await ambiente.subirDominio('gestao-acesso') }
})

test('G7: zona travada (aceita conexao e nao responde) vira 503 em menos de 2 s', { timeout: 30_000 }, async () => {
  const ana = (await entrar('ana')).cookie
  const pid = pidNaPorta(3002)
  assert.ok(pid, 'sem processo na 3002')
  process.kill(Number(pid), 'SIGSTOP')
  try {
    await new Promise((r) => setTimeout(r, 1200))   // passa do TTL
    const t0 = Date.now()
    const r = await fetch(`${SHELL}/zona2`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(5000) })
      .catch((e) => ({ status: `sem resposta (${e.name})` }))
    const ms = Date.now() - t0
    assert.equal(r.status, 503, `status ${r.status} em ${ms} ms`)
    assert.ok(ms < 2000, `levou ${ms} ms`)
  } finally { process.kill(Number(pid), 'SIGCONT') }
})

test('G9: nonce da CSP muda a cada requisicao (shell e rota publica)', async () => {
  const { cookie } = await entrar('ana')
  for (const [c, ck] of [['/', cookie], ['/login', undefined]]) {
    const n = async () => (await pedir(c, { cookie: ck })).csp?.match(/'nonce-([^']+)'/)?.[1]
    const [a, b] = [await n(), await n()]
    assert.ok(a && b, `${c} sem nonce`)
    assert.notEqual(a, b, `${c}: nonce repetido entre requisicoes`)
  }
})

test('G10 (prova de equivalencia do flash nas zonas): em /zona1 chegam dois Set-Cookie de remocao, do shell e da zona', async () => {
  const ana = (await entrar('ana')).cookie
  const flash = encodeURIComponent(JSON.stringify({ tipo: 'sucesso', texto: 'Uma vez so', id: 'f1' }))
  const r = await fetch(`${SHELL}/zona1`, { headers: { cookie: `${ana}; __Host-flash=${flash}` }, redirect: 'manual' })
  const todos = r.headers.getSetCookie().filter((c) => c.startsWith('__Host-flash='))
  console.log('G10 Set-Cookie __Host-flash:', JSON.stringify(todos))
  assert.ok(todos.some((c) => /Max-Age=0/i.test(c) && /;\s*Secure/i.test(c)), 'nenhuma remocao valida')
  for (const c of todos) assert.match(c, /;\s*Secure/i, `remocao sem Secure: ${c}`)
})
