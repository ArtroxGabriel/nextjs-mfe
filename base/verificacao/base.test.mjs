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
import { abrirNavegador, acharChrome, COMO_CONSEGUIR_UM_NAVEGADOR } from './navegador.mjs'
import { varrerAplicacoes } from './saida-de-rede.mjs'

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

// Páginas de uma app, com a rota que o Next serve para cada uma. `page.(tsx|ts|jsx|js)`: o auditor_shell_4
// mostrou que só `page.tsx` deixava passar uma página em `.ts` sem exigirModulo.
const PAGINA = /^page\.(tsx|ts|jsx|js)$/
function paginasDaApp(app, { pularPublico }) {
  const raiz = join(RAIZ, app, 'app')
  const andar = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n)
    if (pularPublico && n === '(publico)') return []
    return statSync(p).isDirectory() ? andar(p) : PAGINA.test(n) ? [p] : []
  })
  return andar(raiz).map((arquivo) => {
    // grupos `(x)` e rotas paralelas `@x` não aparecem na URL
    const segs = arquivo.slice(raiz.length + 1).split('/').slice(0, -1).filter((g) => !/^\(.*\)$/.test(g) && !g.startsWith('@'))
    return { arquivo, rota: '/' + segs.join('/'), dinamicos: segs.filter((g) => g.startsWith('[')).length }
  })
}
// URL → regex da rota: [x] um segmento, [...x] um ou mais, [[...x]] zero ou mais
const padraoDaRota = (rota) => new RegExp('^' + rota
  .replace(/\/\[\[\.\.\.[^\]]+\]\]/g, '(?:/.*)?')
  .replace(/\[\.\.\.[^\]]+\]/g, '.+')
  .replace(/\[[^\]]+\]/g, '[^/]+') + '$')

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

// Uma entrada por módulo (v2); "Gestão de acesso" só para quem tem papel (ADR-0014, adendo 1)
const MENUS = {
  ana: ['/', '/zona1', '/zona2'],
  bruno: ['/', '/zona1'],
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

test('L3 (auditor_b1_d1_3, P10): o link de Relatorios so aparece para quem tem a funcionalidade (invariante 8)', async () => {
  const link = /href="\/zona1\/relatorios"/
  assert.doesNotMatch((await pedir('/zona1', { cookie: (await entrar('davi')).cookie })).html, link, 'davi (so painel.ver) ve o link')
  assert.match((await pedir('/zona1', { cookie: (await entrar('bruno')).cookie })).html, link, 'bruno (relatorios.ver) nao ve o link')
})

test('N5/D6: modulo nao permitido responde 404 pela URL direta; permitido responde 200', async () => {
  const casos = [
    ['ana', '/zona1/relatorios', 404], ['ana', '/acesso', 404], ['ana', '/zona2', 200],
    ['bruno', '/zona1/relatorios', 200], ['bruno', '/zona2', 404], ['bruno', '/acesso', 404],
    ['carla', '/acesso', 200], ['carla', '/zona2', 404], ['carla', '/zona1/relatorios', 404],
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

test('V4 (auditor_b1_d1_3, E10c): nenhum CPF nem e-mail da semente chega ao HTML ou ao payload RSC de /acesso', async () => {
  const semente = JSON.parse(readFileSync(join(RAIZ, 'erp-dominio-stub', 'dados', 'semente', 'gestao-acesso-v2.json'), 'utf8'))
  const cpfs = semente.pessoas.map((p) => p.cpf).filter(Boolean)
  const emails = semente.pessoas.map((p) => p.emailFuncional).filter(Boolean)
  assert.ok(cpfs.length >= 4 && emails.length >= 4, 'semente sem CPF ou e-mail: o teste nao provaria nada')
  const carla = (await entrar('carla')).cookie
  const html = (await pedir('/acesso', { cookie: carla })).html
  const rsc = (await pedir('/acesso', { cookie: carla, cabecalhos: { rsc: '1' } })).html
  assert.match(html, /revogar|conceder/i, 'a pagina de acesso nao listou pessoas (o teste nao provaria nada)')
  for (const [nome, corpo] of [['HTML', html], ['RSC', rsc]]) {
    for (const v of [...cpfs, ...emails]) assert.ok(!corpo.includes(v), `${v} chegou ao ${nome} de /acesso`)
    assert.ok(!/"cpf"|\\"cpf\\"|emailFuncional/.test(corpo), `campo de cadastro chegou ao ${nome} de /acesso`)
  }
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

// Gestão de acesso v2: pessoas × módulos na zona de acesso (ADR-0014, adendo 1). Só o davi é revogado e
// reconcedido: o módulo zona1 é de concessão direta, e ele volta com o mesmo perfil padrão.
const ACAO_DE_ACESSO = (nome) => ({ app: 'erp-zona-acesso', arquivo: 'app/acesso/acoes.ts', nome, caminho: '/acesso' })
const DAVI = 'p-20'
const CARLA = 'p-19'
const formDeAcesso = async (carla, pessoa, modulo) => formularios((await pedir('/acesso', { cookie: carla })).html)
  .find((c) => c.pessoa === pessoa && c.modulo === modulo)

async function administrar(nome, campos, cookie) {
  assert.ok(campos, `formulario de ${nome} nao encontrado`)
  const r = await acaoPeloCliente({ ...ACAO_DE_ACESSO(nome), campos, cookie })
  assert.equal(r.status, 200)
  assert.equal(r.redirecionamento, null, 'nenhuma action usa redirect() (limitacao 11)')
  return r
}

test('N6/N5 e invariante 16 comportamental: revogar o acesso vale na proxima navegacao, sem novo login', async () => {
  const carla = (await entrar('carla')).cookie
  const davi = (await entrar('davi')).cookie
  assert.equal((await pedir('/zona1', { cookie: davi })).status, 200)

  const revogar = await formDeAcesso(carla, DAVI, 'zona1')
  assert.ok(revogar?.acesso, 'davi deveria ter acesso vigente a zona1')
  const r = await administrar('revogarAcesso', revogar, carla)
  assert.match(r.corpo, /"destino":"\/acesso"/)
  assert.ok(valorDoCookie(r.cookies, '__Host-flash'), 'toast de resultado')
  try {
    for (const caminho of ['/zona1', '/zona1/recursos/r-1']) assert.equal((await pedir(caminho, { cookie: davi })).status, 404, caminho)
    assert.ok(!menu((await pedir('/', { cookie: davi })).html).hrefs.includes('/zona1'))
  } finally {
    await administrar('concederAcesso', await formDeAcesso(carla, DAVI, 'zona1'), carla)
  }
  assert.equal((await pedir('/zona1/recursos/r-1', { cookie: davi })).status, 200)
})

test('segregacao: quem administra nao se concede modulo; o dominio recusa e nada muda', async () => {
  const carla = (await entrar('carla')).cookie
  const r = await administrar('concederAcesso', await formDeAcesso(carla, CARLA, 'zona2'), carla)
  assert.match(r.corpo, /"destino":"\/acesso"/)
  assert.equal((await pedir('/zona2', { cookie: carla })).status, 404, 'carla se concedeu a zona 2')
})

test('Server Action e reverificada no servidor: quem nao tem papel nao administra', async () => {
  const carla = (await entrar('carla')).cookie
  const bruno = (await entrar('bruno')).cookie
  const davi = (await entrar('davi')).cookie
  const r = await acaoPeloCliente({ ...ACAO_DE_ACESSO('concederAcesso'), campos: await formDeAcesso(carla, DAVI, 'zona2'), cookie: bruno })
  assert.match(r.corpo, /"destino":"\/"/, 'a action de administracao rodou para o bruno')
  assert.equal((await pedir('/zona2', { cookie: davi })).status, 404, 'o acesso mudou')
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

/**
 * Campos VALIDOS de cada action, lidos do formulario que a propria pagina renderiza (auditor_b1_d1_3, V5):
 * com campos da v1, o dominio recusaria com 422 de qualquer jeito e o teste de Origin nao teria dentes.
 * Action nova sem entrada aqui reprova o teste.
 */
const CAMPOS_VALIDOS = {
  concluirTarefa: async () => formularios((await pedir('/zona2', { cookie: (await entrar('ana')).cookie })).html).find((c) => c.id === 't-2'),
  revogarAcesso: async () => formDeAcesso((await entrar('carla')).cookie, DAVI, 'zona1'),
  concederAcesso: async () => formDeAcesso((await entrar('carla')).cookie, DAVI, 'zona2'),
}

test('Server Action sem Origin, ou com Origin de outro site, nao executa em nenhuma app (campos validos, estado conferido)', async () => {
  const acoes = todasAsAcoes()
  assert.ok(acoes.length >= 3, `so ${acoes.length} actions encontradas`)
  for (const acao of acoes) {
    assert.ok(CAMPOS_VALIDOS[acao.nome], `action ${acao.app} ${acao.nome} sem campos validos neste teste`)
    const campos = await CAMPOS_VALIDOS[acao.nome]()
    assert.ok(campos, `${acao.nome}: formulario nao encontrado na pagina (o teste nao provaria nada)`)
    const cookie = (await entrar(DONO[acao.app] ?? 'carla')).cookie
    for (const origem of [null, 'http://evil.com']) {
      const r = await acaoPeloCliente({ ...acao, campos, cookie, origem })
      assert.ok(!valorDoCookie(r.cookies, '__Host-flash'), `${acao.app} ${acao.nome} rodou com Origin ${origem}`)
    }
  }
  // nada mudou no dominio: davi segue com a zona 1 e sem a zona 2; a tarefa segue pendente
  const davi = (await entrar('davi')).cookie
  assert.equal((await pedir('/zona1', { cookie: davi })).status, 200, 'revogacao executou sem Origin valido')
  assert.equal((await pedir('/zona2', { cookie: davi })).status, 404, 'concessao executou sem Origin valido')
  // zona 2 e modulo validado: a concessao ficaria pendente (sem 200); o estado se confere no dominio
  assert.ok(!(await formDeAcesso((await entrar('carla')).cookie, DAVI, 'zona2'))?.acesso, 'concessao pendente criada sem Origin valido')
  const ana = (await entrar('ana')).cookie
  assert.match((await pedir('/zona2', { cookie: ana })).html, /Conferir inventário(<!-- -->)? — (<!-- -->)?pendente/)
})

test('Server Action com Origin do shell e os mesmos campos executa (dentes do teste acima)', async () => {
  const carla = (await entrar('carla')).cookie
  const davi = (await entrar('davi')).cookie
  await administrar('concederAcesso', await CAMPOS_VALIDOS.concederAcesso(), carla)
  const criado = await formDeAcesso(carla, DAVI, 'zona2')
  try {
    // zona 2 e modulo validado: a concessao nasce pendente (vigente, revogavel), sem dar a zona ainda
    assert.ok(criado?.acesso, 'a concessao com Origin valido nao chegou ao dominio')
  } finally {
    if (criado?.acesso) await administrar('revogarAcesso', criado, carla)
  }
  assert.ok(!(await formDeAcesso(carla, DAVI, 'zona2'))?.acesso, 'a limpeza nao revogou')
  assert.equal((await pedir('/zona2', { cookie: davi })).status, 404)
})

test('N4: acao na zona 2 leva para a zona 1 e o toast aparece no documento seguinte, uma vez', async () => {
  const ana = (await entrar('ana')).cookie
  const campos = formularios((await pedir('/zona2', { cookie: ana })).html).find((c) => c.id === 't-1')
  assert.ok(campos, 'formulario da tarefa t-1')
  // a semente guarda t-1 na versao 3: o If-Match vem do que o cliente conhece, nunca fixo (invariante 6; P16)
  assert.equal(campos.versao, '3', 'a pagina deveria mandar a versao que conhece')
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
  assert.ok(total >= 3, `so ${total} actions encontradas`)
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

test('V1 estatico: o cliente Redis das zonas so le (sem set, del nem outro comando de escrita)', () => {
  const fontes = (d) => readdirSync(d).flatMap((n) => {
    if (['node_modules', '.next'].includes(n)) return []
    const p = join(d, n)
    return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : []
  })
  for (const zona of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    // sem comentarios: o auditor_b1_d1_3 (V1) satisfez a checagem com REDIS_URL_ZONA num comentario
    const cliente = readFileSync(join(RAIZ, zona, 'lib', 'redis.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    assert.match(cliente, /ClienteRedisDeLeitura/, `${zona}: cliente sem o tipo so de leitura`)
    assert.match(cliente, /process\.env\.REDIS_URL_ZONA\b/, `${zona}: nao usa o usuario de leitura`)
    assert.ok(!/(\?\?|\|\|)\s*process\.env\.REDIS_URL\b(?!_)/.test(cliente), `${zona}: cai na credencial de escrita do shell sem REDIS_URL_ZONA`)
    assert.ok(!/\b(set|del|unlink|expire|pexpire|getdel|getex|rename|flushall|flushdb|sendCommand|multi|eval)\b/i.test(cliente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')),
      `${zona}: lib/redis.ts expoe comando alem de get`)
    for (const f of fontes(join(RAIZ, zona))) {
      if (f.endsWith(join('lib', 'redis.ts'))) continue
      assert.ok(!/from ['"](redis|ioredis|@redis\/[a-z-]+)['"]|require\(['"](redis|ioredis)/.test(readFileSync(f, 'utf8')), `${f} fala com o Redis fora de lib/redis.ts`)
    }
  }
})

/** Conversa RESP crua com o Redis de `url` (usuário e senha da URL); termina com QUIT e devolve tudo o que veio. */
async function redisCru(url, comandos) {
  const { createConnection } = await import('node:net')
  const u = new URL(url)
  const resp = (...args) => `*${args.length}\r\n` + args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}\r\n`).join('')
  const auth = u.username || u.password ? [['AUTH', decodeURIComponent(u.username || 'default'), decodeURIComponent(u.password)]] : []
  return new Promise((ok, falha) => {
    const c = createConnection({ host: u.hostname, port: Number(u.port || 6379) })
    let dados = ''
    c.on('data', (d) => { dados += d })
    c.on('close', () => ok(dados))
    c.on('error', falha)
    c.write([...auth, ...comandos, ['QUIT']].map((a) => resp(...a)).join(''))
  })
}
/** Conexões abertas no Redis (id, usuário, último comando), sem a própria conexão de quem pergunta. */
async function conexoesRedis() {
  const lista = await redisCru(process.env.REDIS_URL, [['CLIENT', 'LIST']])
  return lista.split('\n').filter((l) => l.startsWith('id=') && !/ cmd=client\|list /.test(l)).map((l) => ({
    id: l.match(/^id=(\d+)/)[1], usuario: l.match(/ user=(\S+)/)[1], cmd: l.match(/ cmd=(\S+)/)[1], idade: l.match(/ age=(\d+)/)[1],
  }))
}

test('V1 dinamico: com a ACL do showcase, o usuario das zonas nao grava nem apaga sessao', { skip: !process.env.REDIS_URL_ZONA && 'so no modo Redis (task verificar:redis)' }, async () => {
  const r = await redisCru(process.env.REDIS_URL_ZONA, [['SET', 'erp:sessao:forjada', '{}'], ['DEL', 'erp:sessao:qualquer']])
  assert.match(r, /^\+OK/, 'AUTH do usuario da zona falhou')
  assert.equal((r.match(/NOPERM/g) ?? []).length, 2, `a zona conseguiu escrever: ${r}`)
})

test('V1 (auditor_b1_d1_3): no ar, as zonas conectam ao Redis so com o usuario de leitura', { skip: !process.env.REDIS_URL_ZONA && 'so no modo Redis (task verificar:redis)' }, async () => {
  const ana = (await entrar('ana')).cookie
  const carla = (await entrar('carla')).cookie
  // O shell abre mais de uma conexao de escrita (rota e pagina sao instancias de modulo separadas), entao
  // contar nao separa processos. Derrubam-se as conexoes `default` (o shell reconecta sozinho, ocioso) e
  // as zonas sao chamadas direto na porta delas, sem passar pelo shell: nenhuma conexao `default` pode
  // surgir nem executar comando nesse intervalo.
  await redisCru(process.env.REDIS_URL, [['CLIENT', 'KILL', 'USER', 'default', 'SKIPME', 'yes']])
  await new Promise((ok) => setTimeout(ok, 500))
  const antes = new Map((await conexoesRedis()).filter((c) => c.usuario === 'default').map((c) => [c.id, c.cmd]))
  for (const [cookie, url] of [[ana, 'http://localhost:3001/zona1'], [ana, 'http://localhost:3002/zona2'], [carla, 'http://localhost:3003/acesso']]) {
    const r = await fetch(url, { headers: { cookie }, redirect: 'manual' })
    await r.text()
    assert.equal(r.status, 200, url)
  }
  const depois = await conexoesRedis()
  const suspeitas = depois.filter((c) => c.usuario === 'default' && antes.get(c.id) !== c.cmd)
  assert.deepEqual(suspeitas, [], `uma zona usou a credencial de escrita: ${JSON.stringify(depois)}`)
  assert.ok(depois.filter((c) => c.usuario === 'zona').length >= 3, `alguma zona nao conectou com o usuario de leitura: ${JSON.stringify(depois)}`)
  // o shell segue funcionando depois de perder as conexoes
  assert.equal((await pedir('/', { cookie: ana })).status, 200)
})

test('V1 (auditor_b1_d1_3): zona com REDIS_URL e sem REDIS_URL_ZONA nao le sessao nem conecta como o shell', { skip: !process.env.REDIS_URL_ZONA && 'so no modo Redis (task verificar:redis)', timeout: 90_000 }, async () => {
  const { cookie } = await entrar('ana')
  const antes = new Set((await conexoesRedis()).filter((c) => c.usuario === 'default').map((c) => c.id))
  const derrubar = await ambiente.subirAppAvulsa('erp-zona-2', { porta: 3012, envExtra: { REDIS_URL_ZONA: null }, caminho: '/zona2/api/health' })
  try {
    const r = await fetch('http://localhost:3012/zona2', { headers: { cookie }, redirect: 'manual' })
    await r.text()
    assert.ok(r.status >= 500, `a zona sem REDIS_URL_ZONA respondeu ${r.status}`)
    const novas = (await conexoesRedis()).filter((c) => c.usuario === 'default' && !antes.has(c.id))
    assert.deepEqual(novas, [], 'a zona conectou com a credencial de escrita do shell')
  } finally {
    await derrubar()
  }
})

test('L1 (auditor_b1_d1_3, E05): /{zona}/api/health nao toca dominio nem sessao e responde corpo fixo', async () => {
  for (const [app, zona, porta] of [['erp-zona-1', 'zona1', 3001], ['erp-zona-2', 'zona2', 3002], ['erp-zona-acesso', 'acesso', 3003]]) {
    const fonte = readFileSync(join(RAIZ, app, 'app', zona, 'api', 'health', 'route.ts'), 'utf8')
    assert.ok(!/\bimport\b|\brequire\s*\(|nucleo|process\.env|fetch|cookies|headers\(/.test(fonte), `${app}: health importa ou le algo`)
    // a sonda do shell pergunta a zona direto, sem cookie (rota publica da zona)
    const r = await fetch(`http://localhost:${porta}/${zona}/api/health`, { redirect: 'manual' })
    assert.equal(r.status, 200, zona)
    assert.deepEqual(await r.json(), { status: 'ok' }, `${zona}: health devolve mais que o estado`)
    // pelo shell, sem sessao, nao e alcancavel (invariante 10)
    assert.equal((await fetch(`${SHELL_URL}/${zona}/api/health`, { redirect: 'manual' })).status, 307, `${zona}: health exposto pelo shell`)
  }
})

test('P12: toda zona aceita Server Action so dos hosts do shell (SHELL_HOSTS), nunca uma lista escrita no codigo', () => {
  for (const app of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const fonte = readFileSync(join(RAIZ, app, 'lib', 'pagina.ts'), 'utf8')
    const hosts = [...fonte.matchAll(/hostsPermitidos:\s*([^\n]+)/g)].map((m) => m[1].trim())
    assert.deepEqual(hosts, ["(process.env.SHELL_HOSTS ?? 'localhost:3000').split(','),"], `${app}: hostsPermitidos`)
  }
})

test('invariante 16 estatico: toda pagina de zona exige modulo e funcionalidade; a zona de acesso, papel; o shell consulta o acesso', () => {
  // `(publico)` so e pulado no shell (login); nas zonas toda pagina e de modulo
  const exigido = {
    'erp-shell': /await Promise\.all\(\[\s*modulosPermitidos\(\)/,   // D4: fail-closed pela consulta
    'erp-zona-1': /await exigirModulo\('zona1', '[a-z0-9-]+\.[a-z0-9-]+'\)/,
    'erp-zona-2': /await exigirModulo\('zona2', '[a-z0-9-]+\.[a-z0-9-]+'\)/,
    'erp-zona-acesso': /await exigirPapel\(\)/,
  }
  let total = 0
  for (const [app, padrao] of Object.entries(exigido)) {
    for (const { arquivo } of paginasDaApp(app, { pularPublico: app === 'erp-shell' })) {
      assert.match(readFileSync(arquivo, 'utf8'), padrao, `${arquivo} sem a verificacao de acesso`)
      total++
    }
  }
  assert.ok(total >= 6)
})

test('toda funcionalidade que a zona exige esta no manifesto dela (e o id do modulo e o da zona)', async () => {
  const fontes = (d) => readdirSync(d).flatMap((n) => {
    if (['node_modules', '.next'].includes(n)) return []
    const p = join(d, n)
    return statSync(p).isDirectory() ? fontes(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
  for (const [app, zona] of [['erp-zona-1', 'zona1'], ['erp-zona-2', 'zona2']]) {
    const manifesto = readFileSync(join(RAIZ, app, 'acesso.manifesto.ts'), 'utf8')
    assert.match(manifesto, new RegExp(`id: '${zona}'`))
    const declaradas = [...manifesto.match(/funcionalidades: \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    let usadas = 0
    for (const f of fontes(join(RAIZ, app, 'app'))) {
      const t = readFileSync(f, 'utf8')
      for (const m of t.matchAll(/(?:exigirModulo\('|modulo: ')([a-z0-9-]+)'(?:, | *, *funcionalidade: )'([a-z0-9.-]+)'/g)) {
        assert.equal(m[1], zona, `${f} exige modulo de outra zona`)
        assert.ok(declaradas.includes(m[2]), `${f} exige ${m[2]}, fora do manifesto de ${zona}`)
        usadas++
      }
    }
    assert.ok(usadas > 0, `nenhuma exigencia achada em ${app}`)
  }
})

test('N8: nenhuma app faz saida de rede fora do registro de destinos (analise estrutural)', () => {
  // saida-de-rede.mjs le a estrutura do codigo com o compilador do TypeScript: pega fetch escrito
  // de qualquer jeito, modulos de rede, eval/Function. Excecoes declaradas e justificadas la.
  assert.deepEqual(varrerAplicacoes(), [])
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
  await ambiente.derrubarDominio('gestao-acesso-v2')
  try {
    for (const caminho of ['/', '/zona1', '/zona2']) {
      const r = await pedir(caminho, { cookie: ana })
      // no HTML do servidor, sem depender de JavaScript; o status fica 200 (o layout não o define)
      assert.match(r.html, /<h1>Serviço indisponível<\/h1>/, caminho)
      assert.ok(!r.html.includes('Olá,') && !r.html.includes('Painel da zona 1</h1>'), `${caminho} renderizou a pagina sem acesso`)
      assert.ok(!/ECONNREFUSED|at [A-Za-z]+ \(|node:internal|DestinoInvalido|ErroDeAplicacao/.test(r.html), `${caminho} vaza detalhe`)
    }
  } finally { await ambiente.subirDominio('gestao-acesso-v2') }
  assert.equal((await pedir('/zona1', { cookie: ana })).status, 200, 'voltou depois de reenviar os manifestos')
})

// ---------------------------------------------------------------------------------------------
// Gate "Shell novo", iteração 1: testes mínimos do auditor_shell_1 (.agents/auditor_shell_1/),
// cada um reprovando uma mutação que antes deixava todas as suítes verdes.

// L1 visitava só a zona 1; o auditor_shell_2 voltou o fail-open só na zona 2 e tudo ficou verde (G1).
// Agora toda página de módulo de toda zona, para quem tem e quem não tem o módulo.
const CONTEUDO_DE_MODULO = {
  '/zona1': /Painel da zona 1|recursos no seu escopo/,
  '/zona1/relatorios': /Relatórios|com custo/,
  '/zona2': /Conferir inventário|Revisar cadastro|Concluir e ir/,
  '/acesso': /Acesso a módulos —/,
  // o auditor_shell_3 voltou o fail-open só no detalhe do recurso e tudo ficou verde (V1)
  '/zona1/recursos/r-1': /Identificador:|CC-10/,
}

test('L1 cobre toda pagina de modulo das zonas: pagina nova sem entrada aqui reprova', () => {
  // O shell fica de fora de proposito: a pagina dele chama modulosPermitidos() de novo e lanca
  // com a gestao de acesso fora (equivalencia provada pelo auditor_shell_3). Nas zonas nenhuma pagina
  // e publica, entao `(publico)` nao e pulado.
  // A chave tem de ser uma URL que o Next serve pela PROPRIA pagina: numa rota dinamica, uma chave que
  // uma pagina mais especifica (menos segmentos dinamicos) tambem casa e servida por ela, nao pela
  // dinamica (auditor_shell_4: `/zona1/[secao]` passava pela chave `/zona1/relatorios`).
  for (const app of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const paginas = paginasDaApp(app, { pularPublico: false })
    for (const p of paginas) {
      const servidaPorEla = (url) => padraoDaRota(p.rota).test(url) &&
        !paginas.some((o) => o !== p && o.dinamicos < p.dinamicos && padraoDaRota(o.rota).test(url))
      assert.ok(Object.keys(CONTEUDO_DE_MODULO).some(servidaPorEla), `${p.rota} (${p.arquivo}) sem entrada em CONTEUDO_DE_MODULO que o Next sirva por ela`)
    }
  }
})

test('completude: o padrao de rota distingue pagina dinamica de literal irma (dentes do teste acima)', () => {
  const paginas = [{ rota: '/zona1/relatorios', dinamicos: 0 }, { rota: '/zona1/[secao]', dinamicos: 1 }]
  const [literal, dinamica] = paginas
  const servida = (p, url) => padraoDaRota(p.rota).test(url) && !paginas.some((o) => o !== p && o.dinamicos < p.dinamicos && padraoDaRota(o.rota).test(url))
  assert.equal(servida(dinamica, '/zona1/relatorios'), false)
  assert.equal(servida(dinamica, '/zona1/outra'), true)
  assert.equal(servida(literal, '/zona1/relatorios'), true)
  assert.ok(padraoDaRota('/zona1/[...resto]').test('/zona1/a/b'))
  assert.ok(padraoDaRota('/zona1/[[...resto]]').test('/zona1'))
})
test('L1/V1: gestao de acesso fora nao entrega pagina de modulo de nenhuma zona, nem no payload RSC', async () => {
  const quem = {}
  for (const u of ['davi', 'bruno', 'ana', 'carla']) quem[u] = (await entrar(u)).cookie
  await ambiente.derrubarDominio('gestao-acesso-v2')
  try {
    for (const [u, cookie] of Object.entries(quem)) {
      for (const [c, conteudo] of Object.entries(CONTEUDO_DE_MODULO)) {
        const r = await pedir(c, { cookie })
        assert.ok(!conteudo.test(r.html), `${u} ${c}: conteudo do modulo chegou com a gestao de acesso fora`)
      }
    }
  } finally { await ambiente.subirDominio('gestao-acesso-v2') }
})

test('L1 tem dentes: com a gestao de acesso no ar, quem tem o modulo ve o conteudo que L1 procura', async () => {
  // sem isto, um texto errado em CONTEUDO_DE_MODULO faria o L1 passar sem provar nada
  const donos = { '/zona1': 'davi', '/zona1/relatorios': 'bruno', '/zona2': 'ana', '/acesso': 'carla', '/zona1/recursos/r-1': 'bruno' }
  for (const [c, u] of Object.entries(donos)) {
    const r = await pedir(c, { cookie: (await entrar(u)).cookie })
    assert.match(r.html, CONTEUDO_DE_MODULO[c], `${u} nao viu ${c}`)
  }
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
  lotesNoColetor.length = 0
  assert.equal((await post(bruno, 'isto nao e json')).status, 400, 'corpo nao-JSON deveria dar 400')
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(lotesNoColetor.length, 0, 'corpo nao-JSON foi repassado ao coletor')
  assert.equal((await post(bruno, '{"ok":1}')).status, 204)
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(lotesNoColetor.length, 1, 'lote com sessao nao chegou ao coletor')
  // corpo em streaming, sem Content-Length: 413. Que o limite vale durante a leitura (sem ler tudo
  // antes) so a unidade de lerComLimite prova; pelo HTTP o fetch so entrega a resposta depois do envio
  const grande = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(300 * 1024)); c.close() } })
  assert.equal((await post(bruno, grande)).status, 413)
  const carla = (await entrar('carla')).cookie
  lotesNoColetor.length = 0
  let ultimo
  for (let i = 0; i < 61; i++) ultimo = await post(carla, '{}')
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(ultimo.status, 429)
  assert.equal(lotesNoColetor.length, 60, `o lote recusado por taxa chegou ao coletor (${lotesNoColetor.length})`)
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

test('L7 (auditor_shell_3, V2): zona travada (aceita conexao e nao responde) vira 503 em menos de 1 s', { timeout: 30_000 }, async () => {
  // L2 usa SIGKILL, que recusa a conexao na hora: sem isto, a sonda do proxy sem timeout passava
  const ana = (await entrar('ana')).cookie
  ambiente.congelarApp('erp-zona-2')
  try {
    await new Promise((r) => setTimeout(r, 1200))   // passa do TTL de 1 s da sonda
    const t0 = Date.now()
    const r = await fetch(`${SHELL_URL}/zona2`, { headers: { cookie: ana }, redirect: 'manual', signal: AbortSignal.timeout(5000) })
      .catch((e) => ({ status: `sem resposta (${e.name})` }))
    const ms = Date.now() - t0
    assert.equal(r.status, 503, `status ${r.status} em ${ms} ms`)
    // sonda de 500 ms (ERP_SONDA_TIMEOUT_MS); 1 s pega uma sonda lenta de 1,5 s (auditor_shell_4, G14)
    assert.ok(ms < 1000, `levou ${ms} ms`)
  } finally { ambiente.descongelarApp('erp-zona-2') }
  // a zona volta a responder antes do proximo teste
  const t0 = Date.now()
  let st = 0
  while (Date.now() - t0 < 5_000 && st !== 200) {
    st = (await pedir('/zona2', { cookie: ana })).status
    if (st !== 200) await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(st, 200, 'a zona 2 nao voltou em 5 s depois de descongelada')
})

test('L8 (auditor_shell_3/4): o nonce da CSP e novo e imprevisivel a cada requisicao, no shell, na rota publica e nas zonas', async () => {
  // as zonas tem nonce proprio (criarProxy do nucleo): so o shell nao pegava nonce fixo nelas
  const { cookie } = await entrar('ana')
  for (const c of ['/', '/login', '/zona1', '/zona2']) {
    const ns = []
    for (let i = 0; i < 4; i++) ns.push((await pedir(c, { cookie: c === '/login' ? undefined : cookie })).csp?.match(/'nonce-([^']+)'/)?.[1])
    assert.ok(ns.every(Boolean), `${c} sem nonce`)
    assert.equal(new Set(ns).size, ns.length, `${c}: nonce repetido entre requisicoes`)
    for (let i = 1; i < ns.length; i++) {
      let p = 0
      while (p < ns[i].length && ns[i][p] === ns[i - 1][p]) p++
      // contador ou relogio deixam prefixo comum longo entre pedidos seguidos
      assert.ok(p < 8, `${c}: nonces seguidos com ${p} caracteres de prefixo comum (${ns[i - 1]} / ${ns[i]})`)
    }
  }
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

test('L6: navegacao do cliente (RSC) com a gestao de acesso fora nao traz o modulo restrito', {
  skip: acharChrome() ? false : COMO_CONSEGUIR_UM_NAVEGADOR,
}, async () => {
  // HTTP puro não reproduz a navegação do cliente: o Next pede só o segmento da página, com a
  // árvore do roteador, e o layout que mostra "indisponível" pode não rodar de novo. Só um
  // navegador de verdade faz esse pedido (lacuna registrada pelo challenger_shell_2).
  const { id } = await entrar('bruno')
  const { pagina, fechar } = await abrirNavegador()
  try {
    await pagina.cookie('__Host-session', id, SHELL_URL)
    await pagina.ir(`${SHELL_URL}/zona1`)
    assert.match(await pagina.avaliar('document.body.innerText'), /Painel da zona 1/, 'a zona 1 nao abriu com a gestao de acesso no ar')
    await ambiente.derrubarDominio('gestao-acesso-v2')
    try {
      pagina.respostas.length = 0
      pagina.pedidos.length = 0
      await pagina.avaliar("window.next.router.push('/zona1/relatorios')")
      await pagina.esperarRede()
      // A guarda olha o PEDIDO, não a resposta: com o fail-closed o Next pode abortar a resposta
      // RSC e cair para navegação completa. O que importa é que a navegação do cliente foi tentada.
      const rsc = pagina.pedidos.filter((p) => /[?&]_rsc=/.test(p.url) || Object.keys(p.headers).some((k) => k.toLowerCase() === 'rsc'))
      assert.ok(rsc.length > 0, `nenhuma requisicao RSC aconteceu (o teste nao provaria nada): ${pagina.pedidos.map((p) => p.url).join(', ')}`)
      for (const r of pagina.respostas) {
        assert.ok(!/recursos no seu escopo|com custo|Relatórios/.test(r.corpo ?? ''), `modulo restrito no corpo de ${r.url}`)
      }
      assert.ok(!/recursos no seu escopo|com custo/.test(await pagina.avaliar('document.body.innerText')), 'modulo restrito na tela')
    } finally { await ambiente.subirDominio('gestao-acesso-v2') }
  } finally { await fechar() }
})

test('G2: CSP completa no shell, inclusive nas rotas publicas', async () => {
  const { cookie } = await entrar('ana')
  for (const [c, ck] of [['/', cookie], ['/login', undefined]]) {
    const csp = (await pedir(c, { cookie: ck })).csp ?? ''
    for (const d of ["form-action 'self'", "img-src 'self' data:", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) {
      assert.ok(csp.includes(d), `${c}: CSP sem ${d}`)
    }
    assert.match(csp, /'nonce-[^']+'/, `${c}: CSP sem nonce`)
  }
})

test('G5: zona fora: o asset estatico dela tambem da 503 (a sonda vem antes do corte de asset)', async () => {
  await ambiente.derrubarApp('erp-zona-2')
  try {
    await new Promise((r) => setTimeout(r, 1200))
    for (const c of ['/zona2-static/_next/static/x.js', '/ZONA2-STATIC/a.css']) {
      const r = await fetch(`${SHELL_URL}${c}`, { redirect: 'manual' })
      assert.equal(r.status, 503, c)
      assert.equal(r.headers.get('retry-after'), '5', c)
    }
  } finally { await ambiente.subirApp('erp-zona-2') }
})

test('T1 (nucleo 8): o trace do navegador chega ao dominio, sem dado pessoal', async () => {
  // troca o dominio A por um que so registra o traceparent recebido
  const recebidos = []
  await ambiente.derrubarDominio('dominio-a')
  const falso = createServer((req, res) => {
    recebidos.push(req.headers.traceparent ?? '')
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('[]')
  })
  await new Promise((ok) => falso.listen(4001, '127.0.0.1', ok))
  try {
    const trace = '4bf92f3577b34da6a3ce929d0e0e4736'
    const { cookie } = await entrar('davi')
    await pedir('/zona1', { cookie, cabecalhos: { traceparent: `00-${trace}-00f067aa0ba902b7-01` } })
    assert.ok(recebidos.length > 0, 'o dominio A nao foi chamado')
    for (const t of recebidos) {
      assert.match(t, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/, `traceparent invalido: ${t}`)
      assert.equal(t.split('-')[1], trace, 'o dominio recebeu outro trace: a cadeia quebrou no BFF')
      assert.notEqual(t.split('-')[2], '00f067aa0ba902b7', 'o BFF repassou o span do navegador em vez de abrir um filho')
    }
    // sem traceparent do navegador, o proxy abre um trace e o dominio recebe um valido
    recebidos.length = 0
    await pedir('/zona1', { cookie })
    assert.match(recebidos[0] ?? '', /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
  } finally {
    await new Promise((ok) => falso.close(ok))
    await ambiente.subirDominio('dominio-a')
  }
})

// ---------------------------------------------------------------------------------------------
// Gestão de acesso v2 (ADR-0014, adendo 1): uma autoridade só, e fechada.

test('v2 fora e v1 no ar: as apps nao voltam a v1; servico indisponivel, nunca conteudo', async () => {
  const ana = (await entrar('ana')).cookie
  const davi = (await entrar('davi')).cookie
  await ambiente.derrubarDominio('gestao-acesso-v2')
  await ambiente.subirDominio('gestao-acesso')   // a v1 concederia o painel e a zona 2
  try {
    for (const [cookie, caminho, conteudo] of [[ana, '/zona2', CONTEUDO_DE_MODULO['/zona2']], [davi, '/zona1', CONTEUDO_DE_MODULO['/zona1']]]) {
      const r = await pedir(caminho, { cookie })
      assert.match(r.html, /<h1>Serviço indisponível<\/h1>/, caminho)
      assert.ok(!conteudo.test(r.html), `${caminho}: conteudo veio da v1`)
    }
  } finally {
    await ambiente.derrubarDominio('gestao-acesso')
    await ambiente.subirDominio('gestao-acesso-v2')
  }
  assert.equal((await pedir('/zona2', { cookie: ana })).status, 200)
})

test('pessoa desligada na gestao de acesso vai ao login na requisicao seguinte, nunca ao conteudo', async () => {
  const davi = (await entrar('davi')).cookie
  assert.equal((await pedir('/zona1', { cookie: davi })).status, 200)
  // o desligamento acontece no domínio (quem administra, pela API dele); o BFF só observa
  const r = await fetch('http://127.0.0.1:4020/v2/pessoas/p-20/desligamento', { method: 'POST', headers: { authorization: 'Bearer dev.carla' } })
  assert.equal(r.status, 204)
  try {
    for (const caminho of ['/zona1', '/']) {
      const p = await pedir(caminho, { cookie: davi })
      assert.ok(!CONTEUDO_DE_MODULO['/zona1'].test(p.html) && !p.html.includes('Olá,'), `${caminho}: conteudo para pessoa desligada`)
      assert.match(p.local ?? p.html, /\/login/, `${caminho}: nao foi ao login`)
    }
  } finally {
    // o domínio falso guarda tudo em memória: reiniciar volta à semente
    await ambiente.derrubarDominio('gestao-acesso-v2')
    await ambiente.subirDominio('gestao-acesso-v2')
  }
})

// ---------------------------------------------------------------------------------------------
// Slice K3 (auditor_b1_d1_4: V1-V5, L1-L5)

test('V1 (E01f): REDIS_URL de escrita do shell nao esta presente no ambiente das zonas', () => {
  for (const dir of ['erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const proc = ambiente.apps.get(dir)
    assert.ok(proc?.pid, `${dir}: processo nao encontrado`)
    const environ = readFileSync(`/proc/${proc.pid}/environ`, 'utf8')
    assert.ok(!environ.includes('REDIS_URL='), `${dir}: processo contem REDIS_URL de escrita em /proc/<pid>/environ`)
  }
  const procShell = ambiente.apps.get('erp-shell')
  assert.ok(procShell?.pid, 'erp-shell: processo nao encontrado')
  const environShell = readFileSync(`/proc/${procShell.pid}/environ`, 'utf8')
  assert.ok(environShell.includes('REDIS_URL='), 'erp-shell: processo deve conter REDIS_URL')
})

test('V3 (E10d): centro de custo nao vaza no HTML nem no RSC da listagem /zona1 para o bruno', async () => {
  const bruno = (await entrar('bruno')).cookie
  const html = (await pedir('/zona1', { cookie: bruno })).html
  const rsc = (await pedir('/zona1', { cookie: bruno, cabecalhos: { rsc: '1' } })).html
  for (const [nome, corpo] of [['HTML', html], ['RSC', rsc]]) {
    assert.ok(!/CC-10|CC-20|CC-99/.test(corpo), `centro de custo vazou no ${nome} de /zona1`)
    assert.ok(!/"custo"|\\"custo\\"/.test(corpo), `campo de custo vazou no ${nome} de /zona1`)
  }
})

test('V5 (XN01p): bundles estaticos do cliente (.next/static) nao vazam portas de dominio nem redis', () => {
  const varrerArquivos = (dir) => {
    let encontrados = []
    for (const item of readdirSync(dir)) {
      const p = join(dir, item)
      if (statSync(p).isDirectory()) encontrados.push(...varrerArquivos(p))
      else if (item.endsWith('.js')) encontrados.push(p)
    }
    return encontrados
  }
  for (const app of ['erp-shell', 'erp-zona-1', 'erp-zona-2', 'erp-zona-acesso']) {
    const dirEstatico = join(RAIZ, app, '.next', 'static')
    const arquivos = varrerArquivos(dirEstatico)
    assert.ok(arquivos.length > 0, `${app}: nenhum arquivo .js encontrado em .next/static`)
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, 'utf8')
      assert.ok(!/127\.0\.0\.1:40\d\d/.test(conteudo), `${arquivo} contem endereco interno de dominio 127.0.0.1:40xx`)
      assert.ok(!/redis:\/\//.test(conteudo), `${arquivo} contem URL do Redis redis://`)
    }
  }
})

test('L2 (P16b): mutacao envia a versao real do recurso (versao 1 em t-2), provando que If-Match nao e fixo em 3', async () => {
  const ana = (await entrar('ana')).cookie
  const campos = formularios((await pedir('/zona2', { cookie: ana })).html).find((c) => c.id === 't-2')
  assert.ok(campos, 'formulario da tarefa t-2')
  assert.equal(campos.versao, '1', 'a tarefa t-2 deve vir com versao 1 da semente')
  const r = await acaoPeloCliente({ ...CONCLUIR, campos, cookie: ana })
  assert.equal(r.status, 200)
  assert.match(r.corpo, /"destino":"\/zona1"/, 'a action concluiu com sucesso usando If-Match: 1')
  // restaura dominio-c para nao alterar o estado das outras assercoes
  await ambiente.derrubarDominio('dominio-c')
  await ambiente.subirDominio('dominio-c')
})
