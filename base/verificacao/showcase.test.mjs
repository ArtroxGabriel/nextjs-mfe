// Verificação das 7 funcionalidades básicas contra o showcase NO AR, nos dois modos de login.
//   task showcase           e, noutro terminal:  task showcase:verificar
//   task showcase:oidc      e, noutro terminal:  task showcase:verificar
// Não sobe nada além da zona de demonstração. O modo (dev ou Keycloak) é detectado pelo "Entrar" do shell.
// Cada teste leva no título o código e o texto da coluna "Funcionalidade" da tabela de
// docs/ROTEIRO-DE-VERIFICACAO.md. Nada fica para trás: a rota da demonstração sai em `finally`.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ } from '../scripts/ambiente.mjs'
import { randomUUID } from 'node:crypto'
import { pedir, entrarComo, modoDeLogin, menu, formularios, acaoPeloCliente, tokenDoKeycloak } from './apoio.mjs'
import { subirZonaDemo } from '../showcase/zona-demo.mjs'

const DOMINIO_C_URL = process.env.DOMINIO_C_URL ?? 'http://127.0.0.1:4003'
const ACESSO_URL = process.env.ACESSO_URL ?? 'http://127.0.0.1:4020'
const TTL_MAPA_MS = Number(process.env.ERP_MAPA_ZONAS_TTL_MS ?? 30_000)
// entrada e saída da demo: um TTL do mapa mais uma releitura, com folga
const PRAZO_DO_MAPA_MS = 2 * TTL_MAPA_MS + 15_000
const PRAZO_DA_SONDA_MS = 15_000
const MARCA_DA_DEMO = 'zona de teste demo'
const CONCLUIR = { app: 'erp-zona-2', arquivo: 'app/zona2/acoes.ts', nome: 'concluirTarefa', caminho: '/zona2' }

const modo = await modoDeLogin()
console.log(`# modo de login detectado: ${modo}`)
const como = (ator, de) => entrarComo(ator, { modo, de })

/** Repete `fn` até devolver algo verdadeiro ou o prazo acabar; devolve o último resultado. */
async function ate(fn, prazoMs, passoMs = 400) {
  const fim = Date.now() + prazoMs
  let ultimo
  for (;;) {
    ultimo = await fn()
    if (ultimo?.ok || Date.now() >= fim) return ultimo
    await new Promise((r) => setTimeout(r, passoMs))
  }
}

const idsDoMapa = async () => {
  const r = await fetch(`${ACESSO_URL}/v2/zonas`, { headers: { authorization: 'Bearer svc.shell' }, redirect: 'manual', signal: AbortSignal.timeout(5000) })
  assert.equal(r.status, 200, `o mapa de zonas respondeu ${r.status}`)
  return (await r.json()).map((z) => z.id)
}
const removerRotaDemo = () => fetch(`${ACESSO_URL}/v2/zonas/demo/rota`, {
  method: 'DELETE', headers: { authorization: 'Bearer svc.demo' }, redirect: 'manual', signal: AbortSignal.timeout(5000),
}).then((r) => r.status, () => 0)

// rede de segurança: se um teste morrer antes do `finally` (ou o processo for interrompido), a rota sai aqui
after(async () => { await removerRotaDemo() })

const cabecalhoDaMoldura = (html) => (html.match(/<header class="moldura-topo">[\s\S]*?<\/header>/)?.[0] ?? '').replace(/<span>[^<]*<\/span>/, '<span></span>')
const semPlaceholder = /sem acesso|acesso negado|permiss[ãa]o negada|n[ãa]o tem permiss/i
const DESTINO_DE_LOGIN = /^\/login/

test('F1 o shell renderiza', async () => {
  const sem = await pedir('/')
  assert.equal(sem.status, 307)
  assert.match(sem.local ?? '', DESTINO_DE_LOGIN, 'sem sessão, / deve ir ao login')

  const { cookie } = await como('ana')
  const r = await pedir('/', { cookie })
  assert.equal(r.status, 200)
  assert.match(r.html, /<header class="moldura-topo">/, 'cabeçalho da moldura')
  assert.match(r.html, /<nav[^>]*aria-label="Módulos"/, 'menu')
  assert.match(r.html, /<form action="\/api\/auth\/sair" method="post"><button type="submit">Sair<\/button><\/form>/, 'botão Sair')
  assert.match(r.csp ?? '', /'nonce-[^']+'/, 'CSP com nonce')
})

test('F2 há zonas', async () => {
  // estado inicial: nada de demo registrada (uma rodada anterior que deixasse a rota apareceria aqui)
  const antes = await idsDoMapa()
  for (const z of ['zona1', 'zona2', 'acesso']) assert.ok(antes.includes(z), `o mapa não tem ${z}: ${antes.join(', ')}`)
  assert.ok(!antes.includes('demo'), `a rota demo já estava registrada antes do teste: ${antes.join(', ')}`)

  const { cookie } = await como('ana')
  const aparece = async () => {
    const r = await pedir('/demo', { cookie })
    return { ok: r.status === 200 && r.html.includes(MARCA_DA_DEMO), status: r.status }
  }
  // o mapa que o shell tem em memória pode ainda lembrar de uma rodada anterior (serve o antigo e relê):
  // só vale a entrada se antes o shell já deu 404 para /demo
  const limpo = await ate(async () => ({ ok: (await pedir('/demo', { cookie })).status === 404 }), PRAZO_DO_MAPA_MS)
  assert.ok(limpo.ok, '/demo não deu 404 antes da demonstração subir')
  let demo
  try {
    demo = await subirZonaDemo()
    const t0 = Date.now()
    const entrou = await ate(aparece, PRAZO_DO_MAPA_MS)
    assert.ok(entrou.ok, `/demo não apareceu em ${PRAZO_DO_MAPA_MS} ms (último status ${entrou.status})`)
    console.log(`# F2: /demo apareceu em ${Date.now() - t0} ms`)
  } finally {
    if (demo) await demo.remover()
    else await removerRotaDemo()
  }
  assert.ok(!(await idsDoMapa()).includes('demo'), 'a rota demo continua registrada depois de removida')
  const t1 = Date.now()
  const saiu = await ate(async () => ({ ok: (await pedir('/demo', { cookie })).status === 404 }), PRAZO_DO_MAPA_MS)
  assert.ok(saiu.ok, `/demo não deu 404 em ${PRAZO_DO_MAPA_MS} ms depois de removida`)
  console.log(`# F2: /demo sumiu em ${Date.now() - t1} ms`)
})

test('F3 as zonas se integram', async () => {
  const ana = (await como('ana')).cookie
  const bruno = (await como('bruno')).cookie
  const davi = (await como('davi')).cookie

  // o mesmo menu nas zonas, com o item atual marcado
  const inicio = menu((await pedir('/', { cookie: ana })).html)
  assert.deepEqual(inicio.hrefs, ['/', '/zona1', '/zona2'])
  for (const caminho of ['/zona1', '/zona2']) {
    const m = menu((await pedir(caminho, { cookie: ana })).html)
    assert.deepEqual(m.hrefs, inicio.hrefs, `menu de ${caminho}`)
    assert.deepEqual(m.atual, [caminho], `item atual em ${caminho}`)
  }

  // o bloco da zona 2 no painel da zona 1 só para quem tem os dois módulos
  const bloco = async (cookie) => /data-fragmento="zona2\/tarefas"/.test((await pedir('/zona1', { cookie })).html)
  assert.equal(await bloco(ana), true, 'ana deveria ver o bloco')
  assert.equal(await bloco(bruno), false, 'bruno não deveria ver o bloco')
  assert.equal(await bloco(davi), false, 'davi não deveria ver o bloco')

  // o Sair encerra a sessão em todas as zonas
  const antes = []
  for (const caminho of ['/', '/zona1', '/zona2']) antes.push((await pedir(caminho, { cookie: ana })).status)
  assert.deepEqual(antes, [200, 200, 200], 'a sessão deveria valer nas três')
  const sair = await pedir('/api/auth/sair', { metodo: 'POST', cookie: ana })
  assert.ok(sair.status >= 300 && sair.status < 400, `sair respondeu ${sair.status}`)
  for (const caminho of ['/', '/zona1', '/zona2']) {
    const r = await pedir(caminho, { cookie: ana })
    assert.equal(r.status, 307, `${caminho} depois de sair`)
    assert.match(r.local ?? '', DESTINO_DE_LOGIN, caminho)
  }
})

test('F4 os tratamentos', async () => {
  const carla = (await como('carla')).cookie
  const ana = (await como('ana')).cookie

  // recurso fora do escopo e módulo negado: 404, sem placeholder
  const fora = await pedir('/zona1/recursos/r-3', { cookie: carla })
  assert.equal(fora.status, 404, 'recurso fora do escopo')
  assert.doesNotMatch(fora.html, semPlaceholder)
  for (const caminho of ['/zona1/relatorios', '/acesso']) {
    const r = await pedir(caminho, { cookie: ana })
    assert.equal(r.status, 404, `${caminho} para ana`)
    assert.doesNotMatch(r.html, semPlaceholder, caminho)
  }

  // erro normalizado { codigo, supportId }, sem stack (o mesmo caminho do N2 de base.test.mjs)
  const csrf = await pedir('/api/auth/sair', {
    metodo: 'POST', cookie: ana, origem: 'https://outro.exemplo', cabecalhos: { 'sec-fetch-site': 'cross-site' },
  })
  assert.equal(csrf.status, 403)
  const corpo = JSON.parse(csrf.html)
  assert.deepEqual(Object.keys(corpo).sort(), ['codigo', 'supportId'])
  assert.doesNotMatch(csrf.html, /\bat .*\(|Error\b|node_modules|\.mjs|\.ts\b/, 'stack ou nome de classe no erro')

  // zona fora do ar: 503 com a página da base e supportId; o resto segue respondendo
  let demo
  try {
    demo = await subirZonaDemo()
    const entrou = await ate(async () => ({ ok: (await pedir('/demo', { cookie: ana })).status === 200 }), PRAZO_DO_MAPA_MS)
    assert.ok(entrou.ok, 'a demo não entrou no mapa a tempo')
    await demo.derrubar()
    const t0 = Date.now()
    const queda = await ate(async () => {
      const r = await pedir('/demo', { cookie: ana })
      return { ok: r.status === 503, r }
    }, PRAZO_DA_SONDA_MS, 250)
    assert.ok(queda.ok, `/demo não deu 503 em ${PRAZO_DA_SONDA_MS} ms depois de derrubada (status ${queda.r.status})`)
    console.log(`# F4: /demo deu 503 em ${Date.now() - t0} ms depois de derrubada`)
    assert.match(queda.r.html, /Zona temporariamente indisponível/)
    assert.match(queda.r.html, /data-support-id="[0-9a-f-]{36}"/, 'a página da base sem supportId')
    assert.doesNotMatch(queda.r.html, /\bat .*\(|node_modules|Error:/, 'stack na página de zona fora do ar')
    assert.equal((await pedir('/zona1', { cookie: ana })).status, 200, 'o resto deveria seguir respondendo')
    assert.equal((await pedir('/', { cookie: ana })).status, 200)
  } finally {
    if (demo) await demo.remover()
    else await removerRotaDemo()
  }
})

test('F5 base de UI', async () => {
  const ana = (await como('ana')).cookie
  const carla = (await como('carla')).cookie
  const paginas = [
    ['/zona1', await pedir('/zona1', { cookie: ana })],
    ['/zona2', await pedir('/zona2', { cookie: ana })],
    ['/acesso', await pedir('/acesso', { cookie: carla })],
  ]
  const [primeira, ...demais] = paginas
  assert.ok(cabecalhoDaMoldura(primeira[1].html), 'cabeçalho da moldura na zona 1')
  const nav = (html) => html.match(/<nav[^>]*aria-label="Módulos"[\s\S]*?<\/nav>/)?.[0] ?? ''
  const abertura = (html) => nav(html).match(/^<nav[^>]*>/)?.[0]
  const classesDosLinks = (html) => [...nav(html).matchAll(/<a [^>]*>/g)].map((m) => m[0].replace(/href="[^"]*"/, '').replace(/\s*aria-current="page"/, ''))
  for (const [caminho, r] of paginas) {
    assert.equal(r.status, 200, caminho)
    assert.ok(nav(r.html), `menu em ${caminho}`)
    assert.match(r.html, /<div class="moldura-toasts" role="status"/, `região de toasts em ${caminho}`)
  }
  // zona 1 e zona 2 (mesmo ator): o bloco do menu é idêntico, salvo o item atual; zona de acesso (menu por módulo,
  // outro ator): a mesma abertura do <nav> e a mesma marcação de link
  const semAtual = (html) => nav(html).replace(/\s*aria-current="page"/g, '')
  assert.equal(semAtual(demais[0][1].html), semAtual(primeira[1].html), 'menu da zona 2 difere do da zona 1')
  for (const [caminho, r] of demais) {
    assert.equal(cabecalhoDaMoldura(r.html), cabecalhoDaMoldura(primeira[1].html), `cabeçalho de ${caminho} difere do da zona 1`)
    assert.equal(abertura(r.html), abertura(primeira[1].html), `abertura do menu de ${caminho} difere do da zona 1`)
    assert.deepEqual(new Set(classesDosLinks(r.html)), new Set(classesDosLinks(primeira[1].html)), `links do menu de ${caminho} diferem do da zona 1`)
  }
  assert.match(primeira[1].html, /<button type="button">Avisar no toast do shell<\/button>/, 'botão que emite o toast na zona 1')

  // O clique em "Avisar no toast do shell" (emitirToast em memória, ilha de cliente) só se confere à mão (A5/A6 do roteiro).
  // Aqui se prova o toast que atravessa a troca de zona e aparece pela moldura: versão desatualizada em t-4 (já concluída,
  // então nada muda) vira o toast de erro no cookie de flash, e o documento seguinte o traz na moldura
  const z2 = await pedir('/zona2', { cookie: ana })
  const base = formularios(z2.html).find((f) => f.id)
  const r = await acaoPeloCliente({ ...CONCLUIR, campos: { ...base, id: 't-4', versao: '0' }, cookie: ana })
  const flash = r.cookies.find((c) => c.startsWith('__Host-flash='))?.split(';')[0]
  assert.ok(flash, 'a recusa deveria deixar o toast no cookie de flash')
  const seguinte = await pedir('/zona1', { cookie: `${ana}; ${flash}` })
  assert.match(seguinte.html, /<div class="moldura-toasts"[^>]*><p class="moldura-toast moldura-toast-erro">[^<]+<\/p><\/div>/, 'o toast deveria aparecer pela moldura')
})

test('F6 bases em pacotes separados', async () => {
  const apps = ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']
  const pacotes = ['@erp/contratos', '@erp/nucleo', '@erp/moldura']
  const versoes = {}
  for (const app of apps) {
    const pkg = JSON.parse(readFileSync(join(RAIZ, app, 'package.json'), 'utf8'))
    for (const p of pacotes) {
      const v = pkg.dependencies?.[p]
      assert.match(v ?? '', /^\d+\.\d+\.\d+$/, `${app} deve declarar ${p} em versão exata (achei ${v})`)
      ;(versoes[p] ??= new Set()).add(v)
      // o que está instalado é o que foi declarado
      const instalado = JSON.parse(readFileSync(join(RAIZ, app, 'node_modules', p, 'package.json'), 'utf8')).version
      assert.equal(instalado, v, `${app}: ${p} instalado difere do declarado`)
    }
  }
  for (const p of pacotes) assert.equal(versoes[p].size, 1, `${p} em versões diferentes entre as apps: ${[...versoes[p]].join(', ')}`)

  // Provado: declaração exata, o mesmo núcleo em todas (lockstep) e o instalado igual ao declarado. A resposta HTTP só
  // mostra que as três zonas servem a moldura; a versão dela não aparece no HTML.
  const ana = (await como('ana')).cookie
  const carla = (await como('carla')).cookie
  for (const [caminho, cookie] of [['/zona1', ana], ['/zona2', ana], ['/acesso', carla]]) {
    const r = await pedir(caminho, { cookie })
    assert.equal(r.status, 200, caminho)
    assert.match(r.html, /<header class="moldura-topo">/, `moldura em ${caminho}`)
  }
})

test('F7 integração com os domínios', async () => {
  // o custo só aparece para quem é do financeiro
  const bruno = (await como('bruno')).cookie
  const carla = (await como('carla')).cookie
  assert.match((await pedir('/zona1/recursos/r-1', { cookie: bruno })).html, /CC-10/, 'bruno deveria ver o custo')
  const c = await pedir('/zona1/recursos/r-1', { cookie: carla })
  assert.equal(c.status, 200)
  assert.doesNotMatch(c.html, /CC-10/, 'carla não deveria ver o custo')

  // Mutação com If-Match: a ação manda a versão que o cliente conhece. Usa t-4, já concluída: concluir de novo não muda
  // o dado, só o número da versão, que SÓ CRESCE (2 por rodada) no estado gravado do showcase;
  // `task showcase:dados:resetar` o devolve à semente. A versão atual vem do GET do domínio C, como a zona 2 lê.
  const ana = (await como('ana')).cookie
  const base = formularios((await pedir('/zona2', { cookie: ana })).html).find((f) => f.id)
  const token = modo === 'oidc' ? await tokenDoKeycloak('ana') : `dev.ana.${randomUUID()}`
  const lista = await fetch(`${DOMINIO_C_URL}/v1/tarefas`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) })
  assert.equal(lista.status, 200, `GET /v1/tarefas do domínio C respondeu ${lista.status}`)
  const atual = (await lista.json()).find((t) => t.id === 't-4')
  assert.ok(Number.isInteger(atual?.versao), 't-4 fora da lista do domínio C')
  const aceita = atual.versao
  const tentar = (versao) => acaoPeloCliente({ ...CONCLUIR, campos: { ...base, id: 't-4', versao: String(versao) }, cookie: ana })
  const passou = (r) => /"destino":"\/zona1"/.test(r.corpo)

  assert.ok(passou(await tentar(aceita)), `com a versão atual (${aceita}) a mutação deveria passar`)
  // a versão aceita acabou de ser consumida: repetir a mesma agora é uma versão desatualizada
  const velha = await tentar(aceita)
  assert.ok(!passou(velha), 'a versão desatualizada deveria ser recusada')
  const flash = velha.cookies.find((c) => c.startsWith('__Host-flash='))?.split(';')[0]
  assert.ok(flash, 'a recusa deveria deixar o toast de erro')
  const seguinte = await pedir('/zona2', { cookie: `${ana}; ${flash}` })
  assert.match(seguinte.html, /moldura-toast-erro">Este registro mudou/, 'o toast de registro desatualizado')
  // a versão nova passa (ensaio com a versão seguinte, que é a atual)
  assert.ok(passou(await tentar(aceita + 1)), 'com a versão certa a mutação deveria passar')
})
