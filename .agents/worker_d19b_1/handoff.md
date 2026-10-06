# Handoff worker_d19b_1 (final)

Atende ao veto do auditor_d19b_1 (A10) e às lacunas A10c, A10d e à observação B11. **Só testes; nenhum código de produto mudou**
(`git diff` de cada submódulo só em `test/`; `src/` e o `dist` instalado no shell restaurados e conferidos com `cmp`/sha256).

## Testes adicionados
- `repos/erp-nucleo/test/identidade.test.mjs`
  - `:749` `leitorQueFalha` (leitor que lança a partir da N-ésima leitura) e `:763` `MOMENTOS_DA_FALHA`.
  - `:772` 9 testes (memória, arquivo, Redis falso × antes do lock / releitura com o lock na mão / espera do perdedor com
    lock de outro dono): token vencido, o store lança → `renovarSessao` rejeita com o erro do store (nunca `ausente` nem
    `revogada`), sem esperar o teto (< 1 s), sem chamar o IdP, sessão intacta no store. `timeout: 10_000` e `ESPERA_CURTA`.
  - `:681-705` B11 no teste de configuração existente: `''` em `ERP_RENOVACAO_ESPERA_MS`/`_PASSO_MS` é aceito e vale o padrão
    (com `lockDe(2)`, `''` é recusado como o padrão 2000; com espera 50, passo `''` é recusado como o padrão 50).
- `repos/erp-shell/test/proxy-renovacao.test.mjs`
  - `:175` 6 testes (memória, Redis falso × os três momentos), um store novo por caminho (`/zona1` e `/`): store que lança
    dentro de `renovarSessao` com token vencido → `prosseguir` sem `limparSessao`, leitura que falha = a do momento pedido,
    sem IdP, sessão intacta. `timeout: 10_000`.

## B11
O comportamento atual é `''` = padrão (não "recusar": é a mutação B11 que passa a recusar). `docs/CONFIGURACAO.md` não fala
de vazio, mas dá o padrão 2000/50 e `lerNumeroPositivo` já trata `''` como ausente; travei o comportamento atual. Produto inalterado.

## Provas (mutação aplicada → suíte inteira → restaurada)
Núcleo (`src/fabricas/criarNucleo.ts`, `pnpm build` + `node --conditions react-server --test test/*.test.mjs`):
- A10 (`valida(id).catch(() => null)` na espera): REPROVA 268/271, falham só os 3 "durante a espera do perdedor (A10)".
- A10c (leitura antes do lock): REPROVA 268/271, só os 3 "antes do lock (A10c)".
- A10d (releitura com o lock): REPROVA 268/271, só os 3 "na releitura com o lock na mao (A10d)".
- B11 (`src/interno/configuracao.ts`, `if (valor === undefined) return padrao`): REPROVA 270/271 ("padrao, teto e recusa na criacao").
Shell (mutação no `dist/fabricas/criarNucleo.js` do @erp/nucleo 0.10.3 instalado no shell; sha256 `815631ad…` igual antes e depois):
- A10: REPROVA 106/108 (os 2 "durante a espera do perdedor"). A10c: 106/108 ("antes do lock"). A10d: 106/108 ("na releitura").
- A10e (`lib/decisao-proxy.ts`, catch com `limparSessao: true`): REPROVA 100/108 (os 6 novos + os 2 de erro do IdP).
Depois de restaurar: todas passam.

Nota: os testes novos do núcleo também reprovam A10b (conferido: 268/271, os 3 "durante a espera") (o erro engolido até o teto), que o auditor classificou como equivalente
no efeito. O contrato que eles fixam é "erro do store propaga sem esperar o teto"; se o orquestrador preferir aceitar A10b,
basta tirar a asserção de tempo e a de `instanceof Error` vira "não é ausente nem revogada".

## Suítes (finais, código de produto limpo)
- `cd repos/erp-nucleo && pnpm test`: 271/271 (antes 262; +9).
- `cd repos/erp-shell && pnpm test`: 108/108 (antes 102; +6).

## Commits e push
- erp-nucleo `610217d` test(d19b): store error in any read of renovarSessao rejects, never ausente (A10, A10c, A10d, B11) — push feito (`fdea296..610217d master`).
- erp-shell `0a3131d` test(d19b): store error inside renovarSessao with an expired token proceeds without clearing the cookie — push feito (`72ecc2f..0a3131d master`).
- Repositório principal e ponteiros de submódulo NÃO tocados (fica com o orquestrador). Nada publicado no Verdaccio; nada instalado.
