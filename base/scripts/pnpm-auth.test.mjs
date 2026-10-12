import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixtureAuth, executarAsync, pnpmDisponivel } from './pnpm-auth-fixture.mjs'

const versao = pnpmDisponivel()
test('pnpm real instala fixture com Authorization e lock congelado via pacotes.instalar', {
  skip: versao ? false : 'pnpm ausente no PATH: prova HTTP real nao executada',
}, async () => {
  await fixtureAuth(async ({ dir, registro, token, auth, pedidos }) => {
    const repo = join(dir, 'fixture')
    mkdirSync(repo)
    writeFileSync(join(repo, 'pnpm-workspace.yaml'), `storeDir: ${JSON.stringify(join(dir, 'store'))}\ncacheDir: ${JSON.stringify(join(dir, 'cache'))}\nfetchRetries: 0\n`)
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'consumidor', private: true, dependencies: { '@erp/fixture': '1.0.0' } }))
    const lock = await executarAsync('pnpm', ['install', '--lockfile-only', '--ignore-scripts', '--userconfig', auth,
      `--config.@erp:registry=${registro}`, '--config.fetch-retries=0'], { cwd: repo, env: { ...process.env, CI: 'true' } })
    assert.equal(lock.code, 0, lock.output)
    const antes = readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8')
    pedidos.length = 0
    const modulo = new URL('./pacotes.mjs', import.meta.url).href
    const instalacao = await executarAsync(process.execPath, ['--input-type=module', '-e',
      `import { instalar, configuracao } from ${JSON.stringify(modulo)}; await instalar({ raiz: process.env.FIXTURE_RAIZ, repos: ['fixture'], config: configuracao() })`], {
      cwd: repo, env: { ...process.env, CI: 'true', FIXTURE_RAIZ: dir, ERP_NPM_REGISTRY: registro, ERP_NPM_TOKEN: token,
        npm_config_store_dir: join(dir, 'store'), npm_config_fetch_retries: '0' },
    })
    assert.equal(instalacao.code, 0, instalacao.output)
    assert.equal(readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8'), antes)
    assert.match(readFileSync(join(repo, 'node_modules/@erp/fixture/index.js'), 'utf8'), /42/)
    assert.ok(pedidos.some((p) => p.url.endsWith('.tgz')), 'tarball nao foi solicitado')
    assert.ok(pedidos.length >= 2)
    assert.ok(pedidos.every((p) => p.authorization), 'requisicao sem Bearer de fixture')
    // Com specifier divergente, só uma instalação congelada deve recusar a fixture.
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'consumidor', private: true, dependencies: { '@erp/fixture': '^1.0.0' } }))
    const recusada = await executarAsync(process.execPath, ['--input-type=module', '-e',
      `import { instalar, configuracao } from ${JSON.stringify(modulo)}; await instalar({ raiz: process.env.FIXTURE_RAIZ, repos: ['fixture'], config: configuracao() })`], {
      cwd: repo, env: { ...process.env, CI: 'false', FIXTURE_RAIZ: dir, ERP_NPM_REGISTRY: registro, ERP_NPM_TOKEN: token,
        npm_config_store_dir: join(dir, 'store'), npm_config_fetch_retries: '0' },
    })
    assert.notEqual(recusada.code, 0, 'pnpm real aceitou lockfile desatualizado')
    assert.match(recusada.output, /OUTDATED_LOCKFILE|FROZEN_LOCKFILE/)
    assert.equal(readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8'), antes)

  })
})

for (const adulterado of [false, true]) {
  test(`redirect de tarball real: sem Authorization no destino; bytes ${adulterado ? 'adulterados recusados' : 'canonicos aceitos'}`, {
    skip: versao ? false : 'pnpm ausente: download real nao exercitado', timeout: 30000,
  }, async (t) => {
    const { createServer } = await import('node:http')
    const { execFileSync } = await import('node:child_process')
    const chamadas = []
    let bytesDestino
    const destino = createServer((req, res) => {
      chamadas.push({ authorization: Boolean(req.headers.authorization) })
      res.end(bytesDestino)
    })
    execFileSync('ss', ['-ltnp'])
    await new Promise((ok, falha) => { destino.once('error', falha); destino.listen(0, '127.0.0.1', ok) })
    t.after(() => new Promise((ok) => { destino.close(ok); destino.closeAllConnections() }))
    await fixtureAuth(async ({ dir, registro, token, integrity }) => {
      const repo = join(dir, 'fixture')
      mkdirSync(repo)
      writeFileSync(join(repo, 'pnpm-workspace.yaml'), `storeDir: ${JSON.stringify(join(dir, 'store'))}\ncacheDir: ${JSON.stringify(join(dir, 'cache'))}\nfetchRetries: 0\n`)
      writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'consumidor', private: true, dependencies: { '@erp/fixture': '1.0.0' } }))
      const lock = `lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .:\n    dependencies:\n      '@erp/fixture':\n        specifier: 1.0.0\n        version: 1.0.0\npackages:\n  '@erp/fixture@1.0.0':\n    resolution: {integrity: ${integrity}}\nsnapshots:\n  '@erp/fixture@1.0.0': {}\n`
      writeFileSync(join(repo, 'pnpm-lock.yaml'), lock)
      const modulo = new URL('./pacotes.mjs', import.meta.url).href
      const r = await executarAsync(process.execPath, ['--input-type=module', '-e',
        `import { instalar, configuracao } from ${JSON.stringify(modulo)}; await instalar({ raiz: process.env.FIXTURE_RAIZ, repos: ['fixture'], config: configuracao() })`], {
        cwd: repo, signal: t.signal, env: { ...process.env, CI: 'true', FIXTURE_RAIZ: dir, ERP_NPM_REGISTRY: registro, ERP_NPM_TOKEN: token,
          npm_config_store_dir: join(dir, 'store'), npm_config_fetch_retries: '0' },
      })
      assert.ok(chamadas.length > 0, `destino do redirect nao foi consultado: ${r.output.split(token).join('<token-mascarado>')}`)
      assert.ok(chamadas.every((c) => !c.authorization), 'Authorization chegou ao destino')
      assert.equal(readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8'), lock)
      if (adulterado) {
        assert.notEqual(r.code, 0)
        assert.match(r.output, /TARBALL_INTEGRITY|integrity check failed/i)
      } else {
        assert.equal(r.code, 0, r.output)
        assert.match(readFileSync(join(repo, 'node_modules/@erp/fixture/index.js'), 'utf8'), /42/)
      }
    }, { interceptar(req, res, { bytes }) {
      if (!req.url.endsWith('.tgz')) return false
      bytesDestino = adulterado ? Buffer.concat([bytes, Buffer.from('bytes-adulterados')]) : bytes
      res.writeHead(302, { location: `http://127.0.0.1:${destino.address().port}/fixture.tgz` })
      res.end()
      return true
    } })
  })
}
