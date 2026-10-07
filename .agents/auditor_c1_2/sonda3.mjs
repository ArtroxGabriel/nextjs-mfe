// Sonda do auditor_c1_2: o que vem logo depois da seção de recursos no painel da zona 1 (onde o bloco da zona 2 entra).
const RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
const { subir } = await import(`${RAIZ}/base/scripts/ambiente.mjs`)
const { entrar, pedir } = await import(`${RAIZ}/base/verificacao/apoio.mjs`)
const amb = await subir({ construir: true })
try {
  for (const u of ['bruno', 'davi', 'ana']) {
    const r = await pedir('/zona1', { cookie: (await entrar(u)).cookie })
    const i = r.html.indexOf('</section>', r.html.indexOf('id="recursos"'))
    console.log(`[${process.argv[2]}] ${u} ${r.status}: ${JSON.stringify(r.html.slice(i, i + 160))}`)
  }
} finally { amb.derrubar() }
await new Promise((r) => setTimeout(r, 1500))
process.exit(0)
