// Contornos do auditor_b1_d1_4: chama os analisadores direto. Cada caso DEVERIA ser pego.
// Rodar da raiz: node .agents/auditor_b1_d1_4/anexos/contornos.mjs
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analisarSeguranca } from '../../../base/verificacao/seguranca-estatica.mjs'
import { analisar as analisarRede, moduloPermitido } from '../../../base/verificacao/saida-de-rede.mjs'

const app = mkdtempSync(join(tmpdir(), 'aud4-'))
for (const d of ['app', 'app/x', 'lib', 'componentes']) mkdirSync(join(app, d), { recursive: true })
const w = (p, t) => writeFileSync(join(app, p), t)
w('app/Ilha.tsx', "'use client'\nexport function Ilha() { return null }\nexport default function D() { return null }\n")
w('app/acoes.ts', "'use server'\nexport async function acao() {}\n")
w('lib/nucleo.ts', "import 'server-only'\nexport const nucleo = {}\n")
w('lib/pagina.ts', "import 'server-only'\nexport const acaoProtegida = () => {}\n")
w('app/x/ajuda.ts', "import { nucleo } from '@/lib/nucleo'\nexport const revogar = (id) => nucleo.destino('g').post('/v2/acessos/:id/revogacao', { params: { id } })\n")
w('app/falso.ts', "export const acaoProtegida = (r, d, f) => f()\n")
w('app/barril2.ts', "import { Ilha } from './Ilha'\nexport const Outra = Ilha\n")
w('app/barril3.ts', "import { Ilha } from './Ilha'\nexport { Ilha as Terceira }\n")
w('app/barril4.ts', "export { default } from './Ilha'\n")
w('app/nav.ts', "import Link from 'next/link'\nexport const Ir = Link\n")
w('app/rotas.ts', "export const ZONA2 = '/zona2'\n")
const pg = join(app, 'app', 'x', 'page.tsx')
const imp = "import { Ilha } from '../Ilha'\n"
const out = []
const caso = (id, desc, achados) => out.push(`${id} | ${desc} | ${achados.length ? 'CAUGHT' : 'SURVIVED'}${achados.length ? ' | ' + achados[0].motivo : ''}`)
const seg = (fonte, nome = pg, zona = null, extra = {}) => analisarSeguranca(fonte, nome, zona, { raizDaApp: app, ...extra })

// ---- inv. 2: valorSeguro / ilha ------------------------------------------------------------------
caso('XA01', 'inv2 valorSeguro: objeto por acesso de propriedade (w.v e o DTO inteiro)', seg(imp + 'export const P = ({ p }) => { const w = { v: p }; return <Ilha dados={w.v} /> }'))
caso('XA02', 'inv2 valorSeguro: props.pessoa (objeto) passa por ser x.campo', seg(imp + 'export const P = (props) => <Ilha dados={props.pessoa} />'))
caso('XA03', 'inv2 spread de x.campo objeto na ilha', seg(imp + 'export const P = (props) => <Ilha {...props.pessoa} />'))
caso('XA04', 'inv2 x.campo ?? literal devolve o objeto', seg(imp + 'export const P = ({ r }) => <Ilha dados={r.corpo ?? null} />'))
caso('XA05', 'inv2 objeto literal com x.campo objeto', seg(imp + 'export const P = ({ r }) => <Ilha campos={{ a: r.body }} />'))
caso('XA06', 'inv2 array com x.campo objeto', seg(imp + 'export const P = ({ r }) => <Ilha itens={[r.body]} />'))
caso('XA07', 'inv2 React.createElement(Ilha, { dados: p }) sem JSX', seg(imp + "import { createElement } from 'react'\nexport const P = ({ p }) => createElement(Ilha, { dados: p })"))
caso('XA08', 'inv2 ilha por next/dynamic', seg("import dynamic from 'next/dynamic'\nconst I = dynamic(() => import('../Ilha').then((m) => m.Ilha))\nexport const P = ({ p }) => <I dados={p} />"))
caso('XA09', 'inv2 ilha reexportada por const em barril (export const Outra = Ilha)', seg("import { Outra } from '../barril2'\nexport const P = ({ p }) => <Outra dados={p} />"))
caso('XA10', 'inv2 ilha reexportada por export { Ilha as T } sem from', seg("import { Terceira } from '../barril3'\nexport const P = ({ p }) => <Terceira dados={p} />"))
caso('XA11', 'inv2 ilha default por barril export { default } from', seg("import D from '../barril4'\nexport const P = ({ p }) => <D dados={p} />"))
caso('XA12', 'inv2 apelido condicional (const C = x ? Ilha : Ilha)', seg(imp + 'export const P = ({ p, x }) => { const C = x ? Ilha : Ilha; return <C dados={p} /> }'))
caso('XA13', 'inv2 apelido por objeto (const M = { Ilha }; <M.Ilha>)', seg(imp + 'const M = { Ilha }\nexport const P = ({ p }) => <M.Ilha dados={p} />'))
caso('XA14', 'inv2 filho da ilha dentro de elemento aninhado passa x.obj a outra ilha? (JSX filho qualquer)', seg(imp + 'export const P = ({ p }) => <Ilha>{[p]}</Ilha>'))
caso('XA15', 'inv2 prop por identificador importado de modulo use server que nao e acao (export const)', (w('app/acoes2.ts', "'use server'\nexport const dados = { cpf: '1' }\n"), seg("import { Ilha } from '../Ilha'\nimport { dados } from '../acoes2'\nexport const P = () => <Ilha d={dados} />")))
caso('XA16', 'inv2 this.props.pessoa', seg(imp + 'export class P { render() { return <Ilha d={this.props.pessoa} /> } }'))
caso('XA17', 'inv2 Number(x.obj) aceito (inofensivo, controle)', seg(imp + 'export const P = ({ r }) => <Ilha n={Number(r.v)} />'))
caso('XA18', 'inv2 prop por x?.campo (optional chaining) objeto', seg(imp + 'export const P = ({ r }) => <Ilha d={r?.body} />'))
caso('XA19', 'inv2 ilha de pacote externo (nao moldura) com use client', seg("import { Grafico } from 'biblioteca-graficos'\nexport const P = ({ p }) => <Grafico dados={p} />"))
caso('XA20', 'inv2 moldura por namespace e apelido (const F = m.FormularioDeAcao)', seg("import * as m from '@erp/moldura'\nconst F = m.FormularioDeAcao\nexport const P = ({ p }) => <F campos={p} />"))

// ---- inv. 5: P0-acao-protegida -------------------------------------------------------------------
const a = (corpo) => seg("'use server'\nimport { nucleo } from '@/lib/nucleo'\nimport { acaoProtegida } from '@/lib/pagina'\n" + corpo, join(app, 'app', 'x', 'acoes.ts'))
const a2 = (cab, corpo) => seg("'use server'\n" + cab + corpo, join(app, 'app', 'x', 'acoes.ts'))
caso('XP01', 'inv5 apelido do nucleo no import (nucleo as n) antes da protecao', a2("import { nucleo as n } from '@/lib/nucleo'\nimport { acaoProtegida } from '@/lib/pagina'\n", "export async function r(f) { return acaoProtegida((await n.destino('g').post('/v', {}), { administra: true }), '/acesso', async () => ({ destino: '/acesso' })) }"))
caso('XP02', 'inv5 argumento do acaoProtegida avaliado antes (dominio no 2o argumento, nucleo literal)', a("export async function r(f) { return acaoProtegida({ administra: true }, (await nucleo.destino('g').post('/v', {}), '/acesso'), async () => ({ destino: '/acesso' })) }"))
caso('XP03', 'inv5 helper local do app que chama o dominio, chamado no argumento', a2("import { revogar } from './ajuda'\nimport { acaoProtegida } from '@/lib/pagina'\n", "export async function r(f) { return acaoProtegida({ administra: true }, (await revogar(String(f.get('acesso'))), '/acesso'), async () => ({ destino: '/acesso' })) }"))
caso('XP04', 'inv5 acaoProtegida falsa definida no proprio arquivo', a2("import { nucleo } from '@/lib/nucleo'\nconst acaoProtegida = (r, d, f) => f()\n", "export async function r(f) { return acaoProtegida({ administra: true }, '/acesso', async () => { await nucleo.destino('g').post('/v', {}); return { destino: '/acesso' } }) }"))
caso('XP05', 'inv5 acaoProtegida importada de modulo falso', a2("import { nucleo } from '@/lib/nucleo'\nimport { acaoProtegida } from '../falso'\n", "export async function r(f) { return acaoProtegida({ administra: true }, '/acesso', async () => { await nucleo.destino('g').post('/v', {}); return { destino: '/acesso' } }) }"))
caso('XP06', 'inv5 action inline com use server dentro de page.tsx, dominio antes', seg("import { nucleo } from '@/lib/nucleo'\nimport { acaoProtegida } from '@/lib/pagina'\nexport default function P() { async function r(f) { 'use server'; await nucleo.destino('g').post('/v', {}); return acaoProtegida({ administra: true }, '/acesso', async () => ({ destino: '/acesso' })) } return <form action={r} /> }"))
caso('XP07', 'inv5 namespace import do nucleo (import * as L; L.nucleo)', a2("import * as L from '@/lib/nucleo'\nimport { acaoProtegida } from '@/lib/pagina'\n", "export async function r(f) { await L.nucleo.destino('g').post('/v', {}); return acaoProtegida({ administra: true }, '/a', async () => ({ destino: '/a' })) }"))
caso('XP08', 'inv5 default param com efeito (export async function r(f, x = await dominio()))', a("export async function r(f, x = nucleo.destino('g').post('/v', {})) { return acaoProtegida({ administra: true }, '/a', async () => ({ destino: '/a' })) }"))
caso('XP09', 'inv5 export const com funcao nao-arrow em let depois reatribuida', a("export let r = async (f) => acaoProtegida({ administra: true }, '/a', async () => ({ destino: '/a' }))\nr = async (f) => { await nucleo.destino('g').post('/v', {}) }"))
caso('XP10', 'inv5 dois declarators: export const a = ok, b = sem protecao', a("export const r = async (f) => acaoProtegida({ administra: true }, '/a', async () => ({ destino: '/a' })), s = async (f) => { await nucleo.destino('g').post('/v', {}) }"))
caso('XP11', 'inv5 sessao lida por next/headers cookies() antes da protecao (sem nucleo)', a2("import { cookies } from 'next/headers'\nimport { acaoProtegida } from '@/lib/pagina'\n", "export async function r(f) { return acaoProtegida({ administra: true }, ((await cookies()).delete('__Host-session'), '/a'), async () => ({ destino: '/a' })) }"))
caso('XP12', 'inv5 import de nucleo via outro nome de modulo (@/lib/pagina reexporta nucleo)', a2("import { acaoProtegida, nucleoDaPagina } from '@/lib/pagina'\n", "export async function r(f) { await nucleoDaPagina.destino('g').post('/v', {}); return acaoProtegida({ administra: true }, '/a', async () => ({ destino: '/a' })) }"))

// ---- inv. 3: exigirServerOnly --------------------------------------------------------------------
const lib = (f, nome = 'lib/y.ts') => analisarSeguranca(f, join(app, nome), null, { raizDaApp: app, exigirServerOnly: true })
caso('XS01', 'inv3 lib com process.env de segredo sem server-only (nao importa servidor)', lib("export const TOKEN = process.env.DOMINIO_TOKEN\n"))
caso('XS02', 'inv3 lib importa node:fs e le sessao do disco sem server-only', lib("import { readFileSync } from 'node:fs'\nexport const s = (id) => readFileSync('/tmp/erp-sessoes/' + id, 'utf8')\n"))
caso('XS03', "inv3 server-only dentro de bloco (if) nao e topo", lib("if (true) { }\nimport { cookies } from 'next/headers'\nexport const c = cookies"))
caso('XS04', 'inv3 lib importa ../lib/nucleo por caminho relativo sem server-only', lib("import { nucleo } from '../lib/nucleo'\nexport const n = nucleo\n", 'componentes/z.ts'))
caso('XS05', "inv3 lib importa 'server-only' com tipo (import type) conta?", lib("import type {} from 'server-only'\nimport { cookies } from 'next/headers'\nexport const c = cookies"))

// ---- inv. 11: next.config / NEXT_PUBLIC --------------------------------------------------------
const nc = (f, nome = 'next.config.ts') => analisarSeguranca(f, nome)
caso('XN01', 'inv11 next.config: cfg.env = {...} por atribuicao', nc("const cfg = {}\ncfg.env = { DOMINIO: process.env.DOMINIO_A_URL }\nexport default cfg"))
caso('XN02', "inv11 next.config: chave calculada ['env']", nc("export default { ['env']: { DOMINIO: process.env.DOMINIO_A_URL } }"))
caso('XN03', 'inv11 next.config: Object.assign(cfg, { env })', nc("const e = { DOMINIO: process.env.DOMINIO_A_URL }\nexport default Object.assign({}, JSON.parse('{\"env\":1}'), { ['e' + 'nv']: e })"))
caso('XN04', 'inv11 next.config importando configuracao de outro arquivo', nc("import extra from './config/extra.mjs'\nexport default { ...extra }"))
caso('XN05', 'inv11 next.config.js (commonjs) com env', nc("module.exports = { env: { D: process.env.DOMINIO_A_URL } }", 'next.config.js'))
caso('XN06', 'inv11 next.config: compiler.defineServer? (controle, deveria ser ok)', nc("export default { compiler: { defineServer: { A: '1' } } }"))
caso('XN07', 'inv11 NEXT_PUBLIC por concatenacao de strings', analisarSeguranca("const t = process.env['NEXT_' + 'PUBLIC_TOKEN']"))
caso('XN08', 'inv11 next.config com rewrites para dominio interno (expoe endpoint via proxy publico)', nc("export default { async rewrites() { return [{ source: '/api/x/:p*', destination: 'http://127.0.0.1:4001/:p*' }] } }"))
caso('XN09', 'inv11 next.config: experimental.serverActions? env em assetPrefix de variavel interna', nc("export default { assetPrefix: process.env.DOMINIO_A_URL }"))

// ---- P1: Link / router -------------------------------------------------------------------------
const z1 = (f) => analisarSeguranca(f, join(app, 'app', 'zona1', 'page.tsx'), 'zona1', { raizDaApp: app })
caso('XL01', 'P1 router.push(variavel) para outra zona', z1("'use client'\nimport { useRouter } from 'next/navigation'\nconst D = '/zona2'\nexport function M() { const r = useRouter(); r.push(D) }"))
caso('XL02', 'P1 push desestruturado de useRouter', z1("'use client'\nimport { useRouter } from 'next/navigation'\nexport function M() { const { push } = useRouter(); push('/zona2') }"))
caso('XL03', 'P1 Link por apelido exportado de barril (export const Ir = Link)', z1("import { Ir } from '../nav'\nexport const M = () => <Ir href='/zona2'>x</Ir>"))
caso('XL04', "P1 router['push']('/zona2')", z1("'use client'\nimport { useRouter } from 'next/navigation'\nexport function M() { const r = useRouter(); r['push']('/zona2') }"))
caso('XL05', 'P1 redirect de next/navigation para outra zona (controle: permitido?)', z1("import { redirect } from 'next/navigation'\nexport default function M() { redirect('/zona2') }"))
caso('XL06', 'P1 href por constante importada', z1("import Link from 'next/link'\nimport { ZONA2 } from '../rotas'\nexport const M = () => <Link href={ZONA2}>x</Link>"))

// ---- inv. 4: N8 (saida-de-rede) ----------------------------------------------------------------
const rede = (f, n = 'x.ts') => analisarRede(f, n)
caso('XR20', 'inv4 fetch sombreado por parametro (declarados global) mas usado como global noutro escopo', rede("function f(fetch) { return fetch }\nexport const g = () => fetch('http://evil')"))
caso('XR21', 'inv4 new Request + Response? (nao faz rede) controle', rede("export const r = new Request('http://evil')"))
caso('XR22', 'inv4 import de @erp/nucleo/testing (permitido?) usado para fetch cru', rede("import { algo } from '@erp/nucleo/testing'\nexport const x = algo"))
caso('XR23', 'inv4 next/dist/compiled/undici via pacote permitido next/*', rede("import { request } from 'next/dist/compiled/undici'\nexport const x = () => request('http://evil')"))
caso('XR24', 'inv4 next/dist/compiled/node-fetch', rede("import nf from 'next/dist/compiled/node-fetch'\nexport const x = () => nf('http://evil')"))
caso('XR25', 'inv4 fs.writeFileSync em /dev/tcp? (sem rede) controle', rede("import { writeFileSync } from 'node:fs'\nexport const x = 1"))
caso('XR26', 'inv4 fetch como shorthand property {fetch}', rede("export const o = { fetch }\nexport const y = () => o.fetch('http://evil')"))
caso('XR27', 'inv4 variavel local chamada fetch declarada em outro escopo torna global invisivel', rede("export function a() { const fetch = 1; return fetch }\nexport const b = () => fetch('http://evil')"))
caso('XR28', 'inv4 globalThis via Function.prototype? (new.target) - Object.getPrototypeOf(async function(){}).constructor', rede("export const x = Object.getPrototypeOf(async function () {})['const' + 'ructor']('return fetch')"))
caso('XR29', 'inv4 import de react-dom/server? preload de recurso externo (controle)', rede("import { preload } from 'react-dom'\nexport const x = () => preload('http://evil/x.js', { as: 'script' })"))
caso('XR30', 'inv4 next/server after/fetch? import { NextResponse } redirect para fora (controle)', rede("import { NextResponse } from 'next/server'\nexport const x = () => NextResponse.rewrite(new URL('http://127.0.0.1:4001/v1/recursos'))"))
caso('XR31', 'inv4 importar crypto.subtle? controle / util.promisify(dns)? dns via process.binding', rede("export const x = process['bind' + 'ing']('tcp_wrap')"))
caso('XR32', 'inv4 require de modulo por createRequire vindo de next/dist', rede("import { createRequire } from 'node:module'\nexport const x = 1"))
caso('XR33', 'inv4 global Reflect.apply com fetch obtido por getter de objeto importado', rede("import * as g from 'node:timers'\nexport const x = 1"))
caso('XR34', 'inv4 eval indireto por setTimeout com string', rede("export const x = () => setTimeout('fetch(\"http://evil\")', 0)"))
caso('XR35', 'inv4 import() de URL data:', rede("export const x = () => import('data:text/javascript,export default 1')"))
caso('XR36', 'inv4 moduloPermitido: nextjs prefixo (next-auth passa por startsWith next/?)', [moduloPermitido('next-auth') ? null : 1].filter(Boolean).length ? [] : [{ motivo: 'next-auth aceito' }].slice(0, moduloPermitido('next-auth') ? 1 : 0))
caso('XR37', 'inv4 fetch em arquivo .cjs/.js de app que fontesDaApp nao lista? (test/ pulado)', [])

for (const l of out) console.log(l)
