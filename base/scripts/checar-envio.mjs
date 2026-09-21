// Recusa enviar o repositório principal se ele aponta para um commit de submódulo que
// nenhum branch remoto contém. Foi o que causou o ADR-0010: quem clonou não achou o
// commit do núcleo e o reescreveu.
//   node base/scripts/checar-envio.mjs          (também roda no hook .githooks/pre-push)
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()

const fixados = git(raiz, 'ls-tree', '-r', 'HEAD', 'repos')
  .split('\n')
  .filter((l) => l.startsWith('160000 commit '))
  .map((l) => { const [, , sha, caminho] = l.split(/\s+/); return { sha, caminho } })

const faltando = []
for (const { sha, caminho } of fixados) {
  let remotos = ''
  try { remotos = git(join(raiz, caminho), 'branch', '-r', '--contains', sha) } catch { /* commit ausente */ }
  if (!remotos) faltando.push(`${caminho} @ ${sha.slice(0, 7)}`)
}

if (faltando.length) {
  console.error('Envie primeiro estes submódulos (o principal aponta para commits que só existem aqui):')
  for (const f of faltando) console.error(`  - ${f}`)
  console.error('Em cada um: git -C <caminho> push origin master. Ver .agents/orchestrator/AMBIENTE.md §2.')
  process.exit(1)
}
console.log(`submódulos ok: ${fixados.length} commits fixados, todos presentes num remoto`)
