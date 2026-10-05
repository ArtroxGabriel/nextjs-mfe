import subprocess, sys, re, os, shutil
R='/home/wilson-castro/Documents/projects/mira/nextjs-mfe/repos/'
L='erp-nucleo/src/interno/login.ts'
ANT="    id: aleatorio(), state: aleatorio(), codeVerifier: aleatorio(), nonce: aleatorio(),\n"
NUC='pnpm test'
M=[
 ('L04h',L,ANT,"    const state = aleatorio()\n    return {\n    id: createHash('sha256').update(state).digest('base64url'), state, codeVerifier: aleatorio(), nonce: aleatorio(),\n",NUC,'erp-nucleo'),
 ('L04k',L,ANT,"    const state = aleatorio()\n    return {\n    id: state + '.login', state, codeVerifier: aleatorio(), nonce: aleatorio(),\n",NUC,'erp-nucleo'),
 ('L04j',L,ANT,"    const state = aleatorio()\n    return {\n    id: aleatorio(), state, codeVerifier: createHash('sha256').update(state).digest('base64url'), nonce: aleatorio(),\n",NUC,'erp-nucleo'),
 ('L04i',L,ANT,"    const id = aleatorio()\n    return {\n    id, state: createHash('sha256').update(id).digest('base64url'), codeVerifier: aleatorio(), nonce: aleatorio(),\n",NUC,'erp-nucleo'),
 ('T3o',L,ANT,"  return {\n    id: aleatorio().replace(/./g, 'i'), state: aleatorio().replace(/./g, 's'), codeVerifier: aleatorio().replace(/./g, 'v'), nonce: aleatorio().replace(/./g, 'n'),\n",'pnpm exec tsc -p tsconfig.json && node --conditions react-server --test test/identidade-oidc.test.mjs','erp-nucleo'),
 ('P04b','erp-shell/lib/decisao-proxy.ts',"  return prosseguirComRenovacao(contexto, renovar, nonce)\n}\n","  return caminho === '/' ? prosseguirComRenovacao(contexto, renovar, nonce) : { acao: 'prosseguir', nonce }\n}\n",'pnpm test','erp-shell'),
]
sel=sys.argv[1:]
for nome,arq,antes,depois,cmd,repo in M:
  if sel and nome not in sel: continue
  p=R+arq; orig=open(p).read()
  if nome!='P04b':
    alvo="  return {\n"+antes
    assert orig.count(alvo)==1, nome
    novo=orig.replace(alvo,depois,1)
  else:
    assert orig.endswith(antes) or orig.rstrip('\n').endswith(antes.rstrip('\n')), nome
    i=orig.rindex(antes.split('\n')[0]); novo=orig[:i]+depois.rstrip('\n')+orig[i+len(antes.rstrip('\n')):]
  open(p,'w').write(novo)
  try:
    r=subprocess.run(cmd,shell=True,cwd=R+repo,capture_output=True,text=True)
    out=r.stdout+r.stderr
    g=lambda k:(re.findall(r'ℹ '+k+r' (\d+)',out) or ['?'])[-1]
    print(f"{nome} | {cmd} | rc={r.returncode} tests={g('tests')} pass={g('pass')} fail={g('fail')} | {'PEGA' if r.returncode else 'SOBREVIVE'}")
    for l in out.splitlines():
      if l.startswith('✖') and 'failing tests' not in l: print('   ',l)
    if r.returncode and g('tests')=='?': print(out[-2000:])
  finally:
    open(p,'w').write(orig)  # escrita nova: mtime novo
    os.utime(p)
print('restaurado; git diff da fonte:')
print(subprocess.run('git -C '+R+'erp-nucleo diff --stat -- src; git -C '+R+'erp-shell diff --stat -- lib',shell=True,capture_output=True,text=True).stdout or '(nada)')
