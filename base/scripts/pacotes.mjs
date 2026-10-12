import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { pacotesErp } from './alinhar-hashes.mjs'

export const REPOS = ['erp-contratos', 'erp-nucleo', 'erp-moldura', 'erp-dominio-stub', 'erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']
export const PUBLICAVEIS = REPOS.slice(0, 3)
const raizPadrao = resolve(dirname(fileURLToPath(import.meta.url)), '../../repos')

export function configuracao(env = process.env) {
  if (env.CI && !env.ERP_NPM_REGISTRY) throw new Error('CI exige ERP_NPM_REGISTRY: configure o registro compartilhado')
  let url
  try { url = new URL(env.ERP_NPM_REGISTRY ?? 'http://localhost:4873/') } catch { throw new Error('ERP_NPM_REGISTRY invalido') }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) {
    throw new Error('ERP_NPM_REGISTRY exige HTTPS, sem credencial, query ou fragmento; HTTP so em loopback')
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  const timeoutMs = Number(env.ERP_NPM_TIMEOUT_MS ?? 10000)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error('ERP_NPM_TIMEOUT_MS deve estar entre 100 e 120000')
  const encerramentoMs = Number(env.ERP_NPM_ENCERRAMENTO_MS ?? 5000)
  if (!Number.isInteger(encerramentoMs) || encerramentoMs < 100 || encerramentoMs > 120000) throw new Error('ERP_NPM_ENCERRAMENTO_MS deve estar entre 100 e 120000')
  for (const chave of ['ERP_NPM_TOKEN', 'ERP_NPM_TOKEN_PUBLICACAO']) {
    if (env[chave] && /[\r\n\0]/.test(env[chave])) throw new Error(`${chave} invalido`)
  }
  return { registro: url.href, timeoutMs, encerramentoMs, token: env.ERP_NPM_TOKEN, tokenPublicacao: env.ERP_NPM_TOKEN_PUBLICACAO }
}

function ambienteSemTokens(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !['ERP_NPM_TOKEN', 'ERP_NPM_TOKEN_PUBLICACAO', 'NODE_AUTH_TOKEN', 'NPM_TOKEN'].includes(k)))
}

/** Um hash por nome e versao, considerando tambem as dependencias transitivas antigas. */
export function inventario(raiz = raizPadrao, repos = REPOS) {
  const pacotes = new Map()
  for (const repo of repos) {
    const lock = readFileSync(join(raiz, repo, 'pnpm-lock.yaml'), 'utf8')
    const itens = pacotesErp(lock)
    const entradas = [...lock.matchAll(/^  '(@erp\/[^']+)':$/gm)]
    if (entradas.length !== itens.length) throw new Error(`${repo}: entrada @erp sem integrity reconhecida`)
    for (const item of itens) {
      const chave = `${item.nome}@${item.versao}`
      if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(item.integrity)) throw new Error(`${repo}: integrity SHA-512 invalida em ${chave}`)
      const anterior = pacotes.get(chave)
      if (anterior && anterior.integrity !== item.integrity) throw new Error(`lockfiles divergem em ${chave}; nao alinhar hashes automaticamente`)
      pacotes.set(chave, item)
    }
  }
  return [...pacotes.values()]
}

async function consultar(nome, versao, config, token = config.token) {
  const url = new URL(`${encodeURIComponent(nome)}/${encodeURIComponent(versao)}`, config.registro)
  let resposta
  try {
    resposta = await fetch(url, {
      redirect: 'manual', signal: AbortSignal.timeout(config.timeoutMs),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch { throw new Error(`registro indisponivel ao consultar ${nome}@${versao}`) }
  if (resposta.status === 404) return null
  if (resposta.status !== 200) throw new Error(`registro recusou ${nome}@${versao}: HTTP ${resposta.status}`)
  try { return await resposta.json() } catch { throw new Error(`metadata invalida de ${nome}@${versao}`) }
}

export async function verificar({ raiz = raizPadrao, repos = REPOS, config = configuracao(), conferirTarballs = true } = {}) {
  const itens = inventario(raiz, repos)
  for (const { nome, versao, integrity } of itens) {
    const meta = await consultar(nome, versao, config)
    if (!meta) throw new Error(`${nome}@${versao} ausente no registro; importe o tarball canonico ou publique uma versao nova`)
    if (meta.name !== nome || meta.version !== versao || meta.dist?.integrity !== integrity) {
      throw new Error(`${nome}@${versao}: metadata ou integrity diverge do lockfile; instalacao recusada`)
    }
  }
  if (conferirTarballs) {
    for (const repo of repos) {
      const lock = readFileSync(join(raiz, repo, 'pnpm-lock.yaml'), 'utf8')
      for (const [, tarball] of lock.matchAll(/tarball: ([^,}\s]+)/g)) {
        if (!tarball.startsWith(config.registro)) throw new Error(`${repo}: tarball aponta para outro registro; use task pacotes:migrar-registro depois de importar os bytes canonicos`)
      }
    }
  }
  return itens.length
}

export async function migrarRegistro({ raiz = raizPadrao, repos = REPOS, config = configuracao() } = {}) {
  await verificar({ raiz, repos, config, conferirTarballs: false })
  for (const repo of repos) {
    const arquivo = join(raiz, repo, 'pnpm-lock.yaml')
    const lock = readFileSync(arquivo, 'utf8')
    // Retira so URLs fixas dos pacotes internos. O checksum continua identico.
    const novo = lock.replace(/(\n  '@erp\/[^']+':\n    resolution: \{integrity: [^,}]+), tarball: [^}]+}/g, '$1}')
    if (novo !== lock) writeFileSync(arquivo, novo)
  }
}

// Recursos pertencem somente a esta operação. Nenhum PID é descoberto no host.
const temporarios = new Set()
const filhos = new Map()
let handlersAtivos = false
let encerrando = false
let prazoEncerramentoMs

function removerTemporarios() {
  for (const dir of temporarios) rmSync(dir, { recursive: true, force: true })
}
function sinalizarFilho(filho, sinal) {
  if (!filho.pid) return // spawn pode falhar antes de criar o processo.
  try { process.kill(process.platform === 'win32' ? filho.pid : -filho.pid, sinal) }
  catch (erro) { if (erro.code !== 'ESRCH') throw erro }
}
function aoSair() {
  removerTemporarios()
  // exit não admite espera assíncrona. Os sinais usam encerrar() e aguardam close.
  for (const filho of filhos.keys()) sinalizarFilho(filho, 'SIGKILL')
}
async function encerrar(sinal) {
  if (encerrando) return
  encerrando = true
  // Apaga a credencial antes de qualquer await, inclusive se o filho resistir.
  removerTemporarios()
  const pendentes = [...filhos.entries()]
  for (const [filho] of pendentes) sinalizarFilho(filho, 'SIGTERM')
  const teto = setTimeout(() => {
    for (const [filho] of pendentes) sinalizarFilho(filho, 'SIGKILL')
  }, prazoEncerramentoMs)
  await Promise.allSettled(pendentes.map(([, fim]) => fim))
  clearTimeout(teto)
  process.exit(sinal === 'SIGINT' ? 130 : 143)
}
const aoInterromper = () => { void encerrar('SIGINT') }
const aoTerminar = () => { void encerrar('SIGTERM') }
function atualizarHandlers() {
  if (encerrando) return
  const necessarios = temporarios.size > 0 || filhos.size > 0
  if (necessarios === handlersAtivos) return
  handlersAtivos = necessarios
  const metodo = necessarios ? 'on' : 'removeListener'
  process[metodo]('exit', aoSair)
  process[metodo]('SIGINT', aoInterromper)
  process[metodo]('SIGTERM', aoTerminar)
}
function criarTemporario(prefixo, config) {
  prazoEncerramentoMs = config.encerramentoMs ?? configuracao().encerramentoMs
  const dir = mkdtempSync(join(tmpdir(), prefixo))
  temporarios.add(dir)
  atualizarHandlers()
  return dir
}
function removerTemporario(dir) {
  rmSync(dir, { recursive: true, force: true })
  temporarios.delete(dir)
  atualizarHandlers()
}
async function comAutenticacao(config, token, executar) {
  const dir = criarTemporario('mira-npm-', config)
  const arquivo = join(dir, 'auth.ini')
  const url = new URL(config.registro)
  try {
    writeFileSync(arquivo, token ? `//${url.host}${url.pathname}:_authToken=${token}\n` : '', { mode: 0o600 })
    return await executar(arquivo)
  } finally { removerTemporario(dir) }
}

function comando(programa, args, opcoes = {}) {
  if (encerrando) throw new Error('operacao de pacotes interrompida')
  const filho = spawn(programa, args, { stdio: 'inherit', ...opcoes, detached: process.platform !== 'win32' })
  const fim = new Promise((ok, falha) => {
    const saida = []
    filho.stdout?.on('data', (bytes) => saida.push(bytes))
    filho.stderr?.resume()
    let erro
    filho.once('error', (e) => { erro = e })
    filho.once('close', (codigo, sinal) => {
      filhos.delete(filho)
      atualizarHandlers()
      if (erro || codigo !== 0) {
        // Nunca anexar argv, ambiente ou saída à exceção.
        falha(new Error(`comando ${programa} falhou (${sinal ?? codigo ?? 'execucao'})`))
      } else {
        const bytes = Buffer.concat(saida)
        ok(opcoes.encoding ? bytes.toString(opcoes.encoding) : bytes)
      }
    })
  })
  filhos.set(filho, fim)
  atualizarHandlers()
  return fim
}

export async function instalar({ raiz = raizPadrao, repos = REPOS, config = configuracao(), executar = comando } = {}) {
  // Preflight de todos os locks antes de tocar node_modules de qualquer repositorio.
  await verificar({ raiz, repos, config })
  await comAutenticacao(config, config.token, async (arquivo) => {
    for (const repo of repos) {
      await executar('pnpm', ['install', '--frozen-lockfile', `--config.@erp:registry=${config.registro}`, '--userconfig', arquivo], {
        cwd: join(raiz, repo), env: ambienteSemTokens(),
      })
    }
  })
}

export async function publicar({ raiz = raizPadrao, repos = PUBLICAVEIS, config = configuracao(), executar = comando } = {}) {
  if (!config.tokenPublicacao && new URL(config.registro).protocol !== 'http:') throw new Error('publicacao compartilhada exige ERP_NPM_TOKEN_PUBLICACAO')
  const pacotes = repos.map((repo) => ({ repo, pkg: JSON.parse(readFileSync(join(raiz, repo, 'package.json'), 'utf8')) }))
  for (const { pkg } of pacotes) {
    if (!/^@erp\/[a-z][a-z0-9-]*$/.test(pkg.name) || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('nome ou versao de pacote invalido')
  }
  prazoEncerramentoMs = config.encerramentoMs ?? configuracao().encerramentoMs
  // Nenhum build ou publish ocorre se uma das tres versoes ja existir.
  for (const { pkg } of pacotes) {
    const meta = await consultar(pkg.name, pkg.version, config, config.tokenPublicacao)
    if (meta) throw new Error(`${pkg.name}@${pkg.version} ja publicado; incremente a versao, nunca substitua o artefato`)
  }
  for (const { repo, pkg } of pacotes) {
    const origem = join(raiz, repo)
    const status = await executar('git', ['status', '--porcelain'], { cwd: origem, encoding: 'utf8', stdio: 'pipe', env: ambienteSemTokens() })
    if (String(status).trim()) throw new Error(`${repo}: publicacao exige arvore limpa e commit de origem`)
    const commit = String(await executar('git', ['rev-parse', 'HEAD'], { cwd: origem, encoding: 'utf8', stdio: 'pipe', env: ambienteSemTokens() })).trim()
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`${repo}: commit de origem invalido`)
    // tsc não remove saídas de fontes excluídas. Nunca empacotar dist de build anterior.
    rmSync(join(origem, 'dist'), { recursive: true, force: true })
    await executar('pnpm', ['build'], { cwd: origem, env: ambienteSemTokens() })
    const temporario = criarTemporario('mira-publicacao-', config)
    try {
      const conteudo = join(temporario, 'conteudo')
      cpSync(join(origem, 'dist'), join(conteudo, 'dist'), { recursive: true })
      for (const nome of ['README.md', 'LICENSE']) {
        if (existsSync(join(origem, nome))) cpSync(join(origem, nome), join(conteudo, nome))
      }
      // O npm respeita publishConfig do tarball. O destino deve ser o registro validado, nunca o local antigo.
      writeFileSync(join(conteudo, 'package.json'), JSON.stringify({
        ...pkg, scripts: undefined, publishConfig: { ...pkg.publishConfig, registry: config.registro }, erpOrigem: { commit },
      }, null, 2) + '\n')
      const saida = await executar('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporario], {
        cwd: conteudo, env: ambienteSemTokens(), encoding: 'utf8', stdio: 'pipe',
      })
      const [artefato] = JSON.parse(String(saida))
      if (!artefato?.filename || artefato.filename !== `${pkg.name.slice(1).replace('/', '-')}-${pkg.version}.tgz`) throw new Error('nome de tarball inesperado')
      const tarball = join(temporario, artefato.filename)
      const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`
      // Reconfere imediatamente antes da escrita. A imutabilidade atomica continua sendo dever do registro.
      if (await consultar(pkg.name, pkg.version, config, config.tokenPublicacao)) throw new Error(`${pkg.name}@${pkg.version} publicado por outro processo; abortado`)
      await comAutenticacao(config, config.tokenPublicacao, async (arquivo) => {
        await executar('npm', ['publish', tarball, '--ignore-scripts', '--registry', config.registro, '--userconfig', arquivo], {
          cwd: temporario, env: ambienteSemTokens(),
        })
      })
      const meta = await consultar(pkg.name, pkg.version, config, config.tokenPublicacao)
      if (!meta || meta.dist?.integrity !== integrity || meta.erpOrigem?.commit !== commit) throw new Error(`${pkg.name}@${pkg.version}: registro nao confirmou o artefato publicado`)
      console.log(`${pkg.name}@${pkg.version}: ${commit}, ${integrity}`)
    } finally { removerTemporario(temporario) }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const acao = process.argv[2]
    if (acao === 'verificar') console.log(`registro ok: ${await verificar()} versoes com integrity canonica`)
    else if (acao === 'instalar') await instalar()
    else if (acao === 'publicar') {
      const repo = process.argv[3]
      if (repo && !PUBLICAVEIS.includes(repo)) throw new Error('pacote deve ser erp-contratos, erp-nucleo ou erp-moldura')
      await publicar({ repos: repo ? [repo] : PUBLICAVEIS })
    }
    else if (acao === 'migrar-registro') await migrarRegistro()
    else throw new Error('uso: pacotes.mjs verificar|instalar|publicar|migrar-registro')
  } catch (erro) {
    // Nao imprimir resposta do registro, comando completo ou stack que possa conter credencial.
    console.error(erro instanceof Error && !('status' in erro) ? erro.message : 'operacao de pacotes falhou; confira o registro e a etapa anterior')
    process.exitCode = 1
  }
}
