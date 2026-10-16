# Retomada: G5 implementado (2026-10-16)

**Atualizado em 2026-10-16.** Gate local do P1 aprovado em 2026-10-12; P1 operacional e envio seguem esperando o humano. O **G5 (revogação ativa de sessão por `/v2/eventos`)** foi implementado conforme `docs/superpowers/plans/2026-10-13-g5-revogacao-ativa.md` (ADR-0014, decisão 5 e adendo 3):
- `erp-dominio-stub`: `GET /v2/eventos` restrito a `Bearer svc.shell` (inclusive em modo JWT via `ROTA_DE_SERVICO`, `404` para outros tokens e `401` sem credencial), cursor `desde` validado (`422 CURSOR_INVALIDO`), e `sujeitos: [sub, login]` nos eventos que atingem uma pessoa, sem expor CPF (6/6 mutações mortas).
- `@erp/nucleo` `0.10.5` (lockstep nas 4 apps): `EscritorDeSessao.removerPorSujeito(sub)` e `nucleo.sessao.removerSessoesDoSujeito(sub)` em `@erp/nucleo/shell`, com índice `erp:sujeito:<sha256(sub)>` no Redis fora de `erp:sessao:*` (7/7 mutações mortas).
- `erp-shell`: destino `eventos-acesso`, `lib/revogacao-ativa.ts` (revoga sessões em `PESSOA_DESLIGADA` e `PESSOA_SUSPENSA`, avança cursor em `ACESSO_REVOGADO` sem derrubar a sessão, single-flight + lock `erp:eventos:lock` e cursor `erp:eventos:cursor` no Redis), integrado em `decidirAcaoDoProxy` e `proxy.ts` (9/9 mutações mortas).

**Sessão vizinha ativa** em `~/Documents/sisbin-planejamento-local` (Claude + Codex, padrão de erros): regras de isolamento em `AMBIENTE.md`, última seção.

## Avaliação do processo (2026-10-13)

- **Evidência no scratchpad se perde:** o GATE_STATUS e o ATIVIDADES apontavam para o scratchpad apagado do worker_p1_3. Regra prática: o resumo e as contagens entram no handoff versionado em `.agents/<nome>/` antes de apagar o scratchpad; nunca citar caminho de `/tmp` em documento versionado.
- **Tabela de mutações estreita:** o worker pegou M1 a M14, mas o auditor achou A02, A09 e A10 fora da tabela (ambiente herdado por filho, rechecagem antes de efeito, casamento exato de host). O plano do G5 declara também mutações de fronteira.
- **Pastas de gates fechados ainda na raiz de `.agents/`:** removidas pelo humano em 2026-10-13 (`*_p1_1` a `*_p1_3`, `seguranca_2026-09-22`; o auto mode recusa `git rm`); estão na tag `historico-2026-10-13`. `challenger_c3_1` só tinha um log ignorado pelo git.
- **Documentos de retomada defasados** (topo do ATIVIDADES em 2026-10-09, CODEX.md dizendo gate não aprovado): corrigidos.

**Gate local do P1 aprovado na iteração 4** (auditor_p1_4, PASS), tag local `gate-p1-local-aprovado`. P1 operacional segue aberto.

## Como foi executado

Desde 2026-10-12 o trabalho é despachado para o Codex local (`codex exec`, sandbox `workspace-write`) ou executado diretamente pelo agente principal; nunca tocar `~/Documents/sisbin-planejamento-local` nem seus processos.

## Gate do P1

| Iteração | Revisor | Challenger | Auditor | Correção |
|---|---|---|---|---|
| 2 | REPROVA (dist órfão no tarball; sondas versionadas) | REPROVA (SIGINT deixa auth.ini; redirect de tarball) | não rodou | dde6957 |
| 3 | APROVA | APROVA (42 cenários, 5 subidas do shell) | VETO só por teste (A02, A09, A10) | 20e9d13 |
| 4 | regra do veto só por teste | idem | PASS (826 pass, 0 fail, 6 skip; lockstep verde) | nenhuma |

Handoffs em `.agents/auditor_p1_4` e `.agents/worker_p1_4`; os das iterações 1 a 3 estão na tag `historico-2026-10-13`. Limite declarado: D34 (pnpm segue redirect de tarball sem enviar token; integridade protege os bytes).

## Pendências

1. **Envio:** commits locais não enviados (`erp-dominio-stub`, `erp-nucleo`, `erp-zona-1`, `erp-zona-2`, `erp-zona-acesso`, `erp-shell` antes do principal). Aguarda confirmação do humano.
2. **P1 operacional:** registro oficial com política de imutabilidade, migração dos tarballs canônicos sem trocar bytes, reconciliação das integridades e uma execução verde do CI remoto. Precisa de endereço e credenciais do humano.
3. Lockfiles soltos de `erp-moldura` e `erp-dominio-stub`: fora de commit; reconciliar só com o registro canônico.
4. Diretórios temporários de teste em `/tmp` (`espera-*`, `fronteira-*`, `tx-*`, `erp-sessoes-*`, `app-*` e afins) não foram apagados: o projeto vizinho roda testes com os mesmos prefixos e não dá para atribuir a origem com segurança.
5. **Próximos passos:** gate do G5 e G4 (showcase com os atores da v2).
