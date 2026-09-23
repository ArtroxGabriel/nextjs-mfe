// Confere se a chave forjada existe, se o shell aceita o cookie nunca emitido, e apaga. Uso: node prova-chave.mjs <id>
import { createHash } from 'node:crypto'
import { createConnection } from 'node:net'
import { subir } from '../../../base/scripts/ambiente.mjs'
import { pedir } from '../../../base/verificacao/apoio.mjs'
const id = process.argv[2]
const chave = 'erp:sessao:' + createHash('sha256').update(id).digest('hex')
const resp = (...a) => '*' + a.length + '\r\n' + a.map((x) => '$' + Buffer.byteLength(x) + '\r\n' + x + '\r\n').join('')
const redis = (cmds) => new Promise((ok, falha) => { const c = createConnection({ host: '127.0.0.1', port: 6379 }); let d = ''; c.on('data', (x) => { d += x }); c.on('close', () => ok(d)); c.on('error', falha); c.write([['AUTH', 'default', 'dev-shell-escrita'], ...cmds, ['QUIT']].map((a) => resp(...a)).join('')) })
console.log('EXISTS/GET antes:', JSON.stringify(await redis([['EXISTS', chave], ['GET', chave]])))
if (process.argv.includes('--no-ar')) {
  process.env.REDIS_URL ??= 'redis://default:dev-shell-escrita@127.0.0.1:6379'
  process.env.REDIS_URL_ZONA ??= 'redis://zona:dev-zona-leitura@127.0.0.1:6379'
  const amb = await subir({ construir: false })
  try {
    for (const c of ['/', '/acesso', '/zona1']) {
      const x = await pedir(c, { cookie: '__Host-session=' + id })
      console.log('cookie forjado (nunca emitido pelo shell) ' + c + ': ' + x.status, /Gestão de acesso/.test(x.html ?? '') ? '(pagina de administracao)' : '')
    }
  } finally { amb.derrubar() }
}
console.log('limpeza DEL/EXISTS:', JSON.stringify(await redis([['DEL', chave], ['EXISTS', chave]])))
