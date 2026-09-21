REQUEST_CHANGES

Commit avaliado: `1b9e811`. Instância própria em `localhost:3000-3003` + `127.0.0.1:4001-4004,4010`,
subida com `node repos/scripts/subir-base.mjs`. Verdaccio (:4873, do controlador) não foi tocado.
Todas as portas foram liberadas ao final (confirmado com `ss -ltnp`).

---

## 1. Achados adversários (binário, ordenado por severidade)

### A1 — BLOQUEANTE: bypass da checagem de CSRF quando o cabeçalho `Origin` está ausente
Sonda: Server Action `alterarConcessao` em `/acesso` (revogar `zona1.analista` × `zona1.relatorios`),
via `curl -X POST` multipart, cookie válido da `carla`.

- Com `Origin: http://evil.com` → **500**, a mutação **não** roda (bruno mantém `200` em
  `/zona1/relatorios` depois). Camada de proteção funciona.
- **Sem cabeçalho `Origin` nenhum** → **303** (sucesso), cookie de flash gravado, e a concessão
  **é revogada de fato**: bruno cai para `404` em `/zona1/relatorios` na chamada seguinte, sem
  novo login. Reproduzido de forma determinística (2 execuções, revogar e re-conceder).
- Causa raiz (lida, não editada): `experimental.serverActions.allowedOrigins` do Next.js em
  `repos/erp-zona-acesso/next.config.ts`, `repos/erp-zona-1/next.config.ts`,
  `repos/erp-zona-2/next.config.ts` — é a proteção nativa do framework, não uma checagem própria
  do projeto (busquei checagem de `Origin` em `erp-nucleo` e não há nenhuma). O comportamento do
  Next é "rejeita só se `Origin` **estiver presente** e não bater"; ausência de `Origin` é tratada
  como confiável.
- Mitigantes que reduzem — mas não eliminam — o risco real: (1) navegadores modernos **sempre**
  anexam `Origin` a um POST cross-origin disparado por `<form>` ou `fetch`, então um CSRF clássico
  a partir de uma página maliciosa não deveria produzir a requisição sem `Origin` que eu forjei
  com `curl`; (2) o cookie `__Host-session` é `SameSite=lax`, o que por si só já impede o navegador
  de anexar o cookie a um POST cross-site forjado por terceiro, então a via de exploração "vítima
  clica em link malicioso, navegador da vítima dispara o POST" está coberta por essa segunda
  camada independentemente do gap do `Origin`.
- O que isso não prova: não testei (nem tentei forçar) um vetor realista fora de `curl` — proxy
  HTTP que remove `Origin`, extensão de navegador, cliente HTTP/1.0, webview embutida — que
  produza a mesma ausência a partir do navegador de uma vítima com sessão válida. Não afirmo que
  é explorável em produção por um atacante remoto comum; afirmo que a checagem de origem, isolada,
  é fail-open na ausência do cabeçalho, e que `06-seguranca.md` §7 ("CSRF em mutação: verificação
  de origem + `SameSite`") não documenta esse limite — documento a corrigir.
- Evidência bruta: `.agents/challenger_base_1/adversario.txt` (seções "Server Action via curl
  multipart com Origin de outro site" e "... SEM Origin nenhum").

### A2 — Não bloqueante, mas real: id de 3000 caracteres em `/zona1/recursos/<id>` produz `500` cru do Next, não um erro tratado
Sonda: `GET /zona1/recursos/<3000 caracteres>` com cookie válido do `bruno`.

- Resposta ao navegador: `500 Internal Server Error`, HTML do boundary de erro padrão do Next
  (`__next_error__`), sem stack trace, sem `at java.`/`org.springframework`/SQL, sem
  `X-Powered-By`, sem nome de arquivo do servidor — **nesse aspecto o critério 5 (nada de
  framework vaza) passa**.
- Mas: no log do processo (não exposto ao cliente) o erro real é `DestinoInvalido` — o núcleo
  **recusou corretamente antes de qualquer chamada de rede** (nenhum dos domínios A/B foi
  chamado; confirmei olhando o log do stub, sem hit registrado). O problema é que não existe
  `error.tsx` em `erp-zona-1` nem em `erp-shell` (busquei, não há nenhum arquivo `error.tsx` ou
  `global-error.tsx` no repositório) — então esse erro interno vira o 500 genérico do Next, e o
  usuário nunca vê a mensagem normalizada (`MENSAGENS.DESTINO_INVALIDO`, "Não foi possível
  concluir a operação"). O contrato de erro `{ codigo, supportId }` só é normalizado para erros
  que **voltam do domínio**; `DestinoInvalido`, por desenho explícito no comentário de
  `erp-nucleo/src/interno/erros.ts`, nunca carrega `supportId` e nunca passa por um boundary de
  página — cai direto no crash handler do framework.
- IDs com `..%2F`, `%00`, `..%2f`, `r-1%2Fextra` → todos `404` uniforme, sem vazamento. Só o
  comprimento extremo produz `500`.
- Evidência: `.agents/challenger_base_1/probe-id-longo-500.html`,
  `probe-id-longo-500-headers.txt`, `subir-base.log` (trecho com o stack do `DestinoInvalido`).

### Passou — sem achado
- Cookie forjado (`__Host-session` com UUID zerado) em `/zona1`: `307` para `/login`, camada 2
  recusa de fato; camada 1 nunca autoriza sozinha.
- `curl` direto ao stub sem `Authorization`: `401 {"codigo":"SESSAO_EXPIRADA"}` — recusa, e o
  corpo não descreve mecanismo interno.
- Stub chamado com cabeçalhos de navegador (`Origin`, `Sec-Fetch-Mode`, `Sec-Fetch-Site`) mesmo
  com `Authorization: Bearer` fabricado: `403 {"codigo":"OPERACAO_NAO_PERMITIDA"}` — o domínio
  segue inalcançável fora do processo Node do BFF.
- `/zona1/recursos/r-1` para `ana`, `carla`, `davi`: nenhum aparece `CC-`, `custo`, token
  `dev.<usuario>.<uuid>` nem `accessToken` no HTML nem no payload RSC embutido
  (`self.__next_f.push`). `carla` em `/zona1/recursos/r-3` (fora do escopo dela): `404`; `bruno`
  no mesmo recurso: `200`.
- `davi` (sem perfil de zona) em `/zona2`, `/acesso`, `/zona1/relatorios` por URL direta: `404`
  uniforme nos três, sem texto de "sem acesso" (invariante 8).
- Enumeração `r-3` (carla, existe mas fora do escopo) × `r-9` (não existe), **n=250 cada**,
  ids do **mesmo comprimento** (removi um viés do meu primeiro script, que usava um id
  inexistente mais longo e produzia 34 bytes de diferença só pelo eco do parâmetro na
  URL/payload RSC — refeito com controle de comprimento):
  status idêntico (`404`/`404`), corpo **byte-idêntico** após normalizar o nonce da CSP
  (8050 bytes nos dois), headers idênticos. Tempo: p50 12,93 ms × 13,18 ms; p95 18,31 ms ×
  19,49 ms; p99 26,50 ms × 26,81 ms — diferença dentro do ruído da própria máquina (ver
  medições, item 3). **Não observei distinção de tempo entre existente-fora-do-escopo e
  inexistente, em 500 amostras totais.** Isso não prova ausência de canal de tempo em geral
  (ver seção final).
- Mutação sem `Origin` válido e com `Origin` forjado: ver A1 acima (é o próprio achado).
- Revogação: `carla` desativa `zona1.analista`→`zona1.relatorios` via Server Action real (form
  multipart com `$ACTION_ID`, não o atalho `acaoPeloCliente`); `bruno` perde `/zona1/relatorios`
  (`200`→`404`) **na próxima requisição, sem novo login**. Restaurei a concessão em seguida e
  confirmei `200` de novo.
- Open redirect no login (`de=//evil.com`, `https://evil.com`, `/\evil.com`, `http://evil.com`,
  `/%2F%2Fevil.com`): todos caem em `Location: /`, nunca no destino externo.
- Suíte automática ponta a ponta (`node --test repos/verificacao/*.test.mjs`): **20/20 passam**,
  rodada uma vez, portas livres antes e depois. Saída completa em
  `.agents/challenger_base_1/suite-verificacao.txt`.

---

## 2. Divergências declarado × observado

| # | Declarado | Observado | Documento a corrigir |
|---|---|---|---|
| D1 | `06-seguranca.md` §7: "CSRF em mutação: verificação de origem + `SameSite`" | A verificação de origem é fail-open quando `Origin` está ausente (Next.js `allowedOrigins`, não uma checagem própria do projeto); só o `SameSite=lax` do cookie é, hoje, a barreira que de fato impede exploração a partir de um navegador de vítima real | `06-seguranca.md` §7 — precisa registrar esse limite explicitamente, não só citar as duas camadas como se fossem redundantes e completas |
| D2 | `atual.md` §4 / ADR-0009 decisão 10: núcleo "recusa destino... antes de qualquer chamada de rede" e "normaliza o erro para `{ codigo, supportId }`" | A recusa antes da rede **acontece** (confirmei nenhum hit no domínio), mas a normalização de erro não chega ao usuário para `DestinoInvalido`: cai no crash handler genérico do Next (`500`, sem mensagem, sem `supportId`) porque nenhuma zona tem `error.tsx`/`global-error.tsx` | `06-seguranca.md` §8 ("Erros") e `atual.md` §4 — falta declarar que a normalização é garantida na camada de rede (fetch ao domínio) mas não há boundary de página cobrindo erro lançado antes da chamada |
| D3 | `alvo.md` §6: "Falha isolada de zona: **não existe**: zona fora devolve erro do gateway" (comportamento atual, explicitamente marcado como não implementado) | Confirmado: derrubar o processo de `erp-zona-2` faz o shell devolver `500 Internal Server Error` (texto puro, sem HTML, sem marca) para `GET /zona2`. Bate com o que o documento já admite — **sem divergência**, incluído aqui só para registrar que foi de fato verificado, não assumido |
| D4 | Nenhum documento (`atual.md`, `06-seguranca.md`) descreve o que acontece quando a **gestão de acesso (:4010)** cai | Toda página, inclusive `/` no shell (que não deveria depender de módulo restrito nenhum), devolve `500` com corpo **visualmente vazio** (nem o texto "Internal Server Error" aparece — o `<body>` só tem um `<div hidden>`, nada legível). Pior que o caso de zona fora: aqui não há sequer o texto genérico do Next | Lacuna de documento confirmada — a consequência já registrada em ADR-0009 ("fica no mesmo nível do store de sessão no plano de falha") não descreve a experiência do usuário, e deveria, porque hoje é pior que "erro do gateway": é página em branco |
| D5 | Nenhum documento descreve o comportamento com um domínio de dado (**A, :4001**) fora, só a gestão de acesso e a zona | `GET /zona1` com domínio A fora (B no ar): `500`, corpo visualmente vazio, igual ao caso da gestão de acesso — **não há degradação parcial** (o painel não renderiza o que dependia de B mesmo B estando disponível); a falha de A derruba a página inteira | Lacuna de documento — vale registrar em `atual.md` §1 ou `06-seguranca.md` que hoje não há isolamento por bloco/domínio dentro de uma página, só por página inteira |
| D6 | Nada declarado sobre a store de gestão de acesso (concessões, manifestos) ser stateful **em memória de processo** | Confirmei operacionalmente: matar o processo do stub e subir de novo **perde todas as concessões e manifestos registrados** (voltam ao estado "nada registrado", produzindo `404` generalizado até re-rodar `pnpm registrar` em cada app). Isso é diferente do store de sessão (`SESSAO_DIR`, em arquivo, sobrevive à queda das zonas) e não está documentado em lugar nenhum que examinei | Lacuna a acrescentar em `atual.md` §5 — a store de sessão já está marcada como "não declarada" no seu pedido; descobri que a store de **gestão de acesso** também não tem modo de degradação declarado, e o observado é "perda total de estado, sem persistência", mais frágil que a sessão |

---

## 3. Medições

### Carga leve — `GET /zona1` autenticado (bruno), n=300, concorrência 10
Comando: script Node com `fetch`, 10 workers concorrentes, mede `performance.now()` por request
completa (corpo lido até o fim). Ambiente: 16 vCPUs, `load average` 1.50–1.75 no momento da
medição (não era uma máquina ociosa — havia outros processos do usuário rodando, load 1.5+ vindo
de antes da minha medição), ~700 MB livres de RAM (resto em cache de página), sem swap ativo.

```
n=300 concorrencia=10 status=200 (único status observado)
duração total=3.21s  throughput=93.6 req/s
p50=94.4ms  p75=105.9ms  p90=175.0ms  p95=192.4ms  p99=199.1ms
min=69.1ms  max=234.6ms
```

Uma amostra, uma repetição. **Não tirei uma segunda rodada para checar estabilidade entre
execuções** — isso está na lista do que não executei. O salto de p75 (106 ms) para p90 (175 ms) é
grande o suficiente para sugerir uma cauda bimodal (provavelmente contenção de I/O entre BFF →
domínio A → domínio B em série, ou contenção de CPU da minha própria máquina compartilhada com
outros processos, que eu não consigo separar sem isolar a máquina). Não afirmo qual é a causa.

### Timing de enumeração — r-3 (carla, existe fora do escopo) × r-9 (não existe), n=250 cada, ids de mesmo comprimento
Ver seção 1 (achados "passou"). Números completos em
`.agents/challenger_base_1/timing-enumeracao-r3-v2.txt`. Repeti uma vez (a primeira rodada, com
ids de comprimento diferente, está preservada em `timing-enumeracao-r3.txt` e mostra por que o
controle de comprimento importa: sem ele, uma diferença de bytes que é só o eco do parâmetro na
URL parece "vazamento" e não é).

### O que eu não medi e o `08-desempenho.md`/duplicação de bundle pediam
Não executei medição de duplicação de bundle entre zonas nem cold start — não estavam no escopo
explícito que recebi para esta rodada (a instrução concreta enumerou 5 itens; bundle e cold start
não estavam entre eles). Se isso for necessário para destravar a questão do ADR-0008 sobre Module
Federation, é um item pendente, não um "aprovado por omissão".

---

## O que eu não consegui executar

- **Vetor realista de bypass de CSRF (A1) a partir de um navegador de verdade.** Só reproduzi via
  `curl` sem `Origin`. Não tenho, neste raio de alcance, uma forma limpa de simular um navegador
  real que omite `Origin` num POST cross-site (seria preciso um navegador antigo, uma extensão, ou
  um proxy manipulando cabeçalhos) — não tentei montar esse ambiente porque estaria fora do
  "localhost, processos que você mesmo iniciou" de forma direta (um proxy interceptando o próprio
  tráfego do navegador ainda seria localhost, mas eu não tinha um navegador automatizado disponível
  na sessão). **Não afirmo que é explorável por um atacante remoto comum; afirmo que a checagem,
  isolada, é fail-open.**
- **Segunda rodada da carga leve** para checar estabilidade da distribuição — rodei uma vez só.
- **Cold start / comportamento após ociosidade** e **duplicação de bundle entre zonas** — fora do
  escopo explícito dos 5 itens que recebi; não medi.
- **Buffering de SSE sob tráfego** — não há SSE nesta base (`atual.md` confirma: SSE é item do
  alvo, "não existe" hoje). Não aplicável, não uma lacuna de execução minha.
- **Falha do store de sessão (arquivo em `SESSAO_DIR`)** — não derrubei essa peça isoladamente
  (ela é compartilhada por todos os processos via variável de ambiente no boot; simular sua queda
  exigiria apagar o diretório em `SESSAO_DIR` com processos já rodando, o que eu decidi não fazer
  sem confirmar antes, já que corromper esse estado poderia deixar a instância num modo que eu não
  conseguiria restaurar de forma limpa dentro do tempo desta rodada). Fica como pendência: a store
  de sessão não tem modo de degradação declarado (seu próprio pedido já sinalizava isso), e eu não
  cheguei a produzir o dado observado para confirmar ou refutar.
- Não tentei anexar cabeçalhos de navegador completos (User-Agent real, `Sec-Fetch-Dest`, etc.) nem
  simular um `fetch()` disparado de dentro de uma página em `http://localhost:9999` de verdade —
  usei sempre `curl` com cabeçalhos forjados manualmente, o que é uma aproximação, não uma prova
  com navegador real.

Todos os artefatos brutos (respostas HTTP completas, logs de processo, scripts de medição) estão
em `.agents/challenger_base_1/`.
