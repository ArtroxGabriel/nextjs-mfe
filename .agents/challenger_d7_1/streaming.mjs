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
  const ler = async (rot) => {
    const t0 = Date.now(); const ev = []
    try {
      const r = await fetch('http://localhost:3000' + rot, { headers: { cookie: ck }, redirect: 'manual', signal: AbortSignal.timeout(40000) })
      ev.push(`headers status=${r.status} t=${Date.now() - t0}`)
      const rd = r.body.getReader()
      for (;;) { const { done, value } = await rd.read(); if (done) { ev.push(`fim-normal t=${Date.now() - t0}`); break }; ev.push(`chunk ${JSON.stringify(Buffer.from(value).toString())} t=${Date.now() - t0}`) }
    } catch (e) { ev.push(`ERRO ${e.name}: ${e.message} cause=${e.cause?.code ?? ''} t=${Date.now() - t0}`) }
    console.log(rot, '\n  ' + ev.join('\n  '))
  }
  for (const r of ['/zona2/lento-ok', '/zona2/stream', '/zona2/trava', '/zona2/cabecalho-tardio']) await ler(r)
} finally { fim() }
