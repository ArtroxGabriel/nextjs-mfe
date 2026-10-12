# Retomada: gate local do P1 aprovado em 2026-10-12

**Gate local do P1 aprovado na iteração 4** (auditor_p1_4, PASS), tag local `gate-p1-local-aprovado`. P1 operacional segue aberto.

## Como foi executado

Desde 2026-10-12 o trabalho é despachado para o Codex local (`codex exec`, sandbox `workspace-write`); o orquestrador aplica os textos e commita o principal, porque `.git/` e `.agents/` do principal são somente leitura na sandbox do Codex. Não tocar `~/Documents/sisbin-planejamento-local` nem seus processos.

## Gate do P1

| Iteração | Revisor | Challenger | Auditor | Correção |
|---|---|---|---|---|
| 2 | REPROVA (dist órfão no tarball; sondas versionadas) | REPROVA (SIGINT deixa auth.ini; redirect de tarball) | não rodou | dde6957 |
| 3 | APROVA | APROVA (42 cenários, 5 subidas do shell) | VETO só por teste (A02, A09, A10) | 20e9d13 |
| 4 | regra do veto só por teste | idem | PASS (826 pass, 0 fail, 6 skip; lockstep verde) | nenhuma |

Handoffs em `.agents/{revisor,challenger,auditor}_p1_{2,3,4}` e `.agents/worker_p1_4`. Limite declarado: D34 (pnpm segue redirect de tarball sem enviar token; integridade protege os bytes).

## Pendências

1. **Envio:** commits locais não enviados. Ordem: `erp-nucleo` (df5b0f4) e `erp-shell` (bd51363) antes do principal. Aguarda confirmação do humano.
2. **P1 operacional:** registro oficial com política de imutabilidade, migração dos tarballs canônicos sem trocar bytes, reconciliação das integridades e uma execução verde do CI remoto. Precisa de endereço e credenciais do humano.
3. Lockfiles soltos de `erp-moldura` e `erp-dominio-stub`: fora de commit; reconciliar só com o registro canônico.
4. Processos órfãos de teste de uma sessão anterior do Codex (PIDs 21265 e 21272): encerrar pelo humano.
5. Depois do P1: G5 e G4, na ordem encaminhada.
