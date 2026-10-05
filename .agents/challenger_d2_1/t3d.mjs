import { SHELL, get, entrar, redisCmd } from './lib.mjs'
import { createHash } from 'node:crypto'
const e = await entrar('eva')
const r = await redisCmd(['GET', 'erp:sessao:' + createHash('sha256').update(e.id).digest('hex')]); const s = JSON.parse(r.match(/\{[\s\S]*\}/)[0])
console.log(Object.keys(s), s.nome)
const pay = JSON.parse(Buffer.from(s.accessToken.split('.')[1], 'base64url')); console.log({ pu: pay.preferred_username, aud: pay.aud, exp: pay.exp - pay.iat })
for (const [p, port] of [['/v1/tarefas', 4003], ['/v1/tarefas', 4001]]) { const x = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { authorization: 'Bearer ' + s.accessToken } }); console.log(port, p, x.status, (await x.text()).slice(0, 100)) }
