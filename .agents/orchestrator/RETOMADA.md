# Retomada: G4, G5 e correção do login integrados (2026-10-19)

**Atualizado em 2026-10-19 (integração).** Gate local do P1 aprovado em 2026-10-12; P1 operacional segue esperando o humano. Esta máquina corrigiu o desvio do login (ADR-0014, adendo 1, item 8: `concluirLogin` consulta `/v2/eu` antes de gravar) e preparou o P1 para o registro do GitLab, inativo. Em paralelo, o **G5 (revogação ativa de sessão por `/v2/eventos`)** e o **G4 (showcase com atores v2 e limpeza da v1)** foram implementados em outra máquina conforme ADR-0014 (adendos 3 e 4):
- G5: `erp-dominio-stub` com `GET /v2/eventos` restrito a `Bearer svc.shell`, cursor `desde` validado e `sujeitos: [sub, login]` nos eventos; `@erp/nucleo` com `removerPorSujeito(sub)` em `@erp/nucleo/shell`; `erp-shell` com sincronização ativa periódica e revogação no proxy com lock e cursor no Redis (`lib/revogacao-ativa.ts`).
- G4: showcase integrado com os 5 atores canônicos (`ana`, `bruno`, `carla`, `davi`, `eva`) em `base/showcase/conferir.mjs` e `base/verificacao/showcase/showcase.test.mjs`; segregação de funções de Carla (404 em `/zona2`) e permissões finas de Eva (leitura sem conclusão em `/zona2` e ação direta negada); passos A16, A17 e A18 no roteiro de verificação; mock legado da v1 (`gestao-acesso.mjs`, porta 4010) apagado.

**Colisão de versão resolvida na integração (ADR-0010):** os dois lados lançaram `@erp/nucleo` 0.10.5 com conteúdos diferentes (login aqui, G5 lá). O merge junta os dois no **0.10.6**, nas quatro apps; nenhum 0.10.5 vale como versão da base. Quem tiver 0.10.5 no Verdaccio local não deve usá-lo.

**Próxima atividade:** os ajustes de pacotes vindos da revisão de monorepo (2026-10-19; decisão: esta base não migra para monorepo): (1) `@erp/moldura` passa a depender de `@erp/contratos` 0.4.0, eliminando a segunda cópia (0.2.1) nas apps; (2) `base/scripts/verificar-lockstep.mjs` conta todas as entradas `@erp/nucleo@x` (e `@erp/contratos@x`) do lockfile, não só a dependência direta; (3) a publicação testa o tarball instalado num consumidor Next mínimo que importa cada `exports`, inclusive o CSS da moldura, e publica esses mesmos bytes. Reavaliar a estrutura de repositórios só depois do P1 operacional, agrupando por dono (`erp-nucleo` + `erp-contratos`), nunca num repositório único sem aprovação obrigatória por caminho.

**Lição do Codex:** entrega código bom, mas declara pronto sem rodar a prova que importa. O orquestrador roda as suítes ponta a ponta e as mutações antes de aceitar. `codex exec resume` não herda `-s` nem `--add-dir`: repassar as opções na retomada.

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

1. **Envio:** commits da integração (os seis submódulos antes do principal) não enviados. Aguarda confirmação do humano.
2. **P1 operacional:** registro oficial com política de imutabilidade, migração dos tarballs canônicos sem trocar bytes, reconciliação das integridades e uma execução verde do CI remoto. Precisa de endereço e credenciais do humano.
3. Lockfiles soltos de `erp-moldura` e `erp-dominio-stub`: fora de commit; reconciliar só com o registro canônico.
4. Diretórios temporários de teste em `/tmp` (`espera-*`, `fronteira-*`, `tx-*`, `erp-sessoes-*`, `app-*` e afins) não foram apagados: o projeto vizinho roda testes com os mesmos prefixos e não dá para atribuir a origem com segurança.
5. **Próximos passos:** gate formal de G4 e G5.
