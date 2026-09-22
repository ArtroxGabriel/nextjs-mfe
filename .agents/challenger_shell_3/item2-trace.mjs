// Item 2: trace. Com traceparent valido do navegador, o dominio recebe o mesmo trace e span
// novo? Com traceparent forjado (texto, e-mail, trace zerado, 2 KB de lixo), o dominio recebe um
// trace novo e valido, sem o texto? Domínio-a trocado por servidor que so registra cabecalhos.
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { subir, SHELL } from '../../base/scripts/ambiente.mjs'
import { abrirNavegador } from '../../base/verificacao/navegador.mjs'

const TRACEPARENT_RE = /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/

const CASOS = [
  { nome: 'valido', valor: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
  { nome: 'texto-livre', valor: 'nao sou um traceparent' },
  { nome: 'email', valor: 'atacante@evil.com' },
  { nome: 'trace-zerado', valor: '00-00000000000000000000000000000000-00f067aa0ba902b7-01' },
  { nome: 'span-zerado', valor: '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01' },
  { nome: 'lixo-2kb', valor: 'X'.repeat(2048) },
]

async function main() {
  const ambiente = await subir({ construir: false })
  const log = []
  const resultado = []
  let fakeDomain
  try {
    await ambiente.derrubarDominio('dominio-a')
    const recebidos = []
    fakeDomain = createServer((req, res) => {
      recebidos.push({ url: req.url, traceparent: req.headers.traceparent ?? null })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('[]')
    })
    await new Promise((ok) => fakeDomain.listen(4001, '127.0.0.1', ok))
    log.push('dominio-a substituido por servidor que so registra cabecalhos, em :4001')

    const { pagina, fechar } = await abrirNavegador()
    try {
      await pagina.ir(`${SHELL}/login`)
      await pagina.avaliar(`
        fetch('/api/auth/entrar', { method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ usuario: 'davi', de: '/' }), redirect: 'manual' })
      `)
      await pagina.ir(`${SHELL}/`)

      for (const caso of CASOS) {
        recebidos.length = 0
        let erro = null
        let status = null
        try {
          status = await pagina.avaliar(`
            fetch('/zona1', { headers: { traceparent: ${JSON.stringify(caso.valor)} } }).then(r => r.status)
          `)
        } catch (e) { erro = e.message }
        // pequena espera: a renderizacao da pagina dispara a chamada ao dominio de forma assincrona
        await new Promise((r) => setTimeout(r, 300))
        const vistos = recebidos.map((r) => r.traceparent)
        const algumValido = vistos.some((t) => t && TRACEPARENT_RE.test(t))
        const contemValorForjado = vistos.some((t) => t && t.includes(caso.valor.slice(0, 40)))
        const traceIgual = caso.nome === 'valido' && vistos.some((t) => t?.split('-')[1] === caso.valor.split('-')[1])
        const spanIgual = caso.nome === 'valido' && vistos.some((t) => t?.split('-')[2] === caso.valor.split('-')[2])
        resultado.push({
          caso: caso.nome, valorEnviado: caso.valor.length > 80 ? `${caso.valor.slice(0, 40)}...(${caso.valor.length} chars)` : caso.valor,
          statusFetch: status, erro, quantidadeVista: vistos.length, vistos,
          algumTraceparentValido: algumValido, contemTextoForjado: contemValorForjado,
          mesmoTraceQueEnviado: traceIgual, mesmoSpanQueEnviado_NAO_deveria_ser_true: spanIgual,
        })
        log.push(`${caso.nome}: status=${status} erro=${erro} vistos=${JSON.stringify(vistos)} validos=${algumValido} contemForjado=${contemValorForjado}`)
      }
    } finally {
      await fechar()
    }
  } finally {
    if (fakeDomain) await new Promise((ok) => fakeDomain.close(ok))
    await ambiente.subirDominio('dominio-a').catch(() => {})
    await ambiente.derrubar()
  }
  writeFileSync(new URL('./item2-resultado.json', import.meta.url), JSON.stringify(resultado, null, 2))
  writeFileSync(new URL('./item2-log.txt', import.meta.url), log.join('\n') + '\n')
  console.log(log.join('\n'))
}

main().catch((e) => { console.error(e); process.exit(1) })
