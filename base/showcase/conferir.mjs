// Painel do showcase: com tudo no ar (task showcase), entra como cada ator e mostra, pelo shell,
// o que cada um vê em cada zona. Não muda nenhum dado.   task showcase:conferir
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { pedir, entrar, menu } from '../verificacao/apoio.mjs'

const PAGINAS = ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/zona1/recursos/r-3', '/zona2', '/acesso']
const ATORES = ['ana', 'bruno', 'carla', 'davi']
const COMPOSE = ['compose', '-f', join(import.meta.dirname, 'docker-compose.yml')]

const linhas = []
const ok = (nome, cond, detalhe = '') => linhas.push(`${cond ? '✔' : '✖'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)

// infraestrutura
let redis = 'fora'
try { redis = execFileSync('docker', [...COMPOSE, 'exec', '-T', 'redis', 'redis-cli', 'ping']).toString().trim() } catch {}
ok('Redis', redis === 'PONG')
const kc = await fetch('http://127.0.0.1:8080/realms/erp/.well-known/openid-configuration').then((r) => r.ok, () => false)
ok('Keycloak (realm erp)', kc)

// sem sessão: toda página manda ao login do shell
const anon = await pedir('/zona2')
ok('sem sessão, /zona2 vai para o login', anon.status === 307 && anon.local?.startsWith('/login'), `${anon.status} → ${anon.local}`)

// cada ator × cada página, pelo shell
console.log('\nstatus HTTP de cada página, pelo shell (200 vê; 404 não tem o módulo ou o recurso)\n')
console.log('ator    ' + PAGINAS.map((p) => p.padEnd(20)).join(''))
for (const u of ATORES) {
  const { cookie } = await entrar(u)
  const st = []
  for (const p of PAGINAS) st.push(String((await pedir(p, { cookie })).status).padEnd(20))
  console.log(u.padEnd(8) + st.join(''))
  const m = menu((await pedir('/', { cookie })).html).hrefs
  linhas.push(`  menu de ${u}: ${m.join(' · ')}`)
}

// sessão no Redis: o login grava a chave (com hash do id, nunca o id cru)
const { id } = await entrar('davi')
let chaves = ''
try { chaves = execFileSync('docker', [...COMPOSE, 'exec', '-T', 'redis', 'redis-cli', '--scan', '--pattern', 'erp:sessao:*']).toString() } catch {}
ok('sessão gravada no Redis (chave com hash)', /erp:sessao:[0-9a-f]{64}/.test(chaves) && !chaves.includes(id))

// o dado é do domínio: custo só para quem é do financeiro
const bruno = (await entrar('bruno')).cookie
const carla = (await entrar('carla')).cookie
ok('bruno vê o custo do recurso r-1', /CC-10/.test((await pedir('/zona1/recursos/r-1', { cookie: bruno })).html))
ok('carla (admin de acesso) não vê custo', !/CC-10/.test((await pedir('/zona1/recursos/r-1', { cookie: carla })).html))

// segurança visível de fora
const r = await pedir('/', { cookie: bruno })
ok('CSP com nonce', /'nonce-[^']+'/.test(r.csp ?? ''))
ok('nenhum token no HTML', !/dev\.(ana|bruno|carla|davi)\.|eyJ/.test(r.html))

console.log('\n' + linhas.join('\n'))
process.exit(linhas.some((l) => l.startsWith('✖')) ? 1 : 0)
