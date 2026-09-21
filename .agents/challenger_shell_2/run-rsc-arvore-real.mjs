// Extrai a arvore de rotas real do flight payload de /zona1 (documento normal) e a reusa como
// Next-Router-State-Tree numa navegacao RSC real para /zona1/relatorios, com e sem gestao-acesso.
import { subir, SHELL as SHELL_URL } from '../../base/scripts/ambiente.mjs'
import { entrar } from '../../base/verificacao/apoio.mjs'
import { writeFileSync } from 'node:fs'

const DIR = new URL('.', import.meta.url).pathname
let ambiente

async function main() {
  ambiente = await subir({ construir: false })
  const bruno = (await entrar('bruno')).cookie

  // 1. documento normal em /zona1: procura no self.__next_f a arvore de segmentos inicial
  const docResp = await fetch(`${SHELL_URL}/zona1`, { headers: { cookie: bruno }, redirect: 'manual' })
  const docHtml = await docResp.text()
  writeFileSync(DIR + 'rsc-real-doc-zona1.html', docHtml)

  // tenta varias formas conhecidas de codificar o cabecalho: usa a propria querystring _rsc do Next
  // como pista, e tambem tenta uma navegacao "as-is" deixando o Next tratar sem Next-Router-State-Tree
  // (so RSC:1), que e o modo minimo documentado do protocolo Flight para paginas sem rotas paralelas.
  async function tentar(rotulo, headersExtra) {
    const r = await fetch(`${SHELL_URL}/zona1/relatorios`, {
      headers: { cookie: bruno, RSC: '1', ...headersExtra },
      redirect: 'manual',
    })
    const corpo = await r.text()
    return { rotulo, status: r.status, location: r.headers.get('location'), contentType: r.headers.get('content-type'), tamanho: corpo.length, corpo }
  }

  const resultados = []
  resultados.push(await tentar('so RSC:1, sem router-state-tree', {}))
  resultados.push(await tentar('RSC:1 + Next-Url:/zona1 (sem router-state-tree)', { 'Next-Url': '/zona1' }))

  writeFileSync(DIR + 'rsc-real-tentativas.json', JSON.stringify(resultados.map((r) => ({ ...r, corpo: r.corpo.slice(0, 3000) })), null, 2))
  for (const r of resultados) console.log(r.rotulo, '->', r.status, r.location, 'bytes', r.tamanho)

  // agora com gestao de acesso fora, repete a tentativa que tiver dado 200 (RSC de verdade)
  const boa = resultados.find((r) => r.status === 200)
  if (boa) {
    await ambiente.derrubarDominio('gestao-acesso')
    const semAcesso = await tentar(boa.rotulo + ' [SEM gestao-acesso]', boa.rotulo.includes('Next-Url') ? { 'Next-Url': '/zona1' } : {})
    writeFileSync(DIR + 'rsc-real-sem-gestao-acesso.json', JSON.stringify({ ...semAcesso, corpo: semAcesso.corpo }, null, 2))
    console.log('sem gestao-acesso:', semAcesso.status, 'bytes', semAcesso.tamanho)
    await ambiente.subirDominio('gestao-acesso')
  } else {
    console.log('NENHUMA tentativa RSC deu 200 — nao foi possivel construir uma navegacao RSC valida sem cliente real')
  }
}

main().finally(async () => { try { await ambiente?.derrubar() } catch {} })
