import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configuracao, instalar, inventario, migrarRegistro, publicar, verificar } from './pacotes.mjs'

const bytes = Buffer.from('artefato-canonico-ficticio')
const hash = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
const outroHash = `sha512-${createHash('sha512').update('outro').digest('base64')}`

function fixture(t, hashLock = hash, tarball = '') {
  const raiz = mkdtempSync(join(tmpdir(), 'mira-pacotes-test-'))
  t.after(() => rmSync(raiz, { recursive: true, force: true }))
  mkdirSync(join(raiz, 'erp-exemplo', 'dist'), { recursive: true })
  writeFileSync(join(raiz, 'erp-exemplo', 'dist', 'index.js'), 'export const exemplo = 1\n')
  writeFileSync(join(raiz, 'erp-exemplo', 'package.json'), JSON.stringify({ name: '@erp/exemplo', version: '1.0.0', files: ['dist'], publishConfig: { registry: 'http://localhost:4873' } }))
  writeFileSync(join(raiz, 'erp-exemplo', 'pnpm-lock.yaml'), `packages:\n\n  '@erp/exemplo@1.0.0':\n    resolution: {integrity: ${hashLock}${tarball ? `, tarball: ${tarball}` : ''}}\n`)
  return { raiz, repos: ['erp-exemplo'] }
}

async function registro(t, responder = () => ({ name: '@erp/exemplo', version: '1.0.0', dist: { integrity: hash } })) {
  const pedidos = []
  const servidor = createServer(async (req, res) => {
    pedidos.push({ url: req.url, auth: req.headers.authorization })
    const resposta = await responder(req)
    res.writeHead(resposta.status ?? 200, resposta.headers ?? { 'content-type': 'application/json' })
    res.end(JSON.stringify(resposta.body ?? resposta))
  })
  await new Promise((ok, falha) => { servidor.once('error', falha); servidor.listen(0, '127.0.0.1', ok) })
  t.after(() => new Promise((ok) => { servidor.close(ok); servidor.closeAllConnections() }))
  const config = configuracao({ ERP_NPM_REGISTRY: `http://127.0.0.1:${servidor.address().port}` })
  return { config, pedidos }
}

test('registro externo exige HTTPS; CI nao cai silenciosamente no Verdaccio local', () => {
  assert.equal(configuracao({}).registro, 'http://localhost:4873/')
  assert.equal(configuracao({ ERP_NPM_REGISTRY: 'https://registry.example/npm' }).registro, 'https://registry.example/npm/')
  for (const url of ['http://registry.example', 'ftp://localhost', 'https://usuario:segredo@r.example', 'https://r.example/?token=x', 'https://r.example/#x']) {
    assert.throws(() => configuracao({ ERP_NPM_REGISTRY: url }), /HTTPS/)
  }
  assert.throws(() => configuracao({ CI: 'true' }), /CI exige/)
  assert.throws(() => configuracao({ ERP_NPM_TOKEN: 'segredo\nchave=x' }), /TOKEN invalido/)
  for (const prazo of ['0', 'NaN', '1.5', '120001']) assert.throws(() => configuracao({ ERP_NPM_TIMEOUT_MS: prazo }), /TIMEOUT/)
})

test('inventario inclui versoes transitivas e recusa hashes divergentes entre repositorios', (t) => {
  const op = fixture(t)
  assert.equal(inventario(op.raiz, op.repos)[0].integrity, hash)
  mkdirSync(join(op.raiz, 'outro'))
  writeFileSync(join(op.raiz, 'outro', 'pnpm-lock.yaml'), readFileSync(join(op.raiz, 'erp-exemplo', 'pnpm-lock.yaml'), 'utf8').replace(hash, outroHash))
  assert.throws(() => inventario(op.raiz, [...op.repos, 'outro']), /lockfiles divergem/)
})

test('hash diferente impede instalacao e preserva lockfile e node_modules', async (t) => {
  const op = fixture(t, outroHash)
  const { config } = await registro(t)
  const arquivo = join(op.raiz, 'erp-exemplo', 'pnpm-lock.yaml')
  const antes = readFileSync(arquivo, 'utf8')
  let execucoes = 0
  await assert.rejects(instalar({ ...op, config, executar: () => { execucoes++ } }), /integrity diverge/)
  assert.equal(execucoes, 0)
  assert.equal(readFileSync(arquivo, 'utf8'), antes)
})

test('instalacao usa lock congelado, registro por escopo e arquivo privado removido ao terminar', async (t) => {
  const op = fixture(t)
  const { config, pedidos } = await registro(t)
  config.token = 'token-de-leitura-ficticio'
  let auth
  let execucoes = 0
  await instalar({ ...op, config, executar: (binario, args, opts) => {
    execucoes++
    assert.equal(binario, 'pnpm')
    assert.ok(args.includes('--frozen-lockfile'))
    assert.ok(args.includes(`--config.@erp:registry=${config.registro}`))
    assert.equal(opts.env.ERP_NPM_TOKEN, undefined)
    assert.ok(args.every((a) => !a.includes(config.token)))
    auth = args[args.indexOf('--userconfig') + 1]
    assert.equal(statSync(auth).mode & 0o777, 0o600)
    assert.ok(readFileSync(auth, 'utf8').includes(config.token))
  } })
  assert.equal(execucoes, 1)
  assert.equal(pedidos[0].auth, `Bearer ${config.token}`)
  assert.equal(existsSync(auth), false)
})

test('falha do instalador tambem remove autenticacao temporaria', async (t) => {
  const op = fixture(t)
  const { config } = await registro(t)
  let auth
  await assert.rejects(instalar({ ...op, config, executar: (_bin, args) => {
    auth = args[args.indexOf('--userconfig') + 1]
    throw new Error('instalacao falhou')
  } }), /instalacao falhou/)
  assert.equal(existsSync(auth), false)
})

test('versao existente, 401 e 500 nunca chegam ao build ou publish', async (t) => {
  for (const status of [200, 401, 500]) {
    const op = fixture(t)
    const { config } = await registro(t, () => ({ status }))
    let execucoes = 0
    await assert.rejects(publicar({ ...op, config, executar: () => { execucoes++ } }), status === 200 ? /ja publicado/ : /HTTP/)
    assert.equal(execucoes, 0)
  }
})

test('redirect do registro nao recebe token nem e seguido', async (t) => {
  const destino = await registro(t)
  const origem = await registro(t, () => ({ status: 302, headers: { location: destino.config.registro } }))
  const op = fixture(t)
  origem.config.token = 'token-ficticio'
  await assert.rejects(verificar({ ...op, config: origem.config }), /HTTP 302/)
  assert.equal(destino.pedidos.length, 0)
})

test('migracao tira URL local somente com metadata canonica; nunca modifica hash', async (t) => {
  const op = fixture(t, hash, 'http://localhost:4873/@erp/exemplo/-/exemplo-1.0.0.tgz')
  const { config } = await registro(t)
  await assert.rejects(verificar({ ...op, config }), /outro registro/)
  await migrarRegistro({ ...op, config })
  const lock = readFileSync(join(op.raiz, 'erp-exemplo', 'pnpm-lock.yaml'), 'utf8')
  assert.ok(lock.includes(hash))
  assert.ok(!lock.includes('tarball:'))
  assert.equal(await verificar({ ...op, config }), 1)
})

test('tarball de publicacao troca destino local, registra commit e publica os bytes preparados uma vez', async (t) => {
  const op = fixture(t)
  const commit = 'a'.repeat(40)
  let publicado = false
  const { config } = await registro(t, () => publicado ? { name: '@erp/exemplo', version: '1.0.0', dist: { integrity: hash }, erpOrigem: { commit } } : { status: 404 })
  config.tokenPublicacao = 'token-de-escrita-ficticio'
  let auth
  let packs = 0
  let destino
  await publicar({ ...op, config, executar: (bin, args, opts) => {
    assert.equal(opts.env.ERP_NPM_TOKEN_PUBLICACAO, undefined)
    assert.ok(args.every((a) => !a.includes(config.tokenPublicacao)))
    if (bin === 'git') return args[0] === 'status' ? '' : commit
    if (bin === 'pnpm') { assert.deepEqual(args, ['build']); return }
    if (args[0] === 'pack') {
      packs++
      const pkg = JSON.parse(readFileSync(join(opts.cwd, 'package.json'), 'utf8'))
      assert.equal(pkg.publishConfig.registry, config.registro)
      assert.equal(pkg.erpOrigem.commit, commit)
      assert.equal(pkg.scripts, undefined)
      destino = args[args.indexOf('--pack-destination') + 1]
      writeFileSync(join(destino, 'erp-exemplo-1.0.0.tgz'), bytes)
      return JSON.stringify([{ filename: 'erp-exemplo-1.0.0.tgz' }])
    }
    assert.equal(args[0], 'publish')
    assert.deepEqual(readFileSync(args[1]), bytes)
    auth = args[args.indexOf('--userconfig') + 1]
    assert.equal(statSync(auth).mode & 0o777, 0o600)
    publicado = true
  } })
  assert.equal(packs, 1)
  assert.equal(existsSync(auth), false)
  assert.equal(existsSync(destino), false)
})
