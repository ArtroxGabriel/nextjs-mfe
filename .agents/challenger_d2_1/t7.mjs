import { SHELL, get, entrar, sc } from './lib.mjs'
const VAZA = /org\.springframework|at java\.|SELECT |X-Powered-By|stack|node_modules|\.tsx?:\d|at async|ECONNREFUSED|redis|keycloak|openid-client|invalid_grant|ERR_|\/home\//i
const s = await entrar('ana')
const casos = [
  ['retorno code lixo sem cookie', '/api/auth/retorno?code=x&state=y'],
  ['retorno com erro do IdP', '/api/auth/retorno?error=access_denied&error_description=<script>alert(1)</script>&state=y'],
  ['retorno %00', '/api/auth/retorno?code=%00&state=%00'],
  ['retorno 10k', '/api/auth/retorno?code=' + 'A'.repeat(10000)],
  ['entrar de=//evil.com', '/api/auth/entrar?de=//evil.com'],
  ['entrar de=/\\evil.com', '/api/auth/entrar?de=/%5Cevil.com'],
  ['entrar de=http://evil.com', '/api/auth/entrar?de=http://evil.com'],
  ['entrar de=/zona1/..%2f..%2f', '/api/auth/entrar?de=/zona1/..%2f..%2f'],
  ['entrar de=%0d%0aSet-Cookie:x=1', '/api/auth/entrar?de=%0d%0aSet-Cookie:x=1'],
  ['login erro=<x>', '/login?erro=%3Cscript%3E&suporte=%3Cimg%3E'],
  ['zona1 com cookie lixo', '/zona1'],
  ['rota inexistente', '/nao/existe/%00'],
  ['path traversal', '/zona1/..%2f..%2fetc/passwd'],
  ['_next dado invalido', '/_next/data/x/y.json'],
]
for (const [nome, path] of casos) {
  const hs = nome.includes('lixo') && nome.startsWith('zona1') ? { cookie: '__Host-session=' + 'x'.repeat(40) } : {}
  const r = await get(SHELL + path, { headers: hs }); const t = await r.text()
  const loc = r.headers.get('location')
  const hdrs = [...r.headers].map(([k, v]) => `${k}: ${v}`).join('\n')
  console.log(nome.padEnd(40), r.status, (loc || '').slice(0, 70).padEnd(70), VAZA.test(t + hdrs) ? 'VAZA ' + (t + hdrs).match(VAZA)[0] : 'limpo', /x-powered-by/i.test(hdrs) ? 'X-POWERED-BY' : '', sc(r).map((c) => c.split(';')[0].slice(0, 30)).join(','))
}
// POST sem corpo em varios endpoints de api/auth
for (const m of ['POST', 'DELETE', 'PUT']) for (const p of ['/api/auth/entrar', '/api/auth/retorno']) { const r = await get(SHELL + p, { method: m }); console.log(m, p, r.status) }
// Server Action sem sessão / com origem de outro site: id arbitrário
const r = await get(SHELL + '/zona1', { method: 'POST', headers: { 'next-action': 'deadbeef', origin: 'http://evil.example', cookie: s.cookie, 'content-type': 'text/plain;charset=UTF-8' }, body: '[]' }); const b = await r.text(); console.log('Server Action origin evil', r.status, VAZA.test(b) ? 'VAZA' : 'limpo', b.slice(0, 100).replace(/\s+/g, ' '))
const r2 = await get(SHELL + '/zona1', { method: 'POST', headers: { 'next-action': 'deadbeef', origin: 'http://localhost:3000', cookie: s.cookie, 'content-type': 'text/plain;charset=UTF-8' }, body: '[]' }); const b2 = await r2.text(); console.log('Server Action id inexistente', r2.status, VAZA.test(b2) ? 'VAZA' : 'limpo', b2.slice(0, 100).replace(/\s+/g, ' '))
