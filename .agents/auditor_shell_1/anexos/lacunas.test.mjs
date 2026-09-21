// Testes mínimos que fechariam as lacunas (rodados só na cópia). node --test lacunas.test.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn, execSync } from 'node:child_process'
const C = '/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad/repos-copia'
const { subir } = await import(`${C}/scripts/ambiente.mjs`)
const { pedir, entrar } = await import(`${C}/verificacao/apoio.mjs`)
let amb, coletor, recebidos = 0
before(async () => {
  coletor = createServer((req, res) => { recebidos++; req.resume(); req.on('end', () => res.end()) })
  await new Promise((ok) => coletor.listen(0, '127.0.0.1', ok))
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${coletor.address().port}`
  amb = await subir({ construir: false })
}, { timeout: 300_000 })
after(() => { amb?.derrubar(); coletor?.close() })

test('L1 gestao de acesso fora: nenhum dado de modulo no HTML, nem no payload RSC', async () => {
  const davi = (await entrar('davi')).cookie
  await amb.derrubarDominio('gestao-acesso')
  try {
    for (const c of ['/zona1', '/zona1/relatorios']) {
      const r = await pedir(c, { cookie: davi })
      assert.ok(!/Painel da zona 1|recursos no seu escopo/.test(r.html), `${c} entregou a pagina com a gestao de acesso fora`)
    }
  } finally { await amb.subirDominio('gestao-acesso') }
})

test('L3 flash forjado pelo cliente nao aparece nas paginas do proprio shell', async () => {
  const ana = (await entrar('ana')).cookie
  const falso = encodeURIComponent(JSON.stringify({ tipo: 'erro', texto: 'Forjado pelo cliente', id: 'x1' }))
  assert.ok(!(await pedir('/', { cookie: ana, cabecalhos: { 'x-erp-flash': falso } })).html.includes('Forjado pelo cliente'))
})

test('L4 telemetria: sem sessao descarta sem repassar; >256 KB sem Content-Length 413; 61o lote 429', async () => {
  recebidos = 0
  const post = (cookie, body, extra = {}) => fetch('http://localhost:3000/api/otel/v1/traces', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...extra }, body, duplex: 'half' })
  assert.equal((await post(null, '{}')).status, 204)
  if (process.env.REPASSE) assert.equal(recebidos, 0, 'lote sem sessao foi repassado ao coletor')
  const bruno = (await entrar('bruno')).cookie
  const grande = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(300 * 1024)); c.close() } })
  assert.equal((await post(bruno, grande)).status, 413)
  const carla = (await entrar('carla')).cookie
  let ultimo
  for (let i = 0; i < 61; i++) ultimo = await post(carla, '{}')
  assert.equal(ultimo.status, 429); assert.equal(ultimo.headers.get('retry-after'), '60')
})

test('L2 zona fora: 503 proprio (inclusive com outra caixa), as outras seguem, e volta em ~TTL', async () => {
  const ana = (await entrar('ana')).cookie
  const pid = execSync("ss -ltnpH 'sport = :3002' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2").toString().trim()
  process.kill(Number(pid), 'SIGKILL')
  await new Promise((r) => setTimeout(r, 1200))   // passa do TTL de 1 s
  for (const c of ['/zona2', '/zona2/x', ...(process.env.CAIXA ? ['/ZONA2'] : [])]) {
    const r = await fetch(`http://localhost:3000${c}`, { headers: { cookie: ana }, redirect: 'manual' })
    assert.equal(r.status, 503, c); assert.equal(r.headers.get('retry-after'), '5', c)
    assert.equal(r.headers.get('cache-control'), 'no-store', c)
    assert.match(await r.text(), /Zona temporariamente indisponível/, c)
  }
  for (const c of ['/', '/zona1']) assert.equal((await pedir(c, { cookie: ana })).status, 200, c)
  const p = spawn('pnpm', ['start'], { cwd: `${C}/erp-zona-2`, env: { ...process.env, SESSAO_DIR: amb.sessaoDir, ERP_PERMITIR_IDENTIDADE_DEV: '1' }, stdio: 'ignore', detached: true })
  try {
    const t0 = Date.now(); let st = 0
    while (Date.now() - t0 < 10_000 && st !== 200) { st = (await pedir('/zona2', { cookie: ana })).status; if (st !== 200) await new Promise((r) => setTimeout(r, 50)) }
    assert.equal(st, 200); assert.ok(Date.now() - t0 < 3000, `demorou ${Date.now() - t0} ms`)
  } finally { try { process.kill(-p.pid, 'SIGTERM') } catch {} }
})
