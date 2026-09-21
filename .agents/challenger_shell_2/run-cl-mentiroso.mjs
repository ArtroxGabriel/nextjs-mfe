// Repete o teste 3.4 (Content-Length mentiroso, MENOR que o corpo) via curl bruto, ja que o
// fetch/undici do Node recusa no lado do cliente um Content-Length manual incompatível com o corpo.
import { subir, SHELL as SHELL_URL } from '../../base/scripts/ambiente.mjs'
import { entrar } from '../../base/verificacao/apoio.mjs'
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

let ambiente
async function main() {
  ambiente = await subir({ construir: false })
  const bruno = (await entrar('bruno')).cookie
  const corpo = 'x'.repeat(300 * 1024)
  writeFileSync('/tmp/corpo-300k.txt', corpo)

  const saida = execFileSync('curl', [
    '-s', '-D', '-', '-o', '/tmp/resp-cl-mentiroso.txt', '--max-time', '5',
    '-X', 'POST', `${SHELL_URL}/api/otel/v1/traces`,
    '-H', `cookie: ${bruno}`,
    '-H', 'content-type: application/json',
    '-H', 'content-length: 10',
    '--data-binary', '@/tmp/corpo-300k.txt',
  ], { encoding: 'utf8' })
  writeFileSync(new URL('./item3.4-cl-mentiroso-curl.txt', import.meta.url).pathname, saida)
  console.log(saida)
}
main().finally(async () => { try { await ambiente?.derrubar() } catch {} })
