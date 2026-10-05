import { SHELL, get, loginAteRetorno, val, sc } from './lib.mjs'
for (const de of ['//evil.com', '/\\evil.com', 'http://evil.com', '/zona1', '/%2f%2fevil.com', '/\t/evil.com', '/zona1?x=1#y']) {
  const l = await loginAteRetorno('ana', 'ana', de)
  const r = await get(l.retorno, { headers: { cookie: `__Host-erp-login=${l.idTransacao}` } })
  console.log(JSON.stringify(de).padEnd(24), r.status, r.headers.get('location'))
}
