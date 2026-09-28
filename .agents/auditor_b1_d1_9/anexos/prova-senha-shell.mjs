// Prova (auditor_b1_d1_9) do V1 da it.8 no código da K5: a base sobe como o showcase monta o ambiente, com
// ERP_REDIS_SENHA_SHELL definida (a senha real do container, como fora da máquina local) e mais uma variável de
// nome qualquer com a mesma senha. Para cada zona e domínio, lê /proc/<pid>/environ e tenta gravar uma sessão
// forjada com TODA credencial que o processo tem (qualquer valor com a senha ou URL redis://). Apaga a chave.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createConnection } from 'node:net'
import { subir } from '../../../base/scripts/ambiente.mjs'
import { pedir, entrar } from '../../../base/verificacao/apoio.mjs'
process.env.ERP_REDIS_SENHA_SHELL = 'dev-shell-escrita'
process.env.QUALQUER_SEGREDO_NOVO = 'dev-shell-escrita'
process.env.REDIS_URL = 'redis://default:dev-shell-escrita@127.0.0.1:6379'
process.env.REDIS_URL_ZONA = 'redis://zona:dev-zona-leitura@127.0.0.1:6379'
delete process.env.DADOS_DIR
const resp = (...a) => `*${a.length}\r\n` + a.map((x) => `$${Buffer.byteLength(x)}\r\n${x}\r\n`).join('')
const redis = (cmds) => new Promise((ok, falha) => { const c = createConnection({ host: '127.0.0.1', port: 6379 }); let d = ''; c.on('data', (x) => { d += x }); c.on('close', () => ok(d)); c.on('error', falha); c.write([...cmds, ['QUIT']].map((a) => resp(...a)).join('')) })
const environ = (pid) => Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const amb = await subir({ construir: false })
const id = 'forjada-aud9-senha'
const chave = `erp:sessao:${createHash('sha256').update(id).digest('hex')}`
let gravou = false
try {
  const carla = await entrar('carla')
  const lido = await redis([['AUTH', 'zona', 'dev-zona-leitura'], ['GET', `erp:sessao:${createHash('sha256').update(carla.id).digest('hex')}`]])
  const sessao = lido.split('\r\n').find((l) => l.startsWith('{'))
  console.log('sessao da carla (lida com o usuario zona):', sessao ? `${sessao.length} bytes` : lido)
  for (const [nome, p] of [...amb.apps, ...amb.dominios]) {
    const env = environ(p.pid)
    const comSenha = Object.keys(env).filter((k) => env[k].includes('dev-shell-escrita'))
    console.log(`${nome} (pid ${p.pid}): REDIS_URL=${'REDIS_URL' in env} ERP_REDIS_SENHA_SHELL=${'ERP_REDIS_SENHA_SHELL' in env} QUALQUER_SEGREDO_NOVO=${'QUALQUER_SEGREDO_NOVO' in env} variaveis com a senha=[${comSenha.join(',')}]`)
    if (nome === 'erp-shell') continue
    // toda credencial do processo: URLs redis:// e valores soltos como senha do default e do zona
    const creds = []
    for (const v of Object.values(env)) {
      if (/^rediss?:\/\//.test(v)) { const u = new URL(v); creds.push([decodeURIComponent(u.username || 'default'), decodeURIComponent(u.password)]) }
    }
    for (const [usuario, senha] of creds) {
      const r = await redis([['AUTH', usuario, senha], ['SET', chave, sessao ?? '{}', 'EX', '300']])
      console.log(`  ${nome} grava com ${usuario}:*** do proprio ambiente:`, JSON.stringify(r.replace(/\r\n/g, ' ')))
      if (/\+OK \+OK/.test(r.replace(/\r\n/g, ' '))) gravou = true
    }
  }
  const x = await pedir('/', { cookie: `__Host-session=${id}` })
  console.log('cookie forjado (nunca emitido) em /:', x.status, gravou ? '(ALGUMA ZONA GRAVOU)' : '(nenhuma zona gravou)')
} finally {
  const d = await redis([['AUTH', 'default', 'dev-shell-escrita'], ['DEL', chave], ['EXISTS', chave]])
  console.log('limpeza DEL/EXISTS:', JSON.stringify(d))
  amb.derrubar()
}
