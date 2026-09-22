import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
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
  'dominio-a': 4001, 'dominio-b': 4002, 'dominio-c': 4003, plataforma: 4004, 'gestao-acesso-v2': 4020,
}
/**
 * Domínios que só sobem quando uma verificação pede (`subirDominio`). A gestão de acesso v1 fica
 * aqui para provar que as apps não voltam a ela com a v2 fora (ADR-0014, adendo 1).
 */
export const PORTAS_SOB_DEMANDA = { 'gestao-acesso': 4010 }
const PORTA = { ...PORTAS_DE_DOMINIO, ...PORTAS_SOB_DEMANDA }

/** O que entra no build de uma aplicação: fonte, configuração e as versões de pacote travadas. */
const ENTRADAS_DO_BUILD = ['app', 'lib', 'proxy.ts', 'next.config.ts', 'package.json', 'pnpm-lock.yaml', 'zonas.json', 'acesso.manifesto.ts']

function maisRecente(caminho) {
  if (!existsSync(caminho)) return 0
  const st = statSync(caminho)
  if (!st.isDirectory()) return st.mtimeMs
  return Math.max(0, ...readdirSync(caminho).map((n) => maisRecente(join(caminho, n))))
}

/** Constrói só se não há build ou se alguma entrada do build é mais nova que ele. */
export function precisaConstruir(dirDaApp) {
  const id = join(dirDaApp, '.next', 'BUILD_ID')
  if (!existsSync(id)) return true
  const build = statSync(id).mtimeMs
  return ENTRADAS_DO_BUILD.some((e) => maisRecente(join(dirDaApp, e)) > build)
}

const temScript = (dir, nome) => !!JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts?.[nome]

async function esperar(url, ms = 60_000) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    // timeout por tentativa: um processo congelado aceita a conexão e nunca responde
    try { await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(2_000) }); return } catch { await new Promise((r) => setTimeout(r, 250)) }
  }
  throw new Error(`nao respondeu a tempo: ${url}`)
}

/**
 * Sobe a base inteira: domínios falsos, manifestos registrados, shell e zonas em modo
 * produção (`next start`). Cada execução usa um diretório de sessão novo.
 *
 * `construir`: `false` só constrói app sem build; `true` reconstrói só as apps cujo fonte mudou
 * desde o último build (uma mutação no shell não refaz as zonas); `'tudo'` reconstrói todas.
 */
export async function subir({ construir = false, log = false } = {}) {
  // Um processo antigo numa porta faria a verificação falar com a base errada (outro
  // diretório de sessão, outro build) e reprovar por motivo nenhum do código.
  for (const porta of [...APPS.map((a) => a.porta), ...Object.values(PORTA)]) {
    // Só "conexão recusada" é porta livre. Timeout é processo que aceita e não responde (ex.: zona
    // congelada por uma verificação interrompida no L7) e conta como ocupada.
    const livre = await fetch(`http://127.0.0.1:${porta}/`, { signal: AbortSignal.timeout(500) })
      .then(() => false, (e) => e?.cause?.code === 'ECONNREFUSED')
    if (!livre) throw new Error(`porta ${porta} ja esta em uso (ou com processo congelado: kill -CONT/-TERM); derrube o processo antes de subir a base`)
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
  const parar = (p) => {
    // SIGCONT antes: um grupo congelado (congelarApp) não processaria o SIGTERM
    try { process.kill(-p.pid, 'SIGCONT'); process.kill(-p.pid, 'SIGTERM') } catch { /* ja saiu */ }
  }
  const derrubar = () => { for (const p of processos) parar(p) }

  // Um processo por domínio e por aplicação, para a verificação poder derrubar um de cada vez.
  const dominios = new Map()
  const apps = new Map()
  const registrar = () => {
    // só as zonas que são módulo têm manifesto (shell e zona de acesso não: ADR-0014, adendo 1)
    for (const { dir } of APPS.filter(({ dir }) => temScript(join(RAIZ, dir), 'registrar'))) {
      execFileSync('pnpm', ['registrar'], { cwd: join(RAIZ, dir), env, stdio: log ? 'inherit' : 'ignore' })
    }
  }
  const subirDominio = async (nome) => {
    dominios.set(nome, iniciar('node', ['src/servidor.mjs', nome], join(RAIZ, 'erp-dominio-stub')))
    await esperar(`http://127.0.0.1:${PORTA[nome]}/`)
    // o domínio falso de acesso guarda tudo em memória: ao voltar, os manifestos são reenviados
    if (nome === 'gestao-acesso-v2') registrar()
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
  /**
   * Congela a aplicação (SIGSTOP no grupo): a porta continua aceitando conexão e nada responde.
   * É a zona travada, diferente da zona caída, que recusa a conexão na hora.
   */
  const congelarApp = (dir) => { const p = apps.get(dir); if (p) process.kill(-p.pid, 'SIGSTOP') }
  const descongelarApp = (dir) => { const p = apps.get(dir); if (p) process.kill(-p.pid, 'SIGCONT') }
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
      const precisa = construir === 'tudo' || (construir ? precisaConstruir(cwd) : !existsSync(join(cwd, '.next', 'BUILD_ID')))
      if (precisa) {
        execFileSync('pnpm', ['build'], { cwd, env, stdio: log ? 'inherit' : 'ignore' })
      }
    }
    for (const { dir } of APPS) apps.set(dir, iniciar('pnpm', ['start'], join(RAIZ, dir)))
    for (const { porta, saude } of APPS) await esperar(`http://localhost:${porta}${saude}`)
  } catch (e) {
    derrubar()
    throw e
  }
  return { derrubar, derrubarDominio, subirDominio, derrubarApp, subirApp, congelarApp, descongelarApp, sessaoDir: env.SESSAO_DIR }
}
