// Sobe a base para uso manual: node base/scripts/subir-base.mjs [--construir]
// Abra http://localhost:3000 e entre como ana, bruno, carla ou davi. Ctrl-C derruba tudo.
import { subir, SHELL } from './ambiente.mjs'

const { derrubar } = await subir({ construir: process.argv.includes('--construir'), log: true })
console.log(`\nbase no ar: ${SHELL}  (Ctrl-C para derrubar)`)
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => { derrubar(); process.exit(0) })
