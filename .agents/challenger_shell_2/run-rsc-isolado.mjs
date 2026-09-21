// Teste isolado: requisicao RSC de navegacao para /zona1/relatorios, com e sem gestao-acesso no ar,
// para separar se o 307 observado no item 2 vem da queda do dominio ou da arvore de rotas sintetica.
import { subir, SHELL as SHELL_URL } from '../../base/scripts/ambiente.mjs'
import { entrar } from '../../base/verificacao/apoio.mjs'
import { writeFileSync } from 'node:fs'

const DIR = new URL('.', import.meta.url).pathname
let ambiente

async function testarRSC(rotulo, cookie) {
  const arvoreEmZona1 = encodeURIComponent(JSON.stringify(['', { children: ['zona1', { children: ['__PAGE__', {}] }] }, null, null, true]))
  const resp = await fetch(`${SHELL_URL}/zona1/relatorios`, {
    headers: { cookie, RSC: '1', 'Next-Router-State-Tree': arvoreEmZona1, 'Next-Url': '/zona1' },
    redirect: 'manual',
  })
  const corpo = await resp.text()
  const cabecalhos = [...resp.headers.entries()]
  return { rotulo, status: resp.status, location: resp.headers.get('location'), cabecalhos, tamanho: corpo.length, corpo }
}

async function main() {
  ambiente = await subir({ construir: false })
  const bruno = (await entrar('bruno')).cookie

  const antes = await testarRSC('gestao-acesso NO AR', bruno)
  writeFileSync(DIR + 'rsc-isolado-1-com-acesso.json', JSON.stringify(antes, null, 2))

  await ambiente.derrubarDominio('gestao-acesso')
  const depois = await testarRSC('gestao-acesso FORA', bruno)
  writeFileSync(DIR + 'rsc-isolado-2-sem-acesso.json', JSON.stringify(depois, null, 2))
  await ambiente.subirDominio('gestao-acesso')

  // controle: pedido NORMAL (sem cabecalhos RSC) para a mesma rota, no mesmo estado (dominio ja de volta)
  console.log('antes:', antes.status, antes.location)
  console.log('depois:', depois.status, depois.location)
}

main().finally(async () => { try { await ambiente?.derrubar() } catch {} })
