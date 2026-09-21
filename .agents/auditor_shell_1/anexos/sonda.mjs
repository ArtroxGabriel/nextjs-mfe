// Sonda ao vivo na cópia (builds já prontos). uso: node sonda.mjs <rotulo>
import { execSync } from 'node:child_process'
const C = '/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/e29fcdca-2336-45d2-a30d-626e27eec6b2/scratchpad/repos-copia'
const { subir } = await import(`${C}/scripts/ambiente.mjs`)
const { pedir, entrar } = await import(`${C}/verificacao/apoio.mjs`)
const amb = await subir({ construir: false })
const out = (...a) => console.log(process.argv[2] ?? '', ...a)
try {
  const ana = (await entrar('ana')).cookie, davi = (await entrar('davi')).cookie, bruno = (await entrar('bruno')).cookie
  // 1. CSP: quantos cabeçalhos em /zona1 e /
  for (const c of ['/', '/zona1']) {
    const r = await fetch(`http://localhost:3000${c}`, { headers: { cookie: ana }, redirect: 'manual' })
    const csp = r.headers.get('content-security-policy')
    out(`CSP ${c}: status ${r.status}; valor: ${csp}`)
  }
  // 2. flash forjado numa página do próprio shell
  const falso = encodeURIComponent(JSON.stringify({ tipo: 'erro', texto: 'Forjado pelo cliente', id: 'x1' }))
  for (const c of ['/', '/zona1']) {
    const r = await pedir(c, { cookie: ana, cabecalhos: { 'x-erp-flash': falso } })
    out(`FLASH forjado ${c}: aparece=${r.html.includes('Forjado pelo cliente')}`)
  }
  // 3. relatórios com a gestão de acesso fora
  for (const [nome, ck] of [['davi', davi], ['bruno', bruno]]) {
    const r = await pedir('/zona1/relatorios', { cookie: ck })
    out(`RELATORIOS (acesso no ar) ${nome}: ${r.status} vaza=${/recursos no seu escopo/.test(r.html)}`)
  }
  await amb.derrubarDominio('gestao-acesso')
  for (const [nome, ck] of [['davi', davi], ['bruno', bruno]]) {
    for (const c of ['/zona1/relatorios', '/zona1']) {
      const r = await pedir(c, { cookie: ck })
      const m = r.html.match(/.{0,60}recursos no seu escopo.{0,60}/)
      out(`ACESSO FORA ${nome} ${c}: ${r.status} indisponivel=${/Serviço indisponível/.test(r.html)} relatorio_no_html=${Boolean(m)} ${m ? JSON.stringify(m[0]) : ''} painel_no_flight=${/Painel da zona 1/.test(r.html)}`)
    }
  }
  await amb.subirDominio('gestao-acesso')
  // 4. zona 2 fora: caixa alta e caminho estático
  const pid = execSync("ss -ltnpH 'sport = :3002' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2").toString().trim()
  process.kill(Number(pid), 'SIGKILL'); await new Promise((r) => setTimeout(r, 1500))
  for (const c of ['/zona2', '/ZONA2', '/zona2-static/_next/static/x.js', '/', '/zona1']) {
    const r = await fetch(`http://localhost:3000${c}`, { headers: { cookie: ana }, redirect: 'manual' })
    out(`ZONA2 FORA ${c}: ${r.status} retry-after=${r.headers.get('retry-after')} cache-control=${r.headers.get('cache-control')}`)
  }
} finally { amb.derrubar() }
