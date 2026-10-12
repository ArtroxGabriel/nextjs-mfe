import { spawn } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { executarAsync } from './pnpm-auth-fixture.mjs'

const destino = resolve(process.env.P1_SCRATCH ?? process.argv[2] ?? '')
if (!process.env.P1_SCRATCH && !process.argv[2]) throw new Error('informe P1_SCRATCH ou diretorio de logs')
mkdirSync(destino, { recursive: true })
const cwd = resolve('repos/erp-nucleo')
const args = ['--conditions', 'react-server', '--test', '--test-name-pattern=token vencido e IdP com erro transitorio', 'test/identidade.test.mjs']
const resultados = []
for (let i = 1; i <= 5; i++) {
  const r = await executarAsync(process.execPath, args, { cwd })
  writeFileSync(join(destino, `espera-isolada-${i}.log`), r.output)
  resultados.push({ rodada: `isolada-${i}`, code: r.code })
}
// Contenção de CPU exclusivamente em filhos próprios e na CPU permitida ao processo.
const permitidas = (await executarAsync('taskset', ['-pc', String(process.pid)])).output.match(/list:\s*([0-9]+)/)?.[1]
if (!permitidas) throw new Error('taskset nao informou CPU permitida')
const carga = Array.from({ length: 4 }, () => spawn('taskset', ['-c', permitidas, process.execPath, '-e', 'while (true) Math.sqrt(Math.random())'], { stdio: 'ignore' }))
try {
  for (let i = 1; i <= 3; i++) {
    const r = await executarAsync('taskset', ['-c', permitidas, process.execPath, ...args], { cwd })
    writeFileSync(join(destino, `espera-carga-${i}.log`), r.output)
    resultados.push({ rodada: `carga-${i}`, code: r.code })
  }
} finally {
  await Promise.all(carga.map((p) => new Promise((ok) => { p.once('exit', ok); p.kill('SIGTERM') })))
}
console.log(JSON.stringify(resultados, null, 2))

// Contraprova: pausa síncrona de CPU depois do erro do IdP, enquanto perdedores esperam.
// A fonte é alterada apenas numa cópia descartável, nunca no submódulo.
const copia = mkdtempSync(join(destino, 'espera-bloqueada-'))
try {
  cpSync(join(cwd, 'test'), join(copia, 'test'), { recursive: true })
  symlinkSync(join(cwd, 'dist'), join(copia, 'dist'))
  symlinkSync(join(cwd, 'node_modules'), join(copia, 'node_modules'))
  const teste = join(copia, 'test/identidade.test.mjs')
  const marcador = 'await assert.rejects(vencedor, /IdP fora do ar/)'
  const fonte = readFileSync(teste, 'utf8')
  if (fonte.split(marcador).length !== 2) throw new Error('marcador da carga nao e unico')
  writeFileSync(teste, fonte.replace(marcador, marcador + '; { const fim = Date.now() + 1200; while (Date.now() < fim) Math.sqrt(Math.random()) }'))
  const r = await executarAsync(process.execPath, args, { cwd: copia })
  writeFileSync(join(destino, 'espera-event-loop-bloqueado.log'), r.output)
  console.log(JSON.stringify({ rodada: 'event-loop-bloqueado', code: r.code }))
} finally { rmSync(copia, { recursive: true, force: true }) }
