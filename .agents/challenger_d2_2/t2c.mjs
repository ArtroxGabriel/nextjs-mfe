import { SHELL, sc, get, entrar, redisCmd } from './lib.mjs'
import { createHash } from 'node:crypto'
const P = [/access_token/i, /refresh_token/i, /id_token/i, /eyJ[A-Za-z0-9_-]{6,}/, /refreshToken/, /idToken/, /accessToken/, /FINANCEIRO/, /"groups"/]
for (const ator of ['bruno', 'carla']) {
  const s = await entrar(ator)
  for (const a of ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/acesso']) {
    const r = await get(`${SHELL}${a}?_rsc=abc`, { headers: { cookie: s.cookie, rsc: '1', 'next-router-prefetch': '' } })
    const t = await r.text()
    console.log(ator, a, 'RSC', r.status, r.headers.get('content-type'), t.length, P.filter((p) => p.test(t)).map(String).join(' ') || 'limpo')
  }
}
// ACL do Redis: zona lê, não grava; shell grava
const s = await entrar('ana')
const k = 'erp:sessao:' + createHash('sha256').update(s.id).digest('hex')
const z = ['zona', 'dev-zona-leitura']
const strip = (x) => x.replace(/\r\n/g, ' | ').slice(0, 400)
console.log('zona GET   :', strip(await redisCmd(['GET', k], undefined, z)))
console.log('zona SET   :', strip(await redisCmd(['SET', k, '{}'], undefined, z)))
console.log('zona DEL   :', strip(await redisCmd(['DEL', k], undefined, z)))
console.log('zona SET other key:', strip(await redisCmd(['SET', 'foo', '1'], undefined, z)))
console.log('zona GET other key:', strip(await redisCmd(['GET', 'foo'], undefined, z)))
console.log('zona KEYS  :', strip(await redisCmd(['KEYS', '*'], undefined, z)))
console.log('zona EVAL  :', strip(await redisCmd(['EVAL', "return redis.call('set','erp:sessao:x','1')", '0'], undefined, z)))
console.log('anonimo SET:', strip(await redisCmd(['SET', 'foo', '1'], undefined, ['default', 'errada'])))
