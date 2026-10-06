import sys, subprocess, json, re
REPO = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/repos/erp-shell'
LOG = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/auditor_d7_1/mutacoes.txt'
muts = json.load(open(sys.argv[1]))
for m in muts:
    path = f"{REPO}/{m['arquivo']}"
    src = open(path).read()
    assert src.count(m['antes']) == 1, (m['id'], src.count(m['antes']))
    linha = src[:src.index(m['antes'])].count('\n') + 1
    open(path, 'w').write(src.replace(m['antes'], m['depois']))
    try:
        r = subprocess.run('pnpm test', shell=True, cwd=REPO, capture_output=True, text=True)
        out = r.stdout + r.stderr
        falhas = sorted(set(re.findall(r'^not ok \d+ - (.*)$', out, re.M) + re.findall(r'^✖ (.+?) \(\d', out, re.M)))
        fail = re.search(r'^ℹ fail (\d+)', out, re.M)
        nf = fail.group(1) if fail else '?'
    finally:
        subprocess.run(['git', 'checkout', '--', m['arquivo']], cwd=REPO, check=True)
    res = f"REPROVOU ({nf} falhas): " + '; '.join(falhas) if nf not in ('0','?') else ('VIVA' if nf == '0' else 'ERRO: ' + out[-500:])
    bloco = f"""
[{m['id']}] repos/erp-shell/{m['arquivo']}:{linha}
  antes : {m['antes']}
  depois: {m['depois']}
  comando: cd repos/erp-shell && pnpm test
  resultado: {res}
"""
    print(bloco); open(LOG, 'a').write(bloco)
