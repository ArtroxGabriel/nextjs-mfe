// Harness próprio do challenger_shell_1: sobe a base com controle individual por app,
// todos compartilhando o mesmo SESSAO_DIR, para poder derrubar/reerguer uma zona de cada vez
// sem perder a validade das sessões já emitidas. Não edita nada em repos/, só lê e importa.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/repos'
const ESTADO = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/challenger_shell_1/harness-estado.json'

const APPS = [
  { id: 'erp-shell', dir: 'erp-shell', porta: 3000, saude: '/login' },
  { id: 'erp-zona-1', dir: 'erp-zona-1', porta: 3001, saude: '/zona1' },
  { id: 'erp-zona-2', dir: 'erp-zona-2', porta: 3002, saude: '/zona2' },
  { id: 'erp-zona-acesso', dir: 'erp-zona-acesso', porta: 3003, saude: '/acesso' },
]
const DOMINIOS = { 'dominio-a': 4001, 'dominio-b': 4002, 'dominio-c': 4003, plataforma: 4004, 'gestao-acesso': 4010 }

async function esperar(url, ms = 60_000) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    try { await fetch(url, { redirect: 'manual' }); return } catch { await new Promise((r) => setTimeout(r, 250)) }
  }
  throw new Error(`nao respondeu a tempo: ${url}`)
}

const comando = process.argv[2]

if (comando === 'subir') {
  for (const porta of [...APPS.map((a) => a.porta), ...Object.values(DOMINIOS)]) {
    const ocupada = await fetch(`http://127.0.0.1:${porta}/`, { signal: AbortSignal.timeout(500) }).then(() => true, () => false)
    if (ocupada) throw new Error(`porta ${porta} ja esta em uso`)
  }
  const SESSAO_DIR = mkdtempSync(join(tmpdir(), 'erp-sessoes-challenger-'))
  const env = { ...process.env, SESSAO_DIR, ERP_PERMITIR_IDENTIDADE_DEV: '1' }
  const estado = { SESSAO_DIR, pids: {} }

  for (const nome of Object.keys(DOMINIOS)) {
    const p = spawn('node', ['src/servidor.mjs', nome], { cwd: join(RAIZ, 'erp-dominio-stub'), env, stdio: 'ignore', detached: true })
    estado.pids[nome] = p.pid
  }
  for (const porta of Object.values(DOMINIOS)) await esperar(`http://127.0.0.1:${porta}/`)
  for (const { dir } of APPS) {
    execFileSync('pnpm', ['registrar'], { cwd: join(RAIZ, dir), env, stdio: 'ignore' })
  }

  for (const { id, dir } of APPS) {
    const p = spawn('pnpm', ['start'], { cwd: join(RAIZ, dir), env, stdio: 'ignore', detached: true })
    estado.pids[id] = p.pid
  }
  for (const { porta, saude } of APPS) await esperar(`http://localhost:${porta}${saude}`)

  writeFileSync(ESTADO, JSON.stringify(estado, null, 2))
  console.log('SUBIU', JSON.stringify(estado))
}

// spawn foi feito com detached:true, entao o pid do processo e o lider do grupo:
// sinal negativo atinge o grupo inteiro (pnpm -> sh -> next-server), como no ambiente.mjs original.
if (comando === 'derrubar-app') {
  const id = process.argv[3]
  const estado = JSON.parse(readFileSync(ESTADO, 'utf8'))
  const pid = estado.pids[id]
  process.kill(-pid, 'SIGTERM')
  console.log('derrubado', id, pid, 'em', Date.now())
}

if (comando === 'stop-app') {
  const id = process.argv[3]
  const estado = JSON.parse(readFileSync(ESTADO, 'utf8'))
  const pid = estado.pids[id]
  process.kill(-pid, 'SIGSTOP')
  console.log('travado (SIGSTOP)', id, pid, 'em', Date.now())
}

if (comando === 'cont-app') {
  const id = process.argv[3]
  const estado = JSON.parse(readFileSync(ESTADO, 'utf8'))
  const pid = estado.pids[id]
  process.kill(-pid, 'SIGCONT')
  console.log('destravado (SIGCONT)', id, pid, 'em', Date.now())
}

if (comando === 'subir-app') {
  const id = process.argv[3]
  const app = APPS.find((a) => a.id === id)
  const estado = JSON.parse(readFileSync(ESTADO, 'utf8'))
  const env = { ...process.env, SESSAO_DIR: estado.SESSAO_DIR, ERP_PERMITIR_IDENTIDADE_DEV: '1' }
  const t0 = Date.now()
  const p = spawn('pnpm', ['start'], { cwd: join(RAIZ, app.dir), env, stdio: 'ignore', detached: true })
  estado.pids[id] = p.pid
  writeFileSync(ESTADO, JSON.stringify(estado, null, 2))
  console.log('subindo', id, 'pid', p.pid, 'iniciado-em', t0)
}

if (comando === 'derrubar-tudo') {
  const estado = JSON.parse(readFileSync(ESTADO, 'utf8'))
  for (const [id, pid] of Object.entries(estado.pids)) {
    try { process.kill(pid, 'SIGTERM') } catch { /* ja morto */ }
  }
  console.log('tudo derrubado')
}

if (comando === 'estado') {
  console.log(readFileSync(ESTADO, 'utf8'))
}
