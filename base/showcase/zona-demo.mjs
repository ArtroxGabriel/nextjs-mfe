// Zona de demonstração do showcase (E4): sobe uma zona `demo` na porta 3009, registra a rota na gestão de acesso
// e deixa ver, sem reiniciar o shell, a zona aparecer, cair e sair do mapa.   task showcase:zona-demo
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { subirZonaDeTeste } from '../verificacao/zona-de-teste.mjs'

/**
 * Sobe a zona `demo` e registra a rota. `derrubar` fecha o servidor e deixa a rota registrada (o shell mostra a
 * página de zona fora do ar); `voltar` sobe de novo na mesma porta; `remover` apaga a rota e fecha o servidor.
 */
export async function subirZonaDemo({ id = 'demo', porta = 3009, hosts = ['127.0.0.1'] } = {}) {
  let zona = await subirZonaDeTeste({ id, porta, hosts })
  let no_ar = true
  const registro = await zona.registrar()
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
      try { await zona.remover() } finally { if (no_ar) { no_ar = false; await zona.fechar() } }
    },
  }
}

async function principal() {
  const ttl = Number(process.env.ERP_MAPA_ZONAS_TTL_MS ?? 30000) / 1000
  const demo = await subirZonaDemo()
  let saindo = false
  const sair = async (codigo) => {
    if (saindo) return
    saindo = true
    try { await demo.remover(); console.log('\nRota removida. A página volta a 404 em até um intervalo do mapa mais uma releitura.') }
    catch (e) { console.error(`\nNão consegui remover a rota: ${e.message}`); codigo = 1 }
    process.exit(codigo)
  }
  process.on('SIGINT', () => sair(0))
  process.on('SIGTERM', () => sair(0))
  process.on('uncaughtException', (e) => { console.error(e.message); sair(1) })

  console.log(`Zona demo no ar na porta 3009, rota registrada.
O shell relê o mapa a cada ${ttl} s (ERP_MAPA_ZONAS_TTL_MS): cada mudança aparece em até ${ttl} s mais uma releitura, sem reiniciar o shell.

1. Entre no showcase com qualquer ator e abra ${demo.url}
2. Enter: derruba a zona. A rota continua registrada e o shell mostra a página de zona fora do ar.
3. Enter de novo: a zona volta.
4. Ctrl-C: remove a rota e sai. A página volta a 404.
`)
  const rl = createInterface({ input: process.stdin })
  let no_ar = true
  for await (const _ of rl) {
    try {
      if (no_ar) { await demo.derrubar(); console.log('Zona derrubada, rota mantida. Espere o mapa reler e recarregue a página.') }
      else { await demo.voltar(); console.log('Zona de volta. Recarregue a página.') }
      no_ar = !no_ar
    } catch (e) { console.error(e.message); return sair(1) }
  }
  // entrada fechada (sem terminal): trata como fim
  await sair(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await principal()
