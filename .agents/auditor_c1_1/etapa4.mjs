import { cru } from './lib.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const ana=(await cru(3002,'/zona2/_fragmento/tarefas/pendentes',{cookie:(await entrar('ana')).cookie,headers:{'accept-fragmento-versao':'1'}})).body
console.log('fragmento de ana:',ana)
const titulos=[...ana.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m=>m[1].replace(/<[^>]+>/g,'').trim()).filter(Boolean)
console.log('titulos extraidos:',JSON.stringify(titulos))
const pats=[/data-fragmento/,/Tarefas pendentes/i,/access_?token/i,/refresh_?token/i,/\bgroups\b/i,/\bgrupos\b/i,/eyJ[A-Za-z0-9_-]{20,}/,/Bearer /i,/sem acesso|acesso negado/i,...titulos.map(t=>new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))]
for (const u of ['ana','bruno','davi','carla','eva']) {
  const c=(await entrar(u)).cookie
  for (const [modo,h] of [['html',{}],['rsc',{rsc:'1'}],['rsc+prefetch',{rsc:'1','next-router-prefetch':'1','next-router-state-tree':'%5B%22%22%5D'}]]) {
    let r=await cru(3000,'/zona1',{cookie:c,headers:h}); if(r.status===307) r=await cru(3000,r.h.location,{cookie:c,headers:h})
    // js servidos
    const hits=pats.map(p=>r.body.match(p)?p.source.slice(0,30):null).filter(Boolean)
    console.log(u,modo,r.status,'len',r.body.length,'ct',(r.h['content-type']??'').split(';')[0],'achados:',JSON.stringify(hits))
  }
}
