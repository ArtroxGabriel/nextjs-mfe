import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as pausa } from 'node:timers/promises'
import { fixtureAuth, pnpmDisponivel } from './pnpm-auth-fixture.mjs'

const modulo = new URL('./pacotes.mjs', import.meta.url).href
const pnpm = pnpmDisponivel()
const skip = pnpm ? false : 'pnpm ausente: processos reais nao exercitados'
function descendentes(pid) {
  try {
    const ids = readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean).map(Number)
    return ids.flatMap((id) => [id, ...descendentes(id)])
  } catch (erro) { if (erro.code === 'ENOENT') return []; throw erro }
}
function arquivos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(dir, item.name)
    return item.isDirectory() ? arquivos(caminho) : [caminho]
  })
}
function preparar(dir, integrity, publicacao) {
  const repo = join(dir, 'fixture')
  mkdirSync(repo)
  writeFileSync(join(repo, 'pnpm-workspace.yaml'), `storeDir: ${JSON.stringify(join(dir, 'store'))}\ncacheDir: ${JSON.stringify(join(dir, 'cache'))}\nfetchRetries: 0\n`)
  if (publicacao) {
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: '@erp/fixture', version: '1.0.0', files: ['dist'], scripts: {
      build: `node -e "require('fs').mkdirSync('dist');require('fs').writeFileSync('dist/index.js','module.exports=42')"`,
    } }))
    writeFileSync(join(repo, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters:\n  .: {}\n")
    writeFileSync(join(repo, '.gitignore'), 'dist\n')
    execFileSync('git', ['init', '-q'], { cwd: repo })
    execFileSync('git', ['add', 'package.json', 'pnpm-lock.yaml', '.gitignore', 'pnpm-workspace.yaml'], { cwd: repo })
    execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'test(fixture): prepare package'], { cwd: repo })
  } else {
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'consumidor', private: true, dependencies: { '@erp/fixture': '1.0.0' } }))
    writeFileSync(join(repo, 'pnpm-lock.yaml'), `lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .:\n    dependencies:\n      '@erp/fixture':\n        specifier: 1.0.0\n        version: 1.0.0\npackages:\n  '@erp/fixture@1.0.0':\n    resolution: {integrity: ${integrity}}\nsnapshots:\n  '@erp/fixture@1.0.0': {}\n`)
  }
  return repo
}

for (const operacao of ['instalar', 'publicar']) {
  for (const sinal of ['SIGINT', 'SIGTERM']) {
    test(`${sinal} durante ${operacao} real remove auth e aguarda os filhos proprios`, { skip, timeout: 30000 }, async (t) => {
      let pendente
      const pedidoPendente = new Promise((ok) => { pendente = ok })
      await fixtureAuth(async ({ dir, registro, token, integrity }) => {
        const repo = preparar(dir, integrity, operacao === 'publicar')
        const tmp = join(dir, 'tmp')
        mkdirSync(tmp)
        const lock = readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8')
        const p = spawn(process.execPath, ['--input-type=module', '-e',
          `import { ${operacao}, configuracao } from ${JSON.stringify(modulo)}; await ${operacao}({ raiz: process.env.FIXTURE_RAIZ, repos: ['fixture'], config: configuracao() })`], {
          cwd: repo, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, CI: 'true', FIXTURE_RAIZ: dir, TMPDIR: tmp, ERP_NPM_REGISTRY: registro,
            ERP_NPM_TOKEN: token, ERP_NPM_TOKEN_PUBLICACAO: token, npm_config_cache: join(dir, 'cache'),
            npm_config_store_dir: join(dir, 'store'), npm_config_fetch_retries: '0' },
        })
        const fim = once(p, 'exit')
        let output = ''
        for (const stream of [p.stdout, p.stderr]) stream.on('data', (b) => { output += b })
        let filhos = []
        const timer = setTimeout(() => { p.kill('SIGKILL') }, 20000)
        try {
          const primeiro = await Promise.race([pedidoPendente.then(() => 'pedido'), fim.then(() => 'saida')])
          assert.equal(primeiro, 'pedido', output.split(token).join('<token-mascarado>'))
          const auth = arquivos(tmp).filter((f) => f.endsWith('auth.ini'))
          assert.equal(auth.length, 1)
          assert.ok(readFileSync(auth[0], 'utf8').includes(token))
          filhos = descendentes(p.pid)
          assert.ok(filhos.length > 0, 'nenhum filho real observado')
          // Sinal somente no pai: ele precisa terminar também pnpm/npm e seus filhos.
          p.kill(sinal)
          const [code, signal] = await fim
          assert.equal(existsSync(auth[0]), false, 'credencial ficou no disco')
          assert.equal(signal, null)
          assert.equal(code, sinal === 'SIGINT' ? 130 : 143)
          assert.deepEqual(filhos.filter((pid) => existsSync(`/proc/${pid}`)), [], 'filho ainda existe apos saida do pai')
          assert.equal(readFileSync(join(repo, 'pnpm-lock.yaml'), 'utf8'), lock)
          assert.ok(!output.includes(token), 'token presente na saida')
        } finally {
          clearTimeout(timer)
          if (p.exitCode === null && p.signalCode === null) { p.kill('SIGKILL'); await fim }
          // Somente os descendentes que esta fixture observou antes de enviar o sinal.
          for (const pid of filhos) { try { process.kill(pid, 'SIGKILL') } catch (e) { if (e.code !== 'ESRCH') throw e } }
          await pausa(20)
        }
      }, { interceptar(req, res) {
        if (operacao === 'publicar') {
          if (req.method === 'PUT') { req.resume(); pendente(); return true }
          res.writeHead(404); res.end('{}'); return true
        }
        if (req.url.endsWith('.tgz')) { pendente(); return true }
      } })
    })
  }
}

test('exit explicito durante autenticacao remove auth sincronamente', { timeout: 15000 }, async () => {
  await fixtureAuth(async ({ dir, registro, token, integrity }) => {
    const repo = preparar(dir, integrity, false)
    const tmp = join(dir, 'tmp')
    mkdirSync(tmp)
    const p = spawn(process.execPath, ['--input-type=module', '-e',
      `import { instalar, configuracao } from ${JSON.stringify(modulo)}; await instalar({ raiz: process.env.FIXTURE_RAIZ, repos: ['fixture'], config: configuracao(), executar: () => process.exit(7) })`], {
      cwd: repo, stdio: 'ignore', env: { ...process.env, FIXTURE_RAIZ: dir, TMPDIR: tmp, ERP_NPM_REGISTRY: registro, ERP_NPM_TOKEN: token },
    })
    const [code] = await once(p, 'exit')
    assert.equal(code, 7)
    assert.deepEqual(arquivos(tmp), [], 'auth.ini sobreviveu a exit')
  })
})


test('sinal apaga auth antes de esperar filho resistente e aplica teto de encerramento', { timeout: 15000 }, async () => {
  await fixtureAuth(async ({ dir, registro, token, integrity }) => {
    const repo = preparar(dir, integrity, false)
    const tmp = join(dir, 'tmp')
    const bin = join(dir, 'bin')
    mkdirSync(tmp)
    mkdirSync(bin)
    const stub = join(bin, 'pnpm')
    writeFileSync(stub, `#!${process.execPath}\nprocess.on('SIGTERM',()=>{});console.log('FILHO_PRONTO');setInterval(()=>{},1000)\n`)
    chmodSync(stub, 0o700)
    const p = spawn(process.execPath, ['--input-type=module', '-e',
      `import { instalar, configuracao } from ${JSON.stringify(modulo)}; await instalar({ raiz: process.env.FIXTURE_RAIZ, repos: ['fixture'], config: configuracao() })`], {
      cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FIXTURE_RAIZ: dir,
        TMPDIR: tmp, ERP_NPM_REGISTRY: registro, ERP_NPM_TOKEN: token, ERP_NPM_ENCERRAMENTO_MS: '1000' },
    })
    const fim = once(p, 'exit')
    p.stderr.resume()
    let filhos = []
    const timer = setTimeout(() => { p.kill('SIGKILL') }, 10000)
    try {
      await new Promise((ok) => {
        let texto = ''
        p.stdout.on('data', (b) => { texto += b; if (texto.includes('FILHO_PRONTO')) ok() })
      })
      filhos = descendentes(p.pid)
      const [auth] = arquivos(tmp).filter((f) => f.endsWith('auth.ini'))
      assert.ok(auth, 'auth nao observada antes do sinal')
      p.kill('SIGTERM')
      while (existsSync(auth) && p.exitCode === null && p.signalCode === null) await pausa(5)
      assert.equal(existsSync(auth), false, 'auth nao foi apagada antes da espera')
      assert.equal(p.exitCode, null, 'pai saiu antes do filho resistente')
      assert.ok(filhos.some((pid) => existsSync(`/proc/${pid}`)), 'filho nao resistiu a SIGTERM')
      p.kill('SIGINT') // segundo sinal não pode abortar a espera nem a limpeza.
      const [code, signal] = await fim
      assert.equal(signal, null)
      assert.equal(code, 143)
      assert.deepEqual(filhos.filter((pid) => existsSync(`/proc/${pid}`)), [])
    } finally {
      clearTimeout(timer)
      if (p.exitCode === null && p.signalCode === null) { p.kill('SIGKILL'); await fim }
      for (const pid of filhos) { try { process.kill(pid, 'SIGKILL') } catch (e) { if (e.code !== 'ESRCH') throw e } }
    }
  })
})
