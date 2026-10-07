def rw(p,f):
    s=open(p).read(); s=f(s); open(p,'w').write(s)
# 4
def f4(s):
    a=[l for l in s.split('\n') if l.startswith('| `ERP_SONDA_TIMEOUT_MS`')]
    assert len(a)==1
    new="| `ERP_ZONA_TETO_MS` | `10000` | Tempo máximo que uma zona pode ficar **sem mandar nenhum byte** numa resposta repassada pelo shell; vira o `experimental.proxyTimeout` do Next. É inatividade, não duração: página em streaming, download ou SSE que segue mandando dados não é cortado. Ao estourar, o Next responde 500 (sem a página da base, que vem com o C3). Teto 120000; tem de ser **maior** que `ERP_DESTINO_TIMEOUT_MS`, senão o shell recusa subir. Lido em todo `next start` | shell (`lib/configuracao.ts`, `next.config.ts`) | ✅ (D7) |"
    return s.replace(a[0],a[0]+'\n'+new)
rw('docs/CONFIGURACAO.md',f4)
# 5
def f5(s):
    i=s.index('A segunda exceção é a zona travada')
    end='o cache e a sonda reais contra um destino que nunca responde).'
    j=s.index(end)+len(end)
    new="""A segunda exceção é a zona travada: processo vivo, porta aceitando conexão, sem resposta
(medido com `SIGSTOP`). Uma requisição enviada dentro do mesmo intervalo de 1 s passa pela
sonda e fica presa na zona até o teto do proxy do Next (`experimental.proxyTimeout`), que o
shell lê de `ERP_ZONA_TETO_MS`: **10 s** por padrão (decisão B1, 2026-09-23; antes do D7 era o
padrão fixo do Next, 30 s, observado 3 de 3). No teto, o próprio Next responde 500 cru; o
`rewrites()` não tem gancho para trocar essa resposta pela página da base, que vem com o
mecanismo de roteamento do C3. O teto conta **silêncio**, não duração: é o tempo do socket sem
nenhum byte, então uma resposta longa que segue mandando dados (streaming, download) não é
cortada. O SSE do C2 mora no shell e nem passa pelo proxy; uma resposta longa de zona convive
com o teto mandando algum byte em intervalo menor que ele, e a que precisar ficar mais tempo
calada vira pedido assíncrono. O teto tem de passar `ERP_DESTINO_TIMEOUT_MS` (o shell recusa
subir se não passar): senão uma página que espera um domínio lento seria cortada antes de
degradar. A verificação ponta a ponta (L9) sobe o shell com 6 s e confere a requisição solta
no teto.

Depois do intervalo, a requisição que dispara a sonda espera o timeout da
sonda, 800 ms (815 a 817 ms medidos), e recebe 503. O custo não é único: o cache vale 1 s a
partir do fim de cada sonda, então, enquanto a zona seguir travada, cada expiração abre uma
nova sonda, e toda requisição que chega durante ela espera o restante dessa sonda, até
800 ms. Num fluxo contínuo isso é cerca de 40% das requisições, com espera mediana de
454 ms entre as que esperam mais de 100 ms (175 de 443, uma a cada 20 ms durante 9 s, com
o cache e a sonda reais contra um destino que nunca responde)."""
    return s[:i]+new+s[j:]
rw('docs/desenho/mfe/01-operacao.md',f5)
# 6
def f6(s):
    for a,b in [("Zona travada segura a requisição ~0,6 s (timeout da sonda).","Zona travada segura a requisição ~0,6 s (timeout da sonda); a que já tinha passado pela sonda é solta no teto (`ERP_ZONA_TETO_MS`, 10 s) com o 500 cru do Next, até o C3 trazer a página (D7)."),
                ("zona 2 derrubada (503 em qualquer caixa, volta) e travada (503 em < 2 s);","zona 2 derrubada (503 em qualquer caixa, volta) e travada (503 em < 2 s; com a sonda ainda válida, solta no teto, L9);")]:
        assert s.count(a)==1; s=s.replace(a,b)
    return s
rw('docs/arquitetura/atual.md',f6)
# 7
def f7(s):
    i=s.index('## D7 —'); j=s.index('## D12 —')
    new="""## D7 — Zona travada: teto feito, página com o C3

- **Feito (2026-10-06):** o shell lê `ERP_ZONA_TETO_MS` (padrão 10 s, decisão B1) como `experimental.proxyTimeout`; a
  requisição que já passou pela sonda é solta no teto, não nos 30 s fixos do Next. Verificação L9.
- **Fica:** no teto, quem responde é o Next, com 500 cru; o `rewrites()` não tem gancho para a página da base
  (`proxy-request.js`, `onProxyError`). Escolha do humano (2026-10-06): a página dentro do teto vem com o mecanismo de
  roteamento do C3, para o caminho de toda requisição mudar uma vez só.
- **Fecha em:** C3.

"""
    return s[:i]+new+s[j:]
rw('.agents/orchestrator/DEFERRED.md',f7)
