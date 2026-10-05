// Showcase: sobe tudo e deixa no ar para usar no navegador.
//   task showcase            (ou: node base/showcase/subir.mjs [--construir] [--log])
//   task showcase:oidc       (o mesmo com --oidc: login pelo Keycloak do showcase, domínios em modo JWT)
// 1. Redis e Keycloak (docker compose), esperando os dois responderem;
// 2. domínios falsos com o estado gravado em repos/erp-dominio-stub/dados/estado (DADOS_DIR) e a
//    sessão no Redis (REDIS_URL);
// 3. shell e as três zonas em modo produção, com os manifestos registrados.
// Ctrl-C derruba domínios e apps; Redis e Keycloak ficam (task showcase:descer).
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { subir, SHELL, RAIZ } from '../scripts/ambiente.mjs'
import { atoresAusentes, avisoDeEstado } from '../scripts/estado-do-showcase.mjs'

const COMPOSE = ['compose', '-f', join(import.meta.dirname, 'docker-compose.yml')]
const KEYCLOAK = 'http://127.0.0.1:8080/realms/erp/.well-known/openid-configuration'

async function esperar(nome, pronto, ms = 120_000) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    if (await pronto().catch(() => false)) return console.log(`  ${nome}: no ar`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`${nome} nao respondeu em ${ms / 1000} s`)
}

// senha do usuário de escrita (K4-4): o Redis recusa até o `ping` sem ela (challenger_b1_d1_9)
const SENHA_SHELL = process.env.ERP_REDIS_SENHA_SHELL ?? 'dev-shell-escrita'

console.log('1/3 infraestrutura (Redis, Keycloak)')
execFileSync('docker', [...COMPOSE, 'up', '-d'], { stdio: 'ignore' })
// `REDISCLI_AUTH` no ambiente do exec: a senha não aparece na linha de comando no host
await esperar('Redis', async () =>
  execFileSync('docker', [...COMPOSE, 'exec', '-T', '-e', 'REDISCLI_AUTH', 'redis', 'redis-cli', 'ping'], {
    env: { ...process.env, REDISCLI_AUTH: SENHA_SHELL },
  }).toString().trim() === 'PONG')
await esperar('Keycloak', async () => (await fetch(KEYCLOAK, { signal: AbortSignal.timeout(2000) })).ok)

console.log('2/3 domínios falsos com estado gravado; 3/3 shell e zonas (pode levar alguns minutos no primeiro build)')
process.env.DADOS_DIR ??= join(RAIZ, 'erp-dominio-stub', 'dados', 'estado')
// estado gravado antes de a semente ganhar um ator (a eva): avisa e sugere o reset, sem migrar
const aviso = avisoDeEstado(atoresAusentes(process.env.DADOS_DIR), process.env.DADOS_DIR)
if (aviso) console.warn(`\n${aviso}\n`)
// sessão no Redis do compose (D1): shell grava, zonas leem; ver docs/CONFIGURACAO.md
process.env.REDIS_URL ??= `redis://default:${SENHA_SHELL}@127.0.0.1:6379`
// zonas só leem a sessão: usuário ACL com GET e nada mais (invariante 15)
process.env.REDIS_URL_ZONA ??= `redis://zona:${process.env.ERP_REDIS_SENHA_ZONA ?? 'dev-zona-leitura'}@127.0.0.1:6379`
// Modo OIDC (ADR-0013): o shell entra pelo Keycloak do showcase, as zonas tiram dele a origem do logout (CSP) e
// os domínios só aceitam o access token dele. O Keycloak local é `http://`; ERP_PERMITIR_HTTP_LOCAL=1 aceita isso
// em produção só para loopback (adendo 2). O segredo é o padrão público do compose (docs/CONFIGURACAO.md §1).
const OIDC = process.argv.includes('--oidc')
if (OIDC) {
  process.env.IDP_EMISSOR ??= 'http://127.0.0.1:8080/realms/erp'
  process.env.IDP_CLIENTE_SEGREDO ??= 'dev-erp-shell-segredo'
  process.env.ERP_PERMITIR_HTTP_LOCAL ??= '1'
}
const { derrubar } = await subir({
  construir: process.argv.includes('--construir'),
  log: process.argv.includes('--log'),
})

function mascararUrl(url) {
  try {
    const u = new URL(url)
    if (u.password) u.password = '***'
    return u.toString()
  } catch {
    return url
  }
}

console.log(`
showcase no ar: ${SHELL}

  atores (${OIDC ? 'login pelo Keycloak; a senha é o próprio nome' : 'login de desenvolvimento, sem senha'}):
    ana    operadora    — zona 1 (painel) e zona 2 (tarefas, pode concluir)
    bruno  analista     — zona 1 com relatórios e custos (grupo FINANCEIRO)
    carla  admin acesso — tela de gestão de acesso (/acesso)
    davi   sem perfil   — só o que não é restrito
    eva    leitora      — zona 2 (tarefas, apenas leitura)

  conferir tudo de uma vez:  task showcase:conferir      (em outro terminal)
  roteiro no navegador:      docs/ROTEIRO-DE-VERIFICACAO.md
  dados dos domínios:        ${process.env.DADOS_DIR}  (task showcase:dados:resetar volta à semente)
  sessão:                    Redis (${mascararUrl(process.env.REDIS_URL)}); cookie __Host-session só com o id opaco
  Keycloak (admin/admin):    http://localhost:8080  — conferido por task showcase:checar;
                             ${OIDC ? `login OIDC (${process.env.IDP_EMISSOR}); domínios só aceitam o token dele` : 'login de desenvolvimento; com o Keycloak: task showcase:oidc'}

Ctrl-C derruba domínios, shell e zonas.${aviso ? `\n\n${aviso}` : ''}`)
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => { derrubar(); process.exit(0) })
