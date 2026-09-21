APPROVE

Commit avaliado: HEAD de `bff-multizone` no início da sessão (`erp-shell` em `f3d8803`, submódulo
já fixado no principal; `git status` do principal limpo). Instância própria em
`localhost:3000-3003` + `127.0.0.1:4001-4004,4010`, subida com `base/scripts/ambiente.mjs`
(`subir`/`derrubarApp`/`subirApp`/`derrubarDominio`/`subirDominio`, já existente, não editado) a
partir de scripts próprios em `.agents/challenger_shell_2/` (`run.mjs` cobre os itens 1-4 numa
única sessão de ambiente; `run-rsc-isolado.mjs`, `run-rsc-arvore-real.mjs`,
`run-recheck-acesso.mjs`, `run-cl-mentiroso.mjs` são reruns isolados de pontos específicos, cada um
sobe e derruba o próprio ambiente). Builds já existentes, não reconstruí nada. Verdaccio (`:4873`)
não foi tocado (`200` antes e depois). Nenhum arquivo de `repos/` ou `base/` foi editado — só leitura
e import. Todas as portas próprias (3000-3003, 4001-4004, 4010) confirmadas livres antes de cada
rodada e ao final (ver seção Housekeeping).

Todos os artefatos brutos estão em `.agents/challenger_shell_2/` (arquivos `item*.txt`, `.json`,
`.html` de evidência, e os scripts `.mjs` usados para gerá-los).

---

## 1. Achados adversários (binário, ordenado por severidade)

Nenhum achado adversário bloqueante nesta rodada. Os dois achados relevantes da iteração 1
(C1 — bypass por maiúsculas; D5 — leitura integral do corpo antes do limite) foram re-executados
ao vivo e **confirmados corrigidos** — ver seção 2 (elas viram divergências fechadas, não achados
novos).

### Sem achado — verificado com evidência
- **Vazamento de módulo com gestão de acesso fora (item 2, HTML inteiro + `self.__next_f`)**:
  para `davi`, `bruno` e `ana`, em `/zona1`, `/zona1/relatorios`, `/zona2`, `/acesso` e `/`, o HTML
  completo (15 respostas) foi varrido por regex incluindo o conteúdo dentro de
  `self.__next_f.push([...])`. Minha primeira varredura sinalizou "vazamento suspeito" em todas as
  15 respostas, mas era falso positivo do meu próprio detector: o padrão
  `aria-label="Módulos"` está sempre presente no wrapper `<nav>` da `Moldura`, vazio ou não
  (`<nav class="moldura-menu" aria-label="Módulos"><ul></ul></nav>`). Refeita a varredura excluindo
  esse falso positivo e usando termos realmente sensíveis (`CC-10`, `Custo`, `svc\.`, `Bearer `,
  `Relatórios`, `Painel da zona 1`, `Conferir invent[áa]rio`, `Revisar cadastro`,
  `Gestão de acesso`), **nenhuma das 15 respostas continha qualquer um desses termos**, nem no HTML
  visível nem dentro do payload de flight. A única ocorrência da palavra "relatorio" no flight de
  `/zona1/relatorios` é o próprio segmento de rota (`"children":["zona1",{"children":["relatorios",...`),
  não conteúdo de negócio. Confirma a correção do achado V1 do auditor da iteração 1
  (`exigirModulo` fail-closed, `lib/pagina.ts`). Evidência: `item2-gestao-acesso-fora.txt`,
  `item2-VAZAMENTO-*.html` (15 arquivos, mantidos apesar do rótulo — são a evidência de que a
  varredura ampla não achou nada real, não de vazamento).
- **Streaming de telemetria não bufferiza corpo inteiro antes do limite (item 3.2/3.3)**: 300 KB
  chunked sem `Content-Length` → `413` em 14 ms, RSS do processo do shell variou +384 KB; 20 MB
  chunked sem `Content-Length` → `413` em 49 ms, RSS variou **+1280 KB** (não +20 MB). Isso confirma
  que a leitura é cortada durante o streaming (perto do limite de 256 KB), não depois de ler tudo —
  ver `lib/telemetria.ts::lerComLimite`, que cancela o `ReadableStream` assim que `total > limite`.
  Fecha o achado D5 da iteração 1 como corrigido (seção 2). Evidência: `item3-telemetria.txt`.
- **Rate limit de telemetria (60/min)**: 61 requisições sequenciais da mesma sessão (`carla`) →
  60× `204`, 61ª `429` com `Retry-After: 60`, exato. Evidência: `item3-telemetria.txt`.
- **Telemetria anônima**: sem sessão, `204` e **zero** lotes chegaram ao coletor falso próprio
  (não o coletor interno da suíte automática — um `http.Server` que eu mesmo levantei e passei via
  `OTEL_EXPORTER_OTLP_ENDPOINT`). Evidência: `item3-telemetria.txt`, log de lotes recebidos anexado
  ao mesmo arquivo (60 entradas, todas do teste 3.6, nenhuma do 3.1).
- **Coletor fora do ar**: derrubei meu próprio coletor falso (o único configurado nesta instância);
  a resposta ao chamador (`davi`, usuário não usado antes para não herdar o `429` do teste de taxa
  de `carla`) seguiu `204` em 6 ms — confirma o `catch` silencioso em `lib/nucleo.ts`/rota, sem
  derrubar a página de quem mandou o lote. Evidência: `item3-telemetria.txt`.
- **Corpo não-JSON** → `400`. **Content-Length menor que o corpo real** (declara 10, envia 300 KB,
  via `curl` bruto porque o `fetch`/undici do Node recusou no lado do cliente antes mesmo de
  enviar) → `HTTP/1.1 400 Bad Request` + `Connection: close`, corpo vazio, sem detalhe de
  framework — igual ao medido na iteração 1. Evidência: `item3.4-cl-mentiroso-curl.txt`.
- **C1 revisitado, agora nas três zonas (item 1)**: com cada uma das três zonas (`zona1`, `zona2`,
  `acesso`) derrubada de propósito e o TTL da sonda vencido, testei as 9 variantes adversárias
  (`/ZONA2`, `/Zona2/x`, `/zONA2-static/a.js`, `/zona2/..`, `/zona2/../zona2`, `/zona2%2F..`,
  `/%7Aona2`, `/zona2-static/../zona2`, `//zona2`, e os equivalentes para `zona1`/`acesso`).
  **Todas as variantes de caixa e de reescrita de caminho que apontam para a zona morta devolvem
  `503` com a página própria** (`pagina_propria=true`, `raw_500=false`), nas três zonas, sem
  exceção. O `raw_500` que a iteração 1 documentou como C1 **não se reproduziu em nenhuma das 27
  combinações testadas** (9 caminhos × 3 zonas). Os caminhos que escapam da sonda (`/zona2/..`
  → home do shell, `/zona2%2F..` e `/%7Aona2` → `404` nativo do Next, `//zona2` → `308`) continuam
  inofensivos, como já registrado na iteração 1 — nenhum deles alcança conteúdo de zona.
  Evidência: `item1-caminhos-adversarios-zona-fora.txt`.

### Ruído do meu próprio harness, não do sistema sob teste
- Em `item1`, a checagem final "zona confirmada de volta" para `erp-zona-acesso` deu `false`
  (loop de 5 s sem receber `200`). Investiguei e é **falso negativo do meu script**: usei o cookie
  de `ana` para confirmar a volta de todas as três zonas por simplicidade, mas `ana` não tem o
  perfil `plataforma.admin-acesso` (ver `repos/erp-dominio-stub/src/gestao-acesso.mjs`:
  `ana → {plataforma.usuario, zona2.operador}`), então `/acesso` para `ana` responde corretamente
  `404` (módulo não concedido) mesmo com a zona no ar. Reexecutei isolado
  (`run-recheck-acesso.mjs`): com `ana`, `404` (esperado); com `carla`, `200` — a zona voltou
  normalmente. Registro isto para honestidade: não é um achado sobre o sistema, é um defeito do meu
  teste, corrigido e reverificado. Evidência: `recheck-acesso.txt`.

---

## 2. Divergências declarado × observado

| # | Declarado | Observado | Documento a corrigir |
|---|---|---|---|
| E1 (fecha C1 e D1 da iteração 1) | `atual.md` §1.1: "O prefixo de zona é casado sem diferenciar maiúsculas, como o rewrite do Next... a armadilha R1 da PoC não se repete aqui" | **Confirmado ao vivo, nas três zonas.** `encontrarZonaPorCaminho` agora normaliza para minúsculas antes de comparar (`lib/zonas.ts`), e as 27 combinações de caminho×zona testadas com a zona morta devolveram todas `503` com a página própria — nenhuma devolveu o `500` cru documentado como C1 na iteração 1. **Nenhuma correção de documento necessária**: a afirmação já está certa e agora tem reexecução independente confirmando. | nenhum |
| E2 (fecha D5 da iteração 1) | Nenhuma versão anterior deste documento afirmava um limite em streaming; a iteração 1 identificou que o limite de 256 KB só era aplicado **depois** de ler o corpo inteiro | **Corrigido**: `lib/telemetria.ts::lerComLimite` cancela a leitura do `ReadableStream` assim que o total excede o limite. Medido: 20 MB chunked sem `Content-Length` → RSS do processo variou só ~1,25 MB (não ~20 MB), `413` em 49 ms. O comentário no próprio código (`lib/telemetria.ts`) já documenta a razão ("ler tudo para medir depois deixava qualquer um alocar memória arbitrária"). **Nenhuma correção de documento necessária** — o próprio código agora é a documentação correta do comportamento; se `08-desempenho.md` ou `atual.md` §1.1 quiserem citar o número medido, o valor é: 20 MB → pico de alocação ≈256 KB (não 20 MB). | nenhum obrigatório; opcionalmente citar o número medido em `atual.md` §1.1 |
| E3 | `atual.md` §8: "Ao voltar, a zona responde de novo em ~1,2 s"; `ROTEIRO-DE-VERIFICACAO.md` A12: "em ~1,5 s `/zonaX` volta" | Medido 3 vezes, reerguendo `erp-zona-2` logo após a janela de queda do item 4.1 (cache de saúde **já expirado/marcado como não-saudável** nesse ponto, diferente da condição da iteração 1, que reergueu a zona com o cache ainda "bom" por até 1 s): **767 ms, 786 ms, 779 ms** até o primeiro `200`, medidos do instante do comando `subirApp` até a resposta. Isso é **menor** que os dois valores documentados (~1,2 s e ~1,5 s), não maior — indica que os documentos estão pessimistas para o caso em que o cache de saúde já sabe que a zona está fora (sem TTL a esperar), embora ainda estejam corretos ou otimistas para o caso em que o cache estava "bom" no momento da queda (que é o que a iteração 1 mediu: 1165-1273 ms, e o meu não reproduziu essa condição). **Não afirmo que os documentos estão errados** — afirmo que o número depende de uma variável não declarada (se o cache de saúde já expirou ou não no momento em que a zona volta), e nenhum dos dois documentos menciona essa dependência. | `atual.md` §8 e `ROTEIRO-DE-VERIFICACAO.md` A12 — esclarecer que o tempo de retorno (~0,8 s a ~1,3 s, pelas duas medições independentes já feitas) depende de quanto tempo o cache de saúde já estava marcado como não-saudável antes da zona voltar; um único número fixo (seja 1,2 s ou 1,5 s) não cobre as duas pontas medidas |
| E4 (informativo, não é uma falha) | Nenhum documento cobre requisição de navegação RSC de cliente real (`RSC: 1` + `Next-Router-State-Tree`) contra uma rota protegida com a gestão de acesso fora | **Não consegui construir uma requisição RSC de navegação válida sem um cliente Next real.** Toda tentativa com um `Next-Router-State-Tree` sintético (mesmo copiando a estrutura de segmentos vista no flight payload real de `/zona1`) foi respondida com `307` para o mesmo caminho com um parâmetro `_rsc=<hash>` de invalidação de cache — **idêntico com e sem a gestão de acesso no ar** (testado isoladamente nos dois estados, mesmo hash de árvore, resultado idêntico). Isso é o próprio mecanismo interno do Next de invalidação de cache de rota por árvore desatualizada, não uma decisão da aplicação (nenhum código em `decisao-proxy.ts`, `proxy.ts` ou `lib/pagina.ts` inspeciona o cabeçalho `RSC` ou `Next-Router-State-Tree`). Não é evidência de vazamento nem de ausência de vazamento nesse canal específico — é uma lacuna de execução minha, registrada explicitamente na seção final. **O caminho equivalente sem os cabeçalhos RSC (GET normal) foi testado e não vazou** (ver seção 1), e como a lógica de aplicação não distingue RSC de documento completo, é razoável (mas não comprovado ao vivo) esperar o mesmo resultado — fica como pendência explícita. | nenhuma correção de documento; registrar a limitação de execução se este item for cobrado de novo em rodada futura |

---

## 3. Medições

### Item 5 — suíte automática ponta a ponta
`node --test base/verificacao/*.test.mjs`: **30/30 passam**, uma execução, 12,2 s de duração total,
portas livres antes e depois. Saída completa em `suite-verificacao.txt`.

### Item 1 — variantes de caixa/caminho com cada zona morta (zona1, zona2, acesso)
n=1 por combinação de caminho×zona (27 combinações: 9 caminhos × 3 zonas), execução única, mesma
sessão de ambiente, zonas revividas e confirmadas de volta entre cada bloco antes de passar para a
próxima. Resultado categórico (200/404/503/500 por caminho), não estatístico — apropriado para o
tipo de asserção (a mesma função de decisão é usada para as três zonas, então repetição adicional
por zona teria baixo valor incremental depois de confirmado nas 27 combinações). Nenhum `500` cru
observado. Evidência: `item1-caminhos-adversarios-zona-fora.txt`.

### Item 2 — gestão de acesso fora, HTML inteiro e flight payload
15 respostas de página completa (3 usuários × 5 caminhos), n=1 cada, mais 3 tentativas de
requisição RSC de navegação (ver E4, execução falha/inconclusiva por limitação de ferramenta, não
por resultado do sistema). Evidência: `item2-gestao-acesso-fora.txt` e os 15 `.html` anexos.

### Item 3 — gateway de telemetria
- Anônimo: n=1, `204`, 0 lotes no coletor.
- 300 KB chunked sem `Content-Length`: n=1, `413` em 14 ms, ΔRSS +384 KB.
- 20 MB chunked sem `Content-Length`: n=1, `413` em 49 ms, ΔRSS +1280 KB (não bufferiza os 20 MB).
  Máquina do desenvolvedor, sem isolamento de CPU garantido; não medi contenção de CPU concorrente
  durante esta medição especificamente (falta registrada abaixo).
- `Content-Length` mentiroso menor: n=1, `400` + `Connection: close`, via `curl` bruto (o
  `fetch`/undici do Node se recusa a enviar um `Content-Length` manual incompatível com o corpo,
  então a tentativa original com `fetch` não chegou a sair da máquina cliente — refeita com `curl`
  para produzir tráfego de rede real).
- Corpo não-JSON: n=1, `400`.
- 61 lotes sequenciais (mesma sessão `carla`): n=1 sequência de 61, `204` × 60, `429` com
  `Retry-After: 60` no 61º — bate exatamente com o limite declarado.
- Coletor fora do ar: n=1, `204` em 6 ms (usei `davi`, não `carla`, para não herdar o `429` do
  teste anterior pela mesma chave de limitador).
- Evidência completa, incluindo o log bruto de cada lote recebido pelo coletor falso (60 entradas,
  timestamps de milissegundo), em `item3-telemetria.txt`; o caso 3.4 em `item3.4-cl-mentiroso-curl.txt`.

### Item 4 — janela pós-queda e recuperação (zona 2)
Ambiente com carga apenas do próprio teste; `load average` do SO registrado no início (0.74, 0.6,
0.4) e a cada rodada de recuperação (subiu para 1.16 depois da primeira rodada — provavelmente o
próprio processo `next start` sendo reiniciado 3 vezes em sequência rápida; não isolei essa
contenção da minha própria máquina do resto do sistema).

- **Janela pós-queda**: sonda de saúde aquecida (uma requisição de sucesso a `/zona2` imediatamente
  antes), processo morto com `SIGKILL` (via `derrubarApp`, que mata o grupo do processo), 40
  requisições concorrentes disparadas no instante da morte. **40/40 responderam `500 Internal
  Server Error` cru**, todas entre **18 ms e 192 ms** desde a morte do processo — bem dentro do
  teto de "até ~0,8 s" já documentado em `atual.md` §8 (crédito: challenger_shell_1), e
  consideravelmente mais rápido que o pior caso registrado na iteração 1 (818 ms). n=40
  requisições, 1 execução da janela. Isto **confirma** o limite superior já documentado; não o
  contradiz.
- **Recuperação**: 3 rodadas independentes de derrubar (`SIGKILL`) → esperar 1200 ms (TTL vencido)
  → reerguer → sondar a cada 20 ms até o primeiro `200`. **767 ms, 786 ms, 779 ms** — ver
  divergência E3 acima. n=3.

Esta medição destrava/reforça a pergunta implícita de `atual.md` §8 sobre o tempo de recuperação:
o valor documentado (~1,2-1,5 s) parece assumir que o cache de saúde ainda está "bom" no momento da
queda (cenário da iteração 1); quando o cache já está marcado como não-saudável antes da zona
voltar (meu cenário), a recuperação é ~35-40% mais rápida. Nenhum dos dois documentos distingue
esses dois cenários.

---

## O que eu não consegui executar

- **Requisição RSC de navegação de cliente real contra `/zona1/relatorios` com a gestão de acesso
  fora, no sentido estrito pedido** (cabeçalho `Next-Router-State-Tree` reproduzindo fielmente o
  que um navegador real enviaria): toda tentativa com árvore sintética — inclusive uma copiada da
  estrutura de segmentos observada no flight payload real de `/zona1` — foi respondida com um
  redirecionamento `307` de invalidação de cache do próprio Next (`_rsc=<hash>`), idêntico com e
  sem a gestão de acesso no ar. Não tenho um cliente Next real (navegador ou `next/router`) para
  gerar o cabeçalho correto. **Isto não é evidência de que o canal RSC não vaza** — é ausência de
  execução válida nesse canal específico. O caminho equivalente sem cabeçalhos RSC (documento HTML
  completo, que exercita exatamente o mesmo código de servidor — nenhuma parte da aplicação
  distingue pela presença do cabeçalho `RSC`) foi testado e não vazou.
- **Não isolei a contenção de CPU da minha própria máquina durante as medições de tempo** (item 3.2/
  3.3, item 4). Registrei `load average` do SO só no item 4 (0.6-1.16, moderado); não registrei para
  o item 3. As diferenças medidas (413 em 14-49 ms, ΔRSS na casa de centenas de KB a poucos MB; 500
  cru em 18-192 ms; recuperação em 767-786 ms) são grandes o suficiente frente ao ruído esperado de
  uma máquina de desenvolvimento moderadamente ociosa para serem discutíveis, mas não tenho como
  provar isso sem o dado de `load average` simultâneo que não coletei no item 3.
  Recovery, o `load average` subiu de 0.74 para 1.16 entre a rodada 1 e 2 — não sei dizer se isso
  influenciou os 767→786→779 ms (a variação entre rodadas é pequena, 19 ms, mas não posso separar
  "ruído de máquina" de "variação real do sistema" com n=3.
- **Não repeti a janela pós-queda (item 4.1) nem a recuperação em outras zonas** (só zona 2, como
  pedido) — se o gate quiser, zona1 e zona-acesso usam o mesmo mecanismo de cache de saúde
  (`saude-zonas.ts` é compartilhado), então é razoável esperar números semelhantes, mas isso é
  inferência, não execução.
- **Não testei o caso "20 MB" nem além disso em escala que realmente estressasse memória do
  processo do shell** (ex.: centenas de MB/GB) — o mecanismo de corte em streaming já ficou
  demonstrado com 20 MB (ΔRSS de ~1,25 MB, não ~20 MB), e subir a escala arriscaria pressão real de
  memória/CPU na minha própria máquina sem necessidade adicional clara para o achado.
  Não afirmo que uma escala maior é ou não é explorável como negação de serviço — apenas que o
  corte por tamanho é aplicado durante a leitura, não depois.
- **Não repeti a família 1 completa de sondas adversárias do pedido geral** (cookie forjado direto
  ao stub, timing de enumeração com n≥500, CSRF em todas as combinações, `If-Match`/concorrência
  etc.) — não fazia parte do escopo explícito dos 5 itens desta rodada (gate do shell/proxy,
  iteração 2); parte já está coberta pela suíte automática (cookie forjado, Server Action sem
  Origin, sessão expirada) e passou nela (item 5).
- **Não usei navegador real** em nenhum item — tudo via `fetch`/`curl` com cabeçalhos forjados à
  mão. É a mesma limitação já registrada pela iteração 1.

---

## Housekeeping

Todas as portas que eu possuía nesta tarefa (3000, 3001, 3002, 3003, 4001, 4002, 4003, 4004, 4010)
confirmadas **livres** ao final de cada script e na checagem final:
```
3000:000  3001:000  3002:000  3003:000
4001:000  4002:000  4003:000  4004:000  4010:000
```
(`000` = conexão recusada, isto é, porta livre). Verdaccio (`:4873`) confirmado no ar (`200`) e não
tocado. Nenhum processo `next-server`, `next start`, `servidor.mjs` ou `pnpm start` meu ficou
rodando (`pgrep` limpo, exceto o próprio comando de checagem se auto-listando). Nenhum arquivo em
`repos/` ou `base/` foi editado (`git status` limpo nos dois); todos os arquivos criados estão em
`.agents/challenger_shell_2/`.
