// Apoio do challenger_d19b_1. Importa o apoio da base; mascara JWT antes de imprimir.
import { createHash } from 'node:crypto'
import { subir, SHELL } from '../../base/scripts/ambiente.mjs'
import { pedir, valorDoCookie, redisCru, monitorarRedis, KEYCLOAK_EMISSOR } from '../../base/verificacao/apoio.mjs'
export { subir, SHELL, pedir, valorDoCookie, redisCru, monitorarRedis, KEYCLOAK_EMISSOR }

export const RAIZ_KC = 'http://127.0.0.1:8080'
export const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))
export const mascarar = (s) => String(s).replace(/eyJ[A-Za-z0-9_-]{10,}(\.[A-Za-z0-9_-]+){0,2}/g, '<jwt-mascarado>')
export const dizer = (...a) => console.log(...a.map((x) => (typeof x === 'string' ? mascarar(x) : mascarar(JSON.stringify(x)))))

export function configOidc(extra = {}) {
  Object.assign(process.env, {
    REDIS_URL: 'redis://default:dev-shell-escrita@127.0.0.1:6379',
    REDIS_URL_ZONA: 'redis://zona:dev-zona-leitura@127.0.0.1:6379',
    IDP_EMISSOR: 'http://127.0.0.1:8080/realms/erp',
    IDP_CLIENTE_SEGREDO: 'dev-erp-shell-segredo',
    ERP_PERMITIR_HTTP_LOCAL: '1',
    ERP_RENOVACAO_JANELA_S: '5',
    ERP_RENOVACAO_LOCK_S: '5',
    ERP_DESTINO_TIMEOUT_MS: '2000',
    ERP_RENOVACAO_ESPERA_MS: '4000',
    ...extra,
  })
  for (const [k, v] of Object.entries(extra)) if (v === null) delete process.env[k]
}

async function adminHeaders() {
  const adm = (await (await fetch(`${RAIZ_KC}/realms/master/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }),
  })).json()).access_token
  return { authorization: `Bearer ${adm}`, 'content-type': 'application/json' }
}
/** grava a vida do access token do erp-shell; '' devolve ao padrao (chamada direta, nao argv). */
export async function vidaDoToken(valor) {
  const [cliente] = await (await fetch(`${RAIZ_KC}/admin/realms/erp/clients?clientId=erp-shell`, { headers: await adminHeaders() })).json()
  const r = await fetch(`${RAIZ_KC}/admin/realms/erp/clients/${cliente.id}`, {
    method: 'PUT', headers: await adminHeaders(),
    body: JSON.stringify({ ...cliente, attributes: { ...cliente.attributes, 'access.token.lifespan': valor } }),
  })
  if (r.status !== 204) throw new Error(`PUT cliente HTTP ${r.status}`)
  return r.status
}

function pote() {
  const jar = new Map()
  return {
    guardar(r) {
      for (const c of r.headers.getSetCookie()) {
        const [kv] = c.split(';'); const i = kv.indexOf('=')
        if (/Max-Age=0/i.test(c)) jar.delete(kv.slice(0, i)); else jar.set(kv.slice(0, i), kv.slice(i + 1))
      }
      return r
    },
    get cabecalho() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
  }
}
export async function entrarPeloKeycloak(usuario, de = '/', host = SHELL) {
  const ini = await pedir(`/api/auth/entrar?${new URLSearchParams({ de })}`)
  const transacao = valorDoCookie(ini.cookies, '__Host-erp-login')
  if (!transacao) throw new Error(`entrar sem transacao HTTP ${ini.status}`)
  const p = pote()
  let r = p.guardar(await fetch(ini.local, { redirect: 'manual' }))
  const acao = (await r.text()).match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
  if (!acao) throw new Error('sem formulario do Keycloak')
  r = p.guardar(await fetch(acao, { method: 'POST', redirect: 'manual', headers: { cookie: p.cabecalho, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: usuario, password: usuario }) }))
  const local = new URL(r.headers.get('location'))
  const ret = await pedir(local.pathname + local.search, { cookie: `__Host-erp-login=${transacao}` })
  const id = valorDoCookie(ret.cookies, '__Host-session')
  if (!id) throw new Error(`retorno sem sessao HTTP ${ret.status}`)
  return { cookie: `__Host-session=${id}`, id, ini, ret, poteKeycloak: p }
}
export const chaveDaSessao = (id) => `erp:sessao:${createHash('sha256').update(id).digest('hex')}`
export async function sessaoNoRedis(id) {
  const r = await redisCru(process.env.REDIS_URL, [['GET', chaveDaSessao(id)]])
  const json = r.match(/\$\d+\r\n(\{.*\})\r\n/s)?.[1]
  return json ? JSON.parse(json) : null
}
export async function ttlDaSessao(id) {
  const r = await redisCru(process.env.REDIS_URL, [['TTL', chaveDaSessao(id)]])
  return r.match(/:(-?\d+)/g)?.pop()
}
export const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)] }

/** pedido cronometrado, sem seguir redirecionamento */
export async function cron(caminho, { cookie, base = SHELL, metodo = 'GET', cabecalhos = {} } = {}) {
  const t0 = performance.now()
  try {
    const r = await fetch(`${base}${caminho}`, { method: metodo, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...cabecalhos } })
    const html = await r.text()
    return { status: r.status, ms: performance.now() - t0, local: r.headers.get('location'), html, cookies: r.headers.getSetCookie() }
  } catch (e) { return { status: 0, ms: performance.now() - t0, erro: String(e.cause?.code ?? e.message) } }
}
export const painelOk = (r) => r.status === 200 && /Painel da zona 1/.test(r.html) && !/Indicadores indisponíveis|Recursos indisponíveis/.test(r.html)
export const inicioOk = (r) => r.status === 200 && /Seus módulos/.test(r.html) && !/Avisos indisponíveis/.test(r.html)
