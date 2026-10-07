const RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
const { subir } = await import(`${RAIZ}/base/scripts/ambiente.mjs`)
const { entrar, pedir } = await import(`${RAIZ}/base/verificacao/apoio.mjs`)
const amb = await subir({ construir: process.env.CONSTRUIR === '1' })
try {
  for (const u of ['bruno', 'davi', 'ana', 'eva']) {
    const r = await pedir('/zona1', { cookie: (await entrar(u)).cookie })
    const a = r.html.indexOf('<main'), b = r.html.indexOf('</main>')
    console.log(`=== ${u} ${r.status}\n${r.html.slice(a, b + 7)}`)
  }
} finally { amb.derrubar() }
await new Promise((r) => setTimeout(r, 1500))
process.exit(0)
