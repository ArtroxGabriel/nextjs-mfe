// Caminhos de falha da zona de demonstração (base/showcase/zona-demo.mjs) contra uma gestão de acesso falsa.
// Sem showcase: a falsa é um servidor `node:http` numa porta livre; o script roda como processo filho.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../showcase/zona-demo.mjs', import.meta.url))
const PORTA_DEMO = 3009
const PRAZO_MS = 8000
const STACK = /^\s+at /m

const escutar = (porta, host = '127.0.0.1', tratar) => new Promise((ok, falha) => {
  const s = createServer(tratar)
  s.once('error', falha)
  s.listen(porta, host, () => ok(s))
})
const fechar = (s) => new Promise((ok) => { s.closeAllConnections(); s.close(ok) })
const urlDe = (s) => `http://127.0.0.1:${s.address().port}`

/** Gestão de acesso falsa: `comportamento` define o status de POST e DELETE; `recebidas` registra o que chegou. */
const falsa = { servidor: null, comportamento: {}, recebidas: [] }
function configurar({ post = 201, del = 204 } = {}) {
  falsa.comportamento = { post, del }
  falsa.recebidas = []
}

let podeRodar = true
before(async () => {
  try { await fechar(await escutar(PORTA_DEMO)) } catch { podeRodar = false; return }
  falsa.servidor = await escutar(0, '127.0.0.1', (req, res) => {
    falsa.recebidas.push({ metodo: req.method, caminho: req.url, autorizacao: req.headers.authorization })
    req.resume()
    const status = req.method === 'POST' ? falsa.comportamento.post : req.method === 'DELETE' ? falsa.comportamento.del : 200
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(req.method === 'GET' ? '[]' : '{}')
  })
  process.env.ACESSO_URL = urlDe(falsa.servidor)
})
after(async () => { if (falsa.servidor) await fechar(falsa.servidor) })

/** Com a 3009 ocupada por outro processo, o teste pula com a razão (avaliado dentro do teste, depois do `before`). */
const pular = (t) => {
  if (podeRodar) return false
  t.skip(`a porta ${PORTA_DEMO} está ocupada por outro processo: feche-o para rodar estes testes`)
  return true
}

/** Roda o script como filho; `saida()` junta stdout e stderr; `ate(re)` espera a linha ou estoura o prazo. */
function filho(env = {}) {
  const p = spawn(process.execPath, [SCRIPT], { env: { ...process.env, ACESSO_URL: urlDe(falsa.servidor), ...env }, stdio: ['pipe', 'pipe', 'pipe'] })
  let texto = ''
  const observadores = []
  const acrescentar = (d) => { texto += d; observadores.forEach((f) => f()) }
  p.stdout.on('data', acrescentar)
  p.stderr.on('data', acrescentar)
  const saiu = new Promise((ok) => p.once('exit', (codigo, sinal) => { observadores.forEach((f) => f()); ok({ codigo, sinal }) }))
  const ate = (re) => new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error(`prazo esgotado esperando ${re}; saída até agora:\n${texto}`)), PRAZO_MS)
    const ver = () => { if (re.test(texto)) { clearTimeout(t); ok() } }
    observadores.push(ver)
    ver()
  })
  const esperarSaida = () => {
    let t
    const prazo = new Promise((_, falha) => { t = setTimeout(() => falha(new Error(`o filho não saiu no prazo; saída:\n${texto}`)), PRAZO_MS) })
    return Promise.race([saiu, prazo]).finally(() => clearTimeout(t))
  }
  return { p, saida: () => texto, ate, esperarSaida, recebidos: (metodo) => falsa.recebidas.filter((r) => r.metodo === metodo) }
}

/** O DELETE que chegou é o da rota `demo`, com a credencial da própria zona. */
function deleteDaDemo(del) {
  assert.equal(del.length, 1, 'a gestão de acesso deveria receber um DELETE')
  assert.equal(del[0].caminho, '/v2/zonas/demo/rota')
  assert.equal(del[0].autorizacao, 'Bearer svc.demo')
}

/** A zona demo responde de novo na 3009 (a saúde da zona de teste, sem passar pelo shell). */
async function responde() {
  const r = await fetch(`http://127.0.0.1:${PORTA_DEMO}/demo/api/health`, { signal: AbortSignal.timeout(2000) })
  assert.equal(r.status, 200, 'a zona demo deveria responder na 3009')
}

async function portaLivre() {
  const s = await escutar(PORTA_DEMO)
  await fechar(s)
}

test('ZD1: porta 3009 ocupada: sai 1 com mensagem clara, sem stack e sem falar com a gestão de acesso', async (t) => {
  if (pular(t)) return
  configurar()
  const ocupante = await escutar(PORTA_DEMO)
  const f = filho()
  try {
    const { codigo } = await f.esperarSaida()
    assert.equal(codigo, 1, f.saida())
    assert.match(f.saida(), /já está em uso/)
    assert.doesNotMatch(f.saida(), STACK)
    assert.equal(falsa.recebidas.filter((r) => r.metodo === 'POST').length, 0, 'não deveria registrar rota')
  } finally {
    f.p.kill('SIGKILL')
    await fechar(ocupante)
  }
})

test('ZD2: gestão de acesso fora do ar: sai 1 com mensagem clara, sem stack, e fecha a 3009', async (t) => {
  if (pular(t)) return
  configurar()
  const morto = await escutar(0)
  const urlMorta = urlDe(morto)
  await fechar(morto)
  const f = filho({ ACESSO_URL: urlMorta })
  try {
    const { codigo } = await f.esperarSaida()
    assert.equal(codigo, 1, f.saida())
    assert.match(f.saida(), /não consegui falar/)
    assert.doesNotMatch(f.saida(), STACK)
    await portaLivre()
  } finally { f.p.kill('SIGKILL') }
})

test('ZD3: registro recusado (403): não diz que registrou e fecha a 3009', async (t) => {
  if (pular(t)) return
  configurar({ post: 403 })
  const f = filho()
  try {
    const { codigo } = await f.esperarSaida()
    assert.notEqual(codigo, 0, f.saida())
    assert.doesNotMatch(f.saida(), /rota registrada/)
    await portaLivre()
  } finally { f.p.kill('SIGKILL') }
})

test('ZD4: DELETE recusado (500) ao sair: sai 1 e diz que não conseguiu remover', async (t) => {
  if (pular(t)) return
  configurar({ post: 201, del: 500 })
  const f = filho()
  try {
    await f.ate(/no ar/)
    f.p.kill('SIGINT')
    const { codigo } = await f.esperarSaida()
    assert.equal(codigo, 1, f.saida())
    assert.match(f.saida(), /Não consegui remover/)
  } finally { f.p.kill('SIGKILL') }
})

for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  test(`ZD5: ${sinal} remove a rota com a credencial da zona e sai 0`, async (t) => {
    if (pular(t)) return
    configurar({ post: 201, del: 204 })
    const f = filho()
    try {
      await f.ate(/no ar/)
      f.p.kill(sinal)
      const { codigo } = await f.esperarSaida()
      assert.equal(codigo, 0, f.saida())
      assert.match(f.saida(), /Rota removida/)
      deleteDaDemo(f.recebidos('DELETE'))
    } finally { f.p.kill('SIGKILL') }
  })
}

test('ZD7: fim da entrada depois de "no ar" remove a rota e sai 0', async (t) => {
  if (pular(t)) return
  configurar({ post: 201, del: 204 })
  const f = filho()
  try {
    await f.ate(/no ar/)
    f.p.stdin.end()
    const { codigo } = await f.esperarSaida()
    assert.equal(codigo, 0, f.saida())
    assert.equal(f.recebidos('DELETE').length, 1, 'o fim da entrada deveria remover a rota')
  } finally { f.p.kill('SIGKILL') }
})

test('ZD8: Enter derruba a zona e mantém a rota; Enter de novo a traz de volta; o SIGINT seguinte remove uma vez', async (t) => {
  if (pular(t)) return
  configurar({ post: 201, del: 204 })
  const f = filho()
  try {
    await f.ate(/no ar/)
    f.p.stdin.write('\n')
    await f.ate(/Zona derrubada/)
    assert.equal(f.recebidos('DELETE').length, 0, 'o Enter não pode remover a rota')
    await portaLivre()
    f.p.stdin.write('\n')
    await f.ate(/Zona de volta/)
    await responde()
    assert.equal(f.recebidos('DELETE').length, 0, 'a volta não pode remover a rota')
    f.p.kill('SIGINT')
    const { codigo } = await f.esperarSaida()
    assert.equal(codigo, 0, f.saida())
    deleteDaDemo(f.recebidos('DELETE'))
  } finally { f.p.kill('SIGKILL') }
})

test('ZD9: DELETE 404 (rota já ausente) é tolerado: SIGINT sai 0 e diz "Rota removida"', async (t) => {
  if (pular(t)) return
  configurar({ post: 201, del: 404 })
  const f = filho()
  try {
    await f.ate(/no ar/)
    f.p.kill('SIGINT')
    const { codigo } = await f.esperarSaida()
    assert.equal(codigo, 0, f.saida())
    assert.match(f.saida(), /Rota removida/)
  } finally { f.p.kill('SIGKILL') }
})

test('ZD6: derrubar() fecha a zona e mantém a rota (nenhum DELETE); voltar() a traz de volta; remover() com 500 lança', async (t) => {
  if (pular(t)) return
  configurar({ post: 201, del: 204 })
  const { subirZonaDemo } = await import('../showcase/zona-demo.mjs')
  const demo = await subirZonaDemo()
  try {
    await demo.derrubar()
    assert.equal(falsa.recebidas.filter((r) => r.metodo === 'DELETE').length, 0, 'derrubar não pode remover a rota')
    await demo.voltar()
    await responde()
    await demo.derrubar()
  } finally { await demo.remover() }
  deleteDaDemo(falsa.recebidas.filter((r) => r.metodo === 'DELETE'))
  await portaLivre()

  configurar({ post: 201, del: 500 })
  const outra = await subirZonaDemo()
  try {
    await assert.rejects(outra.remover(), /recusou remover/)
    await portaLivre()
  } finally { await outra.derrubar() }
})
