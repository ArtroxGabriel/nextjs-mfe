// auditor_shell_2: testes mínimos para as lacunas que a iteração 2 deixou. Formato de base/verificacao.
//   node --test base/verificacao/lacunas2.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { subir, SHELL as SHELL_URL } from '../scripts/ambiente.mjs'
import { pedir, entrar } from './apoio.mjs'

let ambiente, coletor
const lotes = []
before(async () => {
  coletor = createServer((req, res) => { const b = []; req.on('data', (c) => b.push(c)); req.on('end', () => { lotes.push(Buffer.concat(b).toString()); res.end() }) })
  await new Promise((ok) => coletor.listen(0, '127.0.0.1', ok))
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${coletor.address().port}`
  ambiente = await subir({ construir: process.env.CONSTRUIR === '1' })
}, { timeout: 600_000 })
after(() => { ambiente?.derrubar(); coletor?.close() })

// G1: L1 só olha a zona 1. A zona 2 e a de acesso têm o mesmo exigirModulo.
test('G1: gestao de acesso fora nao entrega pagina de modulo na zona 2 nem na zona de acesso', async () => {
  const quem = { davi: (await entrar('davi')).cookie, ana: (await entrar('ana')).cookie, carla: (await entrar('carla')).cookie }
  await ambiente.derrubarDominio('gestao-acesso')
  try {
    for (const [u, cookie] of Object.entries(quem)) {
      const z2 = (await pedir('/zona2', { cookie })).html
      assert.ok(!/Conferir inventário|Revisar cadastro|Concluir e ir/.test(z2), `${u} /zona2: tarefas chegaram com a gestao de acesso fora`)
      const ac = (await pedir('/acesso', { cookie })).html
      assert.ok(!/Zonas registradas|Módulos: restrição/.test(ac), `${u} /acesso: catalogo chegou com a gestao de acesso fora`)
    }
  } finally { await ambiente.subirDominio('gestao-acesso') }
})

// G2: a CSP do shell (e a das rotas públicas) com as diretivas que o documento promete.
test('G2: CSP do shell com form-action e img-src, inclusive em /login', async () => {
  const { cookie } = await entrar('ana')
  for (const [c, ck] of [['/', cookie], ['/login', undefined]]) {
    const csp = (await pedir(c, { cookie: ck })).csp ?? ''
    for (const d of ["form-action 'self'", "img-src 'self' data:", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) {
      assert.ok(csp.includes(d), `${c}: CSP sem ${d}: ${csp}`)
    }
    assert.match(csp, /'nonce-[^']+'/, `${c}: CSP sem nonce`)
  }
})

// G3: o shell consome o flash e o apaga com um Set-Cookie que o navegador aceita (__Host- exige Secure).
test('G3: flash nas paginas do shell aparece uma vez e o apagamento vem com Secure', async () => {
  const { cookie } = await entrar('ana')
  const flash = encodeURIComponent(JSON.stringify({ tipo: 'sucesso', texto: 'Toast do shell', id: 'g3' }))
  const r = await pedir('/', { cookie: `${cookie}; __Host-flash=${flash}` })
  assert.equal((r.html.match(/Toast do shell/g) ?? []).length >= 1, true, 'o shell nao mostrou o flash')
  const apaga = r.cookies.find((c) => c.startsWith('__Host-flash='))
  assert.ok(apaga, 'o shell nao apagou o cookie de flash')
  assert.match(apaga, /Max-Age=0/i)
  assert.match(apaga, /;\s*Secure/i, `Set-Cookie de __Host- sem Secure e recusado pelo navegador: ${apaga}`)
})

const post = (cookie, body, extra = {}) => fetch(`${SHELL_URL}/api/otel/v1/traces`, {
  method: 'POST', body, duplex: 'half', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...extra },
})
const assentar = () => new Promise((r) => setTimeout(r, 200))

// G4: 400 para nao-JSON sem repasse; o 61º lote nao chega ao coletor
test('G4: telemetria: nao-JSON da 400 e nao repassa; lote recusado por taxa nao repassa', async () => {
  const davi = (await entrar('davi')).cookie
  lotes.length = 0
  assert.equal((await post(davi, 'isto nao e json')).status, 400)
  await assentar()
  assert.equal(lotes.length, 0, 'corpo nao-JSON foi repassado ao coletor')

  const bruno = (await entrar('bruno')).cookie
  lotes.length = 0
  let ultimo
  for (let i = 0; i < 61; i++) ultimo = await post(bruno, `{"i":${i}}`)
  await assentar()
  assert.equal(ultimo.status, 429)
  assert.equal(lotes.length, 60, `lote recusado por taxa chegou ao coletor (${lotes.length} lotes)`)

})

// G5: a volta da zona depende do TTL da entrada "fora" (M3d) e a queda do TTL da entrada "ok" (M3).
// L2 já cobre as duas; aqui, o asset estático de zona morta (M13) e o acesso pela sonda em /zona2-static.
test('G5: zona fora: asset estatico dela tambem da 503 (a sonda vem antes do corte de asset)', async () => {
  await ambiente.derrubarApp('erp-zona-2')
  try {
    await new Promise((r) => setTimeout(r, 1200))
    for (const c of ['/zona2-static/_next/static/x.js', '/ZONA2-STATIC/a.css']) {
      const r = await fetch(`${SHELL_URL}${c}`, { redirect: 'manual' })
      assert.equal(r.status, 503, c)
      assert.equal(r.headers.get('retry-after'), '5', c)
    }
  } finally { await ambiente.subirApp('erp-zona-2') }
})
