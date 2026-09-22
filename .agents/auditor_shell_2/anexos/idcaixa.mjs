import { carregarZonas, encontrarZonaPorCaminho, gerarRewrites } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/repos/erp-shell/lib/zonas.ts'
const z = carregarZonas({ ZonaA: 'http://localhost:3009' }, {})
console.log(JSON.stringify(z))
for (const c of ['/zonaa', '/ZonaA', '/ZONAA/x']) console.log(c, encontrarZonaPorCaminho(c, z)?.id ?? null)
console.log(JSON.stringify(gerarRewrites(z).slice(0, 2)))
