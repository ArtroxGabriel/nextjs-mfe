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

const SCRIPT_AMBIENTE = fileURLToPath(import.meta.url)

/** Constrói só se não há build ou se alguma entrada do build (ou ambiente.mjs) é mais nova que ele. */
export function precisaConstruir(dirDaApp, { scriptAmbiente } = {}) {
  const id = join(dirDaApp, '.next', 'BUILD_ID')
  if (!existsSync(id)) return true
  const build = statSync(id).mtimeMs
  const candidato = scriptAmbiente ?? (dirDaApp.startsWith(RAIZ) ? SCRIPT_AMBIENTE : null)
  if (candidato && existsSync(candidato) && statSync(candidato).mtimeMs > build) return true
  return ENTRADAS_DO_BUILD.some((e) => maisRecente(join(dirDaApp, e)) > build)
}

/**
 * Ambiente de cada processo por LISTA DE INCLUSÃO (auditor_b1_d1_8, V1): zona e domínio recebem só o que
 * leem, nunca o ambiente inteiro menos uma lista de nomes. Assim a credencial de escrita do Redis
 * (`REDIS_URL`, `ERP_REDIS_SENHA_SHELL` ou qualquer variável nova com o segredo) não chega a eles, em
 * nenhuma fase (build, start, registrar). O shell é o único dono da escrita e recebe o ambiente inteiro.
 * Variável nova que zona ou domínio precisam entra aqui e em docs/CONFIGURACAO.md.
 */
const DO_SISTEMA = [
  'PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'LC_MESSAGES', 'TZ', 'TMPDIR', 'TERM',
  'PNPM_HOME', 'COREPACK_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_RUNTIME_DIR',
  'NODE_ENV', 'NODE_EXTRA_CA_CERTS', 'NEXT_TELEMETRY_DISABLED', 'CI',
]
export const AMBIENTE_PERMITIDO = {
  zona: [
    ...DO_SISTEMA,
    'SESSAO_DIR', 'REDIS_URL_ZONA', 'ACESSO_URL', 'SHELL_HOSTS', 'DOMINIO_A_URL', 'DOMINIO_B_URL', 'DOMINIO_C_URL',
    'ERP_TOKEN_SERVICO', 'ERP_DESTINO_TIMEOUT_MS', 'ERP_FRAGMENTO_TIMEOUT_MS', 'ERP_PERMITIR_IDENTIDADE_DEV', 'ERP_TOKEN_VIDA_S',
    // não é segredo: a zona só tira dele a origem do IdP para o form-action da CSP (ADR-0013, decisão 6)
    'IDP_EMISSOR',
  ],
  dominio: [...DO_SISTEMA, 'DADOS_DIR'],
}

/** Papel de um diretório de `repos/`: só o shell grava sessão; o domínio falso não fala com o Redis. */
export const papelDe = (dir) => (dir === 'erp-shell' ? 'shell' : dir === 'erp-dominio-stub' ? 'dominio' : 'zona')

/** O ambiente que um processo do papel recebe, a partir do ambiente de quem sobe a base. */
export function ambienteDoPapel(papel, base) {
  if (papel === 'shell') return { ...base }
  const permitidas = AMBIENTE_PERMITIDO[papel]
  if (!permitidas) throw new Error(`papel desconhecido: ${papel}`)
  return Object.fromEntries(Object.entries(base).filter(([k]) => permitidas.includes(k)))
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
  /**
   * Todo processo da base nasce aqui, e o ambiente sai do diretório (`papelDe`), nunca de quem chama:
   * build, start, registrar, domínio e app avulsa recebem o mesmo filtro (auditor_b1_d1_8, V1; na K4 o
   * build e o registrar das zonas escapavam da exclusão). `ambientesEntregues` guarda o que cada um
   * recebeu, para a verificação conferir; `extras` são as variáveis que um teste pôs de propósito.
   */
  const ambientesEntregues = []
  const executar = (fase, dir, cmd, args, { extra = {}, esperar: sincrono = false } = {}) => {
    const envProc = ambienteDoPapel(papelDe(dir), env)
    for (const [k, v] of Object.entries(extra)) { if (v === null) delete envProc[k]; else envProc[k] = v }
    ambientesEntregues.push({ fase, dir, ambiente: { ...envProc }, extras: Object.keys(extra) })
    const opcoes = { cwd: join(RAIZ, dir), env: envProc, stdio: log ? 'inherit' : 'ignore' }
    if (sincrono) return execFileSync(cmd, args, opcoes)
    const p = spawn(cmd, args, { ...opcoes, detached: true })
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
      executar('registrar', dir, 'pnpm', ['registrar'], { esperar: true })
    }
  }
  const subirDominio = async (nome) => {
    dominios.set(nome, executar('start', 'erp-dominio-stub', 'node', ['src/servidor.mjs', nome]))
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
    apps.set(dir, executar('start', dir, 'pnpm', ['start']))
    const { porta, saude } = APPS.find((a) => a.dir === dir)
    await esperar(`http://localhost:${porta}${saude}`)
  }

  /**
   * Sobe mais uma instância de uma app já construída, noutra porta e com o ambiente alterado
   * (`null` apaga a variável). Serve para provar como a app se comporta com configuração errada
   * sem mexer na instância que o resto da verificação usa. Devolve a função que a derruba.
   */
  const subirAppAvulsa = async (dir, { porta, envExtra = {}, caminho = '/' }) => {
    const p = executar('avulsa', dir, 'pnpm', ['exec', 'next', 'start', '-p', String(porta)], { extra: envExtra })
    await esperar(`http://localhost:${porta}${caminho}`)
    return async () => {
      parar(p)
      await new Promise((ok) => (p.exitCode !== null || p.signalCode !== null ? ok() : p.once('exit', ok)))
    }
  }

  try {
    for (const nome of Object.keys(PORTAS_DE_DOMINIO)) {
      dominios.set(nome, executar('start', 'erp-dominio-stub', 'node', ['src/servidor.mjs', nome]))
    }
    for (const porta of Object.values(PORTAS_DE_DOMINIO)) await esperar(`http://127.0.0.1:${porta}/`)
    registrar()

    for (const { dir } of APPS) {
      const cwd = join(RAIZ, dir)
      const precisa = construir === 'tudo' || (construir ? precisaConstruir(cwd) : !existsSync(join(cwd, '.next', 'BUILD_ID')))
      if (precisa) {
        executar('build', dir, 'pnpm', ['build'], { esperar: true })
      }
    }
    for (const { dir } of APPS) apps.set(dir, executar('start', dir, 'pnpm', ['start']))
    for (const { porta, saude } of APPS) await esperar(`http://localhost:${porta}${saude}`)
  } catch (e) {
    derrubar()
    throw e
  }
  return { derrubar, derrubarDominio, subirDominio, derrubarApp, subirApp, subirAppAvulsa, congelarApp, descongelarApp, sessaoDir: env.SESSAO_DIR, apps, dominios, ambientesEntregues }
}
