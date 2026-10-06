// Cenario 7: regressao dos ataques do D2. uso: node c7.mjs <transacaoS|default>
import * as L from './lib.mjs'
const T = process.argv[2]
L.configOidc(T === 'default' ? { ERP_LOGIN_TRANSACAO_S: null } : { ERP_LOGIN_TRANSACAO_S: T })
const amb = await L.subir({ log: true })
try {
  await L.esperar(1500)
  L.dizer(`##### ERP_LOGIN_TRANSACAO_S=${process.env.ERP_LOGIN_TRANSACAO_S ?? '(padrao 600)'}`)
  // --- 1) cookie __Host-erp-login
  const mon = await L.monitorarRedis(process.env.REDIS_URL)
  const ini = await L.pedir('/api/auth/entrar?de=%2Fzona1')
  const cmds = await mon.parar()
  const sc = ini.cookies.find((c) => c.startsWith('__Host-erp-login='))
  L.dizer('Set-Cookie login (valor omitido):', sc?.replace(/=[^;]*/, '=<id>'))
  const setLogin = cmds.filter((l) => /"set"/i.test(l) && /erp:login|transac/i.test(l)).map((l) => l.replace(/"\{.*\}"/, '"<json>"').replace(/^.*?\]/, ''))
  L.dizer('SET no Redis da transacao:', setLogin.length ? setLogin : cmds.filter((l) => /"set"/i.test(l)).map((l) => l.replace(/"\{.*\}"/, '"<json>"').replace(/^.*?\]/, '').slice(0, 200)))
  // --- 2) varredura de tokens
  const { cookie, id } = await L.entrarPeloKeycloak('bruno')
  const s = await L.sessaoNoRedis(id)
  const valores = [s.accessToken, s.refreshToken, s.idToken].filter(Boolean)
  L.dizer('campos da sessao no Redis (so chaves):', Object.keys(s))
  const PADROES = [/refresh_token/i, /id_token/i, /access_token/i, /eyJ[A-Za-z0-9_-]{8,}/, /refreshToken/, /idToken/, /accessToken/, /dev-erp-shell-segredo/, /"groups"|groups\\?"/i]
  const scripts = new Set(); let corpos = 0, achados = []
  const varrer = (nome, texto, headers = '') => {
    corpos++
    for (const p of PADROES) if (p.test(texto) || p.test(headers)) achados.push(`${nome}: ${p}`)
    for (const v of valores) if (texto.includes(v) || headers.includes(v)) achados.push(`${nome}: valor exato de token`)
  }
  for (const c of ['/', '/zona1', '/zona1/relatorios', '/zona1/recursos/r-1', '/zona2']) {
    for (const rsc of [false, true]) {
      const r = await fetch(`${L.SHELL}${c}`, { headers: { cookie, ...(rsc ? { rsc: '1' } : {}) }, redirect: 'manual' })
      const t = await r.text(); varrer(`${c}${rsc ? ' (rsc)' : ''}`, t, [...r.headers].map(([k, v]) => `${k}: ${v}`).join('\n'))
      for (const m of t.matchAll(/(?:src|href)="([^"]+\.js[^"]*)"/g)) scripts.add(m[1].replaceAll('&amp;', '&'))
    }
  }
  for (const src of scripts) { const r = await fetch(new URL(src, L.SHELL), { headers: { cookie } }); const t = await r.text(); varrer(`JS ${src}`, t) }
  const carla = await L.entrarPeloKeycloak('carla'); const a = await L.cron('/acesso', { cookie: carla.cookie }); varrer('/acesso (carla)', a.html)
  L.dizer(`varredura: ${corpos} corpos (HTML, RSC, ${scripts.size} scripts, /acesso), achados=${achados.length}`, achados.slice(0, 10))
  L.dizer('cookies da resposta do retorno (nomes+atributos, valor omitido):', (await L.entrarPeloKeycloak('ana')).ret.cookies.map((c) => c.replace(/=[^;]*/, '=<v>')))
  // --- 3) ACL do usuario zona
  const z = process.env.REDIS_URL_ZONA, hash = L.chaveDaSessao(id)
  const ex = async (cmd) => (await L.redisCru(z, [cmd])).replace(/\r\n/g, ' | ').replace(/\{.*?\}/gs, '<json>').slice(0, 160)
  for (const cmd of [['GET', hash], ['SET', hash, 'x'], ['SET', 'erp:sessao:novo', 'x'], ['DEL', hash], ['EXPIRE', hash, '1'], ['SET', 'erp:renovacao:' + hash.split(':').pop(), '1', 'NX'], ['FLUSHALL'], ['KEYS', '*'], ['EVAL', 'return 1', '0'], ['CONFIG', 'GET', 'requirepass']]) L.dizer('ZONA', cmd[0], cmd[1]?.slice(0, 12) ?? '', '->', await ex(cmd))
  L.dizer('sessao ainda intacta no Redis (shell):', !!(await L.sessaoNoRedis(id)))
  // --- 4) outros
  const g = await fetch(`${L.SHELL}/api/auth/sair`, { redirect: 'manual', headers: { cookie } }); L.dizer('GET /api/auth/sair ->', g.status, g.headers.get('location'))
  const zd = await fetch('http://127.0.0.1:3001/zona1', { headers: { cookie }, redirect: 'manual' }); L.dizer('zona1 direta :3001 com cookie ->', zd.status, (await zd.text()).slice(0, 80))
  const st = await fetch('http://127.0.0.1:4001/v1/recursos'); L.dizer('stub :4001 sem Authorization ->', st.status, await st.text())
  const st2 = await fetch('http://127.0.0.1:4001/v1/recursos', { headers: { origin: 'http://localhost:3000', authorization: 'Bearer lixo' } }); L.dizer('stub com Bearer lixo ->', st2.status, await st2.text())
} finally { amb.derrubar(); await L.esperar(1500) }
