import { cru } from './lib.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const c=(await entrar('bruno')).cookie
let r=await cru(3000,'/zona1',{cookie:c,headers:{rsc:'1'}})
console.log(r.status,r.h.location, Object.keys(r.h).join(','))
r=await cru(3000,'/zona1',{cookie:c,headers:{rsc:'1'}}); console.log(r.status)
r=await cru(3000,'/zona1',{cookie:c,headers:{rsc:'1',accept:'text/x-component'}}); console.log('accept xc',r.status,r.h.location)
r=await cru(3000,'/zona1?_rsc=abc',{cookie:c,headers:{rsc:'1',accept:'text/x-component'}}); console.log('_rsc q',r.status,r.h.location)
