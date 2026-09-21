// Verificação ponta a ponta da base genérica (ADR-0009). Tudo pelo shell, como no navegador.
//   node --test base/verificacao/*.test.mjs
// Sobe domínios, registra manifestos, sobe shell e zonas; derruba no fim.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { subir, RAIZ, SHELL as SHELL_URL } from '../scripts/ambiente.mjs'
import { pedir, entrar, menu, formularios, valorDoCookie, acaoPeloCliente } from './apoio.mjs'

let ambiente
// Coletor OTLP falso: prova que o gateway de telemetria do shell só repassa lote de quem tem sessão.
let coletor
const lotesNoColetor = []
before(async () => {
  coletor = createServer((req, res) => { lotesNoColetor.push(req.url); req.resume(); req.on('end', () => res.end()) })
  await new Promise((ok) => coletor.listen(0, '127.0.0.1', ok))
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${coletor.address().port}`
  // CONSTRUIR=1 reconstrói só as apps com fonte mais novo que o build; CONSTRUIR=tudo, todas
  ambiente = await subir({ construir: process.env.CONSTRUIR === 'tudo' ? 'tudo' : process.env.CONSTRUIR === '1' })
}, { timeout: 600_000 })
after(() => { ambiente?.derrubar(); coletor?.close() })

const TOKEN = /dev\.(ana|bruno|carla|davi)\.[0-9a-f-]{36}/

test('camada 1: sem cookie, shell e zonas mandam para o login do shell, com Location relativo', async () => {
  for (const caminho of ['/', '/zona1', '/zona1/relatorios', '/zona2', '/acesso']) {
    const r = await pedir(caminho)
    assert.equal(r.status, 307, caminho)
    assert.equal(r.local, `/login?de=${encodeURIComponent(caminho)}`, caminho)
  }
  assert.equal((await pedir('/login')).status, 200)
})

test('N3: o shell grava a sessao e o navegador recebe so um id opaco, HttpOnly e __Host-', async () => {
  const { resposta, id } = await entrar('ana')
  assert.equal(resposta.status, 303)
  assert.equal(resposta.local, '/')
  const c = resposta.cookies.find((x) => x.startsWith('__Host-session='))
  assert.match(c, /HttpOnly/i); assert.match(c, /Secure/i); assert.match(c, /Path=\//); assert.match(c, /SameSite=lax/i)
  assert.match(id, /^[0-9a-f-]{36}$/)
  assert.ok(!TOKEN.test(id))
})

test('login nao vira redirecionamento aberto', async () => {
  for (const de of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
    assert.equal((await entrar('ana', de)).resposta.local, '/', de)
  }
  assert.equal((await entrar('ana', '/zona2')).resposta.local, '/zona2')
  const r = await pedir('/api/auth/entrar', { metodo: 'POST', corpo: new URLSearchParams({ usuario: 'intruso' }) })
  assert.equal(r.local, '/login')
  assert.equal(valorDoCookie(r.cookies, '__Host-session'), undefined)
})

const MENUS = {
  ana: ['/', '/zona1', '/zona2'],
  bruno: ['/', '/zona1', '/zona1/relatorios'],
  carla: ['/', '/zona1', '/acesso'],
  davi: ['/', '/zona1'],
}

test('N5: o menu mostra so os modulos permitidos, igual no shell e nas zonas (moldura comum)', async () => {
  for (const [u, esperado] of Object.entries(MENUS)) {
    const { cookie } = await entrar(u)
    const noShell = menu((await pedir('/', { cookie })).html)
    assert.deepEqual(noShell.hrefs, esperado, `menu de ${u} no shell`)
    assert.deepEqual(noShell.atual, ['/'])
    const naZona = menu((await pedir('/zona1', { cookie })).html)
    assert.deepEqual(naZona.hrefs, esperado, `menu de ${u} na zona 1`)
    assert.deepEqual(naZona.atual, ['/zona1'])
  }
})

test('N5/D6: modulo nao permitido responde 404 pela URL direta; permitido responde 200', async () => {
  const casos = [
    ['ana', '/zona1/relatorios', 404], ['ana', '/acesso', 404], ['ana', '/zona2', 200],
    ['bruno', '/zona1/relatorios', 200], ['bruno', '/zona2', 404], ['bruno', '/acesso', 404],
    ['carla', '/acesso', 200], ['carla', '/zona2', 404],
    ['davi', '/zona2', 404], ['davi', '/zona1', 200],
  ]
  for (const [u, caminho, status] of casos) {
    const { cookie } = await entrar(u)
    const r = await pedir(caminho, { cookie })
    assert.equal(r.status, status, `${u} ${caminho}`)
    if (status === 404) assert.ok(!/sem acesso|não autorizado|acesso negado/i.test(r.html), 'placeholder de sem acesso (invariante 8)')
  }
})

test('N7: shell e zona 1 leem os proprios dominios (plataforma; A e B)', async () => {
  const { cookie } = await entrar('bruno')
  assert.match((await pedir('/', { cookie })).html, /Manutenção programada/)
  const z1 = (await pedir('/zona1', { cookie })).html
  assert.match(z1, /Disponibilidade/)      // domínio B
  assert.match(z1, /Recurso do financeiro/) // domínio A, escopo do bruno
})

test('perfil administrativo nao concede dado: carla nao ve custo nem r-3; bruno ve', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  const r1 = (await pedir('/zona1/recursos/r-1', { cookie: carla })).html
  assert.ok(!/CC-10|Custo/.test(r1), 'custo chegou ao HTML ou ao payload RSC da carla')
  assert.match((await pedir('/zona1/recursos/r-1', { cookie: bruno })).html, /CC-10/)
  assert.equal((await pedir('/zona1/recursos/r-3', { cookie: carla })).status, 404)
  assert.equal((await pedir('/zona1/recursos/r-3', { cookie: bruno })).status, 200)
})

test('token nunca chega ao navegador, em nenhuma pagina', async () => {
  for (const u of Object.keys(MENUS)) {
    const { cookie } = await entrar(u)
    for (const caminho of ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/zona2', '/acesso']) {
      const { html } = await pedir(caminho, { cookie })
      assert.ok(!TOKEN.test(html) && !html.includes('accessToken'), `${u} ${caminho}`)
    }
  }
})

const CONCEDER = { app: 'erp-zona-acesso', arquivo: 'app/acesso/acoes.ts', nome: 'alterarConcessao', caminho: '/acesso' }
const celula = async (carla) => formularios((await pedir('/acesso', { cookie: carla })).html)
  .find((c) => c.perfil === 'zona1.analista' && c.modulo === 'zona1.relatorios')

test('N6/N5: revogar uma concessao na zona de acesso vale na proxima navegacao, sem novo login', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 200)

  const alternar = async (conceder) => {
    const campos = await celula(carla)
    assert.ok(campos, 'formulario de concessao nao encontrado')
    assert.equal(campos.conceder, String(conceder))
    const r = await acaoPeloCliente({ ...CONCEDER, campos, cookie: carla })
    assert.equal(r.status, 200)
    assert.equal(r.redirecionamento, null, 'nenhuma action usa redirect() (limitacao 11)')
    assert.match(r.corpo, /"destino":"\/acesso"/)
    assert.ok(valorDoCookie(r.cookies, '__Host-flash'), 'toast de resultado')
  }

  await alternar(false)
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 404)
  assert.ok(!menu((await pedir('/', { cookie: bruno })).html).hrefs.includes('/zona1/relatorios'))
  await alternar(true)
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 200)
})

test('D8: a tela de acesso nao oferece perfil de zona para modulo de outra zona', async () => {
  const carla = (await entrar('carla')).cookie
  const forms = formularios((await pedir('/acesso', { cookie: carla })).html)
  assert.ok(!forms.some((f) => f.perfil === 'zona1.analista' && f.modulo === 'zona2.tarefas'))
  assert.ok(forms.some((f) => f.perfil === 'plataforma.usuario' && f.modulo === 'zona2.tarefas'))
})

test('Server Action e reverificada no servidor: quem nao tem o modulo nao executa', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  const r = await acaoPeloCliente({ ...CONCEDER, campos: await celula(carla), cookie: bruno })
  assert.match(r.corpo, /"destino":"\/"/, 'a action de administracao rodou para o bruno')
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 200, 'a concessao mudou')
})

/** Toda Server Action de toda app, lida dos manifestos do build. */
function todasAsAcoes() {
  return ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso'].flatMap((app) => {
    const m = JSON.parse(readFileSync(join(RAIZ, app, '.next/server/server-reference-manifest.json'), 'utf8'))
    return Object.values(m.node).map(({ filename, exportedName }) => {
      const seg = (filename.includes('app/') ? filename.split('app/')[1] : filename).split('/')[0]
      return { app, arquivo: filename, nome: exportedName, caminho: '/' + seg }
    })
  })
}
/** Quem tem o módulo de cada app com action: sem a checagem de origem, a action rodaria. */
const DONO = { 'erp-zona-2': 'ana', 'erp-zona-acesso': 'carla' }

const CONCLUIR = { app: 'erp-zona-2', arquivo: 'app/zona2/acoes.ts', nome: 'concluirTarefa', caminho: '/zona2' }

test('Server Action sem Origin, ou com Origin de outro site, nao executa em nenhuma app', async () => {
  const acoes = todasAsAcoes()
  assert.ok(acoes.length >= 4)
  for (const acao of acoes) {
    const cookie = (await entrar(DONO[acao.app] ?? 'carla')).cookie
    const campos = acao.app === 'erp-zona-2' ? { id: 't-2', versao: '1' }
      : { perfil: 'zona1.analista', modulo: 'zona1.relatorios', conceder: 'false', modulo2: '', restrito: 'false', usuario: 'davi', atribuir: 'true' }
    for (const origem of [null, 'http://evil.com']) {
      const r = await acaoPeloCliente({ ...acao, campos, cookie, origem })
      assert.ok(!valorDoCookie(r.cookies, '__Host-flash'), `${acao.app} ${acao.nome} rodou com Origin ${origem}`)
    }
  }
  const bruno = (await entrar('bruno')).cookie
  assert.equal((await pedir('/zona1/relatorios', { cookie: bruno })).status, 200, 'concessao mudou')
  assert.ok(!menu((await pedir('/', { cookie: (await entrar('davi')).cookie })).html).hrefs.includes('/zona2'), 'atribuicao mudou')
  const ana = (await entrar('ana')).cookie
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('N4: acao na zona 2 leva para a zona 1 e o toast aparece no documento seguinte, uma vez', async () => {
  const ana = (await entrar('ana')).cookie
  const campos = formularios((await pedir('/zona2', { cookie: ana })).html).find((c) => c.id === 't-1')
  assert.ok(campos, 'formulario da tarefa t-1')
  const r = await acaoPeloCliente({ ...CONCLUIR, campos, cookie: ana })
  assert.equal(r.status, 200)
  // Sem redirect() da action: o Next buscaria /zona1 dentro do processo da zona 2 (limitação de Multi-Zones).
  assert.equal(r.redirecionamento, null)
  assert.match(r.corpo, /"destino":"\/zona1"/, 'a ilha recebe o destino e troca o documento')
  const flash = valorDoCookie(r.cookies, '__Host-flash')
  assert.ok(flash, 'cookie de flash')

  // Pote de cookies como o do navegador: o que a resposta apagar deixa de ser enviado.
  const pote = new Map([['__Host-session', ana.split('=')[1]], ['__Host-flash', flash]])
  const comPote = async (caminho) => {
    const r = await pedir(caminho, { cookie: [...pote].map(([k, v]) => `${k}=${v}`).join('; ') })
    for (const c of r.cookies) {
      const [par] = c.split(';'); const [k, v] = [par.slice(0, par.indexOf('=')), par.slice(par.indexOf('=') + 1)]
      if (/max-age=0/i.test(c)) pote.delete(k); else pote.set(k, v)
    }
    return r.html
  }
  const primeiro = await comPote('/zona1')
  assert.equal((primeiro.match(/moldura-toast-sucesso">Tarefa concluída\.</g) ?? []).length, 1)
  assert.ok(!pote.has('__Host-flash'), 'o proxy nao consumiu o flash')
  assert.ok(!(await comPote('/zona1')).includes('Tarefa concluída'), 'o toast reapareceu ao recarregar')
  assert.ok(!(await comPote('/zona2')).includes('Tarefa concluída'), 'o toast reapareceu em outra zona')
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Revisar cadastro(<!-- -->)? — (<!-- -->)?concluída/)
})

test('invariante 16: toda Server Action de toda app recusa quem nao tem o modulo, antes de agir', async () => {
  const davi = (await entrar('davi')).cookie   // sem nenhum modulo com action
  let total = 0
  for (const app of ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const manifesto = JSON.parse(readFileSync(join(RAIZ, app, '.next/server/server-reference-manifest.json'), 'utf8'))
    for (const { filename, exportedName } of Object.values(manifesto.node)) {
      const seg = (filename.includes('app/') ? filename.split('app/')[1] : filename).split('/')[0]
      const caminho = '/' + seg
      const r = await acaoPeloCliente({ app, arquivo: filename, nome: exportedName, caminho, campos: { id: 't-2', versao: '1' }, cookie: davi })
      assert.match(r.corpo, /"destino":"\/"/, `${app} ${exportedName} nao reverificou o modulo`)
      total++
    }
  }
  assert.ok(total >= 4, `so ${total} actions encontradas`)
  const ana = (await entrar('ana')).cookie
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('invariante 12: sessao expirada numa action vira ida ao login, sem erro generico', async () => {
  const { cookie } = await entrar('ana')
  const campos = formularios((await pedir('/zona2', { cookie })).html).find((c) => c.id === 't-2')
  await pedir('/api/auth/sair', { metodo: 'POST', cookie })
  const r = await acaoPeloCliente({ ...CONCLUIR, campos, cookie })
  assert.equal(r.status, 200)
  assert.match(r.corpo, /"destino":"\/login\?de=%2Fzona2"/)
  const outra = (await entrar('ana')).cookie
  assert.match((await pedir('/zona2', { cookie: outra })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('o cabecalho interno de flash vindo do navegador e ignorado', async () => {
  const ana = (await entrar('ana')).cookie
  const falso = encodeURIComponent(JSON.stringify({ tipo: 'erro', texto: 'Forjado pelo cliente', id: 'x1' }))
  const r = await pedir('/zona1', { cookie: ana, cabecalhos: { 'x-erp-flash': falso } })
  assert.ok(!r.html.includes('Forjado pelo cliente'))
})

test('invariante 16 comportamental: restringir o painel da zona 1 tira pagina e detalhe de quem nao tem concessao', async () => {
  const carla = (await entrar('carla')).cookie
  const davi = (await entrar('davi')).cookie
  const restringir = (restrito) => acaoPeloCliente({ app: 'erp-zona-acesso', arquivo: 'app/acesso/acoes.ts', nome: 'alterarRestricao',
    caminho: '/acesso', campos: { modulo: 'zona1.painel', restrito: String(restrito) }, cookie: carla })
  await restringir(true)
  try {
    for (const caminho of ['/zona1', '/zona1/recursos/r-1']) assert.equal((await pedir(caminho, { cookie: davi })).status, 404, caminho)
  } finally {
    await restringir(false)
  }
  assert.equal((await pedir('/zona1/recursos/r-1', { cookie: davi })).status, 200)
})

test('N3: sair no shell encerra a sessao em todas as zonas', async () => {
  const { cookie } = await entrar('ana')
  assert.equal((await pedir('/zona2', { cookie })).status, 200)
  const r = await pedir('/api/auth/sair', { metodo: 'POST', cookie })
  assert.equal(r.status, 303)
  assert.match(r.cookies.find((c) => c.startsWith('__Host-session=')) ?? '', /Max-Age=0/i)
  // o cookie antigo, como outra aba que ainda o tem: a camada 2 recusa em toda zona
  for (const caminho of ['/', '/zona1', '/zona2']) {
    const s = await pedir(caminho, { cookie })
    assert.equal(s.status, 307, caminho)
    assert.match(s.local ?? '', /^\/login/)
  }
})

test('cookie forjado passa da camada 1 e morre na camada 2', async () => {
  const r = await pedir('/zona1', { cookie: '__Host-session=00000000-0000-0000-0000-000000000000' })
  assert.equal(r.status, 307)
  assert.match(r.local ?? '', /^\/login/)
})

test('CSP com nonce em shell e zonas, e todo script marcado com ele', async () => {
  const { cookie } = await entrar('ana')
  for (const caminho of ['/', '/zona1', '/zona2']) {
    const r = await pedir(caminho, { cookie })
    const nonce = r.csp?.match(/'nonce-([^']+)'/)?.[1]
    assert.ok(nonce, `${caminho} sem CSP com nonce`)
    const scripts = [...r.html.matchAll(/<script([^>]*)>/g)]
    assert.ok(scripts.length > 0)
    for (const [, attrs] of scripts) assert.match(attrs, new RegExp(`nonce="${nonce}"`), `${caminho}: script sem nonce`)
  }
})

test('assets de cada zona vivem sob o prefixo dela e chegam pelo shell', async () => {
  const { cookie } = await entrar('ana')
  for (const [caminho, prefixo] of [['/zona1', '/zona1-static/_next/'], ['/zona2', '/zona2-static/_next/']]) {
    const html = (await pedir(caminho, { cookie })).html
    const asset = html.match(new RegExp(`${prefixo}[^"]+\\.js`))?.[0]
    assert.ok(asset, `${caminho} nao referencia ${prefixo}`)
    assert.equal((await pedir(asset)).status, 200, asset)
  }
})

test('N3 estatico: nenhuma zona monta store de escrita, identidade ou grava o cookie de sessao', () => {
  const fontes = (d) => readdirSync(d).flatMap((n) => {
    if (['node_modules', '.next'].includes(n)) return []
    const p = join(d, n)
    return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
  for (const zona of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    for (const f of fontes(join(RAIZ, zona))) {
      const t = readFileSync(f, 'utf8')
      // Estrutural: escrita de sessao e autenticacao so existem em @erp/nucleo/shell (invariante 15).
      assert.ok(!/@erp\/nucleo\/shell/.test(t), `${f} importa o subpath de escrita do shell`)
      assert.ok(!/@erp\/nucleo\/(dist|src)/.test(t), `${f} contorna os exports do nucleo`)
      // o nome do cookie de sessao so pode aparecer numa leitura
      for (const m of t.matchAll(/__Host-session/g)) {
        assert.match(t.slice(Math.max(0, m.index - 6), m.index + 16), /\.get\('__Host-session'\)/, `${f} usa o cookie de sessao fora de uma leitura`)
      }
    }
  }
})

test('invariante 16 estatico: toda pagina de modulo chama exigirModulo', () => {
  const paginas = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n)
    if (n === '(publico)') return []
    return statSync(p).isDirectory() ? paginas(p) : n === 'page.tsx' ? [p] : []
  })
  let total = 0
  for (const app of ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    for (const f of paginas(join(RAIZ, app, 'app'))) {
      assert.match(readFileSync(f, 'utf8'), /await exigirModulo\('[a-z0-9-]+\.[a-z0-9-]+'\)/, `${f} sem exigirModulo`)
      total++
    }
  }
  assert.ok(total >= 6)
})

test('N8: nenhuma zona monta URL; toda saida passa pelo registro de destinos do nucleo', () => {
  for (const zona of ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    for (const dir of ['app', 'lib']) {
      const base = join(RAIZ, zona, dir)
      const fontes = (d) => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? fontes(join(d, n)) : [join(d, n)])
      for (const f of fontes(base)) {
        // também o acesso indireto (`globalThis['fetch']`), que escapava da primeira versão desta checagem
        assert.ok(!/\bfetch\(|globalThis\s*(\.|\[)\s*['"`]?fetch/.test(readFileSync(f, 'utf8')), `${f} chama fetch direto`)
      }
    }
  }
})

test('D5: dominio de negocio fora apaga so o bloco dele', async () => {
  const bruno = (await entrar('bruno')).cookie
  await ambiente.derrubarDominio('dominio-b')
  try {
    const r = await pedir('/zona1', { cookie: bruno })
    assert.equal(r.status, 200)
    assert.match(r.html, /Indicadores indisponíveis no momento/)
    assert.match(r.html, /Recurso do financeiro/)
  } finally { await ambiente.subirDominio('dominio-b') }
  await ambiente.derrubarDominio('dominio-a')
  try {
    const r = await pedir('/zona1', { cookie: bruno })
    assert.equal(r.status, 200)
    assert.match(r.html, /Recursos indisponíveis no momento/)
    assert.match(r.html, /Disponibilidade/)
  } finally { await ambiente.subirDominio('dominio-a') }
  await ambiente.derrubarDominio('plataforma')
  try {
    const r = await pedir('/', { cookie: bruno })
    assert.equal(r.status, 200)
    assert.match(r.html, /Avisos indisponíveis no momento/)
  } finally { await ambiente.subirDominio('plataforma') }
})

test('D4: gestao de acesso fora da a pagina de servico indisponivel, sem detalhe interno', async () => {
  const ana = (await entrar('ana')).cookie
  await ambiente.derrubarDominio('gestao-acesso')
  try {
    for (const caminho of ['/', '/zona1', '/zona2']) {
      const r = await pedir(caminho, { cookie: ana })
      // no HTML do servidor, sem depender de JavaScript; o status fica 200 (o layout não o define)
      assert.match(r.html, /<h1>Serviço indisponível<\/h1>/, caminho)
      assert.ok(!r.html.includes('Olá,') && !r.html.includes('Painel da zona 1</h1>'), `${caminho} renderizou a pagina sem acesso`)
      assert.ok(!/ECONNREFUSED|at [A-Za-z]+ \(|node:internal|DestinoInvalido|ErroDeAplicacao/.test(r.html), `${caminho} vaza detalhe`)
    }
  } finally { await ambiente.subirDominio('gestao-acesso') }
  assert.equal((await pedir('/zona1', { cookie: ana })).status, 200, 'voltou depois de reenviar os manifestos')
})

// ---------------------------------------------------------------------------------------------
// Gate "Shell novo", iteração 1: testes mínimos do auditor_shell_1 (.agents/auditor_shell_1/),
// cada um reprovando uma mutação que antes deixava todas as suítes verdes.

test('L1/V1: gestao de acesso fora nao entrega pagina de modulo, nem no payload RSC', async () => {
  const davi = (await entrar('davi')).cookie
  const bruno = (await entrar('bruno')).cookie
  await ambiente.derrubarDominio('gestao-acesso')
  try {
    for (const [quem, cookie] of [['davi', davi], ['bruno', bruno]]) {
      for (const c of ['/zona1', '/zona1/relatorios']) {
        const r = await pedir(c, { cookie })
        assert.ok(!/Painel da zona 1|Relatórios|recursos no seu escopo|com custo/.test(r.html),
          `${quem} ${c}: conteudo do modulo chegou com a gestao de acesso fora`)
      }
    }
  } finally { await ambiente.subirDominio('gestao-acesso') }
})

test('L3: cabecalho de flash forjado pelo cliente nao aparece nas paginas do proprio shell', async () => {
  const ana = (await entrar('ana')).cookie
  const falso = encodeURIComponent(JSON.stringify({ tipo: 'erro', texto: 'Forjado pelo cliente', id: 'x1' }))
  const r = await pedir('/', { cookie: ana, cabecalhos: { 'x-erp-flash': falso } })
  assert.ok(!r.html.includes('Forjado pelo cliente'))
})

test('L4/V2: telemetria descarta lote anonimo sem repassar; 413 em streaming; 429 no 61o lote', async () => {
  const post = (cookie, body) => fetch(`${SHELL_URL}/api/otel/v1/traces`, {
    method: 'POST', body, duplex: 'half',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  })
  lotesNoColetor.length = 0
  assert.equal((await post(null, '{}')).status, 204)
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(lotesNoColetor.length, 0, 'lote sem sessao foi repassado ao coletor')
  const bruno = (await entrar('bruno')).cookie
  assert.equal((await post(bruno, 'isto nao e json')).status, 400, 'corpo nao-JSON deveria dar 400')
  assert.equal((await post(bruno, '{"ok":1}')).status, 204)
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(lotesNoColetor.length, 1, 'lote com sessao nao chegou ao coletor')
  // corpo em streaming, sem Content-Length: o limite vale enquanto le, nao depois
  const grande = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(300 * 1024)); c.close() } })
  assert.equal((await post(bruno, grande)).status, 413)
  const carla = (await entrar('carla')).cookie
  let ultimo
  for (let i = 0; i < 61; i++) ultimo = await post(carla, '{}')
  assert.equal(ultimo.status, 429)
  assert.equal(ultimo.headers.get('retry-after'), '60')
})

test('L2/V3/C1: zona fora da 503 proprio, em qualquer caixa; as outras seguem; ela volta', async () => {
  const ana = (await entrar('ana')).cookie
  await ambiente.derrubarApp('erp-zona-2')
  try {
    await new Promise((r) => setTimeout(r, 1200))   // passa do TTL de 1 s da sonda
    for (const c of ['/zona2', '/zona2/x', '/ZONA2', '/Zona2/x']) {
      const r = await fetch(`${SHELL_URL}${c}`, { headers: { cookie: ana }, redirect: 'manual' })
      assert.equal(r.status, 503, c)
      assert.equal(r.headers.get('retry-after'), '5', c)
      assert.equal(r.headers.get('cache-control'), 'no-store', c)
      assert.match(await r.text(), /indispon/i, c)
    }
    for (const c of ['/', '/zona1']) assert.equal((await pedir(c, { cookie: ana })).status, 200, c)
  } finally { await ambiente.subirApp('erp-zona-2') }
  const t0 = Date.now()
  let st = 0
  while (Date.now() - t0 < 5_000 && st !== 200) {
    st = (await pedir('/zona2', { cookie: ana })).status
    if (st !== 200) await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de reerguida')
})

test('L5 (reviewer_shell_2): o shell apaga o cookie de flash com Secure, senao o navegador ignora e o toast repete', async () => {
  const ana = (await entrar('ana')).cookie
  const flash = encodeURIComponent(JSON.stringify({ tipo: 'sucesso', texto: 'Uma vez so', id: 'f1' }))
  for (const caminho of ['/', '/zona1']) {
    const r = await fetch(`${SHELL_URL}${caminho}`, { headers: { cookie: `${ana}; __Host-flash=${flash}` }, redirect: 'manual' })
    const apaga = r.headers.getSetCookie().find((c) => c.startsWith('__Host-flash='))
    assert.ok(apaga, `${caminho} nao apagou o cookie de flash`)
    assert.match(apaga, /Max-Age=0/i, caminho)
    assert.match(apaga, /;\s*Secure/i, `${caminho}: remocao de __Host- sem Secure e ignorada pelo navegador`)
    assert.match(apaga, /Path=\//i, caminho)
  }
})
