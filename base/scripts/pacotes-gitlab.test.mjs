import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configuracao, instalar, migrarRegistro, publicar, verificar } from './pacotes.mjs'

const projeto = '/api/v4/projects/123/packages/npm/'
const grupo = '/api/v4/groups/456/-/packages/npm/'
const nome = '@erp/exemplo'
const commit = 'e'.repeat(40)
const hash = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`
const canonico = Buffer.from('bytes-canonicos-ficticios')
function fixture(t) {
  const raiz = mkdtempSync(join(tmpdir(), 'mira-gitlab-test-'))
  const repo = join(raiz, 'erp-exemplo')
  mkdirSync(join(repo, 'dist'), { recursive: true })
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: nome, version: '1.0.0', files: ['dist'], publishConfig: { registry: 'http://localhost:4873/' } }))
  const lock = `packages:\n  '@erp/exemplo@1.0.0':\n    resolution: {integrity: ${hash(canonico)}}\n`
  writeFileSync(join(repo, 'pnpm-lock.yaml'), lock)
  t.after(() => rmSync(raiz, { recursive: true, force: true }))
  return { raiz, repos: ['erp-exemplo'], repo, lock }
}
async function registro(t, { metaStatus, putStatus = 201, versoes = null, bytes = canonico, redirecionar, tarballExterno } = {}) {
  const pedidos = []
  let base
  let payload
  const servidor = createServer(async (req, res) => {
    const caminho = decodeURIComponent(req.url)
    const endpoint = [projeto, grupo].find((prefixo) => caminho.startsWith(prefixo))
    pedidos.push({ metodo: req.method, caminho, auth: req.headers.authorization })
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (!endpoint) return json(404, { message: 'rota inexistente' })
    if (caminho === `${projeto}${nome}/-/${nome}-1.0.0.tgz`) {
      if (redirecionar) { res.writeHead(302, { location: redirecionar }); res.end(); return }
      res.end(bytes); return
    }
    // Não existe GET /nome/versão neste registro.
    if (caminho !== `${endpoint}${nome}`) return json(404, { message: 'rota inexistente' })
    if (req.method === 'PUT' && endpoint === projeto) {
      const partes = []
      for await (const parte of req) partes.push(parte)
      payload = JSON.parse(Buffer.concat(partes).toString())
      const [anexo] = Object.values(payload._attachments)
      bytes = Buffer.from(anexo.data, 'base64')
      // Simula a corrida: o GET anterior não viu, mas o PUT encontra duplicado.
      versoes = { '1.0.0': {} }
      if (putStatus !== 201) return json(putStatus, { message: 'Package already exists.' })
      return json(201, {})
    }
    if (req.method !== 'GET') return json(405, {})
    if (metaStatus === 302) { res.writeHead(302, { location: redirecionar }); res.end(); return }
    if (metaStatus) return json(metaStatus, { message: 'erro ficticio' })
    if (!versoes) return json(404, { message: 'Package not found' })
    const versions = Object.fromEntries(Object.entries(versoes).map(([version, extra]) => [version, {
      name: nome, version, dist: {
        shasum: createHash('sha1').update(bytes).digest('hex'),
        tarball: (typeof tarballExterno === 'function' ? tarballExterno(base) : tarballExterno) ?? `${base}${projeto}${nome}/-/${nome}-1.0.0.tgz`,
      }, ...extra,
    }]))
    json(200, { name: nome, versions, 'dist-tags': { latest: Object.keys(versions).at(-1) } })
  })
  await new Promise((ok, falha) => { servidor.once('error', falha); servidor.listen(0, '127.0.0.1', ok) })
  base = `http://127.0.0.1:${servidor.address().port}`
  t.after(() => new Promise((ok) => { servidor.close(ok); servidor.closeAllConnections() }))
  const config = configuracao({ ERP_NPM_REGISTRY: `${base}${grupo}`, ERP_NPM_REGISTRY_PUBLICACAO: `${base}${projeto}`,
    ERP_NPM_TOKEN: 'leitura-ficticia', ERP_NPM_TOKEN_PUBLICACAO: 'escrita-ficticia' })
  return { config, pedidos, payload: () => payload }
}
function executarPublicacao(op, config) {
  const etapas = []
  const arquivosAuth = []
  const executar = async (bin, args, opts) => {
    etapas.push(args[0])
    assert.equal(opts.env.ERP_NPM_TOKEN_PUBLICACAO, undefined)
    assert.equal(opts.env.CI_JOB_TOKEN, undefined)
    assert.ok(args.every((arg) => !arg.includes(config.tokenPublicacao)))
    if (bin === 'git') return args[0] === 'status' ? '' : commit
    if (bin === 'pnpm') {
      mkdirSync(join(opts.cwd, 'dist'), { recursive: true })
      writeFileSync(join(opts.cwd, 'dist', 'index.js'), 'export const exemplo = 42\n')
      return
    }
    if (args[0] === 'publish') {
      assert.equal(args[args.indexOf('--registry') + 1], config.registroPublicacao)
      const auth = args[args.indexOf('--userconfig') + 1]
      arquivosAuth.push(auth)
      assert.equal(statSync(auth).mode & 0o777, 0o600)
      const url = new URL(config.registroPublicacao)
      assert.equal(readFileSync(auth, 'utf8'), `//${url.host}${url.pathname}:_authToken=${config.tokenPublicacao}\n`)
    }
    // npm pack e PUT de npm publish reais; cache isolado, nenhum registro externo.
    return await new Promise((ok, falha) => {
      const p = spawn(bin, [...args, '--fetch-retries=0'], { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...opts.env, npm_config_cache: join(op.raiz, 'cache') } })
      const saida = []
      p.stdout.on('data', (b) => saida.push(b))
      p.stderr.resume()
      p.once('error', falha)
      p.once('close', (code) => code === 0 ? ok(Buffer.concat(saida).toString()) : falha(new Error(`npm falhou (${code})`)))
    })
  }
  return { executar, etapas, arquivosAuth }
}

test('GitLab preserva prefixos de projeto/grupo e valida HTTPS em ambos os enderecos', () => {
  const registro = `https://gitlab.exemplo${grupo}`
  const publicacao = `https://gitlab.exemplo${projeto}`
  assert.equal(configuracao({ ERP_NPM_REGISTRY: publicacao.slice(0, -1) }).registroPublicacao, publicacao)
  assert.equal(configuracao({ ERP_NPM_REGISTRY: registro }).registroPublicacao, registro)
  for (const chave of ['ERP_NPM_REGISTRY', 'ERP_NPM_REGISTRY_PUBLICACAO']) {
    for (const url of ['http://gitlab.exemplo', 'http://localhost.evil', 'https://user:senha@gitlab.exemplo', 'https://gitlab.exemplo/?token=x', 'https://gitlab.exemplo/#x']) {
      assert.throws(() => configuracao({ ERP_NPM_REGISTRY: registro, [chave]: url }), /HTTPS/)
    }
  }
})

test('GitLab versao existente na metadata nunca chega ao build; GET por versao e inexistente', async (t) => {
  const op = fixture(t)
  const r = await registro(t, { versoes: { '1.0.0': {}, '2.0.0': {} } })
  let execucoes = 0
  await assert.rejects(publicar({ ...op, config: r.config, executar: () => { execucoes++ } }), /ja publicado/)
  assert.equal(execucoes, 0)
  assert.deepEqual(r.pedidos.map((p) => p.caminho), [`${projeto}${nome}`])
})

for (const ausente of [true, false]) {
  test(`GitLab publica por PUT no projeto: ${ausente ? '404 de pacote' : 'versao ausente da metadata'}`, { timeout: 15000 }, async (t) => {
    const op = fixture(t)
    const r = await registro(t, { versoes: ausente ? null : { '0.9.0': {} } })
    const exec = executarPublicacao(op, r.config)
    await publicar({ ...op, config: r.config, executar: exec.executar })
    const put = r.pedidos.findIndex((p) => p.metodo === 'PUT')
    assert.ok(put >= 2, 'preflight e reconsulta devem ocorrer antes do PUT')
    assert.ok(r.pedidos.slice(0, put).every((p) => p.metodo === 'GET' && p.caminho === `${projeto}${nome}`))
    assert.deepEqual(r.pedidos.slice(put).map((p) => [p.metodo, p.caminho]), [
      ['PUT', `${projeto}${nome}`], ['GET', `${projeto}${nome}`], ['GET', `${projeto}${nome}/-/${nome}-1.0.0.tgz`],
    ])
    assert.ok(r.pedidos.every((p) => p.auth === `Bearer ${r.config.tokenPublicacao}`))
    assert.equal(r.payload().versions['1.0.0'].erpOrigem.commit, commit)
    assert.equal(r.payload().versions['1.0.0'].publishConfig.registry, r.config.registroPublicacao)
    assert.equal(exec.arquivosAuth.length, 1)
    assert.ok(exec.arquivosAuth.every((p) => !existsSync(p)))
  })
}

for (const status of [403, 409]) {
  test(`GitLab PUT duplicado HTTP ${status} interrompe e remove auth`, { timeout: 15000 }, async (t) => {
    const op = fixture(t)
    const r = await registro(t, { putStatus: status })
    const exec = executarPublicacao(op, r.config)
    await assert.rejects(publicar({ ...op, config: r.config, executar: exec.executar }), /npm falhou/)
    assert.equal(r.pedidos.filter((p) => p.metodo === 'PUT').length, 1)
    assert.equal(r.pedidos.at(-1).metodo, 'PUT', 'duplicado não deve chegar à confirmação')
    assert.ok(exec.arquivosAuth.every((p) => !existsSync(p)))
    assert.equal(readFileSync(join(op.repo, 'pnpm-lock.yaml'), 'utf8'), op.lock)
  })
}

for (const status of [401, 403, 500, 503]) {
  test(`GitLab metadata HTTP ${status} nao significa ausencia`, async (t) => {
    const op = fixture(t)
    const r = await registro(t, { metaStatus: status })
    let execucoes = 0
    await assert.rejects(publicar({ ...op, config: r.config, executar: () => { execucoes++ } }), new RegExp(`HTTP ${status}`))
    assert.equal(execucoes, 0)
  })
}

test('GitLab instalacao por grupo autentica projeto do tarball e prova SHA-512 dos bytes', async (t) => {
  const op = fixture(t)
  const r = await registro(t, { versoes: { '1.0.0': {} } })
  let execucoes = 0
  await assert.rejects(instalar({ ...op, config: r.config, executar: () => { execucoes++ } }), /GitLab exige URL de tarball/)
  assert.equal(execucoes, 0)
  await migrarRegistro({ ...op, config: r.config })
  const migrado = readFileSync(join(op.repo, 'pnpm-lock.yaml'), 'utf8')
  assert.ok(migrado.includes(hash(canonico)))
  assert.ok(migrado.includes(`tarball: ${r.config.registroPublicacao}${nome}/-/${nome}-1.0.0.tgz`))
  r.pedidos.length = 0
  let auth
  await instalar({ ...op, config: r.config, executar: (_bin, args) => {
    assert.ok(args.includes(`--config.@erp:registry=${r.config.registro}`))
    auth = args[args.indexOf('--userconfig') + 1]
    assert.equal(statSync(auth).mode & 0o777, 0o600)
    const url = new URL(r.config.registro)
    // leitura no grupo (instalação) e no projeto (tarballs); nunca o token de publicação
    assert.equal(readFileSync(auth, 'utf8'), `//${url.host}${grupo}:_authToken=${r.config.token}\n//${url.host}${projeto}:_authToken=${r.config.token}\n`)
  } })
  assert.deepEqual(r.pedidos.map((p) => p.caminho), [`${grupo}${nome}`, `${projeto}${nome}/-/${nome}-1.0.0.tgz`])
  assert.ok(r.pedidos.every((p) => p.auth === `Bearer ${r.config.token}`))
  assert.equal(existsSync(auth), false)
})

test('GitLab shasum SHA-1 nao substitui SHA-512 canonico nem autoriza instalacao de bytes diferentes', async (t) => {
  const op = fixture(t)
  const r = await registro(t, { versoes: { '1.0.0': {} }, bytes: Buffer.from('bytes-adulterados') })
  const lock = op.lock.replace(`integrity: ${hash(canonico)}`, `integrity: ${hash(canonico)}, tarball: ${r.config.registroPublicacao}${nome}/-/${nome}-1.0.0.tgz`)
  writeFileSync(join(op.repo, 'pnpm-lock.yaml'), lock)
  let execucoes = 0
  await assert.rejects(instalar({ ...op, config: r.config, executar: () => { execucoes++ } }), /integrity diverge/)
  assert.equal(execucoes, 0)
  assert.equal(readFileSync(join(op.repo, 'pnpm-lock.yaml'), 'utf8'), lock)
})

for (const tipo of ['metadata', 'tarball']) {
  test(`GitLab redirect de ${tipo} nao e seguido nem amplia credencial`, async (t) => {
    const op = fixture(t)
    const destino = await registro(t, { versoes: { '1.0.0': {} } })
    const r = await registro(t, { versoes: { '1.0.0': {} }, metaStatus: tipo === 'metadata' ? 302 : undefined,
      redirecionar: destino.config.registro })
    await assert.rejects(verificar({ ...op, config: r.config }), /HTTP 302/)
    assert.equal(destino.pedidos.length, 0)
  })
}

test('GitLab metadata nao pode ampliar caminhos da credencial nem injetar texto no lock', async (t) => {
  const op = fixture(t)
  const destino = await registro(t)
  const r = await registro(t, { versoes: { '1.0.0': {} }, tarballExterno: destino.config.registro })
  await assert.rejects(verificar({ ...op, config: r.config }), /fora dos registros/)
  assert.equal(destino.pedidos.length, 0)
  assert.equal(r.pedidos.length, 1)
  for (const tarballExterno of [(base) => `${base}/api/v4/projects/999/packages/npm/exemplo.tgz`,
    (base) => `${base}${projeto}exemplo.tgz?token=x`, (base) => `${base}${projeto}exemplo.tgz#x`,
    (base) => `${base}${projeto}exemplo.tgz\nsettings: {ignore: true}`]) {
    const falso = await registro(t, { versoes: { '1.0.0': {} }, tarballExterno })
    await assert.rejects(migrarRegistro({ ...op, config: falso.config }), /fora dos registros/)
    assert.equal(falso.pedidos.length, 1)
    assert.equal(readFileSync(join(op.repo, 'pnpm-lock.yaml'), 'utf8'), op.lock)
  }
})

const { fixtureAuth, pnpmDisponivel } = await import('./pnpm-auth-fixture.mjs')
test('GitLab pnpm real instala por grupo com tarball autenticado no projeto e lock SHA-512 congelado', {
  skip: pnpmDisponivel() ? false : 'pnpm ausente: instalacao real nao exercitada', timeout: 30000,
}, async () => {
  await fixtureAuth(async ({ dir, registro, registroPublicacao, token, integrity, pedidos }) => {
    const repo = join(dir, 'consumidor')
    mkdirSync(repo)
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'consumidor', private: true, dependencies: { '@erp/fixture': '1.0.0' } }))
    writeFileSync(join(repo, 'pnpm-workspace.yaml'), `storeDir: ${JSON.stringify(join(dir, 'store'))}\ncacheDir: ${JSON.stringify(join(dir, 'cache'))}\nfetchRetries: 0\n`)
    const lock = `lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .:\n    dependencies:\n      '@erp/fixture':\n        specifier: 1.0.0\n        version: 1.0.0\npackages:\n  '@erp/fixture@1.0.0':\n    resolution: {integrity: ${integrity}}\nsnapshots:\n  '@erp/fixture@1.0.0': {}\n`
    writeFileSync(join(repo, 'pnpm-lock.yaml'), lock)
    const op = { raiz: dir, repos: ['consumidor'], config: configuracao({ ERP_NPM_REGISTRY: registro,
      ERP_NPM_REGISTRY_PUBLICACAO: registroPublicacao, ERP_NPM_TOKEN: token }) }
    await migrarRegistro(op)
    const migrado = readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8')
    assert.equal(migrado, lock.replace(`integrity: ${integrity}`, `integrity: ${integrity}, tarball: ${registroPublicacao}@erp/fixture/-/@erp/fixture-1.0.0.tgz`))
    pedidos.length = 0
    await instalar(op)
    assert.match(readFileSync(join(repo, 'node_modules/@erp/fixture/index.js'), 'utf8'), /42/)
    assert.equal(readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8'), migrado)
    assert.ok(pedidos.every((p) => p.authorization))
    assert.ok(pedidos.some((p) => p.url.startsWith(grupo)))
    assert.ok(pedidos.filter((p) => p.url.endsWith('.tgz')).length >= 2, 'preflight e pnpm precisam baixar os bytes')
    assert.ok(pedidos.filter((p) => p.url.endsWith('.tgz')).every((p) => p.url.startsWith(projeto)))
  }, { gitlab: true })
})
