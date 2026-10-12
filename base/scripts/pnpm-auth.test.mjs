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
