// Cenario 1: token vencido, Keycloak saudavel. uso: node c1.mjs <config:tarefa|padrao> <n> <caminho>
import * as L from './lib.mjs'
const [cfg, n, caminho, usuario = 'bruno', rep = '1'] = process.argv.slice(2)
if (cfg === 'tarefa') L.configOidc()
else L.configOidc({ ERP_RENOVACAO_LOCK_S: '15', ERP_DESTINO_TIMEOUT_MS: '5000', ERP_RENOVACAO_ESPERA_MS: null })
const N = Number(n)
await L.vidaDoToken('20')
const amb = await L.subir({ log: true })
try {
  await L.esperar(2000)
  for (let k = 0; k < Number(rep); k++) {
    const { cookie, id } = await L.entrarPeloKeycloak(usuario)
    const antes = await L.sessaoNoRedis(id)
    await L.esperar(antes.tokenExpiraEm + 7000 - Date.now())
    const load = (await import('node:fs')).readFileSync('/proc/loadavg', 'utf8').trim()
    const mon = await L.monitorarRedis(process.env.REDIS_URL)
    const t0 = performance.now()
    const rs = await Promise.all(Array.from({ length: N }, (_, i) => L.cron(caminho === 'misto' ? (i % 2 ? '/zona1' : '/') : caminho, { cookie })))
    const total = performance.now() - t0
    const cmds = await mon.parar()
    const sets = cmds.filter((l) => l.toLowerCase().includes(`"set" "${L.chaveDaSessao(id)}"`))
    const locks = cmds.filter((l) => /"set" "erp:.*lock|"set" "erp:renov/i.test(l)).length
    const depois = await L.sessaoNoRedis(id)
    const por = {}
    for (const r of rs) { const k = r.status + (r.local ? '->' + r.local : ''); por[k] = (por[k] ?? 0) + 1 }
    const oks = rs.filter((r) => r.status === 200)
    const ms = rs.map((r) => r.ms)
    const ok = rs.filter((r) => r.status === 200 && (/zona1/.test(caminho) ? L.painelOk(r) : L.inicioOk(r) || L.painelOk(r)))
    L.dizer(JSON.stringify({ cfg, n: N, caminho, rep: k, status: por, corpoCompletoOk: ok.length, setsSessao: sets.length, outrosSetsErp: locks, refreshMudou: depois.refreshToken !== antes.refreshToken, tokenValidoDepois: depois.tokenExpiraEm > Date.now(), totalMs: Math.round(total), p50: Math.round(L.pct(ms, 50)), p95: Math.round(L.pct(ms, 95)), max: Math.round(Math.max(...ms)), min: Math.round(Math.min(...ms)), loadavg: load }))
    L.dizer('  comandos SET/redis no lote (mascarado):', cmds.filter((l) => /"set"/i.test(l)).map((l) => l.replace(/"\{.*\}"/, '"<json>"').slice(0, 160)))
  }
} finally { amb.derrubar(); await L.esperar(1500); await L.vidaDoToken('') }
