import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixtureAuth, executarAsync, pnpmDisponivel } from './pnpm-auth-fixture.mjs'

const versao = pnpmDisponivel()
if (!versao) throw new Error('pnpm ausente: sonda nao executada')
await fixtureAuth(async ({ dir, pedidos, registro, auth, conteudoAuth }) => {
  const resultados = []
  for (const mecanismo of ['--config.npmrcAuthFile', '--config.npmrc-auth-file', '--userconfig', 'npm_config_userconfig', '.npmrc']) {
    for (const operacao of ['view', 'install']) {
      const cwd = join(dir, `${resultados.length}`)
      mkdirSync(cwd)
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'sonda', private: true, dependencies: { '@erp/fixture': '1.0.0' } }))
      const env = { ...process.env, CI: 'true' }
      delete env.npm_config_userconfig
      delete env.NPM_CONFIG_USERCONFIG
      const args = operacao === 'view' ? ['view', '@erp/fixture', 'version'] : ['install', '--ignore-scripts', `--store-dir=${join(cwd, 'store')}`]
      args.push(`--config.registry=${registro}`, `--config.@erp:registry=${registro}`, '--config.fetch-retries=0')
      if (mecanismo.startsWith('--')) args.push(`${mecanismo}=${auth}`)
      else if (mecanismo === 'npm_config_userconfig') env.npm_config_userconfig = auth
      else writeFileSync(join(cwd, '.npmrc'), conteudoAuth, { mode: 0o600 })
      const inicio = pedidos.length
      const { code } = await executarAsync('pnpm', args, { cwd, env })
      resultados.push({ mecanismo, operacao, code, pedidos: pedidos.slice(inicio) })
    }
  }
  console.log(JSON.stringify({ pnpm: versao, resultados }, null, 2))
})
