import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function pnpmDisponivel() {
  try { return execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim() } catch (erro) {
    if (erro.code === 'ENOENT') return null
    throw erro
  }
}
export function executarAsync(bin, args, opts = {}) {
  return new Promise((ok, falha) => {
    const p = spawn(bin, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    for (const s of [p.stdout, p.stderr]) s.on('data', (b) => { output += b })
    p.on('error', falha)
    p.on('close', (code) => ok({ code, output }))
  })
}
export async function fixtureAuth(usar) {
  const dir = mkdtempSync(join(process.env.P1_SCRATCH ?? tmpdir(), 'pnpm-auth-'))
  const token = 'fixture-pnpm-sem-segredo'
  const pedidos = []
  const pacote = join(dir, 'pacote')
  mkdirSync(pacote)
  writeFileSync(join(pacote, 'package.json'), JSON.stringify({ name: '@erp/fixture', version: '1.0.0' }))
  writeFileSync(join(pacote, 'index.js'), 'module.exports = 42\n')
  execFileSync('tar', ['-czf', join(dir, 'fixture.tgz'), '--transform=s,^,package/,', 'package.json', 'index.js'], { cwd: pacote })
  const bytes = readFileSync(join(dir, 'fixture.tgz'))
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  let registro
  const servidor = createServer((req, res) => {
    const autorizado = req.headers.authorization === `Bearer ${token}`
    pedidos.push({ url: req.url, authorization: autorizado, presente: Boolean(req.headers.authorization) })
    if (!autorizado) { res.writeHead(401); res.end('{}'); return }
    if (req.url.endsWith('.tgz')) { res.writeHead(200); res.end(bytes); return }
    const meta = { name: '@erp/fixture', version: '1.0.0', dist: { integrity, tarball: `${registro}fixture.tgz` } }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(req.url.endsWith('/1.0.0') ? meta : {
      name: '@erp/fixture', 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': meta },
    }))
  })
  try {
    // Toda porta candidata é conferida; nunca encerrar um listener encontrado.
    let porta
    do { porta = 45000 + Math.floor(Math.random() * 15000) }
    while (execFileSync('ss', ['-H', '-ltnp', `sport = :${porta}`], { encoding: 'utf8' }).trim())
    await new Promise((ok, falha) => { servidor.once('error', falha); servidor.listen(porta, '127.0.0.1', ok) })
    registro = `http://127.0.0.1:${porta}/`
    const auth = join(dir, 'auth.ini')
    const conteudoAuth = `//127.0.0.1:${porta}/:_authToken=${token}\n`
    writeFileSync(auth, conteudoAuth, { mode: 0o600 })
    return await usar({ dir, token, pedidos, registro, auth, conteudoAuth, integrity })
  } finally {
    await new Promise((ok) => { servidor.close(ok); servidor.closeAllConnections() })
    rmSync(dir, { recursive: true, force: true })
  }
}
