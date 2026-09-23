# Adiados de propósito

> Só o que está **aberto**. Cada item diz o que é, a evidência e em que atividade do plano fecha.
> Os itens da PoC (D1–D11) fecharam por substituição em 2026-09-21; estão na tag `historico-2026-09-22`.

## D7 — Zona travada segura a requisição até o `proxyTimeout` do Next

- **Evidência:** zona congelada com `SIGSTOP` logo após uma sonda saudável: a requisição dentro da janela
  de 1 s esperou ~30 s e recebeu 500 cru (3/3); na PoC e de novo no `challenger_shell_1` (~0,6 s com a sonda nova).
- **Por que não foi corrigido:** a alavanca é `experimental.proxyTimeout`, que vale para toda resposta
  repassada, inclusive SSE. Escolher o valor é decisão operacional.
- **Fecha em:** C2 (SSE no shell), junto com o tempo de vida de respostas longas; registrar o valor em
  `docs/desenho/mfe/01-operacao.md` §5.1.

## D12 — Menores do núcleo (fatia 1)

| Item | Estado | Fecha em |
|---|---|---|
| `sessaoArquivo`: diretório sem permissão restritiva (`sessao-arquivo.ts:18`) | aberto | D1 (Redis substitui o arquivo) |
| `sessaoArquivo.ler`: `existsSync` antes de `readFileSync` (TOCTOU inofensivo) | aberto | D1 |
| `sanitizarSupportId` valida formato, não semântica | aceito | F4 (padronização de erro) |
| teste de namespace passa com `caminhos` vazio | a conferir | F6 (camada de testes) |

## D13 — Ator só com `tarefas.ver` (auditor_b1_d1_3, L2/P07)

- **Evidência:** a mutação P07 (`concluirTarefa` exigindo `tarefas.ver` em vez de `tarefas.concluir`) sobrevive porque
  nenhum ator da base tem a leitura sem a conclusão (`mutacoes.txt`).
- **Por que não foi corrigido na K2:** um ator novo entra em `identidadeDev` do núcleo (versão nova, lockstep nas 4 apps)
  e na semente da v2; o D2 já sobe o núcleo para 0.10.0 e traz os atores do Keycloak. A outra metade do L2 (P16, `If-Match`
  fixo) foi fechada na K2: a tarefa t-1 nasce na versão 3.
- **Fecha em:** D2 — ator "eva" com perfil `zona2.leitor` no realm e na semente; teste que a action dela é negada antes do
  domínio (`"destino":"/"`).
