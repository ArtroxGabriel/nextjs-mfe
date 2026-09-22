// Item 4: CSP em /, /login, /erro-de-zona e numa zona -- mesmas diretivas? um so cabecalho CSP
// por resposta? Usa curl -D para ver cabecalhos crus (fetch normalizaria/uniria duplicatas).
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { subir, SHELL } from '../../base/scripts/ambiente.mjs'

function curlCru(caminho, { cookie } = {}) {
  const args = ['-s', '-D', '-', '-o', '/tmp/corpo-csp.html', `${SHELL}${caminho}`]
  if (cookie) args.push('-H', `cookie: ${cookie}`)
  const saida = execFileSync('curl', args, { encoding: 'utf8' })
  return saida
}

async function main() {
  const ambiente = await subir({ construir: false })
  const resultado = {}
  try {
    // login real via curl para obter cookie de sessao
    const loginSaida = execFileSync('curl', ['-s', '-D', '-', '-o', '/dev/null', '-X', 'POST',
      `${SHELL}/api/auth/entrar`, '-H', 'origin: ' + SHELL,
      '--data-urlencode', 'usuario=davi', '--data-urlencode', 'de=/'], { encoding: 'utf8' })
    const m = loginSaida.match(/__Host-session=([^;]+)/)
    const cookie = m ? `__Host-session=${m[1]}` : null

    resultado['/'] = curlCru('/', { cookie })
    resultado['/login'] = curlCru('/login')
    resultado['/erro-de-zona'] = curlCru('/erro-de-zona')
    resultado['/zona1'] = curlCru('/zona1', { cookie })
    // sem sessao tambem, pra ver se a resposta de redirecionamento tem CSP
    resultado['/zona1 (sem cookie, 307)'] = curlCru('/zona1')

    writeFileSync(new URL('./item4-cabecalhos-brutos.txt', import.meta.url),
      Object.entries(resultado).map(([k, v]) => `=== ${k} ===\n${v}\n`).join('\n'))

    for (const [rota, bruto] of Object.entries(resultado)) {
      const linhas = bruto.split('\r\n').filter((l) => /^content-security-policy:/i.test(l))
      console.log(`--- ${rota} ---`)
      console.log(`status: ${bruto.split('\r\n')[0]}`)
      console.log(`ocorrencias de CSP: ${linhas.length}`)
      linhas.forEach((l, i) => console.log(`  [${i}] ${l}`))
    }
  } finally {
    await ambiente.derrubar()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
