import { SHELL, get, entrar } from './lib.mjs'
const P = [/access_token/i, /refresh_token/i, /id_token/i, /eyJ[A-Za-z0-9_-]{6,}/, /refreshToken/, /idToken/, /accessToken/, /FINANCEIRO/, /"groups"/, /Custo|custo/]
for (const ator of ['bruno', 'carla']) {
  const s = await entrar(ator)
  for (const a of ['/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/acesso', '/']) {
    let u = `${SHELL}${a}?_rsc=abc`, r, hops = 0
    do { r = await get(u, { headers: { cookie: s.cookie, rsc: '1' } }); const l = r.headers.get('location'); if (r.status === 307 && l) u = new URL(l, SHELL).href; else break } while (++hops < 3)
    const t = await r.text()
    console.log(ator, a, 'RSC hops', hops, r.status, r.headers.get('content-type'), t.length, 'hits:', P.filter((p) => p.test(t)).map(String).join(' ') || 'nenhum', u.slice(0,70))
  }
}
