REQUEST_CHANGES

Commit avaliado: HEAD de `bff-multizone` no momento do teste (`73bdc8b`, ver git status no início da
sessão). Instância própria em `localhost:3000-3003` + `127.0.0.1:4001-4004,4010`, subida primeiro com
`node repos/scripts/subir-base.mjs` e, a partir do item 2, com um harness próprio
(`.agents/challenger_shell_1/harness.mjs`, escrito só para este teste, não toca `repos/`) que sobe os
mesmos processos com um único `SESSAO_DIR` compartilhado, para poder derrubar/reerguer/travar uma
zona de cada vez sem invalidar as sessões das outras. Verdaccio (`:4873`) não foi tocado. Todas as
portas que eu possuía (3000–3003, 4001–4004, 4010) livres ao final — confirmado abaixo na seção de
housekeeping.

Todos os artefatos brutos (respostas HTTP completas, scripts de medição, logs) estão em
`.agents/challenger_shell_1/`.

---

## 1. Achados adversários (binário, ordenado por severidade)

### C1 — BLOQUEANTE: variação de maiúsculas no prefixo de zona ignora a sonda de saúde e vaza o erro cru do Next quando a zona está morta
Sonda: item 5 do pedido (caminhos adversários com zona 2 fora), variantes `/ZONA2`, `/Zona2`,
`/zONA2`, `/zonA2`.

- **Mecanismo**: `encontrarZonaPorCaminho` (`repos/erp-shell/lib/zonas.ts`) faz comparação de string
  exata/prefixo **sensível a maiúsculas** contra `zona.prefixo` (`/zona2`). `/ZONA2` não bate, então
  `decidirAcaoDoProxy` cai no ramo 4 ("rota do próprio shell"), **nunca chama
  `cacheSaude.verificar`**, e como há cookie de sessão, decide `prosseguir`. A requisição segue para
  o rewrite do `next.config.ts` (`source: '/zona2'`), e o matcher de rewrite do Next **é
  case-insensitive** (confirmado empiricamente: ver abaixo), então a requisição chega de fato à
  zona.
- **Com zona2 no ar**: `/ZONA2`, `/Zona2`, `/zONA2`, `/zonA2` → todos `200`, servindo o HTML real da
  zona 2 (assets `/zona2-static/...` no corpo). Controle `/ZONAX` (rota que não existe) → `404`, o
  que descarta a hipótese de "tudo retorna 200"; é especificamente o roteamento case-insensitive do
  Next casando com a zona. Evidência: `item5-variantes-caixa.txt`.
- **Com zona2 morta** (processo derrubado de propósito, confirmado pela porta 3002 livre):
  `/ZONA2`, `/Zona2`, `/zONA2` → todos `500 Internal Server Error`, corpo `Internal Server Error`
  em texto puro, **sem `content-type`, sem CSP, sem `cache-control`, sem `Retry-After`, sem a
  página estilizada `pagina-erro-zona.ts`**. O controle `/zona2` minúsculo, no mesmo instante,
  devolve corretamente `503` com a página própria. Reproduzido em 2 rodadas independentes (queda 1
  e queda 2). Evidência: `item5-caminhos-adversarios-zona-fora.txt`,
  `item5-variantes-caixa-zona-fora.txt`.
- **Checagem de sessão não é contornada** por essa mesma via: `/ZONA2` e `/zona2%2F..` e `/%7Aona2`
  sem cookie nenhum devolvem `307` para `/login` (não vazam conteúdo). Evidência:
  `item5-ZONA2-zona-viva.txt` (linha "SEM sessao"), `item5-sem-sessao-variantes.txt`. O achado é
  só sobre a sonda de saúde, não sobre autenticação.
- **Por que isto é bloqueante e não só uma divergência de documento**: é exatamente o padrão "R1" já
  registrado como suspeita em `atual.md` §1.1 e em `RETOMADA.md` ("a decisão usa
  `req.nextUrl.pathname`... enquanto os rewrites olham o caminho cru") — aqui a assimetria não é
  por segmento de ponto, é por caixa, mas o efeito é o mesmo do R1 histórico da PoC
  (`.agents/challenger_final_1/handoff.md`): a checagem de vivacidade e o roteiro real do Next
  enxergam o caminho de forma diferente, então existe pelo menos um caminho de zona que **nunca**
  passa pela sonda. Qualquer cliente, crawler ou link com URL em outra caixa (comum em compartilhamento
  de link, bookmarklet, digitação manual) reproduz o erro cru do framework em vez do 503 documentado,
  quebrando a garantia central do item que está sendo avaliado neste gate.
- Reprodução mínima: com a zona 2 fora do ar, `curl -s -D - http://localhost:3000/ZONA2` com cookie
  de sessão válido → `500` sem headers de aplicação; `curl -s -D - http://localhost:3000/zona2` no
  mesmo instante → `503` com `Retry-After: 5` e a página própria.
- O que isto não prova: não testei se o mesmo padrão vale para outras variações fora de maiúsculas
  puras (ex.: unicode case-folding, `İ` turco), nem se acontece igual em zona1/acesso (só testei em
  zona2; a causa raiz é genérica — `encontrarZonaPorCaminho` é usada para todas as zonas da mesma
  forma — então é razoável esperar o mesmo em zona1 e acesso, mas **não verifiquei ao vivo** nessas
  duas; ficaria como pendência caso o gate queira confirmação por zona).

### Passou — sem achado
- **Cookie forjado / sem `Authorization`**: não testei diretamente nesta rodada (não fazia parte dos
  7 itens do pedido); a suíte automática (`node --test repos/verificacao/*.test.mjs`, 26/26) já
  cobre "cookie forjado passa da camada 1 e morre na camada 2" e isso passou (ver seção 3).
- **Nenhuma das 7 variantes adversárias de caminho pediu no item 5** (`/zona2/..`,
  `/zona2/../zona2`, `/zona2%2F..`, `/%7Aona2`, `/ZONA2`, `/zona2-static/../zona2`, `//zona2`)
  chega ao **conteúdo** da zona morta sem passar pela sonda, **exceto** as variantes de caixa
  (C1 acima). Detalhe por caminho, com zona2 fora:
  - `/zona2/..` → `200`, serve a **home do próprio shell** (`req.nextUrl.pathname` normaliza
    `/zona2/..` para `/` antes do proxy rodar; não é rota de zona, não passa pela sonda, mas também
    não alcança conteúdo de zona nenhuma — comportamento inofensivo, ainda que surpreendente).
  - `/zona2/../zona2` → `503` correto (normaliza para `/zona2`).
  - `/zona2%2F..` e `/%7Aona2` → `404` nativo do Next (página 404 pré-renderizada do próprio
    shell, com `x-nextjs-cache: HIT`), porque o `%2F` e o `%7A` não são decodificados da forma que
    bateria com o prefixo da zona nem com nenhuma rota real do shell — sem vazamento.
  - `/zona2-static/../zona2` → `503` correto.
  - `//zona2` → `308` para `/zona2` (redirecionamento padrão do Next para barra dupla), que então
    segue o fluxo normal.
  Evidência: `item5-caminhos-adversarios-zona-fora.txt`.
- Rota pública `/erro-de-zona` existe como página Next própria (`app/(publico)/erro-de-zona/page.tsx`)
  e é alcançável diretamente (`200`), mas **o fluxo real de zona-inativa nunca redireciona para ela**
  — a resposta 503 é uma string HTML construída à mão em `pagina-erro-zona.ts`, servida inline. Não é
  um achado de segurança (a página em si não vaza nada, é estática e sem dados), mas é uma
  inconsistência entre o diagrama de `atual.md` §1.1 (que lista `/erro-de-zona` como destino do fluxo
  público) e o comportamento observado — ver seção 2.

---

## 2. Divergências declarado × observado

| # | Declarado | Observado | Documento a corrigir |
|---|---|---|---|
| D1 | `atual.md` §8: "uma zona cai → o shell responde 503 com `Retry-After: 5` e uma página própria; as outras zonas seguem" (sem exceção) | Verdadeiro para o caminho minúsculo exato do prefixo, mas **falso** para qualquer variação de maiúsculas do mesmo prefixo (`/ZONA2`, `/Zona2`, `/zONA2`): nesses casos o usuário recebe o `500` cru do framework, não a página própria. Isto é o achado C1. | `atual.md` §8 e `ROTEIRO-DE-VERIFICACAO.md` item A12 — precisam registrar que a proteção depende de correspondência exata de caixa no caminho, e não é garantida para variações que o roteador do Next ainda resolve para a mesma zona |
| D2 | `ROTEIRO-DE-VERIFICACAO.md` item A12: "Suba a zona de volta: em até ~1 s `/zonaX` volta" | Medido 3 vezes reerguendo `erp-zona-2` sozinha (mesmo `SESSAO_DIR`): **1273 ms, 1165 ms, 1176 ms** do comando de subida até o primeiro `200`. Consistentemente **acima de 1 s**, porque o tempo inclui não só o TTL do cache de saúde (1 s) mas também o boot do `next start` da zona (~200-300 ms, visto nos logs de subida). "~1 s" está otimista; o texto deveria dizer algo como "~1,2–1,3 s (TTL de 1 s + tempo de boot do processo)" | `ROTEIRO-DE-VERIFICACAO.md` item A12 e `atual.md` §8 |
| D3 | Nenhum documento (`atual.md` §8, `06-seguranca.md`) descreve a **janela entre a queda real do processo e a expiração do cache de saúde** | Medido: com o cache ainda marcando a zona como saudável (sonda bem-sucedida imediatamente antes), **40 requisições concorrentes disparadas nos primeiros 251 ms após a morte do processo, 40/40 receberam `500 Internal Server Error` cru** (sem content-type, sem CSP, sem página própria), não o 503. Numa segunda medição sequencial na mesma zona, isso persistiu por até 818 ms (a duração exata depende de quando a última sonda bem-sucedida expirou; o teto teórico é o TTL de 1 s). Isto é esperado dado o desenho (cache com TTL, não invalidação ativa), mas **não está declarado em lugar nenhum** como uma janela de exposição conhecida — hoje um leitor de `atual.md` §8 pode achar que a proteção é instantânea | `atual.md` §8 — acrescentar que existe uma janela de até ~1 s (o TTL) em que requisições concorrentes recebem o erro cru do gateway em vez do 503, entre a queda real do processo e a próxima sonda |
| D4 | Nenhum documento descreve o comportamento com a **zona travada** (processo vivo, mas não responde) | Medido 3 vezes (`kill -STOP`/`kill -CONT` no processo da zona 2): a requisição fica pendurada por **597–615 ms** antes de o shell responder `503` — bate com o timeout declarado da sonda (500 ms) mais ~100 ms de sobrecarga (parsing, geração do corpo). Comportamento correto e coerente com o design, só não está escrito em lugar nenhum como garantia | `atual.md` §8 — vale registrar que o timeout de 500 ms da sonda também protege contra zona travada (não só zona morta), com o número observado |
| D5 | `08-desempenho.md` (referido em `atual.md` §1.1 e no gateway de telemetria): comentário no código e no fluxo diz que o gateway limita a 256 KB, mas não distingue corpo com e sem `Content-Length` | Confirmado: **sem `Content-Length`, o gateway lê o corpo inteiro antes de aplicar o limite** (`route.ts`: `tamanhoBytes = 0` quando o cabeçalho falta, então a condição `tamanhoBytes <= TAMANHO_MAXIMO_BYTES` é sempre verdadeira nesse caso e `req.arrayBuffer()` roda sem limite). Testado com 300 KB chunked sem `Content-Length` → ainda assim corretamente rejeitado com `413` (o tamanho real é medido **depois** da leitura completa). Testado com 20 MB chunked sem `Content-Length` → aceito, lido por completo, `413` em ~100 ms de parede (localhost, sem stress real de memória nessa escala). Isto confirma a suspeita já registrada em `RETOMADA.md` ("o gateway de telemetria lê o corpo inteiro quando não há `Content-Length`"): o limite de 256 KB é aplicado só depois da leitura completa, não durante, então um cliente que envie um corpo chunked muito maior (centenas de MB/GB) força o processo do shell a bufferizar tudo antes de rejeitar — não testei esse cenário extremo por seria uma sobrecarga real no meu próprio ambiente e sairia do "reporte, não estresse a máquina compartilhada" implícito no raio de alcance | `08-desempenho.md` ou `atual.md` §1.1 — declarar que o limite de 256 KB não é aplicado em streaming; é um teto pós-leitura, o que é relevante para dimensionar risco de memória |

---

## 3. Medições

### Item 7 — suíte automática ponta a ponta
`node --test repos/verificacao/*.test.mjs`: **26/26 passam**, uma execução, portas livres antes e
depois. Saída completa em `suite-verificacao.txt`.

### Item 1 — zona fora do ar, uma de cada vez
Baseline com as três zonas no ar: `/` (bruno) `200`, `/zona1` (bruno) `200`, `/zona2` (ana) `200`,
`/acesso` (carla) `200` (`item1-baseline.txt`).

- Zona 1 derrubada (`kill -TERM` no processo real, porta 3001 confirmada livre): `/zona1` (bruno) →
  `503`, `retry-after: 5`, `cache-control: no-store`, `content-type: text/html; charset=utf-8`,
  corpo é a página própria (`pagina-erro-zona.ts`, título "Zona temporariamente indisponível" +
  nome da zona). `/` (bruno) `200`, `/zona2` (ana) `200`, `/acesso` (carla) `200` — não afetadas.
  Evidência: `item1-zona1.txt`, `body-zona1-fora.html`.
- Zona 2 derrubada: mesmo padrão (`503`, headers idênticos), outras rotas `200`. Evidência:
  `item1-zona2-fora.txt` (nota: essa rodada específica também mostrou `/zona1` em `503` porque a
  zona 1 ainda estava fora de uma medição anterior na mesma sessão — não é um bug, é o estado
  acumulado do teste; registrado para honestidade, não escondido).
- Zona acesso: testada dentro do crossover do item 3 (ver abaixo) e confirmada `503` com os mesmos
  headers ao derrubar o processo real.
- Uma repetição por zona (não 3 rodadas completas do item 1 isoladamente, porque as zonas foram
  reaproveitadas entre os itens 1, 2 e 3 do pedido para não multiplicar builds/reinícios
  desnecessários — a mecânica de detecção é a mesma testada repetidamente nos itens 2–4).

### Item 2 — tempo de recuperação após reerguer a zona (declarado: TTL 1 s)
Zona 2 derrubada e reerguida 3 vezes, mesmo `SESSAO_DIR`, sondando `/zona2` a cada 20-30 ms após o
comando de subida:

```
rodada 1: primeiro 200 em 1273 ms
rodada 2: primeiro 200 em 1165 ms
rodada 3: primeiro 200 em 1176 ms
```
n=3, ambiente: máquina do desenvolvedor, sem isolamento de CPU garantido (não medi `load average`
nesta rodada — falha minha, ver "o que não executei"). Evidência: `item2-recuperacao-v3.txt`,
`item2-recuperacao-r2.txt`, `item2-recuperacao-r3.txt`.

### Item 3 — janela logo após a queda (crash window)
Zona 2 com sonda bem-sucedida imediatamente antes da queda (cache "saudável" ainda válido por até
1 s); processo morto via `SIGTERM`; 40 requisições disparadas concorrentemente:

```
40/40 requisições em 49–251 ms desde a morte do processo → 500 Internal Server Error
  (sem content-type, sem CSP, sem cache-control, corpo "Internal Server Error" de 21 bytes)
```
Segunda medição (zona-acesso, sequencial): 200 requisições sequenciais entre 8 ms e 818 ms desde a
morte → **todas** ainda `500` cru (nenhuma virou `503` dentro dessa janela, porque 200 round-trips
de ~4 ms cada somaram só 818 ms, ainda dentro do TTL de 1 s do cache). Uma terceira chamada, isolada,
iniciada bem depois (>1 s desde a morte), já veio `503` corretamente. n=1 processo por zona testada
(zona2 para a concorrente, zona-acesso para a sequencial), sem repetição da mesma configuração —
ver pendências. Evidência: `item3-janela-resultado.txt`, `item3-crossover-resultado.txt`,
`item3-crossover2-resultado.txt`.

Isto destrava a pergunta implícita do documento: a janela de exposição ao erro cru **é limitada pelo
TTL do cache de saúde (1 s)**, não indefinida, mas dentro dela **toda** requisição concorrente ou
sequencial recebe o erro cru — não há um mecanismo de "primeira detecção invalida o cache
imediatamente para as demais", é puramente TTL.

### Item 4 — zona travada (SIGSTOP/SIGCONT), timeout declarado da sonda: 500 ms
3 medições independentes, processo da zona 2 travado com `SIGSTOP`, uma requisição disparada,
depois `SIGCONT`:

```
medição 1: 615 ms até o 503
medição 2: 598 ms até o 503
medição 3: 597 ms até o 503
```
Consistente com o timeout declarado de 500 ms mais ~100 ms de sobrecarga (geração do HTML da página
de erro, latência de loopback). n=3. Evidência: `item4-travada.txt`, `item4-travada-repeticoes.txt`.

### Item 5 — caminhos adversários com zona 2 fora
Ver achado C1 (seção 1) e a lista completa de 7 variantes na seção "Passou — sem achado". Nenhuma
amostragem estatística aqui — são testes categóricos (200/404/503/500 por caminho), n=1 por caminho,
repetidos 2× para as variantes de caixa que geraram o achado C1 (zona derrubada em duas ocasiões
distintas, mesmo resultado nas duas). Evidência: `item5-caminhos-adversarios-zona-fora.txt`,
`item5-variantes-caixa.txt`, `item5-variantes-caixa-zona-fora.txt`, `item5-ZONA2-zona-viva.txt`,
`item5-sem-sessao-variantes.txt`.

### Item 6 — gateway `/api/otel/v1/traces`
- Sem sessão, corpo pequeno: `204`. n=1.
- Com sessão (bruno), 300 KB com `Content-Length: 307200`: `413`. n=1.
- Com sessão (bruno), 300 KB **sem** `Content-Length` (chunked): `413` — o limite é aplicado depois
  da leitura completa, não antes (ver D5). n=1.
- Com sessão (bruno), **20 MB** sem `Content-Length` (chunked): aceito por completo e só então
  rejeitado com `413`, 0,10 s de parede em localhost (não testei escala que estressasse memória de
  verdade — ver pendências). n=1.
- 65 lotes em sequência (sessão carla), mesmo minuto: **60× `204`, a partir do 61º `429` com
  `Retry-After: 60`** — bate exatamente com o limite declarado (60/min). n=1 sequência de 65.
  Evidência: `item6-rate-limit.txt`.
- `Content-Length` mentiroso, menor que o corpo real (declara 10, envia 300 KB): `400 Bad Request`,
  `Connection: close` — rejeitado pelo parser HTTP do Node antes de chegar à aplicação (framing
  inválido), sem vazar detalhe de implementação além do próprio código HTTP. n=1.
- `Content-Length` mentiroso, maior que o corpo real (declara 300000, envia 3 bytes): a conexão
  **fica pendurada indefinidamente** esperando o restante dos bytes prometidos; com `--max-time 5`
  o cliente abortou sem receber nenhuma resposta (`curl` exit 28, `http_code=000`). Não é um bug
  específico da telemetria — é o comportamento padrão de um servidor HTTP esperando o corpo
  declarado — mas não há timeout de leitura de corpo configurado que eu tenha observado dentro de
  5 s; **não esperei além disso** para descobrir o timeout real do Node (padrão do Node 18+ é
  `requestTimeout` de 300 s), então não posso dizer se e quando o servidor desiste sozinho.
  Evidência: `item6-content-length-mentiroso.txt`.

---

## O que eu não consegui executar

- **C1 (bypass por maiúsculas) só foi verificado na zona 2.** Não repeti ao vivo em zona1 e acesso
  por tempo; a causa raiz (`encontrarZonaPorCaminho`) é a mesma função para as três, então é
  razoável esperar o mesmo resultado, mas isso é inferência, não execução. Se o gate quiser, vale
  confirmar nas outras duas antes de aceitar a correção como completa.
- **20 MB sem `Content-Length` não é uma prova de exaustão de memória real** — só confirma que a
  leitura é integral antes do corte. Não subi para centenas de MB/GB porque isso arriscaria
  pressão real de memória/CPU na minha própria máquina de desenvolvimento sem necessidade clara
  para o achado (o mecanismo já está demonstrado com 20 MB). Não afirmo que isso é ou não é
  explorável como negação de serviço em produção; afirmo apenas que o corte de tamanho não é
  aplicado em streaming.
- **`Content-Length` maior que o corpo real**: não esperei além de 5 s para descobrir se e quando o
  servidor Node desiste da conexão sozinho. Fica em aberto se existe timeout de leitura de corpo
  configurado ou se depende só do padrão do runtime.
- **Não medi `load average`/contenção da própria máquina** nas medições de tempo de recuperação
  (item 2) e da janela de queda (item 3) — soube depois que deveria ter registrado isso a cada
  medição, conforme a instrução original. As medições em si (diferenças de centenas de ms, TTL de
  1 s) são grandes o suficiente para não depender criticamente de ruído de CPU local, mas não tenho
  como provar isso sem o dado que não coletei.
- **Não testei os achados adversários da família 1 do pedido geral** (cookie forjado, `curl` sem
  `Authorization`, timing de enumeração, CSRF, concorrência com `If-Match`, etc.) — não faziam parte
  do escopo explícito dos 7 itens desta rodada (gate do shell/proxy), e a suíte automática já cobre
  parte deles (cookie forjado, sessão expirada em Server Action). Se este gate também cobrir essas
  afirmações, ficam como pendência de uma rodada separada.
- **Não naveguei com navegador real** — tudo via `curl` e `fetch` do Node, com cabeçalhos forjados
  manualmente. Não simulei um cliente de navegador de verdade para nenhum dos 7 itens.
- **Não repeti o item 1 em 3 rodadas completas e independentes por zona** — reaproveitei as zonas já
  derrubadas/reerguidas pelos itens 2–4 para essa verificação categórica, o que é suficiente para
  confirmar o mecanismo mas não dá uma amostra estatística do item 1 isoladamente.

---

## Housekeeping

Todas as portas que eu possuía nesta tarefa (3000, 3001, 3002, 3003, 4001, 4002, 4003, 4004, 4010)
confirmadas **livres** ao final:
```
port 3000: free   port 3001: free   port 3002: free   port 3003: free
port 4001: free   port 4002: free   port 4003: free   port 4004: free   port 4010: free
```
Verdaccio (`:4873`) segue no ar, não foi tocado (`200` na checagem final). Nenhum processo
`next-server`, `next start`, `servidor.mjs`, `subir-base.mjs` ou dos apps `erp-*` meu ficou
rodando (`pgrep` vazio ao final). Nenhum arquivo em `repos/` foi editado — só criei arquivos em
`.agents/challenger_shell_1/` (incluindo `harness.mjs`, um script de orquestração próprio usado
para controlar zonas individualmente com `SESSAO_DIR` compartilhado; ele só lê caminhos de
`repos/`, nunca escreve neles).
