# Gate "Shell novo (Gabriel)" — reviewer_shell_1

**Veredito: REQUEST_CHANGES**

Escopo revisado: `repos/erp-shell` commits `6de4939`, `dab5ffd`, `a63b995` (diff completo
`6e05e55..a63b995`), `repos/erp-zona-1` commit `bac6d37` (`lib/pagina.ts`), e leitura de
contexto em `repos/erp-zona-2`/`repos/erp-zona-acesso` (mesmo padrão, não alterado nestes
commits) e `repos/verificacao`. `tsc --noEmit` limpo; `node --test test/*.test.mjs` 22/22 verde.

---

## Achado 1 (BLOQUEIA) — `exigirModulo` libera acesso quando a gestão de acesso falha

**Onde:** `repos/erp-shell/lib/pagina.ts:36-42` (introduzido em `a63b995`, mensagem do próprio
commit: "Gracefully bypass exigirModulo when ErroDeAplicacao is encountered"); a mesma mudança
em `repos/erp-zona-1/lib/pagina.ts:34-41` (`bac6d37`).

```ts
export async function exigirModulo(id: string): Promise<void> {
  try {
    if (!(await modulosPermitidos()).some((m) => m.id === id)) notFound()
  } catch (e) {
    if (e instanceof ErroDeAplicacao) return   // <- permite a renderização
    throw e
  }
}
```

`modulosPermitidos()` relança qualquer `ErroDeAplicacao` que não seja `SessaoInvalida` (rede
fora do ar, timeout, 5xx da gestão de acesso). `exigirModulo` captura esse erro e **retorna
normalmente**, como se o módulo fosse permitido, em vez de negar.

**Cenário concreto, confirmado no código de zona-1 (fora do escopo de arquivo mas convocado
pelo próprio achado):** `repos/erp-zona-1/app/zona1/relatorios/page.tsx`, comentário no próprio
arquivo — *"Módulo restrito: sem concessão, 404 — nem o menu nem a URL revelam que existe"*:

```ts
export default async function Relatorios() {
  await exigirModulo('zona1.relatorios')
  const recursos = await listarRecursos()     // sem novo check
  ...
}
```

Com a gestão de acesso (`:4010`) fora do ar, **qualquer usuário autenticado** — mesmo sem o
módulo `zona1.relatorios` — recebe o relatório completo (`comCusto`, contagens) que deveria ser
404. Isso é exatamente a categoria "BFF decidindo acesso a dado" / "módulo negado respondido
com algo diferente de 404" (ADR-0009 N5, invariante 16 do AGENTS.md).

Verifiquei que na página `/` do próprio shell (`app/(app)/page.tsx`) o efeito prático é
mascarado por acidente: ela chama `modulosPermitidos()` de novo, sem `try/catch`, logo abaixo
de `exigirModulo`, e como é a mesma promise cacheada (`React.cache`) ela rejeita de novo e a
página quebra para `error.tsx` em vez de vazar dado. Isso NÃO é proteção — é coincidência de
uma página específica; `zona1/relatorios` não tem essa segunda chamada e expõe o dado.

**Contraste no mesmo arquivo:** `acaoProtegida` (mesmo `lib/pagina.ts`) trata o erro
corretamente (nega a ação, mostra toast); `dadosDaMoldura` também degrada com segurança
(`indisponivel: true`, menu vazio). O padrão certo já existe ao lado do errado.

**Correção:** fail-closed. Sem confirmação positiva de "módulo permitido", `exigirModulo` deve
chamar `notFound()` (ou devolver 503 se quiser distinguir indisponibilidade de proibição —
nunca "seguir como se estivesse permitido").

---

## Achado 2 (BLOQUEIA) — `proxy.ts` do shell reimplementa cookie+CSP em vez de `criarProxy`

**Onde:** `repos/erp-shell/proxy.ts:36-55` (função `aplicarCsp`), introduzida em `a63b995`
(consolidando o que `6de4939`/`dab5ffd` já vinham fazendo).

Antes deste conjunto de commits, `proxy.ts` chamava a fábrica compartilhada:
```ts
export default criarProxy({ prefixo: '/', rotaLogin: '/login', publicos: [...], outrasAplicacoes: PREFIXOS_DE_ZONA })
```
Agora o shell tem sua própria checagem de cookie e sua própria montagem de CSP, duplicando o
que `@erp/nucleo/proxy`'s `criarProxy` já faz para as zonas (`erp-zona-1/proxy.ts` continua
usando `criarProxy`). O comentário no próprio pacote avisa exatamente disso:
*"Sem esta fábrica, cada zona reimplementaria cookie e CSP e divergiria (limitação 4)."*

**Prova de que já divergiu** — comparando as duas políticas geradas:

| | `criarProxy` (zonas) | `proxy.ts` do shell (novo) |
|---|---|---|
| `img-src` | `'self' data:` | **ausente** |
| `form-action` | `'self'` | **ausente** |

`form-action` não tem fallback para `default-src` na especificação de CSP — a ausência
significa que uma página do shell (login, `/`) não tem nenhuma restrição de para onde um
`<form>` pode submeter, caso um atacante consiga injetar/alterar um form (defesa em
profundidade a menos). Isso é exatamente a restrição citada como bloqueante: "`proxy.ts`
reimplementando sessão ou CSP em vez de chamar `criarProxy`".

**Correção:** manter uma única definição da política (exportar de `@erp/nucleo/proxy` um
construtor de CSP reaproveitável, ou envolver `criarProxy` e compor por cima dela a lógica
nova do shell — saúde de zona, telemetria, rotas reservadas — em vez de reescrever a checagem
de cookie e a CSP do zero).

---

## Achado 3 (BLOQUEIA — consumo de recurso) — telemetria bufferiza o corpo antes de checar sessão

**Onde:** `repos/erp-shell/app/api/otel/v1/traces/route.ts:9-16`.

```ts
const tamanhoCabecalho = req.headers.get('content-length')
let tamanhoBytes = tamanhoCabecalho ? Number(tamanhoCabecalho) : 0   // 0 se ausente
let corpo: ArrayBuffer | null = null
if (tamanhoBytes <= TAMANHO_MAXIMO_BYTES) {                          // 0 <= 256KB: sempre true
  corpo = await req.arrayBuffer()                                    // lê tudo, sem limite real
  tamanhoBytes = corpo.byteLength
}
const resultado = processarLoteDeTelemetria({ sessaoValida: Boolean(sessao), ... })
```

Quando `Content-Length` está ausente (ex.: `Transfer-Encoding: chunked`), `tamanhoBytes` vira
`0`, a comparação `0 <= 256KB` é sempre verdadeira, e `req.arrayBuffer()` bufferiza o corpo
inteiro **sem limite** antes de qualquer checagem de tamanho real acontecer. A checagem de
sessão (que descartaria em 204) só roda **depois** desse `await`.

`decisao-proxy.ts` deixa `/api/otel` passar pela camada 1 sem exigir cookie (ação
`'telemetria'`, sem checagem de `temCookieSessao`) — por design, para poder devolver 204 em
silêncio a quem não tem sessão. O custo disso: um cliente **sem sessão nenhuma**, sem
`Content-Length`, pode enviar um corpo de tamanho arbitrário (GBs, via chunked) e forçar o
processo do shell a alocar toda essa memória antes de descartar a requisição.

**Correção:** checar `sessaoValida` (e a presença/validade de `Content-Length`) **antes** de
`req.arrayBuffer()`; se `Content-Length` estiver ausente, recusar (411) ou ler via stream com
corte físico ao ultrapassar `TAMANHO_MAXIMO_BYTES`.

---

## Achado 4 (reporta — moderado) — `LimitadorDeTaxa` cresce sem limite

**Onde:** `repos/erp-shell/lib/telemetria.ts:11`.

`registros: Map<string, EntradaTaxa>` nunca remove entradas antigas (só `limpar()` manual, não
chamado em produção); cada `sub` que já mandou telemetria uma vez fica lá para sempre, mesmo
depois que a sessão dele expira. Ao longo da vida do processo (que não reinicia com
frequência), é um vazamento de memória proporcional ao número de usuários distintos ao longo
do tempo. Não é vazamento de dado — o `sub` já é conhecido do servidor — é robustez/disponibilidade
sem verificação.

Conferi a suspeita de "`sub` 'desconhecido' compartilhado": **não é alcançável pela rota real**.
`processarLoteDeTelemetria` só chega à linha do `chave = contexto.sub ?? 'desconhecido'` quando
`sessaoValida` é `true` (checagem anterior retorna 204 direto), e o tipo `Sessao` do núcleo
(`portas/sessao.d.ts`) sempre inclui `sub: string` obrigatório — não há caminho onde uma sessão
válida chegue sem `sub`. Essa parte da suspeita está refutada.

**Correção:** expirar entradas por `expiraEm` (varredura periódica) ou usar uma estrutura com
tamanho máximo/LRU.

---

## Suspeita refutada com evidência — armadilha R1 (pathname normalizado vs. cru)

Testei diretamente, sem subir servidor, os dois parsers usados por este fork do Next 16.3.4:
`NextURL` (o que popula `req.nextUrl.pathname`, usado pelo proxy) e `parseUrl`/`parseRelativeUrl`
(o que resolve `rewrites()` e o roteamento em `resolve-routes.js`). Ambos usam `new URL()`
(WHATWG) por baixo, então o colapso de `.`/`..`, percent-encoding e maiúsculas bate nos dois
lados:

```
"/zona1/.."                    -> nextUrl "/"              parseUrl "/"              SAME
"/zona1/../zona1-static/x"     -> nextUrl "/zona1-static/x" parseUrl "/zona1-static/x" SAME
"/zona1/%2e%2e"                -> nextUrl "/"              parseUrl "/"              SAME
"/ZONA1"                       -> nextUrl "/ZONA1"          parseUrl "/ZONA1"         SAME
"/zona1%2f.."                  -> nextUrl "/zona1%2f.."     parseUrl "/zona1%2f.."    SAME
"/zona1//../etc"                -> nextUrl "/zona1/etc"      parseUrl "/zona1/etc"     SAME
```

O único caso onde divergiram (`//zona1`: `NextURL` interpreta como novo host, `parseUrl`
mantém como caminho) é neutralizado **antes** do proxy rodar: `resolve-routes.js` detecta barra
dupla/backslash no `req.url` cru e devolve 308 para a forma normalizada, então o proxy nunca vê
esse caminho.

Isto é uma versão fictícia do Next (`node_modules/next/AGENTS.md` avisa: "breaking changes...
pode diferir do que você sabe") que aparentemente unificou o parsing de pathname, fechando a
armadilha registrada pela PoC (`.agents/challenger_final_1/handoff.md`, R1). Não é uma garantia
formal — não testei o pipeline completo de produção/edge nem toda combinação de encoding — mas
os vetores concretamente sugeridos não reproduzem. Não bloqueio por isso.

---

## Suspeita não confirmada — CSP duplicada shell × zona (precisa de servidor rodando)

O shell gera um nonce `N1` e define `Content-Security-Policy` na resposta do proxy antes do
rewrite para a zona; a zona, ao receber essa requisição reescrita, roda o próprio `criarProxy`
e gera outro nonce `N2`, também definindo `Content-Security-Policy` na resposta dela. Pelo
código de `resolve-routes.js` (linhas 444-465), cabeçalhos que o middleware do shell define são
propagados tanto para a resposta acumulada quanto para os cabeçalhos da requisição usada no
rewrite — a zona sobrescreve isso com o próprio CSP na entrada, então a requisição não quebra.
O que não consegui confirmar sem subir os processos (proibido pela tarefa) é se o CSP de
**resposta** do shell (`N1`) sobrevive ao lado do CSP de resposta da zona (`N2`) no HTTP final.
Se os dois sobreviverem, o navegador aplica a interseção (regra de múltiplos cabeçalhos CSP) e
os scripts da zona — que carregam `nonce=N2` — falhariam contra a política do shell (que exige
`nonce=N1`), quebrando a hidratação de toda página de zona.

**O que confirmaria:** subir shell + zona1 fora das portas reservadas e rodar `curl -si`
autenticado em `/zona1`, contar quantos cabeçalhos `content-security-policy` voltam e comparar
o nonce de cada um com o nonce usado no HTML servido. Sugiro delegar ao `simulador-condicoes`.

---

## Nota, não bloqueante — página de erro de zona parece código morto

`app/(publico)/erro-de-zona/page.tsx` existe e a rota é reservada, mas o fluxo atual de
indisponibilidade (`decisao-proxy.ts`, ação `zona-inativa`) nunca navega para essa página —
serve HTML inline via `renderizarPaginaErroDeZona` direto no proxy. Vale confirmar se é
vestígio de um design anterior ou uso futuro (ex.: link de algum lugar que não vi no escopo).

---

## Suspeita #7 — os 22 testes provam comportamento ou texto?

Majoritariamente comportamento: status HTTP, destino de redirecionamento, contagem de taxa.
As duas checagens de texto (`assert.match(decisao.html, /Zona temporariamente indisponível/)`)
são aceitáveis porque ali o texto **é** o comportamento (página de erro).

Mas os dois módulos com o maior risco desta rodada não têm **nenhum** teste:
- `proxy.ts` (construção de CSP, remoção de `x-erp-flash` do pedido, cookies) — só a função pura
  `decidirAcaoDoProxy` é testada; a tradução para `NextResponse` (onde vive o Achado 2) não.
- `lib/pagina.ts` (`exigirModulo`, `acaoProtegida`, `origemPermitida`) — zero testes. O Achado 1
  foi commitado sem que nenhum teste pudesse pegá-lo, porque o arquivo não tem suíte.

Delego ao `testes-invariantes`: (a) um teste que force `nucleo.acesso.modulosPermitidos()` a
rejeitar com `ErroDeAplicacao` e verifique que `exigirModulo` nega (não retorna em silêncio);
(b) um teste de integração para `proxy.ts` cobrindo o cabeçalho CSP completo e a remoção do
`x-erp-flash` de entrada antes de repassar o da zona.

---

## O que foi verificado

- Leitura de `docs/design-bff/comum/AGENTS.md`, `02-nucleo.md`, ADR-0008 (via 0009), 0009, 0010.
- `docs/arquitetura/atual.md` §1.1 e `.agents/orchestrator/RETOMADA.md` (topo).
- `git -C repos/erp-shell log -p 6e05e55..a63b995` (diff completo dos três commits em escopo).
- `git -C repos/erp-zona-1 show bac6d37` e leitura de `app/zona1/*/page.tsx` para confirmar o
  cenário concreto do Achado 1 (não editei nada nesse repositório).
- `node --test test/*.test.mjs` (22/22 verde) e `./node_modules/.bin/tsc --noEmit` (limpo) em
  `repos/erp-shell`.
- Leitura de `node_modules/next/dist/server/web/next-url.js`,
  `.../shared/lib/router/utils/parse-url.js`, `parse-relative-url.js` e
  `.../server/lib/router-utils/resolve-routes.js` para testar empiricamente a hipótese R1
  (script Node isolado, sem subir servidor nem usar portas reservadas).
- Leitura de `@erp/nucleo` 0.3.2 (`portas/sessao.d.ts`, `fabricas/criarProxy.js`) para confirmar
  o tipo `Sessao` (sempre tem `sub`) e a política de CSP de referência usada pelas zonas.
- Confirmei ausência de `import '@erp/nucleo/shell'` em qualquer zona (invariante 15 preservado)
  e que `carregarZonas`/`gerarRewrites` filtram corretamente rotas reservadas (`ehRotaReservada`,
  testado em `zonas.test.mjs`).
- Não subi nenhum servidor nem usei as portas 3000–3003/4001–4010. Não editei nada fora de
  `.agents/reviewer_shell_1/`.
