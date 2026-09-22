# auditor_shell_3: gate "Shell novo (Gabriel)", iteração 3

**Veredito: INTEGRITY VIOLATION** (veto: V1 e V2)

Escopo: `erp-shell` 72e0475, `erp-zona-1` f26fd7c, `erp-zona-2` 8627c02, `erp-zona-acesso` ee623ab, `@erp/nucleo` 0.6.0
instalado nas apps (= e624c0c) e o fonte do `erp-nucleo` e579454 (unidade do núcleo), `base/verificacao/*` e
`base/scripts/ambiente.mjs` do principal em 1e64855. Todas as mutações rodaram numa cópia
(`scratchpad/aud3/copia/{repos,base}`); a árvore real não foi editada. Tabela completa: `mutacoes.txt`. Scripts,
testes mínimos e saídas brutas: `anexos/` (`muts.mjs`, `mut.sh`, `mutL.sh`, `lote.sh`, `liberar.sh`,
`lacunas3.test.mjs`, `saidas/`, `lote-resultados*.txt`, `lacunas-resultados.txt`).

## Números reproduzidos
- Unidade do shell: **36/36** na árvore real e na cópia (`node --test test/*.test.mjs`).
- Unidade do núcleo (cópia, e579454): **107/107** (`tsc -p tsconfig.json && node --conditions react-server --test test/*.test.mjs`).
- Zonas: não têm suíte de unidade (sem `test/` nem script `test`).
- e2e `node --test base/verificacao/*.test.mjs` na cópia: **47/47, 0 skipped** com `CONSTRUIR=tudo` (55 s, 4 builds);
  de novo 47/47 com `CONSTRUIR=1` no meio do lote 2 e no fim, depois de restaurar tudo.

## O que a iteração 2 corrigiu e agora é pego
- **V1 da iteração 2 fechado:** fail-open do `exigirModulo` só na zona 2 → L1/V1 reprova; só na zona 1 → L1 e L6.
  Na zona de acesso e no shell continua equivalente (a página de acesso lê o catálogo do próprio serviço que está fora;
  a do shell chama `modulosPermitidos()` de novo e lança; L1 e D4 passam com a mutação e procuram o conteúdo).
- G2: CSP sem `form-action`, sem `img-src`, `/login` sem CSP e o dist do núcleo sem `form-action` → G2; sem nonce →
  "CSP com nonce".
- G4: anônimo repassado, 429 ignorado ou repassado antes, não-JSON repassado ou engolido com 204 → L4/V2.
- Sonda: constante de timeout, `signal` removido (U4), ≥500 como vivo (U3), TTL infinito/ignorado/só "fora" eterno
  (U1/U2 + L2/G5), caixa no caminho (C1 + L2) e no prefixo estático (C1, só unidade), `/api/otel`/`/api/auth` por
  substring, `includes` ou `/api` inteiro (U6, só unidade), asset antes da sonda (U5 + G5).
- T1: regex frouxa e shell ignorando o trace do navegador → T1 no e2e; trace zerado e texto qualquer aceitos → só a
  unidade do núcleo pega (o T1 do e2e só envia traceparent válido).
- `__Host-flash`: sem `Secure` ou sem apagar no shell → L5; zonas sem apagar → L5 + N4. Zonas sem `Secure`: equivalente
  (em `/zona1` chega também a remoção com `Secure`, e o navegador aplica essa; G10 imprime os dois `Set-Cookie`).

## Por que é veto

### V1. Fail-open numa página de módulo que o L1 não visita passa por todas as suítes
A correção da iteração 2 é descrita no GATE_STATUS como "L1 cobre toda página de módulo das 3 zonas". São 5 páginas
de módulo; o `CONTEUDO_DE_MODULO` do L1 tem 4 (`/zona1`, `/zona1/relatorios`, `/zona2`, `/acesso`). Falta
`/zona1/recursos/[id]`.

Mutação `F1-recurso-b`: o mesmo fail-open vetado nas iterações 1 e 2 (engole só o erro com `codigo`, deixa o
`notFound()` subir), só na página do recurso:
```ts
try { await exigirModulo('zona1.painel') } catch (e) { if (!(e && typeof e === 'object' && 'codigo' in e)) throw e }
```
Resultado: unidade 36/36, e2e **47/47**. A checagem estática de invariante 16 também passa (o texto `await exigirModulo('…')`
continua lá). Com a gestão de acesso fora, **o detalhe do recurso chega no HTML**: meu G6 reprova com
`detalhe do recurso chegou com a gestao de acesso fora` (na linha de base, G6 passa e tem dentes: com a gestão no ar,
bruno vê `Identificador:`). É o vazamento do V1, numa rota que a correção declara coberta e não cobre.
(O try/catch que engole tudo, `F1-recurso`, é pego pelo "invariante 16 comportamental", porque engole o `notFound()`.)

**Teste mínimo:** incluir `'/zona1/recursos/r-1': /Identificador:|CC-10/` no `CONTEUDO_DE_MODULO` (e `bruno` no
`donos` do "L1 tem dentes"). Melhor: montar a lista das páginas a partir dos `page.tsx` das apps (a mesma varredura do
"invariante 16 estatico") e reprovar se alguma página de módulo não tiver caminho no L1, para a próxima página nova não
repetir isto. G6 em `anexos/lacunas3.test.mjs` é a versão isolada.

### V2. A sonda de produção sem timeout passa por todas as suítes
A mutação pedida "sonda sem timeout" tem uma forma que sobrevive: a instância que o proxy usa, com timeout efetivo
desligado.
```ts
export const cacheSaudePadrao = criarCacheSaudeZona(TTL_SAUDE_PADRAO_MS, 600_000)
```
Unidade 36/36 (o U4 testa `criarCacheSaudeZona(1000, undefined, …)`, o padrão do parâmetro, não a instância), e2e
**47/47** (L2 e G5 matam a zona com SIGKILL: a conexão é recusada na hora, e o timeout nunca é exercitado). Com a zona 2
travada (SIGSTOP: aceita a conexão e não responde), `/zona2` fica sem resposta: meu G7 reprova com
`status sem resposta (TimeoutError) em 5003 ms`. Na linha de base, G7 passa (503 em menos de 2 s). §1.1 ("timeout de
500 ms") e §8 ("zona travada segura ~0,6 s") continuam sem teste que prenda o comportamento real.

**Teste mínimo:** G7 em `anexos/lacunas3.test.mjs` (e2e: `SIGSTOP` no processo da 3002, espera o TTL, `/zona2` tem de
dar 503 em < 2 s, `SIGCONT` no `finally`). Alternativa na unidade: exportar a configuração da instância ou testar
`cacheSaudePadrao` contra um servidor local que não responde.

## Lacunas (não dão veto sozinhas)
- **Nonce fixo** (`CSP-nonce-fixo`): um nonce constante em toda resposta do shell passa 47/47. Um nonce previsível anula
  a CSP. G9 (dois pedidos, nonces diferentes, em `/` e `/login`) pega.
- **413 em streaming**: a rota pode deixar de usar `lerComLimite` (limite `Infinity` ou `req.arrayBuffer()`) e o e2e
  continua verde, porque o 413 passa a vir de `processarLote` depois de ler tudo. Pelo HTTP isso é equivalente: um G8 que
  media quanto o cliente enviou até a resposta **reprovou na própria linha de base** (o `fetch` só entrega a resposta
  depois do upload inteiro), e eu o tirei. O comentário do L4 ("o limite vale enquanto le, nao depois") afirma algo que o
  L4 não verifica. Só a unidade de `lerComLimite` protege, e nada prende que a rota a use.
- **Teste de unidade que passa pelo motivo errado:** com `lerComLimite` lendo tudo antes de medir, o
  `{ timeout: 2000 }` do teste "para de ler…" não dispara; o arquivo inteiro morre em 46 s (`✖ test/telemetria.test.mjs
  (45955 ms)`). Pega, mas por estouro, não pelo timeout declarado.
- A recusa de traceparent forjado só é protegida pela unidade do núcleo; o T1 do e2e só envia trace válido. Aceitável,
  porque a função é do núcleo e a suíte dele pega as duas formas.
- `C1-estatico` e as quatro formas de U6 só são pegas na unidade do shell. Aceitável.

## Arrumação
- Portas 3000–3003, 4001–4004 e 4010 livres no fim (`ss -ltnH`: nenhuma); nenhum `next start`/`servidor.mjs` vivo.
  O Verdaccio (4873) não foi tocado.
- Árvore real: os 5 submódulos do escopo sem nenhuma alteração; no principal só aparecem `.agents/auditor_shell_3/`
  (este handoff e `anexos/`) e `mutacoes.txt`. Nenhum pacote instalado, nenhum commit.
