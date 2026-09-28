// Contornos novos do auditor_b1_d1_9 contra os analisadores da K5 (N8 léxico, L3), chamando-os direto.
// Rodar da raiz: node .agents/auditor_b1_d1_9/anexos/contornos-it9.mjs
import { analisar as rede } from '../../../base/verificacao/saida-de-rede.mjs'
import { analisarSeguranca } from '../../../base/verificacao/seguranca-estatica.mjs'
const c = (id, desc, a, esperado = 'CAUGHT') => {
  const r = a.length ? 'CAUGHT' : 'SURVIVED'
  console.log(`${id} | ${desc} | ${r}${r === esperado ? '' : ' (INESPERADO: esperado ' + esperado + ')'} | ${a.length ? a.map((x) => `l${x.linha} ${x.motivo}`).join('; ').slice(0, 200) : '-'}`)
}
const nc = (f) => analisarSeguranca(f, 'next.config.ts')
const USO = "\nexport async function listar() { return fetch('http://alvo/x') }"

// --- N8: declarações que só existem no tipo (nada em tempo de execução) ---
c('XR20k', 'declare const fetch (ambiente, some na compilacao) + fetch direto', rede('declare const fetch: typeof globalThis.fetch' + USO))
c('XR20l', 'declare function fetch(...) + fetch direto', rede('declare function fetch(u: string): Promise<unknown>' + USO))
c('XR20m', 'declare var WebSocket + new WebSocket', rede("declare var WebSocket: any\nexport const s = () => new WebSocket('ws://alvo')"))
c('XR20n', "import type { fetch } (so tipo) + fetch direto", rede("import type { fetch } from './tipos'" + USO))
c('XR20o', "import { type fetch } (especificador so tipo) + fetch direto", rede("import { type fetch } from './tipos'" + USO))
c('XR20s', 'declare global { var fetch } (controle: nao liga)', rede('declare global { var fetch: any }' + USO))
c('XR20t', 'overload: function fetch(u): X; sem corpo e sem declare (so tipo) + fetch em outra funcao', rede('export function f(fetch: string): void\nexport function f(x: unknown) { return x }' + USO))
c('XR20u', 'expressao de classe com nome fetch (liga so dentro) + fetch fora', rede('const C = class fetch {}\nvoid C' + USO))
c('XR20v', 'expressao de funcao nomeada fetch + fetch fora', rede('const g = function fetch() {}\nvoid g' + USO))
c('XR20w', 'parametro fetch em tipo de funcao (type T = (fetch) => void) + fetch fora', rede('type T = (fetch: string) => void\nexport type U = T' + USO))
c('XR20x', 'parametro fetch em assinatura de interface + fetch fora', rede('interface I { m(fetch: string): void }\nexport type J = I' + USO))
c('XR20y', 'namespace fetch {} (valor em TS) + fetch no arquivo', rede('namespace fetch { export const a = 1 }' + USO))
c('XR20z', 'enum fetch {} (sombra real: local, controle de falso positivo)', rede('enum fetch { A }\nexport const x = fetch.A'), 'SURVIVED')
c('XR20aa', 'var fetch dentro de if, usado fora no mesmo corpo (JS: local; analisador: global, falso positivo aceito)', rede("export function f() { if (1) { var fetch = (u: string) => u } return fetch('x') }"))
c('XR20ab', 'parametro fetch com valor padrao que usa a global: (fetch = globalThis.fetch)', rede("export const f = (fetch = globalThis.fetch) => fetch('http://alvo')"))
c('XR20ac', 'static block de classe com const fetch + fetch fora', rede('class K { static { const fetch = 1; void fetch } }\nvoid K' + USO))
c('XR20ad', 'arrow com parametro fetch e corpo expressao; fetch fora', rede('const h = (fetch: unknown) => fetch\nvoid h' + USO))
c('XR20ae', 'label fetch: (nao liga) + fetch direto', rede('fetch: for (;;) { break fetch }' + USO))
// --- N8: carregadores fora da análise ---
c('XR40', "__non_webpack_require__('node:http') (require real do Node no bundle do Next)", rede("declare const __non_webpack_require__: (m: string) => any\nexport const h = () => __non_webpack_require__('node:http')"))
c('XR40b', "__non_webpack_require__ sem declare", rede("// @ts-ignore\nexport const h = () => __non_webpack_require__('node:http')"))
c('XR41', "module.require('http')", rede("export const h = () => (module as any).require('http')"))
c('XR42', "process.mainModule.require('http')", rede("export const h = () => (process as any).mainModule.require('http')"))
c('XR43', "require.call(null, 'http')", rede("export const h = () => require.call(null, 'http')"))
c('XR44', "const r = require; r('http')", rede("const r = require\nexport const h = () => r('http')"))
// --- N8: rede do navegador (use client): CSP é a defesa ---
c('XR45', "'use client' new WebTransport(url)", rede("'use client'\nexport const t = () => new WebTransport('https://fora')"))
c('XR46', "'use client' new Image().src = url (pixel)", rede("'use client'\nexport const t = () => { new Image().src = 'https://fora/p' }"))
c('XR47', "'use client' new Worker(url externo)", rede("'use client'\nexport const t = () => new Worker('https://fora/w.js')"))
c('XR48', "'use client' navigator.serviceWorker.register", rede("'use client'\nexport const t = () => navigator.serviceWorker.register('/sw.js')"))
// --- L3 (XN09): formas de atribuição que não são '=' ---
c('XN09h', 'config.assetPrefix ??= process.env.X', nc("const config: Record<string, unknown> = {}\nconfig.assetPrefix ??= process.env.DOMINIO_A_URL\nexport default config"))
c('XN09i', 'config.basePath ||= process.env.X', nc("const config: Record<string, unknown> = {}\nconfig.basePath ||= process.env.X\nexport default config"))
c('XN09j', "Object.defineProperty(config, 'assetPrefix', { value: x })", nc("const config = {}\nObject.defineProperty(config, 'assetPrefix', { value: process.env.DOMINIO_A_URL, enumerable: true })\nexport default config"))
c('XN09k', 'desestruturacao com renomeio: const { assetPrefix: ap } ... (controle: leitura, nao escrita)', nc("const config = { assetPrefix: '/z' }\nconst { assetPrefix: ap } = config\nvoid ap\nexport default config"), 'SURVIVED')
c('XN09l', 'metodo que devolve a config: export default () => ({ assetPrefix: x })', nc("export default () => ({ assetPrefix: process.env.DOMINIO_A_URL })"))
c('XN09m', "assetPrefix por template com expressao na propriedade", nc("export default { assetPrefix: `${process.env.DOMINIO_A_URL}` }"))
c('XN09n', "config.assetPrefix += process.env.X", nc("const config = { assetPrefix: '' }\nconfig.assetPrefix += process.env.DOMINIO_A_URL\nexport default config"))
c('XN09o', "Object.assign(config, { assetPrefix })", nc("const assetPrefix = process.env.DOMINIO_A_URL\nconst config = {}\nObject.assign(config, { assetPrefix })\nexport default config"))
