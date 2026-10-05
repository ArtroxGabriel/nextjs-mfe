// Apoio dos ataques do challenger_d2_1. Só localhost.
export const SHELL = 'http://localhost:3000'
export const KC = 'http://127.0.0.1:8080'
export const SEGREDO = 'dev-erp-shell-segredo'
export const sc = (r) => r.headers.getSetCookie()
export const val = (cs, n) => cs.find((c) => c.startsWith(n + '='))?.split(';')[0].slice(n.length + 1)
export const get = (u, o = {}) => fetch(u, { redirect: 'manual', ...o })

/** Passo 1+2: entrar -> formulário KC -> POST credenciais; devolve URL de retorno (com code/state) e cookies */
export async function loginAteRetorno(usuario, senha = usuario, de = '/') {
  const e = await get(`${SHELL}/api/auth/entrar?de=${encodeURIComponent(de)}`)
  const idTransacao = val(sc(e), '__Host-erp-login')
  const kcUrl = e.headers.get('location')
  const kcCookies = new Map()
  const guardar = (r) => sc(r).forEach((c) => { const [p] = c.split(';'); const i = p.indexOf('='); kcCookies.set(p.slice(0, i), p.slice(i + 1)) })
  const jar = () => [...kcCookies].map(([k, v]) => `${k}=${v}`).join('; ')
  const f = await get(kcUrl); guardar(f)
  const html = await f.text()
  const action = html.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
  if (!action) throw new Error('sem formulario KC: ' + f.status + ' ' + html.slice(0, 300))
  const p = await get(action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar() }, body: new URLSearchParams({ username: usuario, password: senha, credentialId: '' }) })
  guardar(p)
  const retorno = p.headers.get('location')
  return { idTransacao, kcUrl, retorno, kcCookies, jar }
}

export async function entrar(usuario) {
  const l = await loginAteRetorno(usuario)
  const r = await get(l.retorno, { headers: { cookie: `__Host-erp-login=${l.idTransacao}` } })
  const id = val(sc(r), '__Host-session')
  if (!id) throw new Error(`login ${usuario} sem cookie: ${r.status} ${r.headers.get('location')}`)
  return { ...l, id, cookie: `__Host-session=${id}`, resp: r }
}

export function redisCmd(args, url = { host: '127.0.0.1', port: 6379 }, auth = ['default', 'dev-shell-escrita']) {
  return import('node:net').then(({ default: net }) => new Promise((ok, ko) => {
    const enc = (a) => `*${a.length}\r\n` + a.map((x) => `$${Buffer.byteLength(String(x))}\r\n${x}\r\n`).join('')
    const s = net.connect(url.port, url.host)
    let buf = ''
    s.on('data', (d) => { buf += d })
    s.on('error', ko)
    s.write(enc(['AUTH', ...auth]) + enc(args))
    setTimeout(() => { s.destroy(); ok(buf) }, 300)
  }))
}
