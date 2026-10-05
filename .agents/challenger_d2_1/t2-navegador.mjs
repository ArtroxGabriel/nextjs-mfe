import { SHELL, sc, val, get, entrar, redisCmd } from './lib.mjs'
const out = (k, v) => console.log(k.padEnd(44), v)
const PADROES = [/access_token/i, /refresh_token/i, /id_token/i, /eyJ[A-Za-z0-9_-]{6,}/, /refreshToken/, /idToken/, /accessToken/, /"groups"|\bgroups\b/i, /FINANCEIRO/]
const alvos = ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/zona2', '/acesso', '/login']
for (const ator of ['bruno', 'carla']) {
  const s = await entrar(ator)
  out(`== ${ator} cookie id`, s.id)
  const vistos = new Set(), js = new Set()
  for (const a of alvos) {
    for (const hdr of [{}, { rsc: '1' }]) {
      const r = await get(SHELL + a, { headers: { cookie: s.cookie, ...hdr } })
      const t = await r.text()
      const hs = [...r.headers].map(([k, v]) => `${k}: ${v}`).join('\n')
      const hit = PADROES.filter((p) => p.test(t) || p.test(hs)).map(String)
      out(`${a} ${hdr.rsc ? 'RSC' : 'HTML'} ${r.status} len=${t.length}`, hit.length ? 'ACHADO ' + hit.join(' ') : 'limpo')
      if (r.headers.get('set-cookie')) out('   set-cookie', sc(r).join(' | '))
      for (const m of t.matchAll(/(?:src|href)="([^"]+\.js[^"]*)"/g)) js.add(m[1])
      for (const m of t.matchAll(/\/[a-z0-9-]*static\/[^"' \\]+\.js/g)) js.add(m[0])
    }
  }
  let n = 0, bytes = 0
  for (const j of js) {
    const r = await get(new URL(j, SHELL), { headers: { cookie: s.cookie } }); const t = await r.text(); n++; bytes += t.length
    const hit = PADROES.filter((p) => p.test(t)).map(String)
    if (hit.length) out('JS ' + j.slice(0, 60), 'ACHADO ' + hit.join(' ') + ' ' + (t.match(/.{30}(access_token|refresh_token|id_token|eyJ[A-Za-z0-9_-]{6,}|groups).{30}/i)?.[0]))
  }
  out('JS varridos', `${n} arquivos, ${bytes} bytes`)
}
