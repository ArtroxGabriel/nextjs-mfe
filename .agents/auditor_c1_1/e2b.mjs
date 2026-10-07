import { cru } from './lib.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const ana=(await entrar('ana')).cookie
for (const p of ['//zona2/_fragmento/tarefas/pendentes','/zona2//_fragmento/tarefas/pendentes','/zona2/_fragmento/tarefas/pendentes/','/zona2/%2F_fragmento/tarefas/pendentes','/zona2/_fragmento%20/tarefas/pendentes','/zona2%2F_fragmento/tarefas/pendentes']) {
  for (const porta of [3000,3002]) {
    let loc=p, r
    for (let i=0;i<4;i++){ r=await cru(porta,loc,{cookie:ana,headers:{accept:'text/html','accept-fragmento-versao':'1'}}); if(![301,307,308].includes(r.status)) break; loc=r.h.location; if(!loc.startsWith('/')) break }
    console.log(porta,p,'->',loc,r.status,'len',r.body.length,/data-fragmento/.test(r.body)?'FRAGMENTO!':'', JSON.stringify(r.body.replace(/\s+/g,' ').slice(0,120)))
  }
}
