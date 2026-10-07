// Painel do showcase: com tudo no ar (task showcase), entra como cada ator e mostra, pelo shell,
// o que cada um vê em cada zona. Não muda nenhum dado.   task showcase:conferir
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { pedir, entrarComo, modoDeLogin, menu } from '../verificacao/apoio.mjs'

const PAGINAS = ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/zona1/recursos/r-3', '/zona2', '/acesso']
const ATORES = ['ana', 'bruno', 'carla', 'davi', 'eva']
const SENHA_SHELL = process.env.ERP_REDIS_SENHA_SHELL ?? 'dev-shell-escrita'
const ACESSO_URL = process.env.ACESSO_URL ?? 'http://127.0.0.1:4020'
const COMPOSE = ['compose', '-f', join(import.meta.dirname, 'docker-compose.yml')]

const linhas = []
const ok = (nome, cond, detalhe = '') => linhas.push(`${cond ? '✔' : '✖'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)

// infraestrutura
let redis = 'fora'
// REDISCLI_AUTH no ambiente do exec: a senha não aparece na linha de comando
const redisCli = (...args) => execFileSync('docker', [...COMPOSE, 'exec', '-T', '-e', 'REDISCLI_AUTH', 'redis', 'redis-cli', ...args],
  { env: { ...process.env, REDISCLI_AUTH: SENHA_SHELL } }).toString()
try { redis = redisCli('ping').trim() } catch {}
ok('Redis', redis === 'PONG')
const kc = await fetch('http://127.0.0.1:8080/realms/erp/.well-known/openid-configuration').then((r) => r.ok, () => false)
ok('Keycloak (realm erp)', kc)

// modo de login em uso (decidido pelo Location de /api/auth/entrar)
const modo = await modoDeLogin()
ok('modo de login em uso', modo === 'oidc' || modo === 'dev', modo === 'oidc' ? 'Keycloak (OIDC + PKCE)' : 'login de desenvolvimento')

// sem sessão: toda página manda ao login do shell
const anon = await pedir('/zona2')
ok('sem sessão, /zona2 vai para o login', anon.status === 307 && anon.local?.startsWith('/login'), `${anon.status} → ${anon.local}`)

// cada ator × cada página, pelo shell
console.log('\nstatus HTTP de cada página, pelo shell (200 vê; 404 não tem o módulo ou o recurso)\n')
console.log('ator    ' + PAGINAS.map((p) => p.padEnd(20)).join(''))
for (const u of ATORES) {
  const { cookie } = await entrarComo(u, { modo })
  const st = []
  for (const p of PAGINAS) st.push(String((await pedir(p, { cookie })).status).padEnd(20))
  console.log(u.padEnd(8) + st.join(''))
  const m = menu((await pedir('/', { cookie })).html).hrefs
  linhas.push(`  menu de ${u}: ${m.join(', ')}`)
}

// sessão no Redis: o login grava a chave (com hash do id, nunca o id cru)
const { id } = await entrarComo('davi', { modo })
let chaves = ''
try { chaves = redisCli('--scan', '--pattern', 'erp:sessao:*') } catch {}
ok('sessão gravada no Redis (chave com hash)', /erp:sessao:[0-9a-f]{64}/.test(chaves) && !chaves.includes(id))

// o dado é do domínio: custo só para quem é do financeiro
const bruno = (await entrarComo('bruno', { modo })).cookie
const carla = (await entrarComo('carla', { modo })).cookie
ok('bruno vê o custo do recurso r-1', /CC-10/.test((await pedir('/zona1/recursos/r-1', { cookie: bruno })).html))
ok('carla (admin de acesso) não vê custo', !/CC-10/.test((await pedir('/zona1/recursos/r-1', { cookie: carla })).html))

// segurança visível de fora
const r = await pedir('/', { cookie: bruno })
ok('CSP com nonce', /'nonce-[^']+'/.test(r.csp ?? ''))
ok('nenhum token no HTML', !/dev\.(ana|bruno|carla|davi|eva)\.|eyJ/.test(r.html))

// bloco da zona 2 no painel da zona 1 (fragmento, C1): só para quem tem os dois módulos
const bloco = async (u) => /data-fragmento="zona2\/tarefas"/.test((await pedir('/zona1', { cookie: (await entrarComo(u, { modo })).cookie })).html)
const comBloco = {}
for (const u of ATORES) comBloco[u] = await bloco(u)
ok('bloco "Tarefas pendentes (zona 2)" no painel da zona 1: só a ana vê; bruno, carla, davi e eva não', comBloco.ana && ATORES.every((u) => u === 'ana' || !comBloco[u]),
  ATORES.map((u) => `${u} ${comBloco[u] ? 'vê' : 'não vê'}`).join(', '))

// mapa de zonas na gestão de acesso (C3)
const zr = await fetch(`${ACESSO_URL}/v2/zonas`, { headers: { authorization: 'Bearer svc.shell' }, redirect: 'manual' }).catch(() => null)
const zonas = zr?.ok ? await zr.json() : []
const ids = zonas.map((z) => z.id)
ok('mapa de zonas tem zona1, zona2 e acesso', ['zona1', 'zona2', 'acesso'].every((z) => ids.includes(z)), ids.join(', '))

// o documento da zona 1 sai sem a origem interna em nenhum cabeçalho (x-middleware-rewrite do caminho rápido:
// limite declarado, D31; no documento só pode trazer o caminho interno /_gateway)
const doc = await fetch('http://localhost:3000/zona1', { headers: { cookie: bruno }, redirect: 'manual' })
const vazados = []
for (const [k, v] of doc.headers) {
  if (zonas.some((z) => z.origem && v.includes(z.origem)) || /https?:\/\/(127\.0\.0\.1|localhost):(300[1-9]|4\d{3})/.test(v)) vazados.push(k)
}
const rw = doc.headers.get('x-middleware-rewrite')
ok('documento da zona 1 sem origem interna em cabeçalho', doc.status === 200 && vazados.length === 0 && (!rw || rw.startsWith('/_gateway')),
  vazados.length ? `em: ${vazados.join(', ')}` : rw ? 'x-middleware-rewrite só com o caminho interno' : 'nenhum x-middleware-rewrite')

console.log('\n' + linhas.join('\n'))
process.exit(linhas.some((l) => l.startsWith('✖')) ? 1 : 0)
