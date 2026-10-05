import { spawn } from 'node:child_process'
import net from 'node:net'
const SHELLDIR = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/repos/erp-shell'
const base = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', REDIS_URL: 'redis://default:dev-shell-escrita@127.0.0.1:6379', REDIS_URL_ZONA: 'redis://zona:dev-zona-leitura@127.0.0.1:6379', IDP_CLIENTE_SEGREDO: 'dev-erp-shell-segredo' }
// escuta na 4016 para ver se alguém tenta conectar no "IdP" falso
let conexoes = 0
const srv = net.createServer((s) => { conexoes++; s.destroy() }).listen(4016, '127.0.0.1')
const casos = [
  ['A sem flag, emissor http://127.0.0.1:8080', { IDP_EMISSOR: 'http://127.0.0.1:8080/realms/erp' }],
  ['B flag=1, emissor loopback (controle, deve funcionar)', { IDP_EMISSOR: 'http://127.0.0.1:8080/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['C flag=1, emissor 127.0.0.1.nip.io:4016', { IDP_EMISSOR: 'http://127.0.0.1.nip.io:4016/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['D flag=1, emissor evil.localhost:4016', { IDP_EMISSOR: 'http://evil.localhost:4016/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['E flag=1, emissor localhost.:4016', { IDP_EMISSOR: 'http://localhost.:4016/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['F flag=1, emissor http://localhost@evil.example', { IDP_EMISSOR: 'http://localhost@evil.example/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['G flag=1, emissor http://127.0.0.1.evil.example:4016', { IDP_EMISSOR: 'http://127.0.0.1.evil.example:4016/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['H flag=true (nao 1)', { IDP_EMISSOR: 'http://127.0.0.1:8080/realms/erp', ERP_PERMITIR_HTTP_LOCAL: 'true' }],
  ['I flag=" 1"', { IDP_EMISSOR: 'http://127.0.0.1:8080/realms/erp', ERP_PERMITIR_HTTP_LOCAL: ' 1' }],
  ['J flag=1, emissor 0.0.0.0', { IDP_EMISSOR: 'http://0.0.0.0:8080/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['K flag=1, emissor 127.1 (forma curta)', { IDP_EMISSOR: 'http://127.1:8080/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['L flag=1, emissor 127.0.0.2', { IDP_EMISSOR: 'http://127.0.0.2:8080/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1' }],
  ['M flag=1, emissor loopback, retorno externo', { IDP_EMISSOR: 'http://127.0.0.1:8080/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1', IDP_URL_RETORNO: 'http://app.example.com/api/auth/retorno' }],
  ['N flag=1, emissor loopback, pos-logout externo', { IDP_EMISSOR: 'http://127.0.0.1:8080/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1', IDP_URL_POS_LOGOUT: 'http://app.example.com/login' }],
  ['O flag=1, emissor https externo (controle de config)', { IDP_EMISSOR: 'https://idp.example.invalid/realms/erp', ERP_PERMITIR_HTTP_LOCAL: '1', IDP_URL_RETORNO: 'https://app.example.invalid/api/auth/retorno', IDP_URL_POS_LOGOUT: 'https://app.example.invalid/login' }],
]
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
for (const [nome, env] of casos) {
  conexoes = 0
  const p = spawn(`${SHELLDIR}/node_modules/.bin/next`, ['start', '-p', '4015'], { cwd: SHELLDIR, env: { ...base, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''; p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d))
  for (let i = 0; i < 60 && !/Ready|ready/.test(log) && p.exitCode === null; i++) await esperar(250)
  await esperar(300)
  const res = []
  for (const path of ['/login', '/api/auth/entrar', '/zona1']) {
    try { const r = await fetch('http://127.0.0.1:4015' + path, { redirect: 'manual', headers: { host: 'localhost:3000' } }); const b = await r.text(); res.push(`${path}=${r.status}${r.headers.get('location') ? '->' + r.headers.get('location').slice(0, 50) : ''}`) } catch (e) { res.push(`${path}=ERR ${e.cause?.code ?? e.message}`) }
  }
  const erros = log.split('\n').filter((l) => /rro|rror|recus|https/.test(l)).slice(0, 2).map((l) => l.slice(0, 160)).join(' // ')
  console.log(nome.padEnd(58), res.join('  '), '| conexoes ao 4016:', conexoes, '| saiu:', p.exitCode, '|', erros)
  p.kill('SIGTERM'); await esperar(600)
}
srv.close()
