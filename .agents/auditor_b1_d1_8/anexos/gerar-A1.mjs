import { writeFileSync } from 'node:fs'
const N = 'cd repos/erp-nucleo && pnpm test 2>&1'
const ST = 'cd repos/erp-dominio-stub && pnpm test 2>&1'
const SH = 'cd repos/erp-shell && pnpm test 2>&1'
const SC = 'node --test base/scripts/*.test.mjs 2>&1'
const nu = 'repos/erp-nucleo/src/'
const s = (id, inv, desc, cmd, edicoes) => ({ id, inv, desc, cmd, edicoes })
const add = (arquivo, texto) => ({ arquivo, de: '\n', para: '\n', todas: false, _add: texto })
const L = [
  s('N08b', 'inv. 3', "import 'server-only' trocado por template literal com o import na linha do meio", N,
    [{ arquivo: nu + 'adaptadores/sessao-redis.ts', de: "import 'server-only'\n", para: "export const _x = `\nimport 'server-only'\n`\n" }]),
  s('N36b', 'config', 'TIMEOUT_PADRAO_MS lido mas nao usado (60 s fixo)', N,
    [{ arquivo: nu + 'interno/destinos.ts', de: 'AbortSignal.timeout(d.timeoutMs ?? TIMEOUT_PADRAO_MS)', para: 'AbortSignal.timeout(d.timeoutMs ?? 60_000)' }]),
  s('N53', 'inv. 5', 'origemPermitida aceita Sec-Fetch-Site same-site', N,
    [{ arquivo: nu + 'fabricas/criarPaginas.ts', de: "if (site && site !== 'same-origin') return false", para: "if (site && site !== 'same-origin' && site !== 'same-site') return false" }]),
  s('A05', '-', 'reduzirEu aceita nome de modulo vazio', N,
    [{ arquivo: nu + 'interno/acesso-v2.ts', de: "if (typeof m.nome !== 'string' || m.nome.length === 0) return invalido()", para: "if (typeof m.nome !== 'string') return invalido()" }]),
  s('N38b', 'inv. 15', '/app reexporta sessaoRedisDeEscrita as lojaDeSessao, aspas duplas', N,
    [{ arquivo: nu + 'app/index.ts', de: "} from '../fabricas/criarPaginas.js'\n", para: "} from '../fabricas/criarPaginas.js'\nexport { sessaoRedisDeEscrita as lojaDeSessao } from \"../adaptadores/sessao-redis.js\"\n" }]),
  s('N38c', 'inv. 15', 'raiz reexporta sessaoArquivoDeEscrita as sessaoArquivoCompleta', N,
    [{ arquivo: nu + 'index.ts', de: "export { acessoHttp } from './adaptadores/acesso-http.js'\n", para: "export { acessoHttp } from './adaptadores/acesso-http.js'\nexport { sessaoArquivoDeEscrita as sessaoArquivoCompleta } from './adaptadores/sessao-arquivo.js'\n" }]),
  s('N38d', 'inv. 15', 'raiz exporta embrulho do escritor: sessaoRedisCompleta = (...a) => sessaoRedisDeEscrita(...a)', N,
    [{ arquivo: nu + 'index.ts', de: "export { acessoHttp } from './adaptadores/acesso-http.js'\n", para: "export { acessoHttp } from './adaptadores/acesso-http.js'\nimport { sessaoRedisDeEscrita } from './adaptadores/sessao-redis.js'\nexport const sessaoRedisCompleta = (...a: Parameters<typeof sessaoRedisDeEscrita>) => sessaoRedisDeEscrita(...a)\n" }]),
  s('N38e', 'inv. 15', '/app exporta objeto { criar: criarNucleoDoShell }', N,
    [{ arquivo: nu + 'app/index.ts', de: "} from '../fabricas/criarPaginas.js'\n", para: "} from '../fabricas/criarPaginas.js'\nimport { criarNucleoDoShell } from '../fabricas/criarNucleo.js'\nexport const kit = { criar: criarNucleoDoShell }\n" }]),
  s('N38f', 'inv. 15', '/app exporta criarNucleoCompleto = (c) => criarNucleoDoShell(c)', N,
    [{ arquivo: nu + 'app/index.ts', de: "} from '../fabricas/criarPaginas.js'\n", para: "} from '../fabricas/criarPaginas.js'\nimport { criarNucleoDoShell } from '../fabricas/criarNucleo.js'\nexport const criarNucleoCompleto = (c: Parameters<typeof criarNucleoDoShell>[0]) => criarNucleoDoShell(c)\n" }]),
  // novas (fronteira K3/K4)
  s('N38g', 'inv. 15', 'NOVA: embrulho declarado no PROPRIO arquivo definidor (fabricas/criarNucleo.ts: criarNucleoCompleto = (c) => criarNucleoDoShell(c)) e reexportado por /app', N,
    [{ arquivo: nu + 'fabricas/criarNucleo.ts', de: 'export function criarNucleoDoShell(', para: 'export const criarNucleoCompleto = (c: ConfigDoNucleoDoShell) => criarNucleoDoShell(c)\nexport function criarNucleoDoShell(' },
     { arquivo: nu + 'app/index.ts', de: "} from '../fabricas/criarPaginas.js'\n", para: "} from '../fabricas/criarPaginas.js'\nexport { criarNucleoCompleto } from '../fabricas/criarNucleo.js'\n" }]),
  s('N38h', 'inv. 15', 'NOVA: embrulho no arquivo definidor (adaptadores/sessao-redis.ts: sessaoRedisPlena) reexportado pela raiz', N,
    [{ arquivo: nu + 'adaptadores/sessao-redis.ts', de: 'export function sessaoRedisDeEscrita(', para: 'export const sessaoRedisPlena = (c: ConfigSessaoRedis) => sessaoRedisDeEscrita(c)\nexport function sessaoRedisDeEscrita(' },
     { arquivo: nu + 'index.ts', de: "export { acessoHttp } from './adaptadores/acesso-http.js'\n", para: "export { acessoHttp } from './adaptadores/acesso-http.js'\nexport { sessaoRedisPlena } from './adaptadores/sessao-redis.js'\n" }]),
  s('N38i', 'inv. 15', 'NOVA: o leitor da raiz (sessaoRedis) devolve o escritor quando a config pede escrita', N,
    [{ arquivo: nu + 'adaptadores/sessao-redis.ts', de: 'export function sessaoRedis(cfg: ConfigSessaoRedis<ClienteRedisDeLeitura>): LeitorDeSessao {\n', para: 'export function sessaoRedis(cfg: ConfigSessaoRedis<ClienteRedisDeLeitura> & { escrita?: boolean }): LeitorDeSessao {\n  if (cfg.escrita) return sessaoRedisDeEscrita(cfg as ConfigSessaoRedis)\n' }]),
  s('N38k', 'inv. 15', 'NOVA: adaptador de escrita novo (adaptadores/sessao-memoria.ts, sessaoMemoriaDeEscrita com gravar/remover) exportado pela raiz', N,
    [{ arquivo: nu + 'adaptadores/sessao-memoria.ts', novo: true, para: "import 'server-only'\nimport type { StoreDeSessao, SessaoArmazenada } from '../portas/sessao.js'\nexport function sessaoMemoriaDeEscrita(): StoreDeSessao {\n  const m = new Map<string, SessaoArmazenada>()\n  return {\n    async ler(id) { return m.get(id) ?? null },\n    async gravar(id, s) { m.set(id, s) },\n    async remover(id) { m.delete(id) },\n  } as StoreDeSessao\n}\n" },
     { arquivo: nu + 'index.ts', de: "export { acessoHttp } from './adaptadores/acesso-http.js'\n", para: "export { acessoHttp } from './adaptadores/acesso-http.js'\nexport { sessaoMemoriaDeEscrita } from './adaptadores/sessao-memoria.js'\n" }]),
  s('G02', 'mock', 'token dev sem ancora ^', ST,
    [{ arquivo: 'repos/erp-dominio-stub/src/gestao-acesso-v2/servidor.mjs', de: '/^Bearer dev\\.', para: '/Bearer dev\\.' }]),
  s('G05', 'mock', '/v2/eu sem usuario responde 200 {}', ST,
    [{ arquivo: 'repos/erp-dominio-stub/src/gestao-acesso-v2/servidor.mjs', de: "if (!usuario) return erro(res, 401, 'SESSAO_EXPIRADA')\n      const p = pessoa(usuario)", para: "if (!usuario) return json(res, 200, {})\n      const p = pessoa(usuario)" }]),
  s('S05', 'L3', 'TTL padrao da sonda 1 s -> 10 s', SH,
    [{ arquivo: 'repos/erp-shell/lib/saude-zonas.ts', de: "lerNumeroPositivo(process.env.ERP_SONDA_TTL_MS, 1000,", para: "lerNumeroPositivo(process.env.ERP_SONDA_TTL_MS, 10_000," }]),
  s('S17', 'L1', 'so "saudavel" entra no cache', SH,
    [{ arquivo: 'repos/erp-shell/lib/saude-zonas.ts', de: 'cache.set(urlSaude, { saudavel, expiraEm: Date.now() + ttlMs })', para: 'if (saudavel) cache.set(urlSaude, { saudavel, expiraEm: Date.now() + ttlMs })' }]),
  s('S17b', 'L1', '"fora" entra no cache com validade de 1 ms', SH,
    [{ arquivo: 'repos/erp-shell/lib/saude-zonas.ts', de: 'cache.set(urlSaude, { saudavel, expiraEm: Date.now() + ttlMs })', para: 'cache.set(urlSaude, { saudavel, expiraEm: Date.now() + (saudavel ? ttlMs : 1) })' }]),
  s('S17c', 'L1', 'NOVA: "fora" no cache por 1/10 do TTL (100 ms com TTL 1 s)', SH,
    [{ arquivo: 'repos/erp-shell/lib/saude-zonas.ts', de: 'cache.set(urlSaude, { saudavel, expiraEm: Date.now() + ttlMs })', para: 'cache.set(urlSaude, { saudavel, expiraEm: Date.now() + (saudavel ? ttlMs : ttlMs / 10) })' }]),
  s('AM1', 'verificacao', 'precisaConstruir ignora app/', SC,
    [{ arquivo: 'base/scripts/ambiente.mjs', de: "const ENTRADAS_DO_BUILD = ['app', ", para: "const ENTRADAS_DO_BUILD = [" }]),
  s('AM2', 'verificacao', 'precisaConstruir ignora zonas.json e acesso.manifesto.ts', SC,
    [{ arquivo: 'base/scripts/ambiente.mjs', de: ", 'zonas.json', 'acesso.manifesto.ts']", para: ']' }]),
  s('AM3', 'verificacao', 'subir nao confere porta ocupada', SC,
    [{ arquivo: 'base/scripts/ambiente.mjs', de: 'if (!livre) throw new Error(', para: 'if (false && !livre) throw new Error(' }]),
  s('AM1b', 'verificacao', 'maisRecente so olha o primeiro nivel da pasta', SC,
    [{ arquivo: 'base/scripts/ambiente.mjs', de: 'readdirSync(caminho).map((n) => maisRecente(join(caminho, n)))', para: 'readdirSync(caminho).map((n) => statSync(join(caminho, n)).mtimeMs)' }]),
]
writeFileSync(new URL('./A1.json', import.meta.url), JSON.stringify(L.map(({ _add, ...x }) => x), null, 1))
