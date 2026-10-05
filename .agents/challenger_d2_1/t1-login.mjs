import { SHELL, KC, SEGREDO, sc, val, get, loginAteRetorno, entrar } from './lib.mjs'
import { createHash, randomBytes } from 'node:crypto'
const out = (k, v) => console.log(k.padEnd(48), v)

// A. fluxo normal e atributos de cookie
const l = await loginAteRetorno('ana')
out('A1 retorno do KC (host/path)', l.retorno.split('?')[0])
const rq = new URL(l.retorno)
out('A1 params', [...rq.searchParams.keys()].join(','))
const r1 = await get(l.retorno, { headers: { cookie: `__Host-erp-login=${l.idTransacao}` } })
out('A2 retorno status/location', `${r1.status} ${r1.headers.get('location')}`)
out('A2 Set-Cookie', JSON.stringify(sc(r1)))
// B. replay do retorno (mesma transação, mesmo code)
const r2 = await get(l.retorno, { headers: { cookie: `__Host-erp-login=${l.idTransacao}` } })
out('B1 replay retorno status/location', `${r2.status} ${r2.headers.get('location')} cookies=${JSON.stringify(sc(r2).map(c=>c.split(';')[0]))}`)
// C. retorno sem cookie de transação
const l2 = await loginAteRetorno('ana')
const r3 = await get(l2.retorno)
out('C1 retorno sem transacao', `${r3.status} ${r3.headers.get('location')} sess=${val(sc(r3),'__Host-session')}`)
// D. retorno com transação inexistente
const r4 = await get(l2.retorno, { headers: { cookie: `__Host-erp-login=${randomBytes(32).toString('base64url')}` } })
out('D1 transacao inexistente', `${r4.status} ${r4.headers.get('location')} sess=${val(sc(r4),'__Host-session')}`)
// E. state adulterado (transacao ainda viva, pois r3/r4 nao consumiram a de l2? r4 usou outra) 
const u = new URL(l2.retorno); u.searchParams.set('state', 'xxxx')
const r5 = await get(u, { headers: { cookie: `__Host-erp-login=${l2.idTransacao}` } })
out('E1 state adulterado', `${r5.status} ${r5.headers.get('location')} sess=${val(sc(r5),'__Host-session')}`)
// E2 depois disso a transacao foi consumida: o retorno original agora
const r6 = await get(l2.retorno, { headers: { cookie: `__Host-erp-login=${l2.idTransacao}` } })
out('E2 retorno legitimo apos state errado', `${r6.status} ${r6.headers.get('location')} sess=${val(sc(r6),'__Host-session')}`)
// F. code trocado entre transações (A code + B transaction)
const a = await loginAteRetorno('ana'); const b = await loginAteRetorno('bruno')
const ua = new URL(a.retorno), ub = new URL(b.retorno)
const mix = new URL(a.retorno); mix.searchParams.set('code', ub.searchParams.get('code'))
const r7 = await get(mix, { headers: { cookie: `__Host-erp-login=${a.idTransacao}` } })
out('F1 code de B com state/transacao de A', `${r7.status} ${r7.headers.get('location')} sess=${val(sc(r7),'__Host-session')}`)
// F2 state de B + transacao de A
const mix2 = new URL(a.retorno); mix2.searchParams.set('state', ub.searchParams.get('state'))
const b2 = await loginAteRetorno('bruno'), a2 = await loginAteRetorno('ana')
const m3 = new URL(a2.retorno); m3.searchParams.set('state', new URL(b2.retorno).searchParams.get('state'))
const r8 = await get(m3, { headers: { cookie: `__Host-erp-login=${a2.idTransacao}` } })
out('F2 state de B com transacao de A', `${r8.status} ${r8.headers.get('location')} sess=${val(sc(r8),'__Host-session')}`)
// G. login CSRF: code de atacante (transação do atacante) ... cookie da vitima sem transacao
// H. iss ausente/adulterado
const c = await loginAteRetorno('ana'); const uc = new URL(c.retorno)
out('H0 params do retorno', JSON.stringify([...uc.searchParams.entries()].map(([k,v])=>k+'='+v.slice(0,12))))
uc.searchParams.set('iss', 'http://evil.example/realms/erp')
const r9 = await get(uc, { headers: { cookie: `__Host-erp-login=${c.idTransacao}` } })
out('H1 iss adulterado', `${r9.status} ${r9.headers.get('location')} sess=${val(sc(r9),'__Host-session')}`)
// I. redirect_uri exato no KC: variantes
const e = await get(`${SHELL}/api/auth/entrar`); const kcu = new URL(e.headers.get('location'))
for (const ru of ['http://localhost:3000/api/auth/retorno/', 'http://localhost:3000/api/auth/retorno?x=1', 'http://localhost:3000/api/auth/Retorno', 'http://localhost:3000/', 'http://evil.example/api/auth/retorno', 'http://localhost:3000/api/auth/retorno#f', 'http://localhost.evil.example:3000/api/auth/retorno', 'http://localhost:3001/api/auth/retorno', 'http://127.0.0.1:3000/api/auth/retorno']) {
  const x = new URL(kcu); x.searchParams.set('redirect_uri', ru)
  const r = await get(x)
  out(`I redirect_uri=${ru}`.slice(0,80), `${r.status} ${(r.headers.get('location')||'').slice(0,80)}`)
}
