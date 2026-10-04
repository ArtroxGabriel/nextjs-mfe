// Mede o custo do proxy do shell (ADR-0013, Consequências: "um GET no Redis por requisição dinâmica do
// shell — medir o p95 do proxy"). Sobe a base com a sessão no Redis do showcase, mede e derruba.
//   task medir:proxy        (task showcase:subir antes; MEDIR_N muda o número de requisições por cenário)
//
// Três cenários na mesma rota de zona (/zona1), em série, uma requisição por vez:
//   A. sem cookie: o proxy manda ao login sem ler o store (0 leituras);
//   B. cookie com id inexistente: o proxy lê o store uma vez (`renovarSessao` → `ausente`) e manda ao
//      login apagando o cookie. A diferença B − A é o custo da leitura que o D2 pôs no proxy;
//   C. sessão válida fora da janela de renovação: proxy (1 leitura) + página renderizada pela zona.
//      Dá a escala: quanto do tempo de uma página é o proxy.
// Números valem para a máquina onde rodaram; o que se compara é A com B na mesma rodada.
import { randomUUID } from 'node:crypto'
import { subir, SHELL } from './ambiente.mjs'
import { entrar } from '../verificacao/apoio.mjs'

const N = Number(process.env.MEDIR_N ?? 1000)
const AQUECER = Math.min(100, N)
if (!Number.isInteger(N) || N < 10) throw new Error('MEDIR_N tem de ser inteiro >= 10')
if (!process.env.REDIS_URL || !process.env.REDIS_URL_ZONA) throw new Error('defina REDIS_URL e REDIS_URL_ZONA (task medir:proxy faz isso)')

const percentil = (ordenados, p) => ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)]

async function medir(nome, cookie, statusEsperado) {
  const uma = async () => {
    const t0 = process.hrtime.bigint()
    const r = await fetch(`${SHELL}/zona1`, { redirect: 'manual', headers: cookie ? { cookie } : {} })
    await r.arrayBuffer()
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    if (r.status !== statusEsperado) throw new Error(`${nome}: HTTP ${r.status}, esperado ${statusEsperado}`)
    return ms
  }
  for (let i = 0; i < AQUECER; i++) await uma()
  const tempos = []
  for (let i = 0; i < N; i++) tempos.push(await uma())
  tempos.sort((a, b) => a - b)
  const f = (v) => v.toFixed(2).padStart(8)
  console.log(`${nome.padEnd(46)} n=${N}  p50 ${f(percentil(tempos, 50))} ms  p95 ${f(percentil(tempos, 95))} ms  p99 ${f(percentil(tempos, 99))} ms`)
  return tempos
}

const ambiente = await subir({ construir: process.env.CONSTRUIR === 'tudo' ? 'tudo' : process.env.CONSTRUIR === '1' })
try {
  const { cookie } = await entrar('ana')
  console.log(`proxy do shell, rota /zona1, ${N} requisições por cenário depois de ${AQUECER} de aquecimento, em série`)
  await medir('A. sem cookie (0 leituras do store) → 307', null, 307)
  await medir('B. cookie inexistente (1 leitura) → 307', `__Host-session=${randomUUID()}`, 307)
  await medir('C. sessão válida (1 leitura + página da zona) → 200', cookie, 200)
} finally {
  ambiente.derrubar()
}
