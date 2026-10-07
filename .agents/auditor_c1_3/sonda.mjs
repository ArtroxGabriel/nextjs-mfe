// Sonda do auditor_c1_3: o <main> do painel da zona 1 e o que vem depois dele, para bruno e davi, com a mutação aplicada.
const RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
const { subir } = await import(`${RAIZ}/base/scripts/ambiente.mjs`)
const { entrar, pedir } = await import(`${RAIZ}/base/verificacao/apoio.mjs`)
const amb = await subir({ construir: true })
try {
  for (const u of ['bruno', 'davi']) {
    const r = await pedir('/zona1', { cookie: (await entrar(u)).cookie })
    const a = r.html.indexOf('<main'), b = r.html.indexOf('</main>')
    const depois = r.html.slice(b, b + 400).replace(/<script[\s\S]*$/, '')
    console.log(`[${process.argv[2]}] ${u} ${r.status}\n  main: ${r.html.slice(a, b + 7)}\n  depois: ${depois}`)
  }
} finally { amb.derrubar() }
await new Promise((r) => setTimeout(r, 1500))
process.exit(0)
