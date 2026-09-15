# Retomada — atualizado em 2026-09-15

Leia este arquivo primeiro. Depois `BRIEFING.md` (estado persistente), `GATE_STATUS.md`
(vereditos por rodada) e `DEFERRED.md` (o que foi deliberadamente adiado, com evidência).

**Revisão de 2026-09-15 (prioridade):** `docs/revisao/2026-09-15-revisao-base-generica.md` — o objetivo passou a ser validar uma base BFF + Multi-Zones genérica (shell, zona 1, zona 2, gestão de acesso). Task 8 pausada até as decisões D1–D9.

**Manutenção:** `MANUTENCAO-GITLAB.md` diz quando avisar o humano para atualizar ou criar
atividades no GitLab. Cheque os gatilhos ao fim de cada gate, task ou decisão do humano.

## 0. Estado atual (sobrepõe as seções 1–4, que ficam como histórico da parada de 2026-09-12)

Atualizado em 2026-09-15.

| Item | Estado |
|---|---|
| E2E, M1 | ✅ |
| M2 + M3 + D2 | ✅ gate final combinado: iteração 4 APROVADA (V1 e V2 sanados, 98 unit tests + 7 static + builds limpos) |
| Funcionalidades base da PoC | ✅ religadas na zona em `d128dff` (abas por query, rota `/mapa/[cidade]`, SSE, mapa); V1 e V2 corrigidos |
| Documentação | ✅ `README.md`, `docs/arquitetura/atual.md`, `docs/arquitetura/alvo.md`, `docs/ROTEIRO-DE-VERIFICACAO.md`, `O que falta para finalizar a arquitetura.md` |
| @erp/nucleo | ✅ Task 5 fix implementado, 32/32 testes passando, publicado no Verdaccio local |

Próximo passo: push do branch `bff-multizone` para o `fork`, e dar andamento às tarefas 6 a 11 do `@erp/nucleo` e Rodada 1. Decisões do humano em 2026-09-15: priorizar base funcionando e testável; alternar modelos; pedidos de pesquisa em `pedidos/`; documentação em português com diagramas atual × alvo.

---|---|
| E2E | ✅ |
| M1 | ✅ |
| M2 | iterações 4 e 5 reprovadas e corrigidas (`59507e4`, `94ccdc2`, `bda529a`); aguarda o gate final |
| M3 | worker concluído (`38a204c`, `2088139`, `c930a08`); aguarda o gate final |
| D2 | implementado pelo Gabriel em `packages/shell-ui`, mesclado em `90e8319`; aguarda o gate final |

Próximo passo: gate final combinado (M2 it. 6 + M3 + D2) sobre `90e8319`, tríade nova
(`reviewer_final_1`, `challenger_final_1`, `auditor_final_1`). Depois: D3, D1/D7 (Rodada 2).

O `pnpm` 11 roda a verificação de dependências antes de scripts e cria sozinho os symlinks de
workspace (`apps/*/node_modules/@mfe/shell-ui`); o lockfile não muda.

---

## 1. Onde parou

O trabalho vinha do harness do Gabriel (`.agents/`), retomado como geração 2 a partir do
commit `355111e` ("WIP: boa sorte wilson").

| Milestone | Estado |
|---|---|
| E2E (infra de teste) | ✅ feita na geração 1 |
| M1 — zona `apps/remote-app` (R1, R2, R5) | ✅ passou no gate na geração 1 |
| M2 — shell `apps/host` (R3, R4) | ⏸ **três iterações de gate, a última reprovada; correção não despachada** |
| M3 — purga do workspace e E2E final (R6) | não iniciada |

**O ponto exato da parada:** o `worker_m2_fix2` (rodada de correção 2/5) tinha sido
despachado para a iteração 4 e foi **interrompido antes de escrever qualquer arquivo**.
A árvore está no estado do commit `8b7f663`, que é exatamente o que a iteração 3 verificou.

## 2. Histórico do gate do M2

| Iteração | Revisor | Challenger | Auditor | Resultado |
|---|---|---|---|---|
| 1 (geração 1) | — | — | — | sem veredito: os 5 verificadores morreram sem handoff |
| 2 | APPROVE | REQUEST_CHANGES | CLEAN | **FAIL** — F1: zona fora do ar devolvia 500 cru |
| 3 | APPROVE | APPROVE | **INTEGRITY VIOLATION** | **FAIL** — veto binário: os testes não protegem a correção |

A F1 foi corrigida e funciona: middleware consulta uma sonda de vivacidade com cache e
responde 503 com `Retry-After` e a página `/erro-de-zona`. Verificado ao vivo em regime,
cache frio, três ciclos de oscilação, 30 requisições concorrentes e recuperação.

O que reprovou a iteração 3 foi a **qualidade da prova, não o mecanismo**. O auditor mutou
a implementação de cinco formas e **quatro passaram com 27/27 verdes**, inclusive reverter
para o 500 cru — porque os testes fazem regex sobre o texto do arquivo, e as strings `503`
e `Retry-After` continuam no comentário de documentação acima do código revertido. O teste
de sincronia de texto casa com um import que ninguém usa.

## 3. O que o worker interrompido ia fazer (iteração 4)

Três tarefas. A primeira é o veto e é obrigatória.

**Tarefa 1 — tornar os testes comportamentais.** O `middleware.ts` não pode ser importado
sob `node --test` porque `next/server` não resolve fora do bundler do Next. Por isso a
solução é reestruturar, não testar texto:
- extrair a decisão para um módulo puro e importável: dado o veredito de vivacidade e o
  caminho, devolve "passa adiante" ou a resposta de erro completa (status, cabeçalhos, corpo);
- extrair a lista de caminhos do matcher para um módulo que middleware e testes importam,
  de modo que os caminhos sejam dado, não alvo de regex;
- `middleware.ts` vira adaptador fino sobre `NextResponse`, com comportamento idêntico;
- reescrever os testes sobre essas funções reais e declarar no handoff que resíduo textual
  sobrou e por quê.

**Critério de aceitação:** numa cópia de trabalho, aplicar uma a uma as cinco mutações
abaixo e mostrar cada uma reprovando. Todas as cinco têm de reprovar.
1. remover uma entrada do matcher (hoje é a única que reprova);
2. inverter o ramo saudável/indisponível;
3. tornar o TTL de produção efetivamente infinito;
4. voltar ao 500 cru sem cabeçalhos — o defeito original da F1;
5. fazer o texto da página divergir do texto do fallback do middleware.

**Tarefa 2 — reduzir a janela de obsolescência.** Decisão do humano: TTL de 3 s para **1 s**,
medindo a sobrecarga real da sonda com a zona no ar, e mantendo o valor numa constante
nomeada. O challenger mediu, com TTL de 3 s, **120 requisições em 2,96 s** recebendo o
defeito original quando a zona cai logo após uma sonda bem-sucedida. Cache frio não é
afetado: cache vazio força sonda síncrona.

**Tarefa 3 — corrigir o documento de desenho.** O humano aprovou editar
`docs/design-bff/mfe/01-operacao.md` §5.1, que hoje promete `/erro-de-zona` sem ressalva.
Acrescentar que a garantia vale em regime, com exceção limitada pelo TTL logo após a queda,
citando a medição e a nova janela — medida, não extrapolada. Não tocar em outras seções.

### Pista deixada pelo worker antes de parar

A instrução que ele recebeu mandava extrair a decisão para um módulo puro, porque
`next/server` não resolve sob `node --test`. Momentos antes de ser interrompido ele estava
indo por um caminho melhor: usar o **mock de módulos embutido do `node:test`** para simular
`next/server` e assim importar o `middleware.ts` de verdade, em vez de checar o texto do
arquivo. Se funcionar, prova o comportamento real do middleware e dispensa a reestruturação
como pré-requisito. Vale tentar isso primeiro; a extração continua valendo como plano B, e
de toda forma o critério de aceitação são as cinco mutações reprovando.

## 4. Depois disso

1. Reabrir o gate do M2 com tríade nova (revisor, challenger, auditor). A regra do harness é
   nunca reusar agente que já entregou handoff.
2. **M3 — R6**, ainda não iniciada:
   - purgar `pnpm-workspace.yaml` e `.npmrc` das sobras de Federation (`allowBuilds`,
     `onlyBuiltDependencies`, `overrides`);
   - trocar os scripts `"test": "npx tsx --test test/*.test.ts"` dos dois apps por
     `node --test test/*.test.ts` — o `tsx` não está em nenhum package.json nem no lockfile,
     então hoje `pnpm test` tenta baixar pacote não fixado;
   - fechar o **D4**: o STATIC-06 em `test/e2e/static-invariants.mjs` é vazio, reporta PASS
     mesmo sem a regra raiz de rewrite;
   - fechar o **D5**: `apps/host/tsconfig.tsbuildinfo` reaparece a cada build e não está no
     `.gitignore`;
   - E2E completo com os dois apps de pé e auditoria de vitória.
3. **Rodada 2**, fora do escopo da migração: D2 (a zona não tem a moldura do host) e D3
   (herança de sessão entre zonas não funciona). Decisão do humano: depois do M3.

## 5. Ambiente — o que difere da geração 1

- `rtk` não existe nesta máquina. Comandos rodam sem prefixo. Node v24.7.0, pnpm 11.22.0.
- `tsx` não está instalado e buscá-lo foi recusado. Testes rodam com
  `node --test test/*.test.ts`, sempre com glob explícito: no Node 24.7, `node --test <dir>`
  roda zero testes e sai com código 0.
- Servidores de longa duração são do controlador, não dos subagentes.
- Só um agente por vez pode buildar ou usar as portas 3000/3001.
- Não commitar `apps/host/tsconfig.tsbuildinfo` (é o D5).
- Os arquivos da geração 1 citam `/home/gabrigas/Selene/Adventure/nextjs-mfe`; a raiz real
  aqui é `/home/wilson-castro/Documents/projects/mira/nextjs-mfe`.
- Mensagens de commit terminam no conteúdo, sem rodapé de coautoria.

## 6. Lição desta execução

O auditor forense pagou a própria conta. Revisor e challenger aprovaram a iteração 3, e os
dois estavam certos sobre o mecanismo — ele funciona em todas as condições testadas ao vivo.
Quem viu que a prova era falsa foi a mutação: sem ela, uma reversão silenciosa ao defeito
original passaria no CI em verde. Vale manter a exigência de falsificação em toda rodada de
correção, como o ledger da fatia 1 já fazia.
