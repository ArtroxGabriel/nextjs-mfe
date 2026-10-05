import { entrar, redisCmd } from './lib.mjs'
import { createHash } from 'node:crypto'
for (const u of ['eva', 'davi']) {
  const e = await entrar(u)
  const s = JSON.parse((await redisCmd(['GET', 'erp:sessao:' + createHash('sha256').update(e.id).digest('hex')])).match(/\{[\s\S]*\}/)[0])
  const x = await fetch('http://127.0.0.1:4020/v2/eu', { headers: { authorization: 'Bearer ' + s.accessToken } })
  console.log(u, 'sub', s.sub, '/v2/eu', x.status, (await x.text()).slice(0, 150))
}
