import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { entrar } from '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/base/verificacao/apoio.mjs'
const D = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
const z = spawn('node', [`${D}/.agents/challenger_d7_1/zona-falsa.mjs`], { detached: true, stdio: 'inherit' })
const s = spawn('pnpm', ['exec', 'next', 'start', '-p', '3000'], { cwd: `${D}/repos/erp-shell`, detached: true, stdio: 'ignore',
  env: { ...process.env, ERP_PERMITIR_IDENTIDADE_DEV: '1', SESSAO_DIR: mkdtempSync(tmpdir() + '/s-'), ERP_ZONA_TETO_MS: '6000' } })
const fim = () => { for (const p of [z, s]) try { process.kill(-p.pid, 'SIGKILL') } catch {} }
try {
  for (let i = 0; i < 60; i++) { try { await fetch('http://localhost:3000/login', { signal: AbortSignal.timeout(1000) }); break } catch { await new Promise(r => setTimeout(r, 500)) } }
  const ck = (await entrar('ana')).cookie
  for (const [nome, h] of [['identity', { 'accept-encoding': 'identity' }], ['gzip', { 'accept-encoding': 'gzip' }]]) {
    const t0 = Date.now(); const ev = []
    const r = await fetch('http://localhost:3000/zona2/stream', { headers: { cookie: ck, ...h }, redirect: 'manual' })
    ev.push(`enc=${r.headers.get('content-encoding')} te=${r.headers.get('transfer-encoding')}`)
    const rd = r.body.getReader()
    for (;;) { const { done, value } = await rd.read(); if (done) break; ev.push(`chunk ${value.length}B t=${Date.now() - t0}`) }
    console.log(nome, ev.join(' | '))
  }
} finally { fim() }
