// Sonda do auditor_c1_1: o que bruno e davi (só zona 1) veem no painel que fale de tarefas ou da zona 2.
const RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
const { subir } = await import(`${RAIZ}/base/scripts/ambiente.mjs`)
const { entrar, pedir } = await import(`${RAIZ}/base/verificacao/apoio.mjs`)
const amb = await subir({ construir: true })
try {
  for (const u of ['bruno', 'davi', 'ana']) {
    const r = await pedir('/zona1', { cookie: (await entrar(u)).cookie })
    const achados = [...r.html.matchAll(/.{0,60}(tarefa|zona 2|indispon)[^<]{0,60}/gi)].map((m) => m[0])
    console.log(`[${process.argv[2]}] ${u} ${r.status}: ${JSON.stringify(achados)}`)
  }
} finally { amb.derrubar() }
await new Promise((r) => setTimeout(r, 1500))
process.exit(0)
