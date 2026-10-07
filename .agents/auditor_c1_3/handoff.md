# Handoff auditor_c1_3 (final)

## Veredito: PASS

As 5 do veto da iteração 2 estão pegas pela asserção nova (V-U1c, V-U1d, V-U1f, E-U1b pela estrutural do C1c; V-Z4e pelo
`<li>` do `tarefasDoBloco`, no C1a e no C1c); o controle V-U1h segue verde. Variantes da classe: 10 pegas; 4 vivas, todas
contorno deliberado (A2), com limite declarado abaixo. Regressão por família 18/18 pegas; regressão completa verde com os
números esperados. Uma observação de fragilidade (F-3: vermelho falso, não verde falso), que não é veto.

Iteração 3 do gate do C1 (veto só por teste: só auditor). Estado sob teste: principal a95aade (correção 103c656),
stub b85540c, shell 836ddc4, zona 1 39c4b76, zona 2 1626fd1, núcleo 610217d (0.10.3).

## Etapas
1. [x] Só teste: fora de `.agents/`, `ca0f4b6..103c656` mexe só em `base/verificacao/base.test.mjs` (+29 −1: helper
   `elementosDoPainel` + `deepEqual` no C1c para bruno/davi; `<li>${T3_ESCAPADO}</li>` no `tarefasDoBloco`). Nenhum ponteiro
   de submódulo mudou (stub b85540c, shell 836ddc4, zona 1 39c4b76, zona 2 1626fd1, núcleo 610217d). Linha de base C1 com
   `CONSTRUIR=1`: 5/5 (`saidas/base-c1.txt`).
2. [x] Veto reaplicado (mesmas entradas do `veto.json`/`variantes.json` do auditor_c1_2), as 5 PEGAS pela asserção nova:
   - V-U1c, V-U1d, E-U1b: C1c, "bruno: elemento no lugar do bloco da zona 2 (invariante 8)" (diff `+ 'p'`);
   - V-U1f: C1c, mesma mensagem (diff `+ 'section:pendencias'`);
   - V-Z4e: C1a e C1c, "ana: pendente t-3 ausente, sem escape ou fora de <li>" / "ana no painel: …".
   - V-U1h (controle equivalente): VERDE, 5/5.
3. [x] Variantes (14) e controles de falso positivo (4), `variantes.json`:
   - PEGAS pela estrutural ("bruno: elemento no lugar do bloco da zona 2"): X-T1 `<template>`, X-T2 `<p hidden>`, X-T3
     `<span aria-hidden>—`, X-T4 `<div>` só com comentário HTML, X-T5 texto solto (`texto:Bloco indisponível…`), X-T6 link
     "Abrir as tarefas" isolado, X-T7 link neutro `<p><a href="/zona2">Abrir</a></p>`, X-T8 `<hr />`.
   - PEGAS pela guarda de texto ("rastro do bloco da zona 2 sem o modulo"): X-S2 "Tarefas indisponíveis" dentro da seção de
     recursos; X-L2 o mesmo texto no layout, fora do `<main>`, condicionado ao módulo zona2.
   - VIVAS, conferidas ao vivo (bruno e davi recebem o placeholder; `saidas/sonda-X-*.txt`): X-S1 "Bloco indisponível…"
     dentro da seção de recursos; X-S3 `<p>—</p>` dentro da seção de indicadores; X-L1 "Bloco indisponível…" no layout,
     fora do `<main>`; X-H1 " (bloco indisponível)" dentro do `<h1>`. CONTORNO deliberado (A2): precisam de lugar alheio
     ao bloco (seção de outro domínio, layout, título) E de texto que não nomeia o bloco; o lugar natural (nível 0 do
     `<main>`) é pego com qualquer texto, e os lugares alheios com texto natural são pegos pela guarda de texto.
     Limite declarado: a estrutural cobre só o nível 0 do `<main>`; dentro das seções da zona 1 e fora do `<main>`, só a
     guarda de texto.
   - Controles: F-1 (atributo novo na seção de recursos), F-2 (texto do h2 de indicadores), F-4 (`<br />` aninhado):
     VERDES. F-3 (`title` no link de relatórios, mudança inocente): REPROVA — o `p:relatorios` é reconhecido pela string
     exata `<a href="/zona1/relatorios">Relatórios</a></p>` e qualquer atributo no link vira `'p'`. Dá vermelho, não
     falso verde: OBSERVAÇÃO, não veto. Sugestão: reconhecer pelo `href` (`/^<a href="\/zona1\/relatorios"/`). O link
     atual (bruno com, davi sem) já passa (linha de base 5/5). Fragilidade declarada no comentário: bloco novo legítimo
     no painel exige atualizar a lista; e a lista supõe o domínio A de pé (o botão só existe com recursos).
4. [x] Regressão por família: 18 de 18 PEGAS (`familias.json`, entradas copiadas do auditor_c1_2): guarda do shell (R-S1,
   R-S2 na unidade do shell; R-E-S1, R-E-P3 no C1b), `exigirModulo` (R-E-Z1: C1a e C1c; R-E-Z2: C1a), chave `pendentes`
   (R-E-Z3: C1a), `<script>` no bloco (R-E-Z5: C1a, C1c, C1d), cookie não repassado (R-E-U2: C1c, C1d), `ZONA2_URL` fora
   da lista (R-T-A5: V1), `fetch` direto/N8 (R-T-U4, R-T-U4b), escape (E-Z4, E-Z4b, V-Z4c: C1a e C1c), filtro de
   pendentes (E-Z6, E-Z6b, V-Z6c: C1a e C1c).
5. [x] Regressão completa no estado original, depois de `CONSTRUIR=tudo` (C1 5/5, `saidas/reg-c1-tudo.txt`):
   `task test` 20 + 271 + 26 + 75 (stub) + 116 (shell), 0 falhas; `task verificar` 123 = 119 + 4 pulados, 0 falhas;
   `task verificar:redis` 123/123; `task verificar:estatica` 51/51 (`saidas/reg-*.txt`).
6. [x] Restauração: toda mutação restaurada por `git checkout` (o `mutar.py` e o `sondar.py` restauram no `finally`).
   `git status --short` vazio em shell, zona 1, zona 2, núcleo, contratos e zona de acesso; stub só com `pnpm-lock.yaml`
   local; moldura também só com o `pnpm-lock.yaml` local, que já estava assim no início (o worker_c1_2 também o
   registrou). Principal só com os docs do humano, os `m` desses dois submódulos e esta pasta. Builds refeitos no estado
   original (`CONSTRUIR=tudo`, C1 5/5) e nenhuma mutação depois disso. Base derrubada; portas 3000–3003 e 4001–4120
   livres; nenhum `next-server` nem `servidor.mjs`; Redis, Keycloak e Verdaccio de pé e intocados. Nenhum JWT nem cookie
   nas saídas (grep). Sem commit.

Totais: 42 aplicações (6 do veto com o controle, 18 variantes/controles, 18 de família): 33 reprovaram como esperado
(5 veto, 10 variantes, 18 família) mais 1 vermelho falso (F-3); verdes: V-U1h, F-1, F-2, F-4 (controles) e 4 contornos.

Arquivos: `mutacoes.txt` (repositório, arquivo:linha, antes/depois, comando, resultado; e a nota [SONDA]); `mutar.py`
(cópia do do auditor_c1_2 com LOG/SAIDAS desta pasta); `gerar.py` → `veto.json`, `variantes.json`, `familias.json`;
`sonda.mjs` + `sondar.py` (aplicam uma variante e mostram o `<main>` de bruno e davi e o que vem depois dele); `saidas/`.
