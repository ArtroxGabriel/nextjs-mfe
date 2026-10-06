// Etapa 7 (parte B): replay, adulteracao de state/PKCE/redirect_uri, logout ate o Keycloak, sair cross-origin. uso: node c7b.mjs <transacaoS|default>
import * as L from './lib.mjs'
const T = process.argv[2]
L.configOidc(T === 'default' ? { ERP_LOGIN_TRANSACAO_S: null } : { ERP_LOGIN_TRANSACAO_S: T })
const amb = await L.subir({ log: false })
const LOC = L.SHELL
const mask = (u) => String(u).replace(/(code|session_state|code_challenge|state|nonce|client_data|tab_id|execution)=[^&"]{6,}/g, '$1=<m>')
try {
  await L.esperar(1500)
  L.dizer(`##### ERP_LOGIN_TRANSACAO_S=${process.env.ERP_LOGIN_TRANSACAO_S ?? '(padrao 600)'}`)
  // A) cookie de login x state
  const ini = await L.pedir('/api/auth/entrar?de=%2Fzona1')
  const auth = new URL(ini.local)
  const ck = L.valorDoCookie(ini.cookies, '__Host-erp-login')
  const sc = ini.cookies.find((c) => c.startsWith('__Host-erp-login='))
  L.dizer('A atributos:', sc.replace(/=[^;]*/, '=<id>'))
  L.dizer('A valor do cookie == state?', ck === auth.searchParams.get('state'), '| comprimento cookie', ck.length, 'state', auth.searchParams.get('state')?.length)
  L.dizer('A params da autorizacao:', [...auth.searchParams.keys()].join(','), '| method', auth.searchParams.get('code_challenge_method'), '| redirect_uri', auth.searchParams.get('redirect_uri'))
  const ttl = await L.redisCru(process.env.REDIS_URL, [['KEYS', 'erp:login:*']]); L.dizer('A chaves erp:login:* ', ttl.replace(/\r\n/g, '|').replace(/[0-9a-f]{64}/g, '<h>'))

  // helper: faz o login completo ate o redirect de volta ao shell; retorna {local, cookieLogin}
  const ate_retorno = async (modAuth = (u) => u, usuario = 'bruno') => {
    const i = await L.pedir('/api/auth/entrar?de=%2Fzona1')
    const tr = L.valorDoCookie(i.cookies, '__Host-erp-login')
    const url = modAuth(new URL(i.local))
    const jar = new Map(); const g = (r) => { for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const k = kv.indexOf('='); jar.set(kv.slice(0, k), kv.slice(k + 1)) } return r }
    const cab = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
    let r = g(await fetch(url, { redirect: 'manual' }))
    const html = await r.text()
    const acao = html.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
    if (!acao) return { kcStatus: r.status, kcCorpo: mask(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200)), tr }
    r = g(await fetch(acao, { method: 'POST', redirect: 'manual', headers: { cookie: cab(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: usuario, password: usuario }) }))
    const loc = r.headers.get('location'); const l = loc && new URL(loc)
    return { tr, kcStatus: r.status, loc, local: l && l.pathname + l.search, l }
  }
  const resumo = (r) => `status=${r.status} location=${mask(r.local ?? '')} setCookieSessao=${!!L.valorDoCookie(r.cookies ?? [], '__Host-session')}`

  // B) fluxo normal + replay
  const ok = await ate_retorno()
  L.dizer('B fluxo normal: keycloak devolveu', ok.kcStatus, mask(ok.loc ?? '').slice(0, 90))
  const r1 = await L.pedir(ok.local, { cookie: `__Host-erp-login=${ok.tr}` })
  L.dizer('B retorno 1:', resumo(r1))
  const r2 = await L.pedir(ok.local, { cookie: `__Host-erp-login=${ok.tr}` })
  L.dizer('B REPLAY (mesmo code+state+cookie):', resumo(r2))
  const r3 = await L.pedir(ok.local, { cookie: `__Host-erp-login=${ok.tr}` })
  L.dizer('B REPLAY 2:', resumo(r3))
  const k = await L.redisCru(process.env.REDIS_URL, [['KEYS', 'erp:login:*']]); L.dizer('B chaves erp:login restantes', k.replace(/\r\n/g, '|').replace(/[0-9a-f]{64}/g, '<h>'))

  // C) retorno sem cookie / cookie de outra transacao / state adulterado / code adulterado
  const c = await ate_retorno()
  const semCk = await L.pedir(c.local); L.dizer('C retorno SEM cookie de transacao:', resumo(semCk))
  const outra = await L.pedir('/api/auth/entrar'); const ckOutra = L.valorDoCookie(outra.cookies, '__Host-erp-login')
  const rOutra = await L.pedir(c.local, { cookie: `__Host-erp-login=${ckOutra}` }); L.dizer('C retorno com cookie de OUTRA transacao:', resumo(rOutra))
  const u = new URL(c.local, LOC); u.searchParams.set('state', 'x'.repeat(u.searchParams.get('state').length))
  const rState = await L.pedir(u.pathname + u.search, { cookie: `__Host-erp-login=${c.tr}` }); L.dizer('C state adulterado:', resumo(rState))
  const c2 = await ate_retorno(); const u2 = new URL(c2.local, LOC); u2.searchParams.set('code', 'lixo')
  const rCode = await L.pedir(u2.pathname + u2.search, { cookie: `__Host-erp-login=${c2.tr}` }); L.dizer('C code adulterado:', resumo(rCode))
  const c3 = await ate_retorno(); const u3 = new URL(c3.local, LOC); u3.searchParams.delete('state')
  const rSem = await L.pedir(u3.pathname + u3.search, { cookie: `__Host-erp-login=${c3.tr}` }); L.dizer('C sem state:', resumo(rSem))
  const rErr = await L.pedir('/api/auth/retorno?error=access_denied', { cookie: `__Host-erp-login=${c3.tr}` }); L.dizer('C ?error=access_denied:', resumo(rErr))
  L.dizer('C o state valido ainda funciona apos tentativas falhas? (c3 consumida/adulterada)', resumo(await L.pedir(c3.local, { cookie: `__Host-erp-login=${c3.tr}` })))
  // transacao nao consumida por erro de outro: usar c.local depois de falhas do cookie errado
  L.dizer('C c.local original ainda utilizavel apos tentativas sem/ outro cookie?', resumo(await L.pedir(c.local, { cookie: `__Host-erp-login=${c.tr}` })))

  // D) PKCE adulterado: code_challenge trocado antes do login
  const d = await ate_retorno((x) => { x.searchParams.set('code_challenge', 'A'.repeat(43)); return x })
  if (!d.local) L.dizer('D PKCE challenge trocado: Keycloak', d.kcStatus, d.kcCorpo)
  else L.dizer('D PKCE challenge trocado: retorno ->', resumo(await L.pedir(d.local, { cookie: `__Host-erp-login=${d.tr}` })))
  const d2 = await ate_retorno((x) => { x.searchParams.delete('code_challenge'); x.searchParams.delete('code_challenge_method'); return x })
  if (!d2.local) L.dizer('D PKCE removido: Keycloak', d2.kcStatus, d2.kcCorpo)
  else L.dizer('D PKCE removido: retorno ->', resumo(await L.pedir(d2.local, { cookie: `__Host-erp-login=${d2.tr}` })))
  // state adulterado na autorizacao (Keycloak ecoa o state adulterado)
  const d3 = await ate_retorno((x) => { x.searchParams.set('state', 'forjado-' + 'y'.repeat(30)); return x })
  if (!d3.local) L.dizer('D state trocado na ida: Keycloak', d3.kcStatus, d3.kcCorpo)
  else L.dizer('D state trocado na ida: retorno ->', resumo(await L.pedir(d3.local, { cookie: `__Host-erp-login=${d3.tr}` })))
  // E) redirect_uri adulterado
  for (const ru of ['http://evil.example/api/auth/retorno', `${LOC}/outra`, `${LOC}/api/auth/retorno/../x`]) {
    const e = await ate_retorno((x) => { x.searchParams.set('redirect_uri', ru); return x })
    L.dizer('E redirect_uri', ru, '-> Keycloak', e.kcStatus, e.kcCorpo ?? mask(e.loc ?? '').slice(0, 100))
  }
  // F) logout ate o Keycloak + sair cross-origin
  const { cookie, id, poteKeycloak } = await L.entrarPeloKeycloak('carla')
  for (const [nome, cab] of [['Origin outro site', { origin: 'https://evil.example' }], ['Sec-Fetch-Site cross-site', { 'sec-fetch-site': 'cross-site' }], ['Origin null', { origin: 'null' }]]) {
    const r = await fetch(`${LOC}/api/auth/sair`, { method: 'POST', redirect: 'manual', headers: { cookie, ...cab } })
    L.dizer('F sair', nome, '->', r.status, 'sessaoViva=', !!(await L.sessaoNoRedis(id)), (await r.text()).slice(0, 80))
  }
  const rs = await fetch(`${LOC}/api/auth/sair`, { method: 'POST', redirect: 'manual', headers: { cookie, origin: LOC } })
  const lg = rs.headers.get('location')
  L.dizer('F sair mesma origem ->', rs.status, mask(lg), 'sessaoViva=', !!(await L.sessaoNoRedis(id)), 'set-cookie:', rs.headers.getSetCookie().map((x) => x.replace(/=[^;]*/, '=<v>')))
  L.dizer('F zona1 depois de sair ->', (await L.pedir('/zona1', { cookie })).status)
  const conf = poteKeycloak.guardar(await fetch(lg, { redirect: 'manual', headers: { cookie: poteKeycloak.cabecalho } }))
  const html = await conf.text(); L.dizer('F logout no Keycloak: HTTP', conf.status, 'form-confirmacao=', /logout-confirm/.test(html))
  const form = html.match(/<form[^>]*action="([^"]*logout-confirm[^"]*)"[^>]*>([\s\S]*?)<\/form>/)
  const campos = new URLSearchParams(); for (const m of form[2].matchAll(/<input[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]*)"/g)) campos.append(m[1], m[2])
  const fim = await fetch(new URL(form[1].replaceAll('&amp;', '&'), L.RAIZ_KC), { method: 'POST', redirect: 'manual', headers: { cookie: poteKeycloak.cabecalho, 'content-type': 'application/x-www-form-urlencoded' }, body: campos })
  L.dizer('F confirmacao ->', fim.status, fim.headers.get('location'))
  const ini2 = await L.pedir('/api/auth/entrar'); const r4 = await fetch(ini2.local, { redirect: 'manual', headers: { cookie: poteKeycloak.cabecalho } })
  L.dizer('F novo entrar apos logout pede senha?', r4.status === 200 && /name="password"/.test(await r4.text()))
} finally { amb.derrubar(); await L.esperar(1500) }
