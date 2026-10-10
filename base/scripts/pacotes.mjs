import { execFileSync } from 'node:child_process'
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
  for (const chave of ['ERP_NPM_TOKEN', 'ERP_NPM_TOKEN_PUBLICACAO']) {
    if (env[chave] && /[\r\n\0]/.test(env[chave])) throw new Error(`${chave} invalido`)
  }
  return { registro: url.href, timeoutMs, token: env.ERP_NPM_TOKEN, tokenPublicacao: env.ERP_NPM_TOKEN_PUBLICACAO }
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

async function comAutenticacao(config, token, executar) {
  const dir = mkdtempSync(join(tmpdir(), 'mira-npm-'))
  const arquivo = join(dir, 'auth.ini')
  const url = new URL(config.registro)
  writeFileSync(arquivo, token ? `//${url.host}${url.pathname}:_authToken=${token}\n` : '', { mode: 0o600 })
  try { return await executar(arquivo) } finally { rmSync(dir, { recursive: true, force: true }) }
}

const comando = (programa, args, opcoes) => execFileSync(programa, args, { stdio: 'inherit', ...opcoes })

export async function instalar({ raiz = raizPadrao, repos = REPOS, config = configuracao(), executar = comando } = {}) {
  // Preflight de todos os locks antes de tocar node_modules de qualquer repositorio.
  await verificar({ raiz, repos, config })
  await comAutenticacao(config, config.token, async (arquivo) => {
    for (const repo of repos) {
      executar('pnpm', ['install', '--frozen-lockfile', `--config.@erp:registry=${config.registro}`, `--config.npmrcAuthFile=${arquivo}`], {
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
  // Nenhum build ou publish ocorre se uma das tres versoes ja existir.
  for (const { pkg } of pacotes) {
    const meta = await consultar(pkg.name, pkg.version, config, config.tokenPublicacao)
    if (meta) throw new Error(`${pkg.name}@${pkg.version} ja publicado; incremente a versao, nunca substitua o artefato`)
  }
  for (const { repo, pkg } of pacotes) {
    const origem = join(raiz, repo)
    const status = executar('git', ['status', '--porcelain'], { cwd: origem, encoding: 'utf8', stdio: 'pipe', env: ambienteSemTokens() })
    if (String(status).trim()) throw new Error(`${repo}: publicacao exige arvore limpa e commit de origem`)
    const commit = String(executar('git', ['rev-parse', 'HEAD'], { cwd: origem, encoding: 'utf8', stdio: 'pipe', env: ambienteSemTokens() })).trim()
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`${repo}: commit de origem invalido`)
    executar('pnpm', ['build'], { cwd: origem, env: ambienteSemTokens() })
    const temporario = mkdtempSync(join(tmpdir(), 'mira-publicacao-'))
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
      const saida = executar('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporario], {
        cwd: conteudo, env: ambienteSemTokens(), encoding: 'utf8', stdio: 'pipe',
      })
      const [artefato] = JSON.parse(String(saida))
      if (!artefato?.filename || artefato.filename !== `${pkg.name.slice(1).replace('/', '-')}-${pkg.version}.tgz`) throw new Error('nome de tarball inesperado')
      const tarball = join(temporario, artefato.filename)
      const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`
      // Reconfere imediatamente antes da escrita. A imutabilidade atomica continua sendo dever do registro.
      if (await consultar(pkg.name, pkg.version, config, config.tokenPublicacao)) throw new Error(`${pkg.name}@${pkg.version} publicado por outro processo; abortado`)
      await comAutenticacao(config, config.tokenPublicacao, async (arquivo) => {
        executar('npm', ['publish', tarball, '--ignore-scripts', '--registry', config.registro, '--userconfig', arquivo], {
          cwd: temporario, env: ambienteSemTokens(),
        })
      })
      const meta = await consultar(pkg.name, pkg.version, config, config.tokenPublicacao)
      if (!meta || meta.dist?.integrity !== integrity || meta.erpOrigem?.commit !== commit) throw new Error(`${pkg.name}@${pkg.version}: registro nao confirmou o artefato publicado`)
      console.log(`${pkg.name}@${pkg.version}: ${commit}, ${integrity}`)
    } finally { rmSync(temporario, { recursive: true, force: true }) }
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
