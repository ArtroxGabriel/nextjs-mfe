// Reaplica os contornos sobreviventes da iteração 3 (reconstruídos das descrições de mutacoes.txt).
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analisarSeguranca } from '../../../base/verificacao/seguranca-estatica.mjs'
import { analisar } from '../../../base/verificacao/saida-de-rede.mjs'
import { temServerOnly } from '../../../repos/erp-nucleo/scripts/fronteira.mjs'
const app = mkdtempSync(join(tmpdir(), 'aud4b-'))
mkdirSync(join(app, 'app', 'zona1'), { recursive: true }); mkdirSync(join(app, 'lib'))
const w = (p, t) => writeFileSync(join(app, p), t)
w('app/Ilha.tsx', "'use client'\nexport function Ilha() { return null }\n")
w('app/index.ts', "export { Ilha } from './Ilha'\n")
w('app/dados.ts', "export const pessoa = { cpf: '1' }\n")
w('app/nav.ts', "export { default as Link } from 'next/link'\n")
const pg = join(app, 'app', 'p.tsx'), z1 = join(app, 'app', 'zona1', 'page.tsx')
const s = (f, n = pg, z = null) => analisarSeguranca(f, n, z, { raizDaApp: app })
const imp = "import { Ilha } from './Ilha'\n"
const casos = {
  XE23: s(imp + 'export const P = ({ p }) => <Ilha texto={`${JSON.stringify(p)}`} />'),
  XE24: s(imp + 'export const P = ({ p }) => <Ilha texto={String(JSON.stringify(p))} />'),
  XE25: s(imp + 'export const P = ({ p }) => <Ilha campos={{ a: Object.assign({}, p) }} />'),
  XE26: s(imp + 'export const P = ({ p }) => <Ilha campos={{ a: p.cadastro }} />'),
  XE27: s(imp + 'export const P = ({ p }) => <Ilha>{p}</Ilha>'),
  XE28: s("import { Ilha } from './index'\nexport const P = ({ p }) => <Ilha dados={p} />"),
  XE29: s(imp + 'const I = Ilha\nexport const P = ({ p }) => <I dados={p} />'),
  XE30: s(imp + "import { pessoa } from './dados'\nexport const P = () => <Ilha dados={pessoa} />"),
  XE31: s(imp + 'export const P = async ({ f }) => <Ilha campos={{ a: await f() }} />'),
  XE32: s("'use client'\nimport m = require('next/headers')"),
  XE33: s("'use client'\nimport { createClient } from 'redis'"),
  XE34: s("import { Link } from '../nav'\nexport const M = () => <Link href='/zona2'>x</Link>", z1, 'zona1'),
  XE35: s("import * as L from 'next/link'\nexport const M = () => <L.default href='/zona2'>x</L.default>", z1, 'zona1'),
  XE36: s("import Link from 'next/link'\nconst Ir = Link\nexport const M = () => <Ir href='/zona2'>x</Ir>", z1, 'zona1'),
  XE37: s("'use client'\nimport { useRouter } from 'next/navigation'\nexport function M() { const router = useRouter(); router.push('/zona2/tarefas') }", z1, 'zona1'),
  XE38: analisarSeguranca("const c = { env: { DOMINIO_A: process.env.DOMINIO_A_URL } }\nexport default c", 'next.config.ts'),
  XE39: analisarSeguranca("const t = process.env.NEXT_PUBLIC_BEARER"),
  XE40: analisarSeguranca("export default { compiler: { define: { 'process.env.API': JSON.stringify(process.env.DOMINIO_A_URL) } } }", 'next.config.ts'),
  XR08: analisar("const g = globalThis\nconst k = ['fe', 'tch'].join('')\nawait g[k]('http://x')"),
  XR09: analisar("const http = process.getBuiltinModule('node:http')"),
  XR10: analisar("import { lookup } from 'node:dns'"),
  XR11: analisar("import { request } from 'needle'"),
  XR12: analisar("const F = (() => {}).constructor\nF('return fetch')()"),
  XF01: temServerOnly("const t = `\nimport 'server-only'\n`\nexport const x = 1") ? [] : [{ motivo: 'temServerOnly false' }],
  N08b_seg: analisarSeguranca("const t = `\nimport 'server-only'\n`\nimport { cookies } from 'next/headers'", join(app, 'lib', 'x.ts'), null, { raizDaApp: app, exigirServerOnly: true }),
}
for (const [id, a] of Object.entries(casos)) console.log(`${id} ${a.length ? 'CAUGHT' : 'SURVIVED'} ${a[0]?.motivo ?? ''}`)
