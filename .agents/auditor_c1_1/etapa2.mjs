import { cru } from './lib.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const ana=(await entrar('ana')).cookie
const K='/_fragmento/tarefas/pendentes'
const g=[
 `//zona2${K}`,`/zona2/${K}`,`/zona2//_fragmento/tarefas/pendentes`,`/zona2/%2F_fragmento/tarefas/pendentes`,`/zona2%2F_fragmento/tarefas/pendentes`,`/zona2%2f_fragmento/tarefas/pendentes`,
 `/zona2/x/../_fragmento/tarefas/pendentes`,`/zona2/./_fragmento/tarefas/pendentes`,`/zona2/%2e%2e/zona2${K}`,`/zona2/x/%2e%2e/_fragmento/tarefas/pendentes`,`/zona2/%2e/_fragmento/tarefas/pendentes`,`/zona2/x%2f..%2f_fragmento/tarefas/pendentes`,`/zona2/x/..%2f_fragmento/tarefas/pendentes`,
 `/zona2;a=b/_fragmento/tarefas/pendentes`,`/zona2/_fragmento;a=b/tarefas/pendentes`,`/zona2/_fragmento/tarefas/pendentes;a=b`,`/zona2/_fragmento/tarefas/pendentes%3Ba`,
 `/ZONA2${K}`,`/zona2/_FRAGMENTO/tarefas/pendentes`,`/zona2/%5F%66ragmento/tarefas/pendentes`,`/zona2/%255Ffragmento/tarefas/pendentes`,`/zona2/%255f%2566ragmento/tarefas/pendentes`,
 `/zona2${K}/`,`/zona2${K}?x=1`,`/zona2${K}%3Fx=1`,`/zona2${K}#a`,`/zona2/_fragmento-static/tarefas/pendentes`,`/zona2/_fragmento%00/tarefas/pendentes`,`/zona2/_fragmento%20/tarefas/pendentes`,`/zona2/_fragmento%2Ftarefas%2Fpendentes`,`/zona2%2F_fragmento%2Ftarefas%2Fpendentes`,
 `/zona2/_frag%6Dento/tarefas/pendentes`,`/zona2/%5c_fragmento/tarefas/pendentes`,`/zona2\\_fragmento/tarefas/pendentes`,`///zona2${K}`,`/./zona2${K}`,`/zona1/../zona2${K}`,`/zona1/%2e%2e/zona2${K}`,`/_next/../zona2${K}`,`/zona2/_fragmento/tarefas/pendentes%2F`,`/zona2/_fragmento/tarefas/pendentes%2e`,
 `/zona2/_next/..${K}`,`/zona2${K}.`,`/zona2/_fragmento/./tarefas/pendentes`,`/zona2/_fragmento//tarefas/pendentes`,
]
const marca=(r)=>/data-fragmento/.test(r.body)?'FRAGMENTO!':''
const out=[]
for(const p of g){
  const o=[]
  for(const [n,c] of [['cookie',ana],['semcookie',undefined]]){
    const r=await cru(3000,p,{cookie:c})
    o.push(`${n}=${r.status}|len=${r.body.length}|cc=${r.h['cache-control']??'-'}|loc=${r.h.location??'-'}|ct=${(r.h['content-type']??'-').split(';')[0]}|${marca(r)}`)
  }
  out.push(`${p}\n   ${o.join('\n   ')}`)
}
console.log(out.join('\n'))
