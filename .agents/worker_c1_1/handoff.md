# Handoff worker_c1_1 (final)

Status: DONE. Mudança só em dado de teste (semente do stub) e em teste; nenhum código de produto tocado.

## Etapas
- [x] 0. Leitura: AMBIENTE, handoff e `mutacoes.txt` do auditor_c1_1, C1a–C1d, `repos/erp-zona-2/lib/fragmento-tarefas.ts`,
  semente e testes do stub.
- [x] 1. Semente `repos/erp-dominio-stub/dados/semente/dominio-c.json`: `t-3` (`Conferir "lote" <A&B>`, pendente, versão 1)
  e `t-4` (`Arquivar relatório antigo`, concluída, versão 2) no fim; `t-1` e `t-2` intactas. Stub: só
  `test/armazem.test.mjs:43` (`tarefas.length` 2 → 4). `pnpm test` 75/75.
- [x] 2. `base/verificacao/base.test.mjs`:
  - helper `tarefasDoBloco(html, quem)`: contém `Conferir &quot;lote&quot; &lt;A&amp;B&gt;` (forma exata do `escapar`),
    não contém `<A&B>` cru, não contém `Arquivar relatório antigo`;
  - C1a: aplicado ao fragmento direto de ana e eva; C1c: aplicado ao painel de ana (o SSR do React traz o HTML do
    fragmento literal, a mesma forma de entidade);
  - C1c, bruno e davi: `assert.doesNotMatch(s.html, /tarefa|zona 2/i)`.
  - Pendente real escolhida: `t-3`. `t-2` não é conferida (o C1 não depende da ordem dos testes nem do estado de `t-1`/`t-2`).
- [x] 3. Prova de dentes: `mutar.py` do auditor copiado para o scratchpad (log em `.agents/worker_c1_1/mutacoes.txt`,
  saídas em `saidas/`, padrão `--test-name-pattern='C1'`), cada mutação exatamente como no `mutacoes.txt` do auditor,
  restaurada com `git checkout`:
  - E-Z4 (escapar removido): PEGA — C1a e C1c, "pendente t-3 ausente ou sem escape" (ana, ana no painel);
  - E-Z4b (escapar sem `<`/`>`): PEGA — C1a e C1c, mesma mensagem;
  - E-Z6 (filtro removido): PEGA — C1a e C1c, "tarefa concluida no bloco de pendentes";
  - E-Z6b (filtro invertido): PEGA — C1a e C1c, "pendente t-3 ausente ou sem escape";
  - E-U1b (placeholder "Tarefas indisponíveis no momento."): PEGA — C1c, "bruno: rastro do bloco da zona 2 sem o modulo".
  - Estado original antes e depois (com `CONSTRUIR=1`, que refez os builds): C1 5/5 (inclui L2/V3/C1 pelo padrão).
- [x] 4. Regressão (estado original): `task test` 20 + 271 + 26 + 75 (stub) + 116 (shell), todos verdes;
  `task verificar` 123 = 119 + 4 pulados, 0 falhas; `task verificar:redis` 123/123; `task verificar:estatica` 51/51.
  Nenhum teste fora do C1 quebrou com as tarefas novas.
- [x] 5. Commits (enviados):
  - stub `b85540c` test(dominio-c): seed a pending task with a hostile title and a completed task (C1 gate veto)
    (só `dominio-c.json` e `armazem.test.mjs`; `pnpm-lock.yaml` local fica fora);
  - principal `ca0f4b6` test(c1): C1a and C1c check the escaped title, the completed task gone and no zone 2 trace for
    bruno and davi (C1 gate veto); stub pointer.

## Estado no fim
- Submódulos de produto (shell, zona 1, zona 2, núcleo) limpos; builds refeitos no estado original.
- Portas 3000–3003 e 4001–4120 livres; nenhum `next`/`servidor.mjs` vivo. Redis, Keycloak e Verdaccio não tocados.
- Principal fora de commit, de propósito: docs do humano, `m` de `erp-dominio-stub` (só o lockfile local) e de
  `erp-moldura`, e esta pasta. Saídas sem JWT (conferido com grep).
