import { subir } from '../../../base/scripts/ambiente.mjs'
import { pedir } from '../../../base/verificacao/apoio.mjs'
const amb = await subir({ construir: false })
try {
  const cookie = '__Host-session=forjada-aud4'
  for (const c of ['/', '/acesso', '/zona1']) {
    const r = await pedir(c, { cookie })
    console.log(`cookie forjado (nunca emitido pelo shell) ${c}: ${r.status}`, /Gestão de acesso/.test(r.html ?? '') ? '(pagina de administracao)' : '')
  }
} finally { amb.derrubar() }
