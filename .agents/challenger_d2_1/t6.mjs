import { KC, get, entrar, redisCmd } from './lib.mjs'
import { createSign, createHmac, generateKeyPairSync, createPublicKey } from 'node:crypto'
const out = (k, v) => console.log(k.padEnd(60), v)
const b = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url')
const A = 'http://127.0.0.1:4001', C = 'http://127.0.0.1:4003', ACESSO = 'http://127.0.0.1:4020'
const chamar = async (url, tok, extra = {}) => { const r = await fetch(url, { redirect: 'manual', ...extra, headers: { ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(extra.headers || {}) } }); return { st: r.status, corpo: (await r.text()).slice(0, 120) } }
// token real novo (vida 12 s)
const ana = await entrar('ana')
const sess = JSON.parse((await redisCmd(['GET', 'erp:sessao:' + (await import('node:crypto')).createHash('sha256').update(ana.id).digest('hex')])).match(/\{[\s\S]*\}/)[0])
const real = sess.accessToken; const [h, p, s] = real.split('.')
const hdr = JSON.parse(Buffer.from(h, 'base64url')); const pay = JSON.parse(Buffer.from(p, 'base64url'))
out('claims reais', JSON.stringify({ alg: hdr.alg, kid: hdr.kid?.slice(0, 8), iss: pay.iss, aud: pay.aud, user: pay.preferred_username, vida: pay.exp - pay.iat }))
const r0 = await chamar(`${A}/v1/recursos`, real); out('controle: token real (dominio A)', `${r0.st} ${r0.corpo.slice(0, 60)}`)
const r0b = await chamar(`${C}/v1/tarefas`, real); out('controle: token real (dominio C)', `${r0b.st}`)
// sem credencial
for (const [nome, u] of [['A', A + '/v1/recursos'], ['C', C + '/v1/tarefas'], ['acesso v2 /v2/eu', ACESSO + '/v2/eu']]) { const r = await chamar(u); out(`sem Authorization (${nome})`, `${r.st} ${r.corpo}`) }
// origem de navegador
for (const o of ['http://localhost:3000', 'http://evil.example']) { const r = await chamar(`${A}/v1/recursos`, real, { headers: { origin: o } }); out(`token real + Origin ${o}`, `${r.st} ${r.corpo}`) }
const r1 = await chamar(`${A}/v1/recursos`, real, { headers: { 'sec-fetch-site': 'cross-site' } }); out('token real + Sec-Fetch-Site: cross-site', `${r1.st} ${r1.corpo}`)
// forjados
const para = (hh, pp, ss) => `${b(hh)}.${b(pp)}.${ss}`
const forjados = {}
forjados['alg none'] = para({ alg: 'none', typ: 'JWT' }, pay, '')
forjados['alg none (assinatura da original)'] = para({ alg: 'none', typ: 'JWT' }, pay, s)
forjados['alg NONE'] = para({ alg: 'NONE', typ: 'JWT' }, pay, '')
const jw = await (await fetch(`${KC}/realms/erp/protocol/openid-connect/certs`)).json()
const chaveRSA = jw.keys.find((k) => k.kid === hdr.kid)
const pem = createPublicKey({ key: chaveRSA, format: 'jwk' }).export({ type: 'spki', format: 'pem' })
const pemDer = createPublicKey({ key: chaveRSA, format: 'jwk' }).export({ type: 'spki', format: 'der' })
for (const [nm, sec] of [['pem', pem], ['der', pemDer], ['n bruto', Buffer.from(chaveRSA.n, 'base64url')]]) {
  const hh = { alg: 'HS256', typ: 'JWT', kid: hdr.kid }
  forjados[`HS256 com chave publica (${nm})`] = `${b(hh)}.${b(pay)}.${createHmac('sha256', sec).update(`${b(hh)}.${b(pay)}`).digest('base64url')}`
}
const meu = generateKeyPairSync('rsa', { modulusLength: 2048 })
const sign = (hh, pp, key, alg = 'RSA-SHA256') => `${b(hh)}.${b(pp)}.${createSign(alg).update(`${b(hh)}.${b(pp)}`).sign(key, 'base64url')}`
forjados['RS256 assinado com minha chave, kid real'] = sign({ alg: 'RS256', kid: hdr.kid }, pay, meu.privateKey)
forjados['RS256 minha chave, kid desconhecido'] = sign({ alg: 'RS256', kid: 'xx' }, pay, meu.privateKey)
forjados['RS256 minha chave + jwk embutido'] = sign({ alg: 'RS256', kid: 'meu', jwk: { ...meu.publicKey.export({ format: 'jwk' }), kid: 'meu' } }, pay, meu.privateKey)
forjados['RS256 minha chave + jku'] = sign({ alg: 'RS256', kid: 'meu', jku: 'http://127.0.0.1:4016/jwks' }, pay, meu.privateKey)
forjados['RS384 (alg trocado), assinatura original'] = para({ ...hdr, alg: 'RS384' }, pay, s)
forjados['RS256 payload trocado (carla), assinatura original'] = para(hdr, { ...pay, preferred_username: 'carla' }, s)
forjados['RS256 exp estendido, assinatura original'] = para(hdr, { ...pay, exp: pay.exp + 99999 }, s)
forjados['RS256 aud trocada, assinatura original'] = para(hdr, { ...pay, aud: 'outro' }, s)
forjados['RS256 iss trocado, assinatura original'] = para(hdr, { ...pay, iss: 'http://evil.example/realms/erp' }, s)
forjados['assinatura truncada'] = `${h}.${p}.${s.slice(0, 20)}`
forjados['assinatura vazia'] = `${h}.${p}.`
forjados['so 2 partes'] = `${h}.${p}`
forjados['lixo'] = 'abc'
for (const [nome, tok] of Object.entries(forjados)) { const r = await chamar(`${A}/v1/recursos`, tok); out(`forjado: ${nome}`, `${r.st} ${r.corpo}`) }
// token de outro realm (master) e de dev
const adm = (await (await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: 'admin' }) })).json()).access_token
out('token do realm master (admin-cli)', JSON.stringify(await chamar(`${A}/v1/recursos`, adm)))
out('token dev (dev.ana.<uuid>) em modo JWT', JSON.stringify(await chamar(`${A}/v1/recursos`, 'dev.ana.' + '0'.repeat(8) + '-0000-0000-0000-' + '0'.repeat(12))))
out('token dev (dev.ana) acesso /v2/eu', JSON.stringify(await chamar(`${ACESSO}/v2/eu`, 'dev.ana')))
// svc
const post = (url, tok, corpo) => chamar(url, tok, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
const z1 = { id: 'zona1', nome: 'Zona 1 — painel e relatórios', funcionalidades: ['painel.ver', 'relatorios.ver'] }
out('svc.zona1 registra zona1 (proprio)', JSON.stringify(await post(`${ACESSO}/v2/modulos/manifesto`, 'svc.zona1', z1)))
out('svc.zona1 registra zona2 (outro)', JSON.stringify(await post(`${ACESSO}/v2/modulos/manifesto`, 'svc.zona1', { ...z1, id: 'zona2' })))
out('svc.idp registra zona1', JSON.stringify(await post(`${ACESSO}/v2/modulos/manifesto`, 'svc.idp', z1)))
out('svc.acesso registra acesso (modulo inexistente?)', JSON.stringify(await post(`${ACESSO}/v2/modulos/manifesto`, 'svc.acesso', { id: 'acesso', nome: 'x', funcionalidades: [] })).slice(0, 140))
out('svc.zona1 registra, id com maiusculas "ZONA1"', JSON.stringify(await post(`${ACESSO}/v2/modulos/manifesto`, 'svc.zona1', { ...z1, id: 'ZONA1' })))
out('svc.zona1 id " zona1"', JSON.stringify(await post(`${ACESSO}/v2/modulos/manifesto`, 'svc.zona1', { ...z1, id: ' zona1' })))
out('svc.zona1 id ["zona1"]', JSON.stringify(await post(`${ACESSO}/v2/modulos/manifesto`, 'svc.zona1', { ...z1, id: ['zona1'] })))
for (const svc of ['svc.idp', 'svc.zona1', 'svc.bff']) {
  out(`${svc} POST /v2/primeiro-acesso`, JSON.stringify(await post(`${ACESSO}/v2/primeiro-acesso`, svc, { cpf: '44477700083', sub: 'x' })))
  out(`${svc} POST /v2/decisoes`, JSON.stringify(await post(`${ACESSO}/v2/decisoes`, svc, {})))
  out(`${svc} GET /v2/eventos`, JSON.stringify(await chamar(`${ACESSO}/v2/eventos`, svc)))
  out(`${svc} GET dominio A /v1/recursos`, JSON.stringify(await chamar(`${A}/v1/recursos`, svc)))
  out(`${svc} GET /v2/eu`, JSON.stringify(await chamar(`${ACESSO}/v2/eu`, svc)))
}
// vencido (vida 12 s)
console.log('esperando o token real vencer (12 s + tolerancia 5 s)...'); await new Promise((r) => setTimeout(r, 19000))
out('token real vencido (>5 s de tolerancia)', JSON.stringify(await chamar(`${A}/v1/recursos`, real)))
