import { subir } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/scripts/ambiente.mjs'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const amb = await subir({ log: false })
const ana=(await entrar('ana')).cookie
const medir=(rot)=>{
  const o=execFileSync('curl',['-s','-o',`${process.env.S}/corpo.html`,'-w','%{http_code} %{time_total}','-H','cookie: '+ana,'--max-time','30','http://localhost:3000/zona1']).toString()
  const b=execFileSync('cat',[`${process.env.S}/corpo.html`]).toString()
  console.log(rot.padEnd(28),o,'painel='+/Painel da zona 1/.test(b),'bloco='+/data-fragmento="zona2\/tarefas"/.test(b),'len='+b.length)
}
const dom=(n,sig)=>process.kill(-amb.dominios.get(n).pid,sig)
try{
for(let i=0;i<5;i++) medir('baseline '+i)
amb.congelarApp('erp-zona-2')
for(let i=0;i<5;i++) medir('zona2 congelada '+i)
amb.descongelarApp('erp-zona-2')
for(let i=0;i<3;i++) medir('zona2 descongelada '+i)
await amb.derrubarApp('erp-zona-2')
for(let i=0;i<5;i++) medir('zona2 derrubada '+i)
await amb.subirApp('erp-zona-2')
for(let i=0;i<3;i++) medir('zona2 restaurada '+i)
dom('dominio-c','SIGSTOP')
for(let i=0;i<5;i++) medir('dominio-c congelado '+i)
dom('dominio-c','SIGCONT')
for(let i=0;i<3;i++) medir('dominio-c restaurado '+i)
// zona 2 congelada + dominio c
}finally{ try{dom('dominio-c','SIGCONT')}catch{}; try{amb.descongelarApp('erp-zona-2')}catch{}; amb.derrubar(); await new Promise(r=>setTimeout(r,4000)) }
