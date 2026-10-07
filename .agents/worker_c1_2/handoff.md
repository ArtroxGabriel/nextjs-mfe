# Handoff worker_c1_2 (final)

Status: DONE. Mudança só em `base/verificacao/base.test.mjs`; produto e semente do stub intocados.
Commit `103c656` test(c1): C1c proves nothing stands in for the missing zone 2 block for bruno and davi, and the escaped title sits in an li (C1 gate veto, iteration 2) — enviado.

## Etapas
- [x] 1. Leitura (AMBIENTE, auditor_c1_2, worker_c1_1, C1a–C1d, `page.tsx`, `fragmento-tarefas.ts`). Sonda
  `sonda-main.mjs` (saída `saidas/sonda-main.txt`): `<main>` do painel. bruno: h1, p(relatórios), section indicadores,
  section recursos, button; davi: o mesmo sem o link de relatórios; ana: com `<div>` do fragmento antes do botão.
- [x] 2. Teste:
  - forma escolhida para a classe placeholder: helper `elementosDoPainel(html)` lista os elementos de primeiro nível do `<main>`
    (sem comentários do React; texto solto no nível 0 também entra, como `texto:…`; sections com o `aria-labelledby`).
    No C1c, para bruno e davi, `deepEqual` com `['h1','section:indicadores','section:recursos','button']` (o
    `p:relatorios` sai do filtro porque depende do usuário). Fica antes da checagem por texto `/tarefa|zona 2/i`,
    que segue como segunda guarda. Pega qualquer elemento ou texto em qualquer posição do painel, não só depois dos recursos;
    mudança de atributo ou de conteúdo interno não o quebra; um bloco novo legítimo exige atualizar a lista (dito no comentário).
    Preferida à proposta `</section>` + `<button>` porque não depende do vizinho exato.
  - `tarefasDoBloco`: exige `<li>${T3_ESCAPADO}</li>`.
- [x] 3. Linha de base (código original, `CONSTRUIR=1`): C1 5/5 (`saidas/base-c1.txt`).
- [x] 4. Prova de dentes (`mutar.py` do auditor_c1_2, com LOG e SAIDAS apontados para cá; log em `mutacoes.txt`, restauração por `git checkout`):
  - V-U1c: PEGA — C1c "bruno: elemento no lugar do bloco da zona 2 (invariante 8)" (diff mostra `+ 'p'`);
  - V-U1d: PEGA — C1c, mesma mensagem;
  - V-U1f: PEGA — C1c, mesma mensagem (`section:pendencias`);
  - V-Z4e: PEGA — C1a e C1c, "ana: pendente t-3 ausente, sem escape ou fora de <li>" e "ana no painel: …";
  - E-U1b: PEGA — na primeira rodada caiu na checagem de texto antiga, que vinha antes. Movi a checagem estrutural
    para antes dela, rodei de novo, e caiu pela nova: "bruno: elemento no lugar do bloco da zona 2 (invariante 8)";
  - V-U1h (controle): VERDE, 5/5 (rodado depois da reordenação também).
- [x] 5. Regressão no estado original (`CONSTRUIR=tudo` no C1 refez todos os builds): C1 5/5; `task verificar` 123 =
  119 + 4 pulados, 0 falhas; `task verificar:redis` 123/123; `task verificar:estatica` 51/51 (`saidas/reg-*.txt`).
- [x] 6. Commit `103c656` (só `base.test.mjs`, +29 −1) e push.

## Estado no fim
- shell, zona 1, zona 2 e núcleo limpos; os builds são do estado original (nenhuma mutação depois do `CONSTRUIR=tudo`).
- Portas 3000–3003 e 4001–4120 livres; nenhum `next-server`/`servidor.mjs`. Redis, Keycloak e Verdaccio de pé, intocados.
- Ficam fora do commit, de propósito: docs do humano, `m` de `erp-dominio-stub` e de `erp-moldura`, e as pastas `.agents/`. Saídas sem JWT nem cookie.
