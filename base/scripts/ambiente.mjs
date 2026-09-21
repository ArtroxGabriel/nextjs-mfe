import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Onde moram os repositórios (submódulos): `repos/`, ao lado de `base/`. */
export const RAIZ = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), 'repos')
export const SHELL = 'http://localhost:3000'
export const APPS = [
  { dir: 'erp-shell', porta: 3000, saude: '/login' },
  { dir: 'erp-zona-1', porta: 3001, saude: '/zona1' },
  { dir: 'erp-zona-2', porta: 3002, saude: '/zona2' },
  { dir: 'erp-zona-acesso', porta: 3003, saude: '/acesso' },
]

export const PORTAS_DE_DOMINIO = {
  'dominio-a': 4001, 'dominio-b': 4002, 'dominio-c': 4003, plataforma: 4004, 'gestao-acesso': 4010,
}

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
  for (const porta of [...APPS.map((a) => a.porta), ...Object.values(PORTAS_DE_DOMINIO)]) {
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
  const parar = (p) => { try { process.kill(-p.pid, 'SIGTERM') } catch { /* ja saiu */ } }
  const derrubar = () => { for (const p of processos) parar(p) }

  // Um processo por domínio e por aplicação, para a verificação poder derrubar um de cada vez.
  const dominios = new Map()
  const apps = new Map()
  const registrar = () => {
    for (const { dir } of APPS) {
      execFileSync('pnpm', ['registrar'], { cwd: join(RAIZ, dir), env, stdio: log ? 'inherit' : 'ignore' })
    }
  }
  const subirDominio = async (nome) => {
    dominios.set(nome, iniciar('node', ['src/servidor.mjs', nome], join(RAIZ, 'erp-dominio-stub')))
    await esperar(`http://127.0.0.1:${PORTAS_DE_DOMINIO[nome]}/`)
    // o domínio falso de acesso guarda tudo em memória: ao voltar, os manifestos são reenviados
    if (nome === 'gestao-acesso') registrar()
  }
  const derrubarDominio = async (nome) => {
    const p = dominios.get(nome)
    if (!p) return
    parar(p)
    await new Promise((ok) => (p.exitCode !== null ? ok() : p.once('exit', ok)))
  }

  /** Mata a aplicação de verdade (SIGKILL no grupo): simula a zona caindo, não desligando com calma. */
  const derrubarApp = async (dir) => {
    const p = apps.get(dir)
    if (!p) return
    try { process.kill(-p.pid, 'SIGKILL') } catch { /* ja saiu */ }
    await new Promise((ok) => (p.exitCode !== null || p.signalCode !== null ? ok() : p.once('exit', ok)))
  }
  const subirApp = async (dir) => {
    apps.set(dir, iniciar('pnpm', ['start'], join(RAIZ, dir)))
    const { porta, saude } = APPS.find((a) => a.dir === dir)
    await esperar(`http://localhost:${porta}${saude}`)
  }

  try {
    for (const nome of Object.keys(PORTAS_DE_DOMINIO)) {
      dominios.set(nome, iniciar('node', ['src/servidor.mjs', nome], join(RAIZ, 'erp-dominio-stub')))
    }
    for (const porta of Object.values(PORTAS_DE_DOMINIO)) await esperar(`http://127.0.0.1:${porta}/`)
    registrar()

    for (const { dir } of APPS) {
      const cwd = join(RAIZ, dir)
      if (construir || !existsSync(join(cwd, '.next', 'BUILD_ID'))) {
        execFileSync('pnpm', ['build'], { cwd, env, stdio: log ? 'inherit' : 'ignore' })
      }
    }
    for (const { dir } of APPS) apps.set(dir, iniciar('pnpm', ['start'], join(RAIZ, dir)))
    for (const { porta, saude } of APPS) await esperar(`http://localhost:${porta}${saude}`)
  } catch (e) {
    derrubar()
    throw e
  }
  return { derrubar, derrubarDominio, subirDominio, derrubarApp, subirApp, sessaoDir: env.SESSAO_DIR }
}
