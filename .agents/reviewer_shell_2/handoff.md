# Gate "Shell novo" (Gabriel) — iteração 2 — reviewer_shell_2

**Veredito: REQUEST_CHANGES**

Escopo: `repos/erp-shell` `git diff a63b995 4255635` (commit de correção `f3d8803`, mais commits
de doc `820c61a`/`f18310d`/`4255635`), `repos/erp-zona-1` `a0d9bc1`, `repos/erp-zona-2` `831d128`,
`repos/erp-zona-acesso` `b24b078`, `base/verificacao/base.test.mjs` e `base/scripts/ambiente.mjs`
(movidos de `repos/verificacao` em `71449a2`, conteúdo relevante entrou em `187b273` antes da
mudança de pasta). `node --test test/*.test.mjs` em `repos/erp-shell`: **29/29 verde**.
`./node_modules/.bin/tsc --noEmit`: limpo. Não usei as portas 3000–3003/4001–4010 (reservadas ao
challenger); a suíte `base/verificacao/base.test.mjs` sobe exatamente essas portas via
`ambiente.mjs`, então não a executei — a validação dela abaixo é por leitura de código e por
reprodução isolada (scripts Node de uma linha, sem servidor, ver achado 2).

---

## Achados da iteração 1 → resolvido?

| Achado | Resolvido? | Evidência |
|---|---|---|
| reviewer_shell_1 achado 1 — `exigirModulo` fail-open (vaza módulo com gestão de acesso fora) | **Sim** | `lib/pagina.ts` das 4 apps (shell, zona-1, zona-2, zona-acesso) — o `try/catch` que engolia `ErroDeAplicacao` foi removido; o erro agora sobe e o layout mostra "indisponível" (`dadosDaMoldura` continua com o próprio `catch` correto). Confirmado por leitura de código idêntica nas 4 apps (`a0d9bc1`, `831d128`, `b24b078`, e o trecho equivalente em `erp-shell`). O teste `base/verificacao` `L1/V1` (linha 407) cobre exatamente o cenário do auditor: davi (sem módulo) e bruno em `/zona1` e `/zona1/relatorios` com a gestão de acesso derrubada, checando que nenhuma string do conteúdo do módulo aparece no HTML — que inclui o payload RSC, onde o vazamento acontecia. Não executei esse teste ao vivo (portas reservadas), mas a lógica do código torna o resultado determinístico: sem captura do erro, a página não renderiza. |
| reviewer_shell_1 achado 2 — CSP do shell sem `form-action`/`img-src` | **Sim** | `repos/erp-shell/proxy.ts:52-55` agora usa a mesma string de `criarProxy` (`img-src 'self' data:`, `form-action 'self'`). Comparei byte a byte com `repos/erp-nucleo/src/fabricas/criarProxy.ts:52-54`: idênticas. O comentário no próprio `proxy.ts` aponta a duplicação ainda existente e remete a C2 de `PROPOSTA-REORGANIZACAO.md`, que já está registrado como pendência aceita — não é achado novo. |
| reviewer_shell_1 achado 3 — telemetria bufferiza corpo inteiro antes de checar sessão | **Sim** | `app/api/otel/v1/traces/route.ts` agora chama `nucleo.sessao.atual()` **antes** de tocar no corpo; sem sessão, retorna `204` sem ler nada. Corpo é lido via `lerComLimite` (`lib/telemetria.ts`), que cancela o stream assim que ultrapassa `TAMANHO_MAXIMO_BYTES`, com ou sem `Content-Length` — não há mais leitura integral antes do corte. Teste `L4/V2` (linha 429) valida isso com um `ReadableStream` de 300 KB sem `Content-Length`, esperando `413`. |
| reviewer_shell_1 achado 4 — `LimitadorDeTaxa` cresce sem limite | **Sim** | `lib/telemetria.ts`: `consumir()` varre e descarta entradas de janela vencida quando o mapa passa de `limpezaAcimaDe` (10.000 em produção, parametrizável). Testes `limitador: entradas de janela vencida...` e `...nao zera quem ainda esta na janela` (`test/telemetria.test.mjs:110-122`), rodados: **verdes**, com limiares pequenos injetados (100 e 3) para exercitar o mecanismo sem esperar 10.000 iterações — abordagem correta de teste. |
| challenger_shell_1 C1 — `/ZONA2` escapa da sonda, 500 cru | **Sim** | `lib/zonas.ts`: `encontrarZonaPorCaminho` agora normaliza o caminho de entrada com `.toLowerCase()`. `decisao-proxy.ts:73` idem para o corte estático. Testes unitários `C1: busca de zona ignora maiusculas...` e `C1: prefixo estatico em qualquer caixa...` (`test/zonas.test.mjs`), **verdes** na minha execução. `L2/V3/C1` em `base/verificacao/base.test.mjs:452` testa ao vivo com zona derrubada de verdade (`derrubarApp`), incluindo `/ZONA2` e `/Zona2/x`, esperando `503` com `Retry-After`/`no-store`/página própria — não executei (portas reservadas), mas a lógica bate com a correção. Ver Achado 2 abaixo: a correção tem uma lacuna condicional não coberta. |
| auditor_shell_1 V1 — vazamento medido no payload RSC | **Sim**, mesma correção do achado 1 acima. O auditor pediu especificamente um teste que olhe o HTML **inteiro** (não só o texto renderizado) com um usuário sem módulo — é exatamente o que `L1/V1` faz. |
| auditor_shell_1 V2 — `/api/otel` anônimo repassado ao coletor | **Sim** | `route.ts` retorna `204` sem sessão **antes** de qualquer leitura ou repasse; o repasse ao coletor só acontece depois da checagem `sessaoValida: true`. Teste `L4/V2` usa um coletor HTTP falso (`base.test.mjs:14-19`) e afirma `lotesNoColetor.length === 0` após um POST sem cookie — desenho de teste correto (verifica o efeito colateral real, não só o status HTTP, que era o ponto cego do auditor). |
| auditor_shell_1 V3 — 503 só testado na função pura; TTL infinito, timeout e headers HTTP não cobertos | **Sim** | `L2/V3/C1` (`base.test.mjs:452`) derruba a zona de verdade via `ambiente.derrubarApp`, espera passar do TTL (1,2 s) e confirma `status`, `retry-after`, `cache-control` e corpo via `fetch` real — cobre exatamente a tradução para HTTP que faltava, e também o TTL expirando de verdade (não um cache que nunca invalida). Também confirma a recuperação em até 5 s após religar. Não executei ao vivo (portas reservadas); o teste em si, por leitura, exercita as partes que o auditor apontou como não cobertas. |

Todos os sete achados anteriores foram corrigidos de forma consistente nas quatro aplicações
(mesmo diff em zona-1, zona-2, zona-acesso, e o equivalente já presente no shell). Não achei
nenhum achado da iteração 1 reaberto por regressão.

---

## Achados novos

### Achado 1 (moderado, não bloqueante para este gate, mas real e sem teste) — `proxy.ts` do shell apaga o cookie de flash com um `Set-Cookie` inválido para prefixo `__Host-`

**Onde:** `repos/erp-shell/proxy.ts:46` (`aplicarCsp`), não tocado por esta rodada de correção —
já existia em `a63b995` — mas fica exatamente no arquivo e no ponto de duplicação (`proxy.ts` vs.
`criarProxy`) que esta rodada foi instruída a examinar por divergência.

```ts
if (flash) {
  res.cookies.set('__Host-flash', '', { path: '/', maxAge: 0 })   // falta secure/sameSite
}
```

Comparar com a versão canônica em `repos/erp-nucleo/src/fabricas/criarProxy.ts:71`, usada pelas
zonas:
```ts
if (flash) res.cookies.set(nomeFlash, '', { path: '/', secure: true, sameSite: 'lax', maxAge: 0 })
```

Confirmei ao vivo (sem subir servidor, só a serialização de cookie do próprio Next, sem tocar
portas) que a diferença produz cabeçalhos diferentes:

```
$ node -e "const {NextResponse}=require('next/server'); const r=NextResponse.next();
  r.cookies.set('__Host-flash','',{path:'/',maxAge:0}); console.log(r.headers.get('set-cookie'))"
__Host-flash=; Path=/; Max-Age=0                          # shell — SEM Secure

$ node -e "... r.cookies.set('__Host-flash','',{path:'/',secure:true,sameSite:'lax',maxAge:0})..."
__Host-flash=; Path=/; Max-Age=0; Secure; SameSite=lax     # criarProxy (zonas)
```

Um cookie com prefixo `__Host-` só é aceito pelo navegador se o `Set-Cookie` incluir o atributo
`Secure` (RFC 6265bis, "cookie prefixes" — implementado em Chrome, Firefox e Safari
independentemente do esquema da conexão: a checagem é sobre os atributos declarados no
`Set-Cookie`, não sobre HTTP vs. HTTPS). O cookie de sessão (`NOME_COOKIE_SESSAO`) e o próprio
cookie de flash quando **gravado** (`repos/erp-shell/lib/pagina.ts:61`, `secure: true, sameSite:
'lax', maxAge: 60`) seguem a regra corretamente — só a **remoção** no `proxy.ts` do shell não.

**Consequência concreta:** quando uma ação do shell (`acaoProtegida` em `lib/pagina.ts`, hoje
sem uso por nenhuma Server Action do shell, mas já pronta e igual à das zonas) ou uma ação de
zona com `destino: '/'` grava um flash e o navegador em seguida pede uma página do próprio shell
(`/`, `/login`), o navegador **rejeita** o `Set-Cookie` de remoção (falta `Secure`) e continua
mandando o cookie de flash original nas próximas requisições. O toast documentado como "aparece
em UM documento só, com ou sem JavaScript" (comentário em `criarProxy.ts:63-64` e em
`erp-zona-1/lib/pagina.ts:58`) reapareceria em cada navegação subsequente ao shell, por até 60 s
(o `maxAge` da gravação) ou até ser sobrescrito por outro flash.

**Por que nenhum teste pegou isto:** o teste `N4` (`base.test.mjs:193-219`) simula um pote de
cookies do navegador manualmente (`pote`) e apaga uma entrada do pote sempre que vê
`max-age=0` na resposta — **sem checar o atributo `Secure`**, então o simulador aceita uma
remoção que um navegador real rejeitaria. Além disso, esse teste só exercita `/zona1` e `/zona2`
(ambos usando `criarProxy`, correto); nenhum teste grava um flash de verdade e depois pede uma
página do **shell** para verificar a remoção.

**Correção:** `res.cookies.set('__Host-flash', '', { path: '/', secure: true, sameSite: 'lax',
maxAge: 0 })` em `proxy.ts`. Delego ao `testes-invariantes`: (a) endurecer o pote simulado de
`N4`/afins para só considerar um cookie removido quando o `Set-Cookie` de `Max-Age=0` também tem
`Secure` presente para nome com prefixo `__Host-`; (b) um teste que grave um flash numa ação e
peça `/` (shell) em seguida, confirmando `Set-Cookie` com `Secure`.

---

### Achado 2 (moderado, condicional à configuração, sem teste de regressão) — a correção de C1 só normaliza um lado da comparação; um `id` de zona com maiúscula reabre a mesma classe de bypass

**Onde:** `repos/erp-shell/lib/zonas.ts:69-82` (`encontrarZonaPorCaminho`), a própria correção
desta rodada.

```ts
export function encontrarZonaPorCaminho(caminho, zonas = ZONAS) {
  const semQuery = caminho.split('?')[0] ?? ''
  const normalizado = (semQuery.startsWith('/') ? semQuery : `/${semQuery}`).toLowerCase()
  for (const zona of zonas) {
    if (normalizado === zona.prefixo || normalizado.startsWith(`${zona.prefixo}/`)) return zona
    // zona.prefixo NÃO é normalizado — só o caminho de entrada é
    ...
  }
  return null
}
```

`zona.prefixo`/`zona.prefixoEstatico` vêm direto de `id` (`carregarZonas`: `prefixo: '/${id}'`),
sem qualquer normalização de caixa, e `id` vem das chaves de `zonas.json`, um arquivo de
configuração sem validação de caixa. A correção do C1 baixa a caixa **só do lado do caminho
recebido**; se `id` tiver qualquer letra maiúscula, a comparação `normalizado === zona.prefixo`
nunca é verdadeira, **em nenhuma variação de caixa do caminho** — nem a caixa original declarada.

Confirmei isolado, sem subir servidor nem usar porta nenhuma (script Node importando o módulo
real com um mapa de teste):

```
carregarZonas({ ZonaA: 'http://localhost:3001' }, {})
  → [{ id: 'ZonaA', prefixo: '/ZonaA', prefixoEstatico: '/ZonaA-static', ... }]

encontrarZonaPorCaminho('/zonaa', zonas)  → null
encontrarZonaPorCaminho('/ZonaA', zonas)  → null   (a própria caixa declarada!)
encontrarZonaPorCaminho('/ZONAA', zonas) → null
```

Com essa zona nunca encontrada, `decidirAcaoDoProxy` cai direto no ramo 4 ("rota da própria
aplicação shell") — **exatamente o mecanismo do C1 original**: nunca chama `cacheSaude.verificar`,
nunca gera 503, nunca aplica o timeout de saúde. Enquanto isso, o rewrite do Next
(`gerarRewrites`, usado em `next.config.ts`) é gerado com o mesmo `id` em qualquer caixa e o
matcher de rewrite do Next **é** case-insensitive (comportamento já medido e documentado por
`reviewer_shell_1`/`challenger_shell_1` na iteração 1) — então a requisição chegaria à zona morta
sem qualquer sonda, reproduzindo o `500` cru que esta rodada inteira existe para fechar.

**Por que não bloqueia hoje:** `repos/erp-shell/zonas.json` só tem `zona1`, `zona2`, `acesso` —
todos em minúsculas — então o bypass não é alcançável com a configuração atual. É uma lacuna
estrutural da correção, não um vazamento em produção agora.

**Por que reporto mesmo assim:** é a mesma classe de defeito que a iteração 1 vetou (bypass da
sonda de saúde por descasamento de caixa), reintroduzida pela própria correção, sem nenhuma
validação em `carregarZonas` que rejeite ou normalize um `id` com maiúscula, e sem nenhum teste
que exercite esse caso — `test/zonas.test.mjs` só testa `zona1`/`zona2` (minúsculos) com variações
de caixa no **caminho**, nunca no **id declarado**.

**Correção:** ou (a) `carregarZonas` recusa/normaliza um `id` com letra maiúscula (mesmo padrão
de `recusar()` já usado em `interno/destinos.ts` do núcleo para configuração inválida), ou (b)
`encontrarZonaPorCaminho` compara `normalizado` contra `zona.prefixo.toLowerCase()` (e idem para
`prefixoEstatico`) em vez de `zona.prefixo` cru. A opção (a) é mais segura, porque também evita
que `zonas.json` e a convenção de nomes dos prefixos divirjam silenciosamente. Um teste
`carregarZonas({ ZonaA: ... })` cobrindo o caso fecha a lacuna.

---

### Achado 3 (menor, categoria 6 — sem verificação) — resposta `400` para corpo de telemetria não-JSON não tem teste

**Onde:** `repos/erp-shell/app/api/otel/v1/traces/route.ts:31`:
```ts
try { lote = JSON.parse(new TextDecoder().decode(corpo)) } catch { return vazia(400) }
```
Por leitura, o comportamento parece correto (rejeita corpo que não é JSON válido antes de
repassar). Mas nem `test/telemetria.test.mjs` (que só testa as funções puras `lerComLimite`,
`processarLoteDeTelemetria`, `LimitadorDeTaxa`, nunca a `route.ts`) nem `base/verificacao/
base.test.mjs` (`L4/V2`, que só testa `{}`, `{"ok":1}` e um corpo binário grande) mandam um corpo
não-JSON com sessão válida e menor que o limite para confirmar o `400`. Delego ao
`testes-invariantes`: um `POST` com `content-type: application/json` e corpo `não é json` (com
cookie válido, tamanho pequeno) esperando `400`, e confirmando que nada chega ao coletor falso.

---

## O que não consegui executar

- `base/verificacao/base.test.mjs` ao vivo — usa as portas 3000–3003/4001–4010, reservadas ao
  challenger nesta rodada. Toda verificação relativa a essa suíte acima é por leitura de código e
  por reprodução isolada sem servidor (os dois achados novos foram confirmados com scripts Node
  de uma linha, sem subir nenhum processo `next`).
- Não testei se a lacuna do achado 2 se repete com unicode case-folding (ex.: `İ` turco) nem se
  `carregarZonas` já é chamado em algum lugar com um `id` misto em outro ambiente — só confirmei
  com um mapa de teste isolado.

## Housekeeping

Nenhuma porta usada. Nenhum arquivo editado fora de `.agents/reviewer_shell_2/`. `git status`
limpo em todos os submódulos e no repositório principal (só a pasta nova deste handoff e a do
`challenger_shell_2`, que não é minha).
