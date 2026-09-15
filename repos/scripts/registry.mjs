import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = dirname(dirname(fileURLToPath(import.meta.url)))
const acao = process.argv[2]
const composeFile = join(raiz, 'docker-compose.yml')

if (acao === 'up') {
  execSync(`docker compose -f "${composeFile}" up -d`, { stdio: 'inherit', cwd: raiz })
  console.log('verdaccio subindo via docker compose, http://localhost:4873')
} else if (acao === 'down') {
  execSync(`docker compose -f "${composeFile}" down`, { stdio: 'inherit', cwd: raiz })
  console.log('verdaccio derrubado')
} else {
  console.error('uso: node repos/scripts/registry.mjs up|down')
  process.exit(1)
}
