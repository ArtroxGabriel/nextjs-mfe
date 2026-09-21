import { readFileSync } from 'node:fs'
const cookie = readFileSync('cookies/carla.txt', 'utf8')
  .split('\n').find((l) => l.includes('__Host-session'))?.split('\t').pop()?.trim()

const tInicioMedicao = Date.now()
const registros = []
for (let i = 0; i < 500; i++) {
  const r = await fetch('http://localhost:3000/acesso', { headers: { Cookie: `__Host-session=${cookie}` }, redirect: 'manual' })
  const corpo = await r.text()
  registros.push({ i, status: r.status, msDesdeInicio: Date.now() - tInicioMedicao, tamanho: corpo.length })
  if (r.status === 503) break
}
const naoquinhentos = registros.filter(r => r.status !== 503)
console.log(JSON.stringify({ totalRequisicoes: registros.length, qtdNao503: naoquinhentos.length, primeiro503: registros.find(r=>r.status===503), ultimoNao503: naoquinhentos.at(-1) }, null, 2))
