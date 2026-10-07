import { cru } from './lib.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const K='/zona2/_fragmento/tarefas/pendentes'
const A={}; for (const u of ['ana','bruno','davi','carla','eva']) A[u]=(await entrar(u)).cookie
const forj='__Host-session='+'a'.repeat(43)
const V={'accept-fragmento-versao':'1'}
const casos=[]
const add=(n,p,o)=>casos.push([n,p,o])
for (const u of Object.keys(A)) add('ator '+u,K,{cookie:A[u],headers:V})
add('forjado',K,{cookie:forj,headers:V}); add('forjado longo',K,{cookie:'__Host-session='+'z'.repeat(5000),headers:V}); add('cookie vazio valor',K,{cookie:'__Host-session=',headers:V})
add('sem cookie',K,{headers:V})
for (const v of ['0','2','','1.0','01','-1','1,2','abc']) add('versao "'+v+'"',K,{cookie:A.ana,headers:{'accept-fragmento-versao':v}})
add('sem header versao',K,{cookie:A.ana})
for (const k of ['todas','..','%2e%2e','','x'.repeat(5000),'Pendentes','pendentes%00','pendentes%20','pendentes/x','%70endentes']) add('chave "'+k.slice(0,20)+'"','/zona2/_fragmento/tarefas/'+k,{cookie:A.ana,headers:V})
add('outro dominio','/zona2/_fragmento/outro/pendentes',{cookie:A.ana,headers:V})
for (const d of ['document','iframe','frame','fencedframe','embed','object','empty','script','image','style','worker','sharedworker','serviceworker','report','audioworklet','video','audio','track','manifest','xslt','nested-document','','DOCUMENT','Iframe']) add('dest '+d,K,{cookie:A.ana,headers:{...V,'sec-fetch-dest':d}})
add('dest+mode navigate',K,{cookie:A.ana,headers:{...V,'sec-fetch-mode':'navigate'}})
add('mode navigate sem dest',K,{cookie:A.ana,headers:{...V,'sec-fetch-mode':'navigate','sec-fetch-user':'?1'}})
add('Accept */*',K,{cookie:A.ana,headers:{...V,accept:'*/*'}})
add('Accept text/html (nav)',K,{cookie:A.ana,headers:{...V,accept:'text/html,application/xhtml+xml','upgrade-insecure-requests':'1'}})
for (const m of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS','TRACE']) add('metodo '+m,K,{cookie:A.ana,headers:V,method:m})
const out=[]
for (const [n,p,o] of casos){ const r=await cru(3002,p,o); const b=r.body; out.push(`${n.padEnd(26)} ${String(r.status).padEnd(4)} len=${String(b.length).padEnd(5)} cc=${r.h['cache-control']??'-'} ct=${(r.h['content-type']??'-').split(';')[0]} loc=${(r.h.location??'-').slice(0,40)} ${/data-fragmento/.test(b)?'FRAGMENTO':''} ${/<script/i.test(b)?'SCRIPT':''} ${/token|groups|grupos/i.test(b)?'TOKENWORD':''}`) }
console.log(out.join('\n'))
