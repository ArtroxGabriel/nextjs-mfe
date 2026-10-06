import sys, subprocess, json, re, time
RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
REPO = RAIZ + '/repos/erp-shell'
LOG = RAIZ + '/.agents/auditor_d7_1/mutacoes.txt'
OUT = '/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/2fe69177-5a1a-4d3a-b5ed-aafa120ce589/scratchpad'
A = '    proxyTimeout: lerTetoDaZona(),\n'
muts = json.load(open(sys.argv[1]))
for m in muts:
    path = REPO + '/next.config.ts'
    src = open(path).read()
    if m['antes'] is not None:
        assert src.count(m['antes']) == 1, m['id']
        linha = src[:src.index(m['antes'])].count('\n') + 1
        open(path, 'w').write(src.replace(m['antes'], m['depois']))
    else:
        linha = '-'
    t0 = time.time()
    try:
        r = subprocess.run("node --test --test-name-pattern='L9' base/verificacao/base.test.mjs", shell=True, cwd=RAIZ,
                           capture_output=True, text=True, env={**__import__('os').environ, 'CONSTRUIR': '1'}, timeout=900)
        out = r.stdout + r.stderr
    finally:
        if m['antes'] is not None:
            subprocess.run(['git', 'checkout', '--', 'next.config.ts'], cwd=REPO, check=True)
    open(f"{OUT}/e2e-{m['id']}.txt", 'w').write(out)
    stats = {k: (re.search(rf'^ℹ {k} (\d+)', out, re.M) or [None, '?'])[1] for k in ['tests', 'pass', 'fail', 'skipped']}
    msgs = re.findall(r"(?:error|AssertionError)[^\n]*\n?[^\n]*(?:soltou|status|nenhuma)[^\n]*", out)
    det = re.findall(r"(soltou em [^'\"\n]*|status [^'\"\n]* em \d+ ms|em 3 tentativas[^'\"\n]*)", out)
    bloco = f"""
[{m['id']}] repos/erp-shell/next.config.ts:{linha}
  antes : {repr(m['antes'])}
  depois: {repr(m['depois'])}
  comando: CONSTRUIR=1 node --test --test-name-pattern='L9' base/verificacao/base.test.mjs  ({int(time.time()-t0)} s)
  resultado: tests {stats['tests']} pass {stats['pass']} fail {stats['fail']} skipped {stats['skipped']} -> {'VIVA' if stats['fail']=='0' else 'REPROVOU (L9)'}; {'; '.join(sorted(set(det)))[:300]}
"""
    print(bloco, flush=True); open(LOG, 'a').write(bloco)
