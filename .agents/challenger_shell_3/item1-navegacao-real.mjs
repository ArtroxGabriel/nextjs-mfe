// Item 1: com a gestao de acesso fora, navegacao do CLIENTE real (abrirNavegador + window.next.router.push)
// para cada pagina de modulo das 3 zonas, como davi, bruno, ana e carla.
// Pergunta: algum conteudo de modulo nas respostas ?_rsc= ou na tela? o que o usuario ve?
import { writeFileSync } from 'node:fs'
import { subir, SHELL } from '../../base/scripts/ambiente.mjs'
import { abrirNavegador } from '../../base/verificacao/navegador.mjs'

const USUARIOS = ['davi', 'bruno', 'ana', 'carla']
const PAGINAS = ['/zona1', '/zona1/relatorios', '/zona2', '/acesso']

// termos que so deveriam existir se o CONTEUDO do modulo (nao so o rotulo do menu) vazasse
const SENSIVEIS = [
  'Indicadores \\(dom[íi]nio B\\)', 'Recursos \\(dom[íi]nio A\\)', 'recursos vis[íi]veis',
  'concluída', 'pendente', 'Concluir e ir para a zona 1',
  'Zonas registradas:', 'restrito', 'Alternar', 'aria-pressed',
  'recursos no seu escopo', 'com custo vis[íi]vel',
]

const resultado = []

async function main() {
  const ambiente = await subir({ construir: false })
  const log = []
  try {
    log.push(`gestao-acesso derrubada em ${new Date().toISOString()}`)
    await ambiente.derrubarDominio('gestao-acesso')

    const { pagina, fechar } = await abrirNavegador()
    try {
      for (const usuario of USUARIOS) {
        // login real: fetch do PROPRIO contexto do navegador (cookies com as regras do navegador)
        await pagina.ir(`${SHELL}/login`)
        const statusLogin = await pagina.avaliar(`
          fetch('/api/auth/entrar', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ usuario: ${JSON.stringify(usuario)}, de: '/' }),
            redirect: 'manual',
          }).then(r => r.status).catch(e => 'erro:' + e.message)
        `)
        log.push(`login ${usuario}: status fetch=${statusLogin}`)

        await pagina.ir(`${SHELL}/`)
        const temRouter = await pagina.avaliar(`!!(window.next && window.next.router && window.next.router.push)`)
        log.push(`  window.next.router presente: ${temRouter}`)

        for (const caminho of PAGINAS) {
          const antesRespostas = pagina.respostas.length
          let erroPush = null
          if (temRouter) {
            try {
              await pagina.avaliar(`window.next.router.push(${JSON.stringify(caminho)})`)
            } catch (e) { erroPush = e.message }
          } else {
            await pagina.avaliar(`window.location.assign(${JSON.stringify(caminho)})`)
          }
          await pagina.esperarRede(600, 8000)
          const novas = pagina.respostas.slice(antesRespostas)
          const rscResp = novas.filter((r) => /_rsc=|next-router-state-tree/i.test(r.url) || (r.headers && Object.keys(r.headers).some((h) => h.toLowerCase() === 'content-type' && /text\/x-component/.test(r.headers[h]))))

          const corpoInteiro = novas.map((r) => r.corpo || '').join('\n')
          const achados = SENSIVEIS.filter((termo) => new RegExp(termo, 'i').test(corpoInteiro))

          const textoTela = await pagina.avaliar('document.body ? document.body.innerText.slice(0, 500) : "(sem body)"')
          const tituloTela = await pagina.avaliar('document.title')
          const h1 = await pagina.avaliar('document.querySelector("h1") ? document.querySelector("h1").textContent : null')
          const urlFinal = await pagina.avaliar('location.pathname')

          resultado.push({
            usuario, caminho, erroPush, urlFinal, h1, tituloTela,
            respostasCapturadas: novas.length, respostasRsc: rscResp.length,
            statusRespostas: novas.map((r) => ({ url: r.url, status: r.status })),
            achadosSensiveis: achados,
            textoTela,
          })
          log.push(`  ${usuario} -> ${caminho}: urlFinal=${urlFinal} h1=${JSON.stringify(h1)} respostas=${novas.length} rsc=${rscResp.length} achados=${JSON.stringify(achados)}`)
        }
      }
    } finally {
      await fechar()
    }
  } finally {
    await ambiente.derrubar()
  }
  writeFileSync(new URL('./item1-resultado.json', import.meta.url), JSON.stringify(resultado, null, 2))
  writeFileSync(new URL('./item1-log.txt', import.meta.url), log.join('\n') + '\n')
  console.log(log.join('\n'))
  console.log('\n--- RESUMO ---')
  for (const r of resultado) {
    console.log(`${r.usuario} ${r.caminho}: h1=${JSON.stringify(r.h1)} achados=${JSON.stringify(r.achadosSensiveis)}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
