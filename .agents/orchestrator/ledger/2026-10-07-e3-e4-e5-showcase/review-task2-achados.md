# Achados da revisao da Task 2 (final)

Veredito: spec atendida, com ressalvas. Qualidade: Needs fixes (um Important).

- Important: `remover` ignora o status do DELETE (zona-demo.mjs:29, 46). Resposta 500/401 deixa a rota e o terminal diz "Rota removida".
- Minor: SIGHUP nao tratado; texto de saida nao diz "TTL"; passo 2 manda "esperar o mapa reler" apos derrubar (queda e imediata); TTL default 30000 duplicado no script; fluxo nao conferido via `task` (stdin).
- (a) Ctrl-C duplo: guarda `saindo` correta, finally em remover correto; unico furo e o status do DELETE.
- (b) voltar apos derrubar: sem corrida (close(ok) espera o fim; observado imediato).
- (c) registro usa `svc.demo` (id da zona), nao credencial do shell. OK.
- Nenhum supportId prometido no texto. Sem travessao, middot, seta, vezes.
