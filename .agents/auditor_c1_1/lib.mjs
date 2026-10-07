import http from 'node:http'
export function cru(porta, path, { cookie, method='GET', headers={} } = {}) {
  return new Promise((ok) => {
    const t=Date.now()
    const r = http.request({ host:'127.0.0.1', port:porta, path, method, headers:{ ...(cookie?{cookie}:{}), ...headers }, setHost:true }, (res) => {
      let b=''; res.on('data',d=>b+=d); res.on('end',()=>ok({status:res.statusCode, h:res.headers, body:b, ms:Date.now()-t}))
    })
    r.on('error',e=>ok({status:'ERR '+e.code,h:{},body:'',ms:Date.now()-t}))
    r.setTimeout(15000,()=>{r.destroy()})
    r.end()
  })
}
