# Handoff para o Codex (2026-10-08)

Este arquivo é para um agente que **não é o Claude Code** (Codex CLI ou outro) assumir o papel de orquestrador.
O processo é o mesmo; muda só a ferramenta. O que vale para todos continua em `AGENTS.md`, `LEIA-PRIMEIRO.md`,
`RETOMADA.md` e `AMBIENTE.md`. Aqui está só o que o Codex precisa saber a mais.

## 1. Onde o trabalho parou

- **Objetivo da base atingido** (gate do E3, E4 e E5 aprovado em 2026-10-07, tag `gate-e3e5-aprovado`). Evidência por
  funcionalidade em `RETOMADA.md`, seção "Objetivo atingido".
- **Nada começa antes da resposta do humano** ao pedido [`pedidos/2026-10-07-proximo-passo.md`](../../pedidos/2026-10-07-proximo-passo.md)
  (ordem entre P1, os itens adiados C2, B2, G4, G5 e a Lista 2; menores D27 a D33; teto de iterações por veto só por teste).
  Se a seção "Resposta" ainda estiver vazia, o Codex para e avisa o humano.
- **Nada está rodando**: contêineres parados, nenhum processo da base, nenhum agente aberto.
- Branch `bff-multizone` igual a `origin/bff-multizone` em `d240ec1` mais o commit deste handoff.
- Sujeira esperada na árvore: `pnpm-lock.yaml` de `repos/erp-dominio-stub` e `repos/erp-moldura` (hash do Verdaccio desta
  máquina; não commitar, `AMBIENTE.md` §1).
- GitLab: `ATIVIDADES.md` §2 tem o que o humano ainda aplica (fechar #9, #10 e #19 com o comentário de §3).

## 2. Primeiros passos do Codex

1. `git fetch origin` e ler os commits novos de outras pessoas (`git log HEAD..origin/bff-multizone`); `git pull --ff-only`;
   `git submodule update --init`; `git config core.hooksPath .githooks` se o clone for novo.
2. Ler, nesta ordem: `AGENTS.md`, `.agents/orchestrator/LEIA-PRIMEIRO.md`, `RETOMADA.md`, `AMBIENTE.md`, este arquivo.
3. Abrir o pedido `pedidos/2026-10-07-proximo-passo.md`. Sem resposta: parar. Com resposta: escrever o plano do primeiro
   item em `docs/superpowers/plans/AAAA-MM-DD-<item>.md` no formato dos planos anteriores (o mais recente é
   `2026-10-07-e3-e4-e5-showcase.md`), com a **tabela de mutações** que os testes precisam pegar (regra de 2026-10-07).
4. Subir o ambiente só quando for testar: `docker start verdaccio`, `task showcase:subir`, esperar o Keycloak
   (`curl -s http://127.0.0.1:8080/realms/erp/.well-known/openid-configuration`), `task showcase:checar`.
5. Antes de parar: `task orquestrador:ledger`, atualizar `RETOMADA.md` (passo exato, o que está rodando) e
   `ATIVIDADES.md`, commitar e enviar (submódulo antes do principal).

## 3. O processo, traduzido para o Codex

O processo foi construído no Claude Code com subagentes. Equivalências:

| No Claude Code | No Codex |
|---|---|
| Subagente `revisor-mfe`, `simulador-condicoes`, `testes-invariantes`, `arquiteto-mfe` | As instruções de cada papel estão em `.claude/agents/<nome>.md` (o corpo depois do cabeçalho YAML). Use o arquivo como prompt de um agente separado, se o Codex oferecer, ou de uma sessão nova do Codex. |
| Auditor forense (`general-purpose`, Opus, com veto) | Sessão separada com o maior nível de raciocínio disponível. Modelo de handoff e de `mutacoes.txt`: os do último gate, que saíram da árvore e ficam no commit `6ebab5e` (`git show 6ebab5e:.agents/auditor_e3e5_5/handoff.md`; também `revisor_e3e5_2` e `challenger_e3e5_2`). A tabela de mutações a reaplicar está no plano do item. |
| Sonnet para trabalho mecânico, Opus para julgamento | Modelo ou esforço menor para revisor e challenger; o maior para auditor e decisão de gate. |
| Worker em modo Subagent-Driven (skill `superpowers`) | Uma task do plano por vez: implementar, rodar os testes e as mutações declaradas, revisar, commitar. O ledger da task fica em `.superpowers/sdd/<plano>/progress.md` (fora do git) e vai para o git com `task orquestrador:ledger`. |
| `SendMessage` para retomar um agente | Não existe entre sessões: verificador interrompido não é retomado; despacha-se um novo (`<papel>_<gate>_<n+1>`) só com as etapas que faltam, a partir do handoff parcial dele. |
| Hook `no-ai-authorship` do Claude Code | Não roda no Codex, mas a regra vale: **mensagem de commit sem rodapé de coautoria nem marca de IA** (`AMBIENTE.md` §4). |
| Memória do Claude Code (fora do repositório) | Não é visível ao Codex. Tudo o que importa está nos arquivos desta pasta e em `pedidos/`. |

**Regras que não mudam com a ferramenta** (resumo; detalhe em `LEIA-PRIMEIRO.md` e `RETOMADA.md`, "Como o trabalho é conduzido"):

- Gate = revisor (lê o código) + challenger (põe no ar e ataca) + auditor (muta e vê se os testes pegam, com veto).
  Cada verificador escreve `.agents/<papel>_<gate>_<n>/handoff.md` **desde o começo**, marcado "(parcial)" até o fim.
  Veto só por teste: a iteração seguinte é só um auditor novo. Verificador que entregou handoff não é reusado.
- Só o challenger usa as portas 3000 a 3003, 4001 a 4004, 4010 e 4020; o auditor espera. Ninguém derruba o Verdaccio (4873).
- Estado salvo e commitado a cada passo; handoff completo antes de acabar o uso da sessão.
- Decisão do humano, pesquisa aberta ou busca na web: escrever em `pedidos/AAAA-MM-DD-<assunto>.md` (formato em
  `pedidos/README.md`) e parar o que depende dela.
- Instalar pacote, `sudo`, `rm -rf`, `chmod`, push forçado: pedir ao humano antes, mostrando o que muda.
- Nada de material do cliente no repositório: só vocabulário genérico e dados fictícios.
- Documentação em português, simples, sem travessão, sem `·` e sem emoji em texto novo; parâmetro de tempo ou limite vai
  para configuração documentada em `docs/CONFIGURACAO.md`.
- Comandos de rotina pelo `Taskfile.yml` (`task` lista tudo); tarefa nova entra nele com `desc`.

## 4. Armadilhas que mais custaram (o resto está em `AMBIENTE.md`)

- `pkill -f` e `pgrep -f` matam o próprio shell da ferramenta: mate pelo PID (`$!` ou `ss -ltnp`).
- `node --test <pasta>` roda zero testes e sai com 0: sempre glob explícito.
- Suíte nova em `base/verificacao/` raiz entra no `verificar:redis`; suíte que exige o showcase no ar vai para subpasta.
- Logs e scripts de mutação ficam fora do repositório (diretório temporário), nunca na raiz.
- Não canalize para `head` um script que sobe a base: ele morre por SIGPIPE e deixa a base de pé.
- Não mute arquivo com teste rodando; restaure dados versionados (`dados/semente/*.json`) depois de cada mutação.
- Evidência de verificador pode levar JWT: `grep -rlE "eyJ[A-Za-z0-9_-]{20,}" .agents/<nome>` e mascarar antes do commit.
- Lockfile com hash desta máquina não entra em commit; integridade quebrada vinda de outra máquina: `task pacotes:alinhar-hashes`.
