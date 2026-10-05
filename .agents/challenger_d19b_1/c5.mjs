// Cenarios 5 e 6: SHELL_HOSTS com espaco; sair com esquema trocado. uso: node c5.mjs <hosts|padrao>
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as L from './lib.mjs'
import { formularios } from '../../base/verificacao/apoio.mjs'
import { RAIZ } from '../../base/scripts/ambiente.mjs'
const modo = process.argv[2]
L.configOidc(modo === 'hosts' ? { SHELL_HOSTS: 'localhost:3000, 127.0.0.1:3000' } : { SHELL_HOSTS: null })
const LOC = 'http://localhost:3000', IP = 'http://127.0.0.1:3000'
async function acao(base, cookie, campos, origem) {
  const manifesto = JSON.parse(readFileSync(join(RAIZ, 'erp-zona-2', '.next/server/server-reference-manifest.json'), 'utf8'))
  const id = Object.entries(manifesto.node).find(([, v]) => v.exportedName === 'concluirTarefa')?.[0]
  const exigir = createRequire(join(RAIZ, 'erp-zona-2', 'package.json'))
  const { encodeReply } = exigir('next/dist/compiled/react-server-dom-webpack/client.edge.js')
  const fd = new FormData(); for (const [k, v] of Object.entries(campos)) if (!k.startsWith('$')) fd.append(k, v)
  const r = await fetch(`${base}/zona2`, { method: 'POST', redirect: 'manual', body: await encodeReply([fd]), headers: { cookie, ...(origem ? { origin: origem } : {}), 'next-action': id, accept: 'text/x-component' } })
  return { status: r.status, redir: r.headers.get('x-action-redirect'), corpo: (await r.text()).slice(0, 200) }
}
const amb = await L.subir({ log: true })
try {
  await L.esperar(1500)
  L.dizer(`##### modo=${modo} SHELL_HOSTS=${JSON.stringify(process.env.SHELL_HOSTS ?? null)}`)
  const { cookie } = await L.entrarPeloKeycloak('ana')
  for (const base of [LOC, IP]) for (const c of ['/', '/zona1', '/zona2', '/acesso']) {
    const r = await L.cron(c, { cookie, base }); L.dizer(`PAGINA ${base}${c} -> ${r.status} ${r.local ?? ''}`)
  }
  const pag = await L.cron('/zona2', { cookie, base: LOC })
  const forms = formularios(pag.html).filter((f) => f.id !== undefined || Object.keys(f).some((k) => /versao|id/.test(k)))
  L.dizer('formularios com campos:', forms.map((f) => Object.keys(f)))
  const alvos = formularios(pag.html).filter((f) => 'id' in f && 'versao' in f)
  L.dizer('tarefas encontradas:', alvos.length)
  const restantes = async () => formularios((await L.cron('/zona2', { cookie, base: LOC })).html).filter((f) => 'id' in f && 'versao' in f).length
  const tentativas = [[LOC, 'https://evil.example', 'Origin de outro site'], [IP, 'http://evil.example:3000', 'host 127.0.0.1, Origin outro'], [LOC, LOC, 'host localhost, Origin localhost'], [IP, IP, 'host 127.0.0.1, Origin 127.0.0.1']]
  let k = 0
  for (const [base, origem, nome] of tentativas) {
    const atuais = formularios((await L.cron('/zona2', { cookie, base: LOC })).html).filter((f) => 'id' in f && 'versao' in f)
    const alvo = atuais[0]; if (!alvo) { L.dizer('sem tarefa livre para', nome); continue }
    const antes = atuais.length
    const r = await acao(base, cookie, alvo, origem)
    L.dizer(`ACTION ${nome}: ${r.status} redirect=${r.redir} corpo=${JSON.stringify(r.corpo.slice(0, 90))} tarefas antes=${antes} depois=${await restantes()}`)
  }
  const apos = formularios((await L.cron('/zona2', { cookie, base: LOC })).html).filter((f) => 'id' in f && 'versao' in f)
  L.dizer('tarefas restantes depois:', apos.length, '(antes', alvos.length + ')')

  // sair: cada caso com sessao nova
  const casos = [
    ['Origin localhost (http)', { origin: LOC }],
    ['Origin 127.0.0.1 (http)', { origin: IP }],
    ['Origin de outro site', { origin: 'https://evil.example' }],
    ['Origin https://localhost:3000 sem Sec-Fetch-Site (esquema trocado)', { origin: 'https://localhost:3000' }],
    ['Origin https://localhost:3000 + X-Forwarded-Proto https', { origin: 'https://localhost:3000', 'x-forwarded-proto': 'https' }],
    ['Origin https://127.0.0.1:3000 + X-Forwarded-Proto https', { origin: 'https://127.0.0.1:3000', 'x-forwarded-proto': 'https' }],
    ['Origin http://localhost:3000 + X-Forwarded-Proto https (navegador http, proxy diz https)', { origin: LOC, 'x-forwarded-proto': 'https' }],
    ['Origin null', { origin: 'null' }],
    ['sem Origin nem Sec-Fetch-Site', {}],
    ['Sec-Fetch-Site same-origin', { 'sec-fetch-site': 'same-origin' }],
    ['Sec-Fetch-Site same-site', { 'sec-fetch-site': 'same-site', origin: LOC }],
    ['Sec-Fetch-Site cross-site', { 'sec-fetch-site': 'cross-site', origin: LOC }],
    ['Sec-Fetch-Site none', { 'sec-fetch-site': 'none' }],
  ]
  for (const [nome, cab] of casos) {
    const { cookie: ck, id } = await L.entrarPeloKeycloak('davi')
    const r = await fetch(`${LOC}/api/auth/sair`, { method: 'POST', redirect: 'manual', headers: { cookie: ck, ...cab } })
    const viva = !!(await L.sessaoNoRedis(id))
    const corpo = r.status === 403 ? await r.text() : ''
    L.dizer(`SAIR [${nome}] -> ${r.status} location=${(r.headers.get('location') ?? '').split('?')[0]} sessaoViva=${viva} ${corpo}`)
  }
} finally { amb.derrubar(); await L.esperar(1500) }
