import { SHELL, KC, get, entrar, redisCmd, sc, val } from './lib.mjs'
import { createHash } from 'node:crypto'
const out = (k, v) => console.log(k.padEnd(52), v)
const chave = (id) => 'erp:sessao:' + createHash('sha256').update(id).digest('hex')
const existe = async (id) => /\{/.test(await redisCmd(['GET', chave(id)]))
const s = await entrar('ana')
const tentativas = [
  ['sem cabecalho nenhum (curl)', {}],
  ['Origin: http://evil.example', { origin: 'http://evil.example' }],
  ['Origin: null', { origin: 'null' }],
  ['Origin: http://localhost:3001', { origin: 'http://localhost:3001' }],
  ['Origin: http://localhost:3000.evil.example', { origin: 'http://localhost:3000.evil.example' }],
  ['Origin: http://localhost:3000@evil.example', { origin: 'http://localhost:3000@evil.example' }],
  ['Origin: https://localhost:3000', { origin: 'https://localhost:3000' }],
  ['Origin: http://localhost (sem porta)', { origin: 'http://localhost' }],
  ['Origin: http://LOCALHOST:3000', { origin: 'http://LOCALHOST:3000' }],
  ['Origin: lixo', { origin: '%%%' }],
  ['Origin: vazio', { origin: '' }],
  ['Sec-Fetch-Site: cross-site', { 'sec-fetch-site': 'cross-site' }],
  ['Sec-Fetch-Site: same-site', { 'sec-fetch-site': 'same-site' }],
  ['Sec-Fetch-Site: none', { 'sec-fetch-site': 'none' }],
  ['Sec-Fetch-Site: Same-Origin (maiuscula)', { 'sec-fetch-site': 'Same-Origin' }],
  ['Sec-Fetch-Site: same-origin ; Origin evil (forjado)', { 'sec-fetch-site': 'same-origin', origin: 'http://evil.example' }],
  ['Sec-Fetch-Site: cross-site ; Origin localhost:3000', { 'sec-fetch-site': 'cross-site', origin: 'http://localhost:3000' }],
  ['Host: evil.example (Origin localhost)', { host: 'evil.example' }],
  ['Origin ... X-Forwarded-Host', { origin: 'http://evil.example', 'x-forwarded-host': 'localhost:3000' }],
]
// as tentativas que passam derrubam a sessão; por isso uma sessão nova para cada
for (const [nome, h] of tentativas) {
  const x = await entrar('ana')
  const r = await get(SHELL + '/api/auth/sair', { method: 'POST', headers: { cookie: x.cookie, ...h } })
  const b = await r.text()
  const viva = await existe(x.id)
  const pag = await get(SHELL + '/zona1', { headers: { cookie: x.cookie } })
  out(nome, `HTTP ${r.status} loc=${(r.headers.get('location') || '').slice(0, 40)} setcookie=${sc(r).length} corpo=${b.slice(0, 80)} | sessao no Redis: ${viva ? 'INTACTA' : 'REMOVIDA'} | /zona1 -> ${pag.status}`)
}
const g = await get(SHELL + '/api/auth/sair', { headers: { cookie: s.cookie } }); out('GET /api/auth/sair', `${g.status}`)
const pu = await get(SHELL + '/api/auth/sair', { method: 'PUT', headers: { cookie: s.cookie } }); out('PUT /api/auth/sair', `${pu.status}`)
out('sessao da ana (nao usada) intacta', await existe(s.id))
// logout legítimo, ponta a ponta
const l = await entrar('bruno')
const r = await get(SHELL + '/api/auth/sair', { method: 'POST', headers: { cookie: l.cookie, origin: SHELL, 'sec-fetch-site': 'same-origin' } })
out('sair legitimo', `HTTP ${r.status} Location=${r.headers.get('location')}`)
out('  Set-Cookie', JSON.stringify(sc(r)))
out('  sessao no Redis', (await existe(l.id)) ? 'AINDA EXISTE' : 'removida')
const p2 = await get(SHELL + '/zona1', { headers: { cookie: l.cookie } }); out('  /zona1 com cookie antigo', `${p2.status} ${p2.headers.get('location')}`)
// SSO no KC antes de confirmar: prompt=none devolve code?
const q = new URLSearchParams({ client_id: 'erp-shell', response_type: 'code', redirect_uri: 'http://localhost:3000/api/auth/retorno', scope: 'openid', prompt: 'none', code_challenge: 'x'.repeat(43), code_challenge_method: 'S256', state: 's' })
const pn = await get(`${KC}/realms/erp/protocol/openid-connect/auth?${q}`, { headers: { cookie: l.jar() } })
out('  KC SSO antes de confirmar (prompt=none)', `${pn.status} ${(pn.headers.get('location') || '').replace(/code=[^&]+/, 'code=<...>').slice(0, 130)}`)
// segue o logout do KC
const lg = await get(r.headers.get('location'), { headers: { cookie: l.jar() } }); const html = await lg.text()
out('  KC logout GET', `${lg.status} formulario de confirmacao=${/confirm|logout/i.test(html)} loc=${lg.headers.get('location')}`)
const act = html.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&'); const sid = html.match(/name="session_code" value="([^"]+)"/)?.[1]
const jar = [...l.kcCookies].map(([k, v]) => `${k}=${v}`).join('; ')
const ck = lg.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
if (act) {
  const cf = await get(new URL(act, KC), { method: 'POST', headers: { cookie: jar + '; ' + ck, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ confirmLogout: '1', ...(sid ? { session_code: sid } : {}) }) })
  out('  KC logout confirmado', `${cf.status} -> ${cf.headers.get('location')}`)
}
const pn2 = await get(`${KC}/realms/erp/protocol/openid-connect/auth?${q}`, { headers: { cookie: jar } })
out('  KC SSO depois de confirmar (prompt=none)', `${pn2.status} ${(pn2.headers.get('location') || '').replace(/code=[^&]+/, 'code=<...>').slice(0, 130)}`)
