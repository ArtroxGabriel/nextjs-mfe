// Reverifica se a suspeita de falso negativo em item1 (erp-zona-acesso "confirmada de volta: false")
// e mesmo um artefato de usar 'ana' (sem perfil admin-acesso) em vez de 'carla'.
import { subir, SHELL as SHELL_URL } from '../../base/scripts/ambiente.mjs'
import { entrar } from '../../base/verificacao/apoio.mjs'

let ambiente
async function main() {
  ambiente = await subir({ construir: false })
  const ana = (await entrar('ana')).cookie
  const carla = (await entrar('carla')).cookie

  await ambiente.derrubarApp('erp-zona-acesso')
  await new Promise((r) => setTimeout(r, 1200))
  await ambiente.subirApp('erp-zona-acesso')

  const rAna = await fetch(`${SHELL_URL}/acesso`, { headers: { cookie: ana }, redirect: 'manual' })
  const rCarla = await fetch(`${SHELL_URL}/acesso`, { headers: { cookie: carla }, redirect: 'manual' })
  console.log('ana  /acesso apos revivida:', rAna.status, '(esperado 404: ana nao tem perfil admin-acesso)')
  console.log('carla /acesso apos revivida:', rCarla.status, '(esperado 200)')
}
main().finally(async () => { try { await ambiente?.derrubar() } catch {} })
