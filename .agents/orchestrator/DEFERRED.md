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

## D14 — Limites declarados dos analisadores estáticos (Decisão A2, 2026-09-23)

- **O que é:** os analisadores de `base/verificacao/` (`seguranca-estatica.mjs`, `saida-de-rede.mjs`) e a fronteira do núcleo
  pegam o **erro de boa-fé**; um contorno escrito de propósito sempre acha outra sintaxe. Pela Decisão A2, contorno deliberado
  não veta o gate: fica aqui, com a defesa que vale contra ele. Erro plausível de boa-fé continua vetando.
- **Classes aceitas** (IDs do `auditor_b1_d1_4/mutacoes.txt`, no git em `ec08ed1`; a iteração 6 confere o que a K3/K4 já fechou):

| Classe | Exemplos | Defesa que vale |
|---|---|---|
| ilha alcançada por indireção (apelido condicional, objeto de componentes, barril sem `from`) | XA09–XA13 | domínio devolve só o que o usuário pode ver (inv. 9); ponta a ponta procura dado interno no HTML e no RSC |
| chave calculada ou sintaxe montada (`['e'+'nv']`, `'const'+'ructor'`, `process['bind'+'ing']`) | XN02–XN04, XR28, XR31 | a zona não tem credencial nem endereço de domínio que valha fora do registro de destinos |
| `acaoProtegida` falsa ou domínio chamado por helper no argumento | XP01, XP03–XP06 | ponta a ponta de `Origin` e `CAMPOS_VALIDOS` (P09b); o domínio recusa sem credencial |
| navegação entre zonas escrita de forma indireta | XL01–XL04 | só experiência de uso: a zona de destino exige sessão e `exigirModulo` |
| rota do domínio repassada por `rewrites`/`NextResponse.rewrite` | XN08, XR30 | o domínio responde 401 sem credencial; bloqueio de saída de rede no deploy |
| `require` por apelido e `__non_webpack_require__` (auditor_b1_d1_9) | XR40–XR44 | mesma de chave calculada: a zona não tem credencial nem endereço de domínio fora do registro |
| rede do navegador sem `fetch` (`WebTransport`, `Image`, `Worker`) (auditor_b1_d1_9) | XR45–XR48 | CSP `default-src 'self'` em shell e zonas (teste de CSP do ponta a ponta) |

- **Barreira de ambiente em vigor desde a K5:** zona e domínio recebem o ambiente por lista de inclusão, em toda fase
  (`base/scripts/ambiente.mjs`); a senha de escrita não chega a eles, conferido em `/proc/<pid>/environ` por
  `base/verificacao/base.test.mjs` com `ERP_REDIS_SENHA_SHELL` sempre definida.
- **Fecha em:** bloqueio de saída de rede das zonas no deploy (P1, fim do plano). Até lá, risco aceito.

## D15 — Lacunas sem veto do gate B1+D1+G3+K, iteração 9 (auditor_b1_d1_9)

- **O que é:** o gate passou (Decisão A2); estas mutações sobrevivem por falta de dente, não por defeito do código atual.
  Handoff e mutações no commit `f010760` (`.agents/auditor_b1_d1_9/`). Cada item: correção e teste sugeridos lá.
  - **LA:** `precisaConstruir` não olha `base/scripts/ambiente.mjs`; mudar só o ambiente do build (AK6) passa com `CONSTRUIR=1`.
  - **LB:** o teste de ambiente confia em `ambientesEntregues` e nos `extras` (AK7, AE1).
  - **LC:** ramos de união e de `Promise` de `temEscrita` (`erp-nucleo/scripts/fronteira.mjs`) sem teste (N38q, N38r).
  - **LD:** a fronteira não vê escrita por cliente Redis convertido ou por `fs` sem tipo com `gravar` (NR1, NR2; suspeita do revisor).
    Defesa hoje: ACL do Redis (a zona só tem `GET`) e o núcleo não depende de `redis`.
  - **LE:** `valorConstante` aceitar `let` (SK8) passa: o caso `let` do teste é pego pelo literal `'fetch'`.
  - **LF:** `assetPrefix` por `??=`, `||=`, `+=` ou `defineProperty` passa (`seguranca-estatica.mjs`).
  - **LG:** nenhum teste roda o showcase; o banner de `base/showcase/subir.mjs` imprime a senha de escrita e ela aparece na linha de
    comando do `docker` no host.
  - **Contorno barato de fechar:** `declare const/function/class fetch|WebSocket` esconde a global (XR20k2–k5, XR20l/m): ignorar
    declaração com `declare` em `nomesLigados` (`saida-de-rede.mjs`).
- **Fecha em:** fatia K6, junto do D2 (o próximo gate cobre as duas). Nenhuma bloqueia o D2.
