// Autoteste do cliente de navegador (navegador.mjs), sem a base: servidor local em porta livre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { abrirNavegador, acharChrome } from './navegador.mjs'

const semChrome = acharChrome() ? false : 'nenhum Chrome nesta maquina (defina ERP_CHROME)'

test('o navegador navega, executa JS, envia cookie __Host- e registra respostas com corpo; limpa tudo', { skip: semChrome }, async () => {
  const recebidos = []
  const srv = createServer((req, res) => {
    recebidos.push({ url: req.url, cookie: req.headers.cookie ?? '' })
    if (req.url === '/dados') { res.setHeader('content-type', 'text/plain'); return res.end('segredo-42') }
    res.setHeader('content-type', 'text/html')
    res.end('<h1>ola</h1><script>fetch("/dados")</script>')
  })
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok))
  const base = `http://localhost:${srv.address().port}`
  const { pagina, perfil, fechar } = await abrirNavegador()
  try {
    await pagina.cookie('__Host-session', 'abc', base)
    await pagina.ir(`${base}/`)
    await pagina.esperarRede()
    assert.equal(await pagina.avaliar('document.querySelector("h1").textContent'), 'ola')
    assert.ok(pagina.respostas.some((r) => r.url.endsWith('/dados') && r.corpo === 'segredo-42'), 'resposta do fetch nao registrada')
    assert.ok(recebidos.every((r) => r.cookie.includes('__Host-session=abc')), 'cookie nao enviado pelo navegador')
  } finally {
    await fechar()
    srv.close()
  }
  assert.ok(!existsSync(perfil), `perfil ${perfil} ficou para tras`)
  // pelo caminho exato do perfil (aleatório): um texto genérico casaria com o próprio shell que roda o teste
  const { execFileSync } = await import('node:child_process')
  let vivos = ''
  try { vivos = execFileSync('pgrep', ['-f', perfil], { encoding: 'utf8' }) } catch { /* nenhum */ }
  assert.equal(vivos.trim(), '', 'processo do Chrome ficou vivo depois de fechar')
})
