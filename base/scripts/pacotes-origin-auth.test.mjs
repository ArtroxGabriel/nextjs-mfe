import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configuracao, instalar, publicar } from './pacotes.mjs'

const bytes = Buffer.from('artefato-ficticio-da-revisao')
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
const commit = 'f'.repeat(40)
function fixture(t) {
  const raiz = mkdtempSync(join(tmpdir(), 'mira-origin-auth-'))
  const repo = join(raiz, 'erp-exemplo')
  mkdirSync(repo)
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: '@erp/exemplo', version: '1.0.0', files: ['dist'] }))
  t.after(() => rmSync(raiz, { recursive: true, force: true }))
  return { raiz, repos: ['erp-exemplo'], repo }
}
function publicacao(t, gitlab, origem) {
  const op = fixture(t)
  const config = configuracao({ ERP_NPM_REGISTRY: gitlab ? 'https://gitlab.exemplo/api/v4/groups/456/-/packages/npm/' : 'https://registro.exemplo/leitura/',
    ERP_NPM_REGISTRY_PUBLICACAO: gitlab ? 'https://gitlab.exemplo/api/v4/projects/123/packages/npm/' : 'https://registro.exemplo/publicacao/',
    ERP_NPM_TOKEN_PUBLICACAO: 'escrita-ficticia' })
  let publicado = false
  let auth
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(String(url), `${config.registroPublicacao}${encodeURIComponent('@erp/exemplo')}`)
    const meta = { name: '@erp/exemplo', version: '1.0.0', dist: { integrity }, ...(origem === undefined ? {} : { erpOrigem: origem }) }
    return new Response(JSON.stringify({ name: '@erp/exemplo', versions: { '1.0.0': meta } }), { status: publicado ? 200 : 404 })
  })
  const executar = (_bin, args, opts) => {
    if (args[0] === 'status') return ''
    if (args[0] === 'rev-parse') return commit
    if (args[0] === 'build') {
      mkdirSync(join(op.repo, 'dist'))
      writeFileSync(join(op.repo, 'dist/index.js'), 'export const exemplo = 42')
      return
    }
    if (args[0] === 'pack') {
      const pkg = JSON.parse(readFileSync(join(opts.cwd, 'package.json'), 'utf8'))
      assert.equal(pkg.erpOrigem.commit, commit)
      const destino = args[args.indexOf('--pack-destination') + 1]
      writeFileSync(join(destino, 'erp-exemplo-1.0.0.tgz'), bytes)
      return JSON.stringify([{ filename: 'erp-exemplo-1.0.0.tgz' }])
    }
    assert.equal(args[0], 'publish')
    auth = args[args.indexOf('--userconfig') + 1]
    const url = new URL(config.registroPublicacao)
    assert.equal(statSync(auth).mode & 0o777, 0o600)
    assert.equal(readFileSync(auth, 'utf8'), `//${url.host}${url.pathname}:_authToken=${config.tokenPublicacao}\n`)
    publicado = true
  }
  return { op, config, executar, auth: () => auth }
}

test('origem obrigatoria fora do GitLab: metadata sem erpOrigem recusa confirmacao', async (t) => {
  const f = publicacao(t, false, undefined)
  await assert.rejects(publicar({ ...f.op, config: f.config, executar: f.executar }), /nao confirmou/)
  assert.equal(existsSync(f.auth()), false)
})
for (const gitlab of [false, true]) {
  test(`origem presente divergente sempre e recusada: GitLab=${gitlab}`, async (t) => {
    const f = publicacao(t, gitlab, { commit: 'a'.repeat(40) })
    await assert.rejects(publicar({ ...f.op, config: f.config, executar: f.executar }), /nao confirmou/)
  })
  test(`auth somente no endpoint de publicacao: GitLab=${gitlab}`, async (t) => {
    const f = publicacao(t, gitlab, { commit })
    await publicar({ ...f.op, config: f.config, executar: f.executar })
    assert.equal(existsSync(f.auth()), false)
  })
}
test('somente GitLab aceita origem ausente quando os bytes confirmados coincidem', async (t) => {
  const f = publicacao(t, true, undefined)
  await publicar({ ...f.op, config: f.config, executar: f.executar })
})
test('instalacao: token de leitura na instalacao e no caminho dos tarballs; nunca o de publicacao', async (t) => {
  const op = fixture(t)
  const config = configuracao({ ERP_NPM_REGISTRY: 'https://registro.exemplo/leitura/',
    ERP_NPM_REGISTRY_PUBLICACAO: 'https://registro.exemplo/publicacao/', ERP_NPM_TOKEN: 'leitura-ficticia',
    ERP_NPM_TOKEN_PUBLICACAO: 'escrita-ficticia' })
  writeFileSync(join(op.repo, 'pnpm-lock.yaml'), `packages:\n  '@erp/exemplo@1.0.0':\n    resolution: {integrity: ${integrity}}\n`)
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ name: '@erp/exemplo', versions: {
    '1.0.0': { name: '@erp/exemplo', version: '1.0.0', dist: { integrity } },
  } })))
  let auth
  await instalar({ ...op, config, executar: (_bin, args) => {
    auth = args[args.indexOf('--userconfig') + 1]
    assert.equal(statSync(auth).mode & 0o777, 0o600)
    assert.equal(readFileSync(auth, 'utf8'), '//registro.exemplo/leitura/:_authToken=leitura-ficticia\n//registro.exemplo/publicacao/:_authToken=leitura-ficticia\n')
  } })
  assert.equal(existsSync(auth), false)
})
