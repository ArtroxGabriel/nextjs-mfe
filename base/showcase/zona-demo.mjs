// Zona de demonstração do showcase (E4): sobe uma zona `demo` na porta 3009, registra a rota na gestão de acesso
// e deixa ver, sem reiniciar o shell, a zona aparecer, cair e sair do mapa.   task showcase:zona-demo
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { subirZonaDeTeste } from '../verificacao/zona-de-teste.mjs'

/** Falha de uso esperada: a mensagem basta, sem stack. */
class ErroDeUso extends Error {}

/**
 * Sobe a zona `demo` e registra a rota. `derrubar` fecha o servidor e deixa a rota registrada (o shell mostra a
 * página de zona fora do ar); `voltar` sobe de novo na mesma porta; `remover` apaga a rota e fecha o servidor.
 */
export async function subirZonaDemo({ id = 'demo', porta = 3009, hosts = ['127.0.0.1'] } = {}) {
  let zona
  try { zona = await subirZonaDeTeste({ id, porta, hosts }) } catch (e) {
    if (e?.code === 'EADDRINUSE') throw new ErroDeUso(`a porta ${porta} já está em uso: já há uma zona demo no ar (outro \`task showcase:zona-demo\`) ou outro processo nela. Feche-o e tente de novo.`)
    throw e
  }
  let no_ar = true
  let registro
  try { registro = await zona.registrar() } catch {
    await zona.fechar()
    throw new ErroDeUso(`não consegui falar com a gestão de acesso (${process.env.ACESSO_URL ?? 'http://127.0.0.1:4020'}): o showcase precisa estar no ar. Suba-o com \`task showcase\` e tente de novo.`)
  }
  if (registro >= 300) {
    await zona.fechar()
    throw new Error(`a gestão de acesso recusou registrar a rota de ${id} (status ${registro})`)
  }
  return {
    id,
    url: `http://localhost:3000/${id}`,
    async derrubar() {
      if (!no_ar) return
      no_ar = false
      await zona.fechar()
    },
    async voltar() {
      if (no_ar) return
      zona = await subirZonaDeTeste({ id, porta, hosts })
      no_ar = true
    },
    async remover() {
      // a rota sai primeiro: o mapa nunca fica com uma zona sem dono, mesmo se o fechamento falhar
      try {
        const status = await zona.remover()
        if (status >= 300 && status !== 404) throw new Error(`a gestão de acesso recusou remover a rota de ${id} (status ${status})`)
      } finally { if (no_ar) { no_ar = false; await zona.fechar() } }
    },
  }
}

async function principal() {
  const ms = Number(process.env.ERP_MAPA_ZONAS_TTL_MS ?? 30000)
  const prazo = `em até um TTL do mapa mais uma releitura${Number.isFinite(ms) && ms > 0 ? ` (TTL de ${ms / 1000} s)` : ''}`
  let demo
  try { demo = await subirZonaDemo() } catch (e) {
    if (!(e instanceof ErroDeUso)) throw e
    console.error(e.message)
    process.exit(1)
  }
  let saindo = false
  const sair = async (codigo) => {
    if (saindo) return
    saindo = true
    try { await demo.remover(); console.log(`\nRota removida. A página volta a 404 ${prazo}.`) }
    catch (e) {
      console.error(`\nNão consegui remover a rota: ${e.message}\nRemova à mão: DELETE ${process.env.ACESSO_URL ?? 'http://127.0.0.1:4020'}/v2/zonas/demo/rota com o cabeçalho Authorization: Bearer svc.demo`)
      codigo = 1
    }
    process.exit(codigo)
  }
  process.on('SIGINT', () => sair(0))
  process.on('SIGTERM', () => sair(0))
  process.on('SIGHUP', () => sair(0))
  process.on('uncaughtException', (e) => { console.error(e.message); sair(1) })
  process.on('unhandledRejection', (e) => { console.error(e?.message ?? e); sair(1) })

  console.log(`Zona demo no ar na porta 3009, rota registrada.
O shell relê o mapa de zonas de tempos em tempos (ERP_MAPA_ZONAS_TTL_MS), sem reiniciar.

1. Entre no showcase com qualquer ator e abra ${demo.url}. A página aparece ${prazo}.
2. Enter: derruba a zona. A rota continua no mapa, então não há espera pelo mapa: recarregue a página e, em até cerca de 1 s (ERP_SONDA_TTL_MS), veja a página de zona fora do ar.
3. Enter de novo: a zona volta. Recarregue a página.
4. Ctrl-C: remove a rota e sai. A página volta a 404 ${prazo}.
`)
  const rl = createInterface({ input: process.stdin })
  let no_ar = true
  for await (const _ of rl) {
    try {
      if (no_ar) { await demo.derrubar(); console.log('Zona derrubada, rota mantida. Recarregue a página.') }
      else { await demo.voltar(); console.log('Zona de volta. Recarregue a página.') }
      no_ar = !no_ar
    } catch (e) { console.error(e.message); return sair(1) }
  }
  // entrada fechada (sem terminal): trata como fim
  await sair(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await principal()
