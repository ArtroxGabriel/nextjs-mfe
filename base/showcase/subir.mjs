// Showcase: sobe tudo e deixa no ar para usar no navegador.
//   task showcase            (ou: node base/showcase/subir.mjs [--construir] [--log])
// 1. Redis e Keycloak (docker compose), esperando os dois responderem;
// 2. domínios falsos com o estado gravado em repos/erp-dominio-stub/dados/estado (DADOS_DIR);
// 3. shell e as três zonas em modo produção, com os manifestos registrados.
// Ctrl-C derruba domínios e apps; Redis e Keycloak ficam (task showcase:descer).
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { subir, SHELL, RAIZ } from '../scripts/ambiente.mjs'

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

console.log('1/3 infraestrutura (Redis, Keycloak)')
execFileSync('docker', [...COMPOSE, 'up', '-d'], { stdio: 'ignore' })
await esperar('Redis', async () =>
  execFileSync('docker', [...COMPOSE, 'exec', '-T', 'redis', 'redis-cli', 'ping']).toString().trim() === 'PONG')
await esperar('Keycloak', async () => (await fetch(KEYCLOAK, { signal: AbortSignal.timeout(2000) })).ok)

console.log('2/3 domínios falsos com estado gravado; 3/3 shell e zonas (pode levar alguns minutos no primeiro build)')
process.env.DADOS_DIR ??= join(RAIZ, 'erp-dominio-stub', 'dados', 'estado')
const { derrubar } = await subir({
  construir: process.argv.includes('--construir'),
  log: process.argv.includes('--log'),
})

console.log(`
showcase no ar: ${SHELL}

  atores (login de desenvolvimento, sem senha):
    ana    operadora    — zona 1 (painel) e zona 2 (tarefas, pode concluir)
    bruno  analista     — zona 1 com relatórios e custos (grupo FINANCEIRO)
    carla  admin acesso — tela de gestão de acesso (/acesso)
    davi   sem perfil   — só o que não é restrito

  conferir tudo de uma vez:  task showcase:conferir      (em outro terminal)
  roteiro no navegador:      docs/ROTEIRO-DE-VERIFICACAO.md
  dados dos domínios:        ${process.env.DADOS_DIR}  (task showcase:dados:resetar volta à semente)
  Keycloak (admin/admin):    http://localhost:8080  — conferido por task showcase:checar;
                             as apps ainda usam o login de desenvolvimento (D2, ADR-0013)

Ctrl-C derruba domínios, shell e zonas.`)
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => { derrubar(); process.exit(0) })
