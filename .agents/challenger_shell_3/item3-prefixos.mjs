// Item 3: /api/otelx, /api/authx, /api/auth-falso/x, /API/OTEL/v1/traces sem cookie -- alguma
// rota escapa da sessao (chega ao route handler / conteudo protegido sem redirecionar ao login)?
import { writeFileSync } from 'node:fs'
import { subir, SHELL } from '../../base/scripts/ambiente.mjs'

const CAMINHOS = ['/api/otelx', '/api/authx', '/api/auth-falso/x', '/API/OTEL/v1/traces']

async function main() {
  const ambiente = await subir({ construir: false })
  const resultado = []
  try {
    for (const caminho of CAMINHOS) {
      const r = await fetch(`${SHELL}${caminho}`, { method: 'GET', redirect: 'manual' })
      const corpo = await r.text()
      resultado.push({
        caminho, status: r.status, location: r.headers.get('location'),
        contentType: r.headers.get('content-type'), tamanhoCorpo: corpo.length,
        corpoAmostra: corpo.slice(0, 300),
      })
      // tambem testa POST, ja que /api/otel e /api/auth sao ambos POST na uso real
      const rp = await fetch(`${SHELL}${caminho}`, { method: 'POST', redirect: 'manual', body: '{}', headers: { 'content-type': 'application/json' } })
      const corpoP = await rp.text()
      resultado.push({
        caminho, metodo: 'POST', status: rp.status, location: rp.headers.get('location'),
        contentType: rp.headers.get('content-type'), tamanhoCorpo: corpoP.length,
        corpoAmostra: corpoP.slice(0, 300),
      })
    }
  } finally {
    await ambiente.derrubar()
  }
  writeFileSync(new URL('./item3-resultado.json', import.meta.url), JSON.stringify(resultado, null, 2))
  for (const r of resultado) {
    console.log(`${r.metodo ?? 'GET'} ${r.caminho}: status=${r.status} location=${r.location} corpo(300)=${JSON.stringify(r.corpoAmostra)}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
