import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { executarAsync } from './pnpm-auth-fixture.mjs'

const destino = resolve(process.argv[2] ?? '')
if (!process.argv[2]) throw new Error('informe diretorio de logs')
mkdirSync(destino, { recursive: true })
const portas = [3000,3001,3002,3003,3009,4001,4002,4003,4004,4010,4020]
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms))
for (const modo of ['dev', 'oidc']) {
  for (const porta of portas) {
    if (execFileSync('ss', ['-H', '-ltnp', `sport = :${porta}`], { encoding: 'utf8' }).trim()) throw new Error(`porta ${porta} ocupada: nao administrar listener`)
  }
  const log = join(destino, `showcase-${modo}-subida.log`)
  const stream = createWriteStream(log)
  const env = { ...process.env, ERP_CHROME: 'docker', DADOS_DIR: join(destino, `dados-${modo}`) }
  const p = spawn('task', [modo === 'dev' ? 'showcase' : 'showcase:oidc'], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let saida = ''
  for (const s of [p.stdout, p.stderr]) s.on('data', (b) => { stream.write(b); saida += b })
  const terminou = new Promise((ok) => p.once('exit', ok))
  try {
    const limite = Date.now() + 180000
    while (!saida.includes('showcase no ar:')) {
      if (p.exitCode !== null || p.signalCode !== null || Date.now() >= limite) throw new Error(`showcase ${modo} nao subiu; veja ${log}`)
      await pausa(500)
    }
    const r = await executarAsync('task', ['showcase:verificar'], { env })
    writeFileSync(join(destino, `showcase-${modo}-test.log`), r.output)
    console.log(JSON.stringify({ modo, code: r.code }))
    if (r.code !== 0) process.exitCode = 1
  } finally {
    // Apenas o grupo registrado ao iniciar este showcase recebe SIGINT.
    try { process.kill(-p.pid, 'SIGINT') } catch { /* terminou */ }
    await Promise.race([terminou, pausa(10000)])
    if (p.exitCode === null && p.signalCode === null) { process.kill(-p.pid, 'SIGTERM'); await terminou }
    stream.end()
    for (let i = 0; i < 40; i++) {
      if (portas.every((porta) => !execFileSync('ss', ['-H', '-ltnp', `sport = :${porta}`], { encoding: 'utf8' }).trim())) break
      await pausa(250)
    }
  }
}
