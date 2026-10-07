const { decidirAcaoDoProxy } = await import('/home/wilson-castro/Documents/projects/mira/nextjs-mfe/repos/erp-shell/lib/decisao-proxy.ts')
const s={verificar:async()=>true,limpar(){}}
const cs=['//zona2/_fragmento/x','/zona2//_fragmento/x','/zona2/%2F_fragmento/x','/zona2%2F_fragmento/x','/zona2/./_fragmento/x','/zona2/%2e/_fragmento/x','/zona2/x/../_fragmento/x','/zona2/_fragmento;a/x','/zona2/%255Ffragmento/x','/zona2/_fragmento%2Fx','/zona2/%5Ffragmento%2Fx','/ZONA2/%5F%46ragmento','/zona2/_fragmento%00','/zona2/%E0%A4%A/_fragmento/x','/zona2/_fragmento?x=1','/zona2-static/_fragmento/x']
for (const c of cs){const d=await decidirAcaoDoProxy({caminho:c,temCookieSessao:true},s);console.log(c.padEnd(32),d.acao, 'URL.pathname=',new URL('http://h'+c).pathname)}
