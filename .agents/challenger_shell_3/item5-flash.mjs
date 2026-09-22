// Item 5: flash nas paginas do shell/zonas, com navegador real: aparece uma vez e some ao
// recarregar? Fluxo real: ana entra, conclui uma tarefa em /zona2 (Server Action de verdade,
// clique de botao), a acao troca o documento para /zona1 com o toast; recarregar /zona1 nao
// deve repetir o toast.
import { writeFileSync } from 'node:fs'
import { subir, SHELL } from '../../base/scripts/ambiente.mjs'
import { abrirNavegador } from '../../base/verificacao/navegador.mjs'

async function main() {
  const ambiente = await subir({ construir: false })
  const log = []
  try {
    const { pagina, fechar } = await abrirNavegador()
    try {
      await pagina.ir(`${SHELL}/login`)
      await pagina.avaliar(`
        fetch('/api/auth/entrar', { method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ usuario: 'ana', de: '/' }), redirect: 'manual' })
      `)
      await pagina.ir(`${SHELL}/zona2`)
      await pagina.esperarRede()

      const tarefasAntes = await pagina.avaliar(`document.querySelector('ul').innerText`)
      log.push(`tarefas antes: ${tarefasAntes}`)

      const cliqueOk = await pagina.avaliar(`
        (() => {
          const botoes = [...document.querySelectorAll('button')];
          const alvo = botoes.find(b => b.textContent.includes('Concluir e ir para a zona 1'));
          if (!alvo) return 'nenhum-botao-encontrado';
          alvo.click();
          return 'clicado';
        })()
      `)
      log.push(`clique no botao: ${cliqueOk}`)
      // a acao troca o documento (location.assign) -- espera a navegacao terminar
      await new Promise((r) => setTimeout(r, 2500))
      await pagina.esperarRede(600, 8000)

      const urlAposAcao = await pagina.avaliar('location.pathname')
      const textoAposAcao = await pagina.avaliar('document.body.innerText')
      log.push(`url apos a acao: ${urlAposAcao}`)
      log.push(`texto apos a acao:\n${textoAposAcao}`)
      const toastApareceu = /Tarefa conclu[íi]da\./.test(textoAposAcao)

      // recarrega /zona1 (documento novo, cookie __Host-flash ja deveria ter sido apagado)
      await pagina.ir(`${SHELL}/zona1`)
      await pagina.esperarRede()
      const textoRecarregado = await pagina.avaliar('document.body.innerText')
      const toastRepetiu = /Tarefa conclu[íi]da\./.test(textoRecarregado)
      log.push(`texto ao recarregar /zona1:\n${textoRecarregado}`)
      log.push(`toast apareceu apos a acao: ${toastApareceu}; toast repetiu ao recarregar: ${toastRepetiu}`)

      writeFileSync(new URL('./item5-log.txt', import.meta.url), log.join('\n\n') + '\n')
      writeFileSync(new URL('./item5-resultado.json', import.meta.url), JSON.stringify({
        urlAposAcao, toastApareceu, toastRepetiu, tarefasAntes,
      }, null, 2))
      console.log(log.join('\n'))
    } finally { await fechar() }
  } finally { await ambiente.derrubar() }
}

main().catch((e) => { console.error(e); process.exit(1) })
