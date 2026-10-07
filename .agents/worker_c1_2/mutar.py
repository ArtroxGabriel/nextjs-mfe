"""Aplica cada mutação, roda os testes do modo, restaura com git checkout e registra em mutacoes.txt.
Uso: python3 -I mutar.py lista.json"""
import sys, subprocess, json, re, os, time
RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'
LOG = '/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/2fe69177-5a1a-4d3a-b5ed-aafa120ce589/scratchpad/c1w/mutacoes.txt'
SAIDAS = '/tmp/claude-1000/-home-wilson-castro-Documents-projects-mira-nextjs-mfe/2fe69177-5a1a-4d3a-b5ed-aafa120ce589/scratchpad/c1w/saidas'
os.makedirs(SAIDAS, exist_ok=True)
MODOS = {
    'unit':    ('repos/erp-shell', 'pnpm test'),
    'e2e':     ('', "CONSTRUIR=1 node --test --test-name-pattern='C1' base/verificacao/base.test.mjs"),
    'e2efull': ('', "CONSTRUIR=1 node --test base/verificacao/base.test.mjs"),
    'estatica':('', 'node --test base/verificacao/saida-de-rede.test.mjs base/verificacao/seguranca-estatica.test.mjs'),
    'scripts': ('', 'node --test base/scripts/ambiente.test.mjs'),
}
JWT = re.compile(r'eyJ[A-Za-z0-9_-]{20,}[A-Za-z0-9._-]*')
COOKIE = re.compile(r'(__Host-session=)[^;\s"\']+')
def mascarar(t): return COOKIE.sub(r'\1<mascarado>', JWT.sub('<jwt-mascarado>', t))

def rodar(modo, mid):
    cwd, cmd = MODOS[modo]
    t0 = time.time()
    r = subprocess.run(cmd, shell=True, cwd=os.path.join(RAIZ, cwd), capture_output=True, text=True, timeout=1500)
    out = mascarar(r.stdout + r.stderr)
    open(f'{SAIDAS}/{mid}-{modo}.txt', 'w').write(out)
    falhas = sorted(set(re.findall(r'^not ok \d+ - (.*)$', out, re.M) + re.findall(r'^✖ (.+?) \(\d', out, re.M)))
    falhas = [f for f in falhas if not f.startswith('failing tests')]
    fail = re.search(r'^ℹ fail (\d+)', out, re.M); tests = re.search(r'^ℹ tests (\d+)', out, re.M)
    nf = fail.group(1) if fail else '?'
    if nf == '0': res = f'VIVA ({tests.group(1) if tests else "?"} testes verdes)'
    elif nf == '?': res = 'ERRO/BUILD: ' + out[-600:].replace('\n', ' | ')
    else: res = f'REPROVOU ({nf} falhas): ' + '; '.join(falhas)[:900]
    return f'{res} [{time.time()-t0:.0f}s]'

def portas_livres():
    o = subprocess.run("ss -ltn | grep -E ':(300[0-3]|40[0-9][0-9]|41[0-2][0-9])\\b' || true", shell=True, capture_output=True, text=True).stdout
    return o.strip() == ''

muts = json.load(open(sys.argv[1]))
for m in muts:
    repo = m.get('repo', '')
    rdir = os.path.join(RAIZ, repo)
    path = os.path.join(rdir, m['arquivo'])
    src = open(path).read()
    assert src.count(m['antes']) == 1, (m['id'], src.count(m['antes']))
    linha = src[:src.index(m['antes'])].count('\n') + 1
    novo = src.replace(m['antes'], m['depois'])
    for a, b in m.get('subs', []):
        assert novo.count(a) == 1, (m['id'], 'subs', a)
        novo = novo.replace(a, b)
    if 'antes2' in m:
        assert novo.count(m['antes2']) == 1, (m['id'], 'antes2')
        novo = novo.replace(m['antes2'], m['depois2'])
    open(path, 'w').write(novo)
    resultados = []
    try:
        for modo in m['modos']:
            if modo.startswith('e2e') and not portas_livres():
                resultados.append(f'{modo}: PORTAS OCUPADAS, nao rodou'); break
            r = rodar(modo, m['id'])
            resultados.append(f'{modo}: {r}')
            if 'REPROVOU' in r and not m.get('todos'): break
    finally:
        subprocess.run(['git', 'checkout', '--', m['arquivo']], cwd=rdir, check=True)
        if 'arquivo_extra' in m: pass
    bloco = f"""
[{m['id']}] {repo or '(principal)'}/{m['arquivo']}:{linha}  ({m.get('nota','')})
  antes : {m['antes']!r}
  depois: {m['depois']!r}""" + (f"""
  antes2: {m['antes2']!r}
  depois2: {m['depois2']!r}""" if 'antes2' in m else '') + ''.join(f"""
  antes+: {a!r}
  depois+: {b!r}""" for a, b in m.get('subs', [])) + f"""
  comando: {' ; '.join(MODOS[x][1] for x in m['modos'])}
  resultado: {' || '.join(resultados)}
"""
    print(bloco, flush=True); open(LOG, 'a').write(bloco)
