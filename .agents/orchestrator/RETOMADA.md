# Retomada: G5 em planejamento (2026-10-13)

**Retomado em 2026-10-13 a pedido do humano ("avalie o processo e continue").** Gate local do P1 aprovado em 2026-10-12; envio feito; P1 operacional segue esperando o humano. **Foco na entrega (2026-10-13: "não se perder do plano").** O objetivo da base foi atingido em 2026-10-07 (F1 a F7 no showcase, tag `gate-e3e5-aprovado`). G5, G4, C2, B2 e a Lista 2 ficam depois da entrega e não começam sem decisão. O plano do G5 está engavetado em `docs/superpowers/plans/2026-10-13-g5-revogacao-ativa.md`, com o recorte no topo.

**Desvio achado no planejamento do G5:** `concluirLogin` (`erp-nucleo/src/fabricas/criarNucleo.ts`) grava a sessão sem consultar `/v2/eu`, embora o ADR-0014, adendo 1, item 8, diga que o retorno do login consulta e recusa `401`. Pessoa desligada consegue sessão nova; a página seguinte nega pela camada 2 e o domínio decide, então não vaza dado, mas o código diverge do ADR.

**O que falta para entregar (atualizado 2026-10-13 noite):** (1) ~~fechar #9, #10 e #19~~ feito: GitLab #120, #121, #132, #135 e #136 fechadas; (2) desvio do login corrigido no núcleo 0.10.5 (`.agents/worker_login_1/handoff.md`), **falta o gate**; (3) P1 preparado para o registro do GitLab, inativo (`.agents/worker_gitlab_1/handoff.md`); a ativação depende do humano: espelhos dos repositórios na instância, projeto do registro, tokens e variáveis.

**Lição do Codex nesta rodada:** entrega código bom, mas declara pronto sem rodar a prova que importa (OIDC nunca rodou; teste unitário contradizia a prova com pnpm). O orquestrador roda as suítes ponta a ponta e as mutações antes de aceitar. `codex exec resume` não herda `-s` nem `--add-dir`: repassar as opções na retomada.

**Sessão vizinha ativa** em `~/Documents/sisbin-planejamento-local` (Claude + Codex, padrão de erros): regras de isolamento em `AMBIENTE.md`, última seção.

## Avaliação do processo (2026-10-13)

- **Evidência no scratchpad se perde:** o GATE_STATUS e o ATIVIDADES apontavam para o scratchpad apagado do worker_p1_3. Regra prática: o resumo e as contagens entram no handoff versionado em `.agents/<nome>/` antes de apagar o scratchpad; nunca citar caminho de `/tmp` em documento versionado.
- **Tabela de mutações estreita:** o worker pegou M1 a M14, mas o auditor achou A02, A09 e A10 fora da tabela (ambiente herdado por filho, rechecagem antes de efeito, casamento exato de host). O plano do G5 declara também mutações de fronteira.
- **Pastas de gates fechados ainda na raiz de `.agents/`:** removidas pelo humano em 2026-10-13 (`*_p1_1` a `*_p1_3`, `seguranca_2026-09-22`; o auto mode recusa `git rm`); estão na tag `historico-2026-10-13`. `challenger_c3_1` só tinha um log ignorado pelo git.
- **Documentos de retomada defasados** (topo do ATIVIDADES em 2026-10-09, CODEX.md dizendo gate não aprovado): corrigidos.

**Gate local do P1 aprovado na iteração 4** (auditor_p1_4, PASS), tag local `gate-p1-local-aprovado`. P1 operacional segue aberto.

## Como foi executado

Desde 2026-10-12 o trabalho é despachado para o Codex local (`codex exec`, sandbox `workspace-write`); o orquestrador aplica os textos e commita o principal, porque `.git/` e `.agents/` do principal são somente leitura na sandbox do Codex. Não tocar `~/Documents/sisbin-planejamento-local` nem seus processos.

## Gate do P1

| Iteração | Revisor | Challenger | Auditor | Correção |
|---|---|---|---|---|
| 2 | REPROVA (dist órfão no tarball; sondas versionadas) | REPROVA (SIGINT deixa auth.ini; redirect de tarball) | não rodou | dde6957 |
| 3 | APROVA | APROVA (42 cenários, 5 subidas do shell) | VETO só por teste (A02, A09, A10) | 20e9d13 |
| 4 | regra do veto só por teste | idem | PASS (826 pass, 0 fail, 6 skip; lockstep verde) | nenhuma |

Handoffs em `.agents/auditor_p1_4` e `.agents/worker_p1_4`; os das iterações 1 a 3 estão na tag `historico-2026-10-13`. Limite declarado: D34 (pnpm segue redirect de tarball sem enviar token; integridade protege os bytes).

## Pendências

1. **Envio:** feito pelo humano em 2026-10-13 (`erp-nucleo` df5b0f4, `erp-shell` bd51363, principal 0f51c79; `pre-push` com submódulos e lockstep verdes).
2. **P1 operacional:** registro oficial com política de imutabilidade, migração dos tarballs canônicos sem trocar bytes, reconciliação das integridades e uma execução verde do CI remoto. Precisa de endereço e credenciais do humano.
3. Lockfiles soltos de `erp-moldura` e `erp-dominio-stub`: fora de commit; reconciliar só com o registro canônico.
4. Diretórios temporários de teste em `/tmp` (`espera-*`, `fronteira-*`, `tx-*`, `erp-sessoes-*`, `app-*` e afins) não foram apagados: o projeto vizinho roda testes com os mesmos prefixos e não dá para atribuir a origem com segurança.
5. Depois do P1: G5 e G4, na ordem encaminhada.
