"""Aplica uma mutação de variantes.json, roda sonda.mjs (saída em arquivo), restaura. Uso: python3 -I sondar.py ID..."""
import sys, json, subprocess, os, re
RAIZ = '/home/wilson-castro/Documents/projects/mira/nextjs-mfe'; S = os.path.dirname(os.path.abspath(__file__))
ms = {m['id']: m for m in json.load(open(f'{S}/variantes.json'))}
for i in sys.argv[1:]:
    m = ms[i]; rdir = os.path.join(RAIZ, m['repo']); p = os.path.join(rdir, m['arquivo'])
    src = open(p).read(); assert src.count(m['antes']) == 1
    novo = src.replace(m['antes'], m['depois'])
    for a, b in m.get('subs', []): novo = novo.replace(a, b)
    open(p, 'w').write(novo)
    try:
        r = subprocess.run(['node', f'{S}/sonda.mjs', i], cwd=RAIZ, capture_output=True, text=True, timeout=900)
        out = re.sub(r'eyJ[A-Za-z0-9_.-]{20,}', '<jwt-mascarado>', r.stdout + r.stderr)
        open(f'{S}/saidas/sonda-{i}.txt', 'w').write(out)
    finally:
        subprocess.run(['git', 'checkout', '--', m['arquivo']], cwd=rdir, check=True)
