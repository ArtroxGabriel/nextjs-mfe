import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
export const SHELL = 'http://localhost:3000'
export const APPS = [
  { dir: 'erp-shell', porta: 3000, saude: '/login' },
  { dir: 'erp-zona-1', porta: 3001, saude: '/zona1' },
  { dir: 'erp-zona-2', porta: 3002, saude: '/zona2' },
  { dir: 'erp-zona-acesso', porta: 3003, saude: '/acesso' },
]

async function esperar(url, ms = 60_000) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    try { await fetch(url, { redirect: 'manual' }); return } catch { await new Promise((r) => setTimeout(r, 250)) }
  }
  throw new Error(`nao respondeu a tempo: ${url}`)
}

/**
 * Sobe a base inteira: domínios falsos, manifestos registrados, shell e zonas em modo
 * produção (`next start`). Cada execução usa um diretório de sessão novo.
 */
export async function subir({ construir = false, log = false } = {}) {
  // Um processo antigo numa porta faria a verificação falar com a base errada (outro
  // diretório de sessão, outro build) e reprovar por motivo nenhum do código.
  for (const porta of [...APPS.map((a) => a.porta), 4001, 4002, 4003, 4004, 4010]) {
    const ocupada = await fetch(`http://127.0.0.1:${porta}/`, { signal: AbortSignal.timeout(500) }).then(() => true, () => false)
    if (ocupada) throw new Error(`porta ${porta} ja esta em uso; derrube o processo antes de subir a base`)
  }
  const env = {
    ...process.env,
    SESSAO_DIR: mkdtempSync(join(tmpdir(), 'erp-sessoes-')),
    ERP_PERMITIR_IDENTIDADE_DEV: '1',
  }
  const processos = []
  const iniciar = (cmd, args, cwd) => {
    const p = spawn(cmd, args, { cwd, env, stdio: log ? 'inherit' : 'ignore', detached: true })
    processos.push(p)
    return p
  }
  const derrubar = () => {
    for (const p of processos) { try { process.kill(-p.pid, 'SIGTERM') } catch { /* ja saiu */ } }
  }

  try {
    iniciar('node', ['src/servidor.mjs'], join(RAIZ, 'erp-dominio-stub'))
    await esperar('http://127.0.0.1:4010/v1/modulos-permitidos')

    for (const { dir } of APPS) {
      const cwd = join(RAIZ, dir)
      execFileSync('pnpm', ['registrar'], { cwd, env, stdio: log ? 'inherit' : 'ignore' })
      if (construir || !existsSync(join(cwd, '.next', 'BUILD_ID'))) {
        execFileSync('pnpm', ['build'], { cwd, env, stdio: log ? 'inherit' : 'ignore' })
      }
    }
    for (const { dir } of APPS) iniciar('pnpm', ['start'], join(RAIZ, dir))
    for (const { porta, saude } of APPS) await esperar(`http://localhost:${porta}${saude}`)
  } catch (e) {
    derrubar()
    throw e
  }
  return { derrubar, sessaoDir: env.SESSAO_DIR }
}
