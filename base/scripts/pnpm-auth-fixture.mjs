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
    let erro
    p.on('error', (e) => { erro = e })
    p.on('close', (code) => erro ? falha(erro) : ok({ code, output }))
  })
}
export async function fixtureAuth(usar, { interceptar, gitlab = false } = {}) {
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
  let registroPublicacao
  const servidor = createServer((req, res) => {
    const autorizado = req.headers.authorization === `Bearer ${token}`
    pedidos.push({ url: req.url, authorization: autorizado, presente: Boolean(req.headers.authorization) })
    if (!autorizado) { res.writeHead(401); res.end('{}'); return }
    if (interceptar?.(req, res, { bytes, integrity, registro })) return
    if (gitlab && req.url.endsWith('.tgz') && req.url !== `${new URL(registroPublicacao).pathname}@erp/fixture/-/@erp/fixture-1.0.0.tgz`) { res.writeHead(404); res.end('{}'); return }
    if (req.url.endsWith('.tgz')) { res.writeHead(200); res.end(bytes); return }
    const meta = { name: '@erp/fixture', version: '1.0.0', dist: { ...(gitlab ? { shasum: createHash('sha1').update(bytes).digest('hex') } : { integrity }), tarball: gitlab ? `${registroPublicacao}@erp/fixture/-/@erp/fixture-1.0.0.tgz` : `${registroPublicacao}fixture.tgz` } }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(req.url.endsWith('/1.0.0') ? meta : {
      name: '@erp/fixture', 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': meta },
    }))
  })
  try {
    // Porta efêmera reservada pelo kernel; nenhum listener alheio é administrado.
    await new Promise((ok, falha) => { servidor.once('error', falha); servidor.listen(0, '127.0.0.1', ok) })
    const porta = servidor.address().port
    const base = `http://127.0.0.1:${porta}/`
    registro = gitlab ? `${base}api/v4/groups/456/-/packages/npm/` : base
    registroPublicacao = gitlab ? `${base}api/v4/projects/123/packages/npm/` : base
    const auth = join(dir, 'auth.ini')
    const conteudoAuth = [...new Set([registro, registroPublicacao])].map((endereco) => {
      const url = new URL(endereco)
      return `//${url.host}${url.pathname}:_authToken=${token}\n`
    }).join('')
    writeFileSync(auth, conteudoAuth, { mode: 0o600 })
    return await usar({ dir, token, pedidos, registro, registroPublicacao, auth, conteudoAuth, integrity })
  } finally {
    await new Promise((ok) => { servidor.close(ok); servidor.closeAllConnections() })
    rmSync(dir, { recursive: true, force: true })
  }
}
