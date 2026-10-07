// Sonda do auditor_c1_1: sobe a base (CONSTRUIR=1) com o domínio C semeado com títulos hostis e confere
// (a) o que chega ao painel da zona 1 e ao fragmento; (b) se grafias com % malformado ou %2F chegam à rota pela zona 2 e pelo shell.
// Uso: node sonda.mjs <rotulo>   (da raiz do principal)
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
const { subir, SHELL } = await import(`${RAIZ}/base/scripts/ambiente.mjs`)
const { entrar, pedir } = await import(`${RAIZ}/base/verificacao/apoio.mjs`)
const dados = mkdtempSync(join(tmpdir(), 'auditor-c1-'))
const semente = JSON.parse(readFileSync(`${RAIZ}/repos/erp-dominio-stub/dados/semente/dominio-c.json`, 'utf8'))
semente.tarefas.push(
  { id: 't-x1', titulo: 'A <img/onerror=alert(1) src=x> & B', concluida: false, versao: 1 },
  { id: 't-x2', titulo: '<meta http-equiv=refresh content="0;url=https://exemplo.invalid/">', concluida: false, versao: 1 },
  { id: 't-x3', titulo: 'Concluida antiga', concluida: true, versao: 1 },
)
writeFileSync(join(dados, 'dominio-c.json'), JSON.stringify(semente))
process.env.DADOS_DIR = dados
const amb = await subir({ construir: true })
const masc = (s) => s.replace(/(__Host-session=)[^;\s"']+/g, '$1<mascarado>')
try {
  const ana = (await entrar('ana')).cookie
  const painel = await pedir('/zona1', { cookie: ana })
  const bloco = painel.html.match(/<section data-fragmento="zona2\/tarefas"[\s\S]*?<\/section>/)?.[0] ?? '(sem bloco)'
  console.log(`[${process.argv[2]}] painel /zona1 ana: ${painel.status}; CSP: ${painel.csp}`)
  console.log(`[${process.argv[2]}] bloco: ${bloco}`)
  const Z2 = 'http://127.0.0.1:3002'
  for (const c of ['/zona2/_fragmento/tarefas/pendentes', '/zona2/_fragmento%2Ftarefas%2Fpendentes', '/zona2/_fragmento/tarefas/pendentes%',
    '/zona2/_fragmento/tarefas/%zz', '/zona2/%5Ffragmento/tarefas/pendentes%25', '/zona2/_fragmento/tarefas/pend%65ntes', '/zona2/_fragmento/tarefas/pendentes/']) {
    const d = await fetch(Z2 + c, { headers: { cookie: ana, accept: 'text/html' }, redirect: 'manual' })
    const s = await fetch(SHELL + c, { headers: { cookie: ana, accept: 'text/html' }, redirect: 'manual' })
    const ds = (await d.text()).includes('data-fragmento'), ss = (await s.text()).includes('data-fragmento')
    console.log(`[${process.argv[2]}] ${c}: zona2 direto ${d.status}${ds ? ' COM BLOCO' : ''}; shell ${s.status}${ss ? ' COM BLOCO' : ''}`)
  }
} finally { amb.derrubar() }
await new Promise((r) => setTimeout(r, 1500))
process.exit(0)
