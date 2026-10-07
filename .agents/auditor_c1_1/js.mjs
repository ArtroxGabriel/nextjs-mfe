import { cru } from './lib.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const c=(await entrar('ana')).cookie
const h=(await cru(3000,'/zona1',{cookie:c})).body
const js=[...new Set([...h.matchAll(/\/(?:zona1\/)?_next\/static\/[^"'\\ ]+\.js/g)].map(m=>m[0]))]
let n=0,bytes=0,hits=[]
for(const u of js){const r=await cru(3000,u,{cookie:c}); n++; bytes+=r.body.length; for(const p of [/access_token/,/refresh_token/,/\bgroups\b/,/accessToken/,/Revisar cadastro/]) if(p.test(r.body)) hits.push(u+' '+p.source)}
console.log('js',n,'bytes',bytes,'hits',JSON.stringify(hits))
