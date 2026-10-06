import * as L from './lib.mjs'
L.configOidc({ ERP_LOGIN_TRANSACAO_S: null })
const amb = await L.subir({ log: false })
try {
  await L.esperar(1500)
  const i = await L.pedir('/api/auth/entrar?de=%2Fzona1'); const tr = L.valorDoCookie(i.cookies, '__Host-erp-login')
  const x = new URL(i.local); x.searchParams.delete('code_challenge'); x.searchParams.delete('code_challenge_method')
  const r = await fetch(x, { redirect: 'manual' })
  const loc = r.headers.get('location')
  L.dizer('PKCE removido: Keycloak', r.status, (loc ?? '').replace(/(state|code|session_state|iss)=[^&]+/g, '$1=<m>'))
  const r2 = await fetch(new URL(loc), { redirect: 'manual' }); L.dizer(' seguindo ->', r2.status, (r2.headers.get('location') ?? '').replace(/(state|code|session_state|iss)=[^&]+/g, '$1=<m>'))
} finally { amb.derrubar(); await L.esperar(1500) }
