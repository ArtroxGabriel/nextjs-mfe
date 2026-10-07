// Mede o custo do roteamento híbrido do shell contra as zonas reais (ADR-0015, "Medição contra as zonas reais").
// Sobe a base como `medir:proxy`, entra como um ator de teste, mede e derruba.
//   task medir:gateway      (task showcase:subir antes; MEDIR_SEGUNDOS muda a duração de cada cenário)
//
// Cenários, com 1 e 4 conexões fixas (keep-alive, accept-encoding: gzip), depois de um aquecimento:
//   a. documento de zona pelo gateway:        GET /zona1 com cookie;
//   b. RSC da mesma página, caminho rápido:   GET /zona1?_rsc=... com cookie e `RSC: 1` (como o App Router pede);
//   c. ativo estático da zona, caminho rápido: GET /zona1-static/... (URL tirada do HTML da página).
// A CPU é a do grupo de processos do shell (utime + stime de /proc/<pid>/stat), dividida pelas requisições.
// Números valem para a máquina onde rodaram; o que se compara é um cenário com outro na mesma rodada.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { subir, SHELL } from './ambiente.mjs'
import { entrar } from '../verificacao/apoio.mjs'

const SEGUNDOS = Number(process.env.MEDIR_SEGUNDOS ?? 8)
const AQUECER_S = Number(process.env.MEDIR_AQUECER_S ?? 2)
if (!(SEGUNDOS >= 1)) throw new Error('MEDIR_SEGUNDOS tem de ser >= 1')
if (!process.env.REDIS_URL || !process.env.REDIS_URL_ZONA) throw new Error('defina REDIS_URL e REDIS_URL_ZONA (task medir:gateway faz isso)')
const { hostname, port } = new URL(SHELL)
const TICKS = Number(execFileSync('getconf', ['CLK_TCK']).toString())

const cpuTicks = (pids) => pids.reduce((s, pid) => {
  try { const c = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' '); return s + Number(c[11]) + Number(c[12]) } catch { return s }
}, 0)

function carga({ caminho, cabecalhos, conc, segundos, pids }) {
  const agente = new http.Agent({ keepAlive: true, maxSockets: conc })
  const lat = []; let bytes = 0, erros = 0
  const fim = Date.now() + segundos * 1000
  const um = () => new Promise((ok) => {
    const t = process.hrtime.bigint()
    http.get({ hostname, port, path: caminho, agent: agente, headers: { 'accept-encoding': 'gzip', ...cabecalhos } }, (r) => {
      r.on('data', (d) => { bytes += d.length })
      r.on('end', () => { if (r.statusCode !== 200) erros++; lat.push(Number(process.hrtime.bigint() - t) / 1e6); ok() })
    }).on('error', () => { erros++; ok() })
  })
  return (async () => {
    const c0 = cpuTicks(pids); const t0 = Date.now()
    await Promise.all(Array.from({ length: conc }, async () => { while (Date.now() < fim) await um() }))
    const dur = (Date.now() - t0) / 1000; const c1 = cpuTicks(pids)
    agente.destroy()
    lat.sort((a, b) => a - b)
    const q = (p) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))]
    return {
      conc, n: lat.length, erros, rps: lat.length / dur, p50: q(0.5), p99: q(0.99),
      bytesPorResp: bytes / lat.length, cpuMsPorReq: ((c1 - c0) / TICKS) * 1000 / lat.length, cpuShellPct: ((c1 - c0) / TICKS / dur) * 100,
    }
  })()
}

const um = (caminho, cabecalhos) => new Promise((ok, falha) => {
  http.get({ hostname, port, path: caminho, headers: cabecalhos }, (r) => {
    const partes = []; r.on('data', (d) => partes.push(d))
    r.on('end', () => ok({ status: r.statusCode, headers: r.headers, corpo: Buffer.concat(partes) }))
  }).on('error', falha)
})

const ambiente = await subir({ construir: process.env.CONSTRUIR === 'tudo' ? 'tudo' : process.env.CONSTRUIR === '1' })
try {
  const { cookie } = await entrar('ana')
  const grupo = ambiente.apps.get('erp-shell').pid
  const pids = execFileSync('ps', ['-o', 'pid=', '-g', String(grupo)]).toString().split('\n').map((s) => s.trim()).filter(Boolean)

  const doc = await um('/zona1', { cookie, 'accept-encoding': 'gzip' })
  if (doc.status !== 200) throw new Error(`GET /zona1 devolveu HTTP ${doc.status}`)
  const html = (doc.headers['content-encoding'] === 'gzip' ? gunzipSync(doc.corpo) : doc.corpo).toString('utf8')
  const ativo = html.match(/\/zona1-static\/[^"'\s)]+\.(?:js|css)/)?.[0]
  if (!ativo) throw new Error('nenhum /zona1-static/ no HTML de /zona1')
  const rsc = await um('/zona1?_rsc', { cookie, rsc: '1', 'accept-encoding': 'gzip' })
  if (rsc.status !== 200) throw new Error(`RSC devolveu HTTP ${rsc.status} (location ${rsc.headers.location}), esperado 200`)
  console.log(`documento: content-encoding=${doc.headers['content-encoding'] ?? 'nenhum'}; RSC: HTTP ${rsc.status} content-type=${rsc.headers['content-type']}; ativo: ${ativo}`)

  const cenarios = [
    ['a. documento pelo gateway (GET /zona1)', '/zona1', { cookie }],
    ['b. RSC, caminho rápido (GET /zona1?_rsc, RSC: 1)', '/zona1?_rsc', { cookie, rsc: '1' }],
    ['c. ativo da zona, caminho rápido (CSS em /zona1-static)', ativo, { cookie }],
  ]
  const f = (v, d = 1) => v.toFixed(d).padStart(8)
  console.log(`${SEGUNDOS} s por cenário depois de ${AQUECER_S} s de aquecimento; CPU do shell por requisição em ms`)
  console.log(`${'cenário'.padEnd(60)} conc      p50      p99    req/s  bytes/resp  CPU ms/req  CPU %  erros`)
  for (const [nome, caminho, cabecalhos] of cenarios) {
    for (const conc of [1, 4]) {
      await carga({ caminho, cabecalhos, conc, segundos: AQUECER_S, pids })
      const r = await carga({ caminho, cabecalhos, conc, segundos: SEGUNDOS, pids })
      console.log(`${nome.padEnd(60)} ${String(conc).padStart(4)} ${f(r.p50)} ${f(r.p99)} ${f(r.rps, 0)} ${f(r.bytesPorResp, 0)} ${f(r.cpuMsPorReq, 2)}${f(r.cpuShellPct, 0)}${String(r.erros).padStart(7)}`)
    }
  }
} finally {
  ambiente.derrubar()
}
