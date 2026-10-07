// Sonda do auditor_c1_2: o bloco de tarefas como ana o vê no painel da zona 1.
const RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
const { subir } = await import(`${RAIZ}/base/scripts/ambiente.mjs`)
const { entrar, pedir } = await import(`${RAIZ}/base/verificacao/apoio.mjs`)
const amb = await subir({ construir: true })
try {
  const r = await pedir('/zona1', { cookie: (await entrar('ana')).cookie })
  const i = r.html.indexOf('<section data-fragmento')
  console.log(`[${process.argv[2]}] ana ${r.status}: ${JSON.stringify(r.html.slice(i, r.html.indexOf('</section>', i) + 10))}`)
} finally { amb.derrubar() }
await new Promise((r) => setTimeout(r, 1500))
process.exit(0)
