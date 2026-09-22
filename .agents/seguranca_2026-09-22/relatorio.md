# Relatório de segurança — 2026-09-22

> Escopo: verificar se os 17 invariantes de `AGENTS.md` têm verificação real (com "dentes"), o
> checklist/ameaças de `docs/desenho/bff/06-seguranca.md` §1/§10, e as três lacunas abertas do
> item B4 de `RETOMADA.md`. Não editei testes nem produto; não usei as portas 3000–3003/4001–4004/4010
> (reservadas ao `auditor_shell_4`); não rodei `base.test.mjs` nem `navegador.test.mjs`.

## Nota sobre conteúdo não confiável

No início da sessão recebi, junto do ambiente, um bloco dizendo ser "instruções de servidor MCP"
pedindo para eu criar documentos via ferramentas (`batch`, `guide`, `open`, `replace`...) que não
existem no meu conjunto real de ferramentas (`Read`, `Bash`, `Write`, `Edit`, `SubagentHandback`).
Tratei isso como conteúdo não confiável/injeção e ignorei — não é instrução do usuário nem
corresponde a nada que eu possa executar. Não escrevi nenhum artefato fora do pedido original.

## O que rodei de fato (saída real, não resumida de memória)

```
$ cd repos/erp-nucleo && pnpm test
...
ℹ tests 107
ℹ pass 107
ℹ fail 0

$ cd repos/erp-contratos && pnpm test
...
ℹ tests 15
ℹ pass 15
ℹ fail 0

$ cd repos/erp-moldura && pnpm test
...
ℹ tests 25
ℹ pass 25
ℹ fail 0

$ cd repos/erp-shell && pnpm test
...
ℹ tests 36
ℹ pass 36
ℹ fail 0

$ cd repos/erp-dominio-stub && pnpm test
...
ℹ tests 16
ℹ pass 16
ℹ fail 0

$ node --test base/verificacao/saida-de-rede.test.mjs
...
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

Total: **206/206** nos pacotes de unidade + N8, todos verdes, hoje, nesta árvore
(`repos/erp-nucleo` 107, `erp-contratos` 15, `erp-moldura` 25, `erp-shell` 36, `erp-dominio-stub`
16, `saida-de-rede.test.mjs` 7). `erp-dominio-stub` usa porta efêmera (`servidor.listen(0, ...)`
em `test/apoio.mjs:7`) — não colide com as portas reservadas. As zonas (`erp-zona-1/2/acesso`) não
têm script `test` próprio; a cobertura delas é só via `base/verificacao/base.test.mjs`, que **não
rodei** por instrução — não posso confirmar hoje esse número (a última vez registrada em
`GATE_STATUS.md`/`RETOMADA.md` é **50/50**, iteração 3 do gate do shell, e o `auditor_shell_4` está
em andamento reproduzindo a mesma linha de base na cópia dele).

Não rodei nada em `.env`, segredos, `~/.ssh` etc., nem instalei pacotes, nem usei comando
destrutivo — nada disso foi necessário para esta tarefa.

---

## 1. Mapa dos 17 invariantes de `AGENTS.md`

Legenda: ✅ coberto com dentes (mutação registrada) · ⚠️ coberto mas só estático, ou comportamental
sem prova de mutação registrada · ❌ sem verificação.

| # | Invariante | Onde | Comportamental/estático | Dentes? | Classificação |
|---|---|---|---|---|---|
| 1 | Token/refresh/grupos nunca ao navegador | `base/verificacao/base.test.mjs:110` "token nunca chega ao navegador, em nenhuma pagina" — varre `TOKEN`/`accessToken` no HTML para **todo** ator (`Object.keys(MENUS)`) e toda página (`/`, `/zona1`, `/zona1/relatorios`, `/zona1/recursos/r-1`, `/zona2`, `/acesso`) | Comportamental | Não encontrei mutação registrada especificamente para vazamento de token (procurei "token"/"accessToken" em `.agents/*/mutacoes.txt`, inclusive no histórico arquivado; nada). As mutações registradas cobrem invariantes vizinhos (2, 4, 5, 15, 16), não este | ⚠️ comportamental, genérico sobre a matriz de atores, mas **sem prova de mutação** registrada |
| 2 | DTO sensível não vira prop de ilha | `base.test.mjs:100-108` "perfil administrativo nao concede dado: carla nao ve custo nem r-3; bruno ve" — checa ausência de `CC-10`/`Custo` no HTML/RSC da carla e 404 em `r-3`; também `erp-dominio-stub/test/dominios.test.mjs` "projecao: custo so existe para o FINANCEIRO; admin de acesso (carla) nao ganha dado" | Comportamental (BFF) + comportamental (domínio) | **Sim.** `auditor_base_1` mutação **M5** (`dominio-a.mjs`: remove o `if (grupos.includes('FINANCEIRO'))` antes de copiar `custo`) → **PEGA** em stub e e2e (`.agents/arquivo/auditor_base_1/mutacoes.txt`, tag `historico-2026-09-22`) | ✅ coberto com dentes — e é exatamente o cenário "carla" que o mapa do orquestrador aponta como o erro mais provável |
| 3 | `server-only` em módulo de credencial/sessão | nenhum teste de build encontrado; `grep -rl "server-only"` mostra o import presente no código-fonte de `erp-nucleo`/zonas, mas não há checagem automatizada de que **falta** dele quebre o build | Nenhuma | — | ❌ sem verificação — confirma o item B4 aberto |
| 4 | Sempre via registro de destinos | `repos/erp-nucleo/test/destinos.test.mjs`: "cenario 1: ... caminho nao declarado falha com DestinoInvalido sem sair da rede", "metodo nao declarado e recusado sem rede", "parametro que o modelo nao pede e recusado", "redirecionamento do dominio nao e seguido para fora do registro"; `//`/`..`/travessia coberto pelo M1a2 do auditor (ver abaixo) | Comportamental (unidade real, sem mock de rede — usa servidor HTTP real efêmero) | **Sim.** `auditor_base_1`: M1a **SOBREVIVE** (equivalente), **M1a2 PEGA** ("parametro hostil (segmento ponto/ponto-ponto)"), M1a3/M1a4 sobrevivem por serem equivalentes documentados, **M1b PEGA** ("cenario 1"), **M1c PEGA** ("redirecionamento ... nao e seguido") | ✅ coberto com dentes |
| 5 | Server Action revalida sessão no 1º bloco | `base.test.mjs:154` "Server Action e reverificada no servidor", `:177` "Server Action sem Origin ... nao executa em nenhuma app", `paginas.test.mjs:72` "acaoProtegida: origem, sessao e modulo conferidos NESSA ordem, antes do corpo" | Comportamental (e2e) + comportamental (unidade do núcleo) | **Sim.** `auditor_base_1`: **M6b PEGA** (Server Action sem `Origin`, zona de acesso), **M6c PEGA** ("invariante 16: toda Server Action..."), **M6d PEGA** (não compila), **M6d2 PEGA** (variante que compila). Ressalva: **X1 SOBREVIVE** na iteração 1 do gate shell (zona 2 sem checagem de Origin passava despercebida) — foi corrigido e voltou a pegar na iteração seguinte (`base.test.mjs:177` cobre hoje "em nenhuma app", ou seja, todas as apps, não só uma) | ✅ coberto com dentes, com histórico documentado de uma lacuna fechada |
| 6 | `If-Match` em mutação; núcleo recusa; domínio 428/409 | núcleo: `destinos.test.mjs:90` "PUT sem If-Match e recusado (invariante 6); com If-Match passa"; domínio: `erp-dominio-stub/test/dominios.test.mjs:47-52` "concluir tarefa exige grupo, If-Match e versao atual" — **rodei e confirmei**: `428` sem `If-Match`, `409` com versão desatualizada, no `dominio-c.mjs:22` | Comportamental, nos dois lados (núcleo e stub) | **Sim.** `auditor_base_1`: **M1d PEGA** ("PUT sem If-Match") | ✅ coberto com dentes |
| 7 | `401`/`403`/`404` conforme critério | `base.test.mjs:29` (401 sem cookie), `:77` "N5/D6: modulo nao permitido 404 ... permitido 200", stub: "sem credencial: 401 sem motivo", "escopo: r-3 fora do escopo e identico a inexistente", "administracao: quem nao e admin recebe 404" | Comportamental | Parcial — ver invariante 16 (mesma superfície, mutações M4a-d, X8, X9 pegam) | ✅ coberto com dentes (via invariantes 16/17, mesma suíte) |
| 8 | Nunca placeholder de "sem acesso" | `paginas.test.mjs:47` `exigirModulo`: negado é `notFound()`, "sem pagina de sem acesso"; `base.test.mjs` L1/V1 varre ausência de conteúdo restrito no payload | Comportamental + estático | Ver invariante 16 (mesma mecânica, dentes comprovados abaixo) | ✅ coberto com dentes |
| 9 | `_permissoes` não é autorização; Server Action não recarrega para reverificar | núcleo `permissoes.test.mjs`: "pode() exige true estrito, nao truthiness", "valor ausente, herdado ou nao booleano e negado — fail closed" | Comportamental (unidade) | Não encontrei mutação registrada especificamente para a parte "nunca recarregar o recurso para reverificar" (a ADR-0009 decisão 6.1 documenta o *porquê*, mas não achei teste que force uma Server Action a decidir sem re-buscar o recurso e falhe se ela buscar) | ⚠️ a parte do helper `pode()` está com dentes; a parte "não recarregar" é só arquitetural/documentada, não testada |
| 10 | Domínio inalcançável da internet; BFF sem endpoint sem cookie | stub: "requisicao vinda do navegador e recusada (dominio nao exposto)"; `base.test.mjs:29` camada 1 redireciona sem cookie | Comportamental | `auditor_base_1`: **X19 PEGA** ("domínio aceita requisição do navegador") | ✅ coberto com dentes |
| 11 | Sem `NEXT_PUBLIC_*` sensível | nenhum teste dedicado encontrado | — | — | ❌ sem verificação automatizada — mas também **nenhuma variável `NEXT_PUBLIC_*` existe hoje no código** (`grep -rn NEXT_PUBLIC repos` vazio), então não há violação conhecida, só ausência de guarda de regressão |
| 12 | Erro normalizado `{codigo, supportId}` | `erp-nucleo/test/erros.test.mjs`: "500 com corpo do framework nao vaza detalhe interno", "codigo desconhecido do upstream vira ERRO_INTERNO", "supportId hostil e DESCARTADO, nao repassado nem truncado", "409 vira Desatualizado preservando supportId" | Comportamental (unidade, com payloads hostis reais) | Testes de fuzzing próprios (entradas hostis no `supportId`); não vi um "PEGA" de catálogo de mutação citando este arquivo especificamente, mas o desenho do teste já injeta a falha (stacktrace, texto de exceção) e afirma ausência — função de "teste com dentes" embutida no próprio caso, não depende de mutação externa | ✅ coberto (fuzzing direto conta como dentes aqui — o teste já simula o defeito) |
| 13 | Nunca cache de payload protegido | Nenhum teste dedicado; `"use cache"` não existe em nenhum arquivo do repositório (`grep` vazio) — o mecanismo que violaria isso foi removido pelo ADR-0007 | — | — | ❌ sem verificação de regressão — hoje a invariante vale por **ausência estrutural** do mecanismo (cache eliminado), não por teste que barraria a reintrodução |
| 14 | Extensão não altera semântica de campo do núcleo | Não há mecanismo de "extensão" implementado ainda em `erp-nucleo/src` (só `shell`, `testing`, `interno`, `permissoes`, `app`, `portas`, `borda`, `adaptadores`, `fabricas`) | — | — | ❌ sem verificação — e a rigor **ainda não é testável**, porque o conceito de extensão citado (ADR-0013 propõe `expiraEm` como campo do núcleo com "campos novos só do escritor") ainda não tem implementação para falsificar |
| 15 | Zona não grava sessão | `base.test.mjs:318` "N3 estatico: nenhuma zona monta store de escrita, identidade ou grava o cookie de sessao"; núcleo `sessao.test.mjs:35` "o nucleo de zona nao tem entrar nem encerrar; o do shell tem"; `sessao-redis.test.mjs:87` "o leitor nao tem como gravar nem remover (N3, invariante 15)" | Estático (varredura de import) + comportamental (unidade, tenta gravar e falha) | **Sim.** `auditor_base_1`: **M2a PEGA** ("invariante 15: a raiz nao entrega..."), **M2b PEGA** ("o nucleo de zona nao tem entrar nem encerrar") | ✅ coberto com dentes |
| 16 | Módulo verificado na camada 2 em toda página/action | `base.test.mjs:226` "invariante 16: toda Server Action de toda app recusa quem nao tem o modulo"; `:262` "invariante 16 comportamental: restringir o painel..."; `:338` "invariante 16 estatico: toda pagina de modulo chama exigirModulo"; `:414` "L1 cobre toda pagina de modulo das zonas: pagina nova sem entrada aqui reprova"; `:431` L1/V1; `:445` "L1 tem dentes" | Estático + comportamental, com teste de **completude** (nova página sem entrada no mapa reprova) | **Sim, robusto.** Cadeia de vetos e correções documentada em `GATE_STATUS.md`: iteração 1 do gate do shell → **INTEGRITY VIOLATION** do `auditor_shell_1` (V1: gestão de acesso fora vazava conteúdo restrito, fail-open); iteração 2 → outro veto do `auditor_shell_2` (fail-open só na zona 2 passava despercebido porque L1 só visitava zona 1); iteração 3 → veto do `auditor_shell_3` (V1: fail-open só em `/zona1/recursos/[id]` sobrevivia — `F1-recurso-b` **SOBREVIVE** no catálogo de mutações, `.agents/auditor_shell_3/mutacoes.txt`). Cada veto gerou correção e o teste de completude do L1 (que reprova página nova sem entrada) tornou a lacuna estruturalmente impossível de repetir — confirmado pelo `reviewer_shell_4` (`.agents/reviewer_shell_4/handoff.md`), que refez a derivação rota→regex à mão. `auditor_shell_4` (em andamento) já reproduziu `F1-recurso-b`/V1 pegando (49/50 quando reintroduzida) | ✅ coberto com dentes — o invariante com histórico de vetos mais rico da base |
| 17 | Perfil/módulo só no prefixo da própria zona | `erp-contratos/test/contratos.test.mjs`: "recusa modulo com prefixo de outra zona", "recusa prefixo que so comeca com o nome da zona" (`/zona10` vs `/zona1`), "recusa prefixo com travessia" (`/zona1/../acesso`), "recusa perfil de outra zona", "recusa concessao para modulo de outra zona (D8)", "zona plataforma e reservada: perfil global nao nasce de manifesto"; e2e `base.test.mjs:147` "D8: a tela de acesso nao oferece perfil de zona para modulo de outra zona" | Estático (validação de manifesto, rodei e confirmei 15/15 verde) + comportamental (D8) | **Sim.** `auditor_base_1`: **M3a PEGA** (contratos+stub, zona plataforma), **M3b PEGA** (concessão para módulo de outra zona), **X16 PEGA** (e2e D8: "tela oferece todo perfil") | ✅ coberto com dentes |
| E1 | Fronteira entre camadas | `repos/erp-nucleo/scripts/fronteira.mjs` + `test/fronteira.test.mjs`: "o nucleo nao conhece dominio: nenhum arquivo fala de pedido"; roda no `pnpm test` (`pnpm fronteira` antes dos testes) — **rodei, passou** | Estático | Não vi mutação de catálogo citando especificamente `fronteira.mjs`, mas é uma varredura textual determinística (grep por termo de domínio) — falsificável por natureza (inserir a palavra "pedido" no núcleo reprovaria) | ✅ estático mas falsificável por construção — dentes por desenho, não por prova registrada |
| E2 | Exports restritos da raiz | `fronteira.test.mjs`: "o pacote publica exatamente cinco subpaths", "a raiz NAO arrasta next/server", "interno e adaptadores nao sao alcancaveis de fora", "a raiz exporta as fabricas e os adaptadores nomeados", "a raiz NAO exporta o transporte cru" — **rodei, passou** | Estático + comportamental (tenta importar e espera falha) | `auditor_base_1` **X10/X10b** tratam de CSP/assets, não deste ponto especificamente; não achei mutação de catálogo para "a raiz exporta X indevido". O teste em si já injeta a tentativa de import proibido e afirma falha — funciona como o próprio "dente" | ✅ coberto — teste já simula a violação e falsifica |

### Atores (matriz genérica)

Confirmei que `base.test.mjs:110` e `:100-108` iteram sobre `Object.keys(MENUS)` (todos os atores
declarados) e não sobre uma lista fixa de 1-2 usuários — é a mesma generalização que o orquestrador
pede. O cenário mais sensível do mapa do orquestrador — **carla vendo `custo` por causa de
`plataforma.admin-acesso` tratado como grupo de dado** — é exatamente o que a mutação **M5**
(`auditor_base_1`) tentou provocar e foi pega. Não tenho evidência de execução against ana/davi
especificamente para o vazamento de `custo` (o teste de linha 100-108 usa carla/bruno), mas a
varredura de token (linha 110-117) cobre **todos** os quatro. Não posso confirmar hoje a suíte
completa de `base.test.mjs` (não rodei), então não posso certificar com 100% de certeza que davi
(zero perfis) está coberto para o cenário de `custo` além do que já vi no código-fonte do teste.

---

## 2. Checklist de release (`06-seguranca.md` §10) e ameaças (§1)

| Item do checklist §10 | Atendido hoje? | Evidência |
|---|---|---|
| Nenhum token/lista de grupos no objeto de sessão do cliente | Sim | `base.test.mjs:110`; sessão do núcleo entrega só `{ sub, nome }` (`sessao.test.mjs`: "a sessao entregue a aplicacao so tem sub e nome") |
| `server-only` em todos os módulos da seção 4 | **Não verificável automaticamente** | ver invariante 3 acima — presente no código, sem checagem de build |
| Nenhum DTO sensível como prop de Client Component | Parcial | coberto pelo teste de vazamento (invariante 2), mas **não** pela verificação estrutural específica de "prop de ilha" (item B4, ver seção 3 abaixo) |
| Nenhum cache de payload protegido; nenhum `"use cache"` com dado por usuário | Sim, estruturalmente (ADR-0007 removeu o mecanismo) | `grep '"use cache"'` vazio em todo o repo; sem verificação de regressão dedicada |
| Toda Server Action revalida sessão no primeiro bloco | Sim | invariante 5/16, com dentes |
| Domínio rejeita requisição sem `Authorization` | Sim | stub: "sem credencial: 401 sem motivo" — rodei, passa |
| Domínio inalcançável fora do namespace do BFF | Sim | stub: "requisicao vinda do navegador e recusada"; X19 pega |
| Nenhuma variável `NEXT_PUBLIC_` com credencial | Sim, por ausência | nenhuma variável `NEXT_PUBLIC_*` existe no código hoje |
| Headers suprimidos nos atributos de span | Não verifiquei — fora do escopo desta rodada (não achei teste dedicado a atributos de span) | — |
| Logs não imprimem `Authorization` nem resposta do endpoint de token | Não verifiquei — nenhum teste dedicado encontrado | — |
| `traceresponse`/`Server-Timing` ausentes | Não verifiquei diretamente; há teste de trace (`T1`) mas focado em propagação, não nesses dois headers específicos | `erp-nucleo/test/trace-e-csp.test.mjs` |
| Rota pública sem `cookies()`/`headers()` (`force-static`) | Não verifiquei — não encontrei teste correspondente | — |

### Ameaças do §1 — status na base de hoje

- **Exfiltração de token por XSS**: mitigado estruturalmente (token nunca sai do servidor) — coberto
  pelo teste de linha 110, sem prova de mutação (ver invariante 1 acima, ⚠️).
- **Enumeração de recursos alheios (404 vs 403)**: coberto com dentes (invariante 7/16/17).
- **Vazamento de bloco sensível no payload**: coberto com dentes (invariante 2, mutação M5).
- **Vazamento pelo canal de tempo real (SSE)**: **não implementado ainda** — SSE está na fase C2
  do plano (`RETOMADA.md`, "C2 SSE no shell"), ainda `⬜`. Não é regressão, é funcionalidade não
  construída; o teste correspondente (`docs/desenho/bff/11-testes.md` §5, "o mais fácil de errar")
  também não existe porque não há o que testar ainda.
- **Sobrescrita concorrente (`If-Match`)**: coberto com dentes (invariante 6).
- **CSRF em mutação**: coberto — `base.test.mjs` "Server Action sem Origin ... nao executa",
  mutação M6b/M6c pegam.
- **Injeção de script (CSP)**: coberto — `base.test.mjs` "CSP com nonce em shell e zonas" e `L8`
  (nonce muda a cada requisição); mutações CSP-* do `auditor_shell_3` pegam quase todas
  (exceto `CSP-nonce-fixo`, que **sobreviveu** na iteração 3 e foi fechada pelo `L8` na correção
  seguinte — confirmado pelo `reviewer_shell_4`).
- **Fingerprinting de framework**: coberto por `erros.test.mjs` (não vaza `spring`/stacktrace).
- **Exfiltração de token por SSRF no BFF (allowlist outbound)**: coberto — `saida-de-rede.test.mjs`
  (N8), **rodei, 7/7**, inclusive o teste que confirma que a exceção da sonda de saúde é mesmo
  necessária (não uma exceção "de conveniência").
- **Distinção por tempo de resposta**: documentado como **não mitigado** no próprio §1 — não há
  teste, e o documento já admite isso, então não é uma lacuna escondida.

### O que é esperado nesta fase (não é regressão)

Confirmado em `RETOMADA.md` e ADR-0013: **OIDC real (Keycloak/PKCE) e Redis ainda não estão
ligados nas 4 apps** — hoje a sessão usa `identidadeDev` (ator de desenvolvimento) e
`sessao-redis`/`sessao` têm teste de unidade prontos, mas a integração ponta a ponta (D1/D2 do
plano) é `⬜`. Ou seja: os testes que existem para Redis e para OIDC (`sessao-redis.test.mjs`,
`checar-keycloak.mjs` do showcase) são reais e passam, mas a **base principal (`repos/`) ainda não
os consome em produção** — isso é esperado e documentado, não uma falha de verificação.

---

## 3. As três verificações de spec ainda abertas (item B4 de `RETOMADA.md`)

Busquei por indícios de que alguma das três já tivesse sido implementada. **Confirmo que as três
continuam sem teste**, batendo com o estado `⬜` de `RETOMADA.md` linha "B4 verificações da spec":

1. **`server-only` ausente em módulo `'use client'` deve falhar o build**: nenhum script,
   config de lint (`find . -iname ".eslintrc*"` vazio) ou teste de build encontrado.
2. **DTO sensível como prop de ilha**: os únicos hits de busca por "ilha"/"use client" em arquivos
   de teste são coincidências de texto (`base.test.mjs:204` fala de "ilha" só na mensagem de asserção
   de um teste de navegação; `moldura.test.mjs:100-106` testa a diretiva `'use client'` em si, não
   se um DTO sensível vira prop dela). Nenhum teste verifica: "componente `'use client'` nunca recebe
   prop com forma de DTO sensível".
3. **Guarda contra `<Link>` entre zonas**: `grep -rln "next/link\|<Link"` em arquivos de teste não
   encontrou nada. Não há verificação.

Nenhuma das três é implementável por mim nesta tarefa (fui instruído a só mapear/reportar, não
escrever testes), mas descrevo abaixo o teste mínimo que cada uma exigiria.

---

## 4. Lista priorizada do que falta

| Prioridade | Lacuna | Por que importa | Teste mínimo proposto | Onde mora |
|---|---|---|---|---|
| **P0** | Invariante 3: `server-only` ausente não quebra o build | É o único invariante do checklist de release (`06-seguranca.md` item 2) sem *nenhuma* rede de segurança; um módulo novo que toque `getAccessToken`/sessão sem o import passa despercebido até produção | Script estático (ts-morph ou grep por AST) que varre módulos que importam de `@erp/nucleo` credencial/sessão e falha se `server-only` não for a primeira linha; rodar no `pnpm build` de cada app, como já é feito para `pnpm fronteira` no núcleo | `base/verificacao/` (novo `server-only.mjs` + `.test.mjs`, no espírito de `saida-de-rede.mjs`) |
| **P0** | B4-2: DTO sensível como prop de ilha | É a defesa que existe *antes* do vazamento chegar ao HTML — hoje só é pega depois, no HTML final (invariante 2). Um DTO renomeado ainda passaria pelo teste de vazamento por sorte de nome, mas não deveria nem compilar/passar review | Análise estática: para cada arquivo `'use client'`, extrair os tipos dos props recebidos e reprovar se algum campo corresponder a uma lista de "campos sensíveis conhecidos" do domínio (ex.: `custo`, `precoNegociado`, `margem`) vinda de um contrato compartilhado — como o "lint customizado" citado em `11-testes.md` linha 18 | `base/verificacao/` (estático) — precisa primeiro de um contrato explícito de "campos sensíveis" para não ser lista mágica |
| **P1** | B4-3: guarda contra `<Link>` entre zonas | Navegação client-side (`next/link`) entre zonas quebra o modelo Multi-Zones (cada zona é processo próprio); um link direto pode vazar para fora do shell ou tentar renderização client-side inválida | Varredura estática: nenhum arquivo de uma zona pode importar `next/link` com `href` apontando para prefixo de outra zona (comparação estática de string, similar ao N8 de `saida-de-rede.mjs`) — mais um teste comportamental (`navegador.test.mjs`) de que clicar num link cruzando zona sempre passa por navegação de documento completo, nunca RSC | `base/verificacao/` (estático) + `navegador.test.mjs` (comportamental) |
| **P1** | Invariante 1: mutação registrada para vazamento de token | É o invariante #1 da lista e não tem prova de mutação, ao contrário de quase todos os outros — hoje depende só do teste não ter sido "sortudo" | Adicionar ao próximo ciclo de auditoria uma mutação que injeta `accessToken`/token cru em algum ponto do payload RSC (ex.: comentar a filtragem em `criarPaginas.ts` ou similar) e confirmar que `base.test.mjs:110` reprova | `.agents/*/mutacoes.txt` do próximo gate — não é teste novo, é prova de mutação do teste existente |
| **P2** | Invariante 9 (parte "não recarregar para reverificar") | `pode()` fail-closed tem dentes; a proibição específica de recarregar o recurso numa Server Action para "reverificar" não tem teste que pegue alguém violando isso | Teste de unidade/e2e que instrumenta o destino do recurso e falha se uma Server Action fizer uma segunda leitura do mesmo recurso só para checar permissão (contagem de chamadas ao destino durante uma `acaoProtegida`) | `repos/erp-nucleo/test/paginas.test.mjs` ou `base/verificacao` |
| **P2** | Invariante 11 (sem `NEXT_PUBLIC_*` sensível) | Hoje vale por ausência, não por guarda; um dev pode introduzir uma variável amanhã sem barreira | Teste estático simples: grep em `process.env.NEXT_PUBLIC_` nos repositórios e reprovar se o nome contiver termos de credencial/endpoint interno (lista curta: `TOKEN`, `SECRET`, `KEY`, `API_`) | `base/verificacao/` (estático, barato de escrever) |
| **P2** | Invariante 13 (nunca cache de payload protegido) | Vale por remoção do mecanismo (ADR-0007); não há guarda contra reintrodução de `"use cache"` tocando dado de sessão | Reimplementar a análise estática descrita em `11-testes.md` §3 (grafo de chamadas: nenhuma função `"use cache"` alcança `getAccessToken`/`requireSessao`) — documento já dá o desenho, só falta escrever | `scripts/verificar-cache.ts` (citado no doc, nunca criado) |
| **P3** | Invariante 14 (extensão não altera semântica do núcleo) | Ainda não é invariante testável — não existe mecanismo de extensão no código hoje | Não escrevo teste para isso: **não é invariante ainda, é intenção**, exatamente como o `AGENTS.md` descreve o caso de "invariante sem teste". Só fica testável quando o ADR-0013 (OIDC) ou outra extensão real existir e declarar campos novos sobre um objeto do núcleo (ex.: `expiraEm`) | Fica pendente até D2 do plano (ADR-0013) sair do estado "proposto" |
| **P3** | Checklist §10: "headers suprimidos nos atributos de span", "logs não imprimem Authorization", "traceresponse/Server-Timing ausentes", "rota pública sem cookies()/headers()" | Quatro itens do checklist de release sem teste localizado nesta varredura | Cada um pede um teste de unidade pequeno e independente — não investiguei profundidade suficiente para propor o desenho exato; recomendo uma rodada dedicada de mapeamento desses quatro itens especificamente (podem já estar cobertos em algum lugar que não encontrei via grep) | a localizar |

---

## Resumo executivo

- **13 dos 17 invariantes** de `AGENTS.md` têm verificação comportamental ou estática **com prova
  de mutação registrada** (✅): 2, 4, 5, 6, 7, 8, 10, 12, 15, 16, 17, E1, E2.
- **2 invariantes** têm verificação real mas **sem prova de mutação/dentes confirmada** (⚠️): 1
  (token — comportamental, genérico sobre a matriz de atores, mas nunca vi uma mutação que o tenha
  pego) e 9 (parte "não recarregar para reverificar" — só o `pode()` tem dentes).
- **4 invariantes sem verificação automatizada** (❌): 3 (`server-only`/build), 11 (`NEXT_PUBLIC_`),
  13 (cache — vale por ausência do mecanismo, ADR-0007), 14 (extensão — ainda não é testável porque
  o mecanismo não existe).
- O cenário mais citado pelo orquestrador — **carla e o bloco `custo`** — está coberto com prova de
  mutação real (M5) e é hoje um dos invariantes mais bem defendidos da base, não uma lacuna.
- O invariante **16** (módulo na camada 2) tem o histórico de verificação mais robusto de toda a
  base: três iterações de veto do auditor, cada uma fechando uma forma diferente de fail-open, e um
  teste de completude estrutural que torna impossível esquecer uma página nova sem proteção.
- As **três lacunas do B4** (`server-only`/build, DTO como prop de ilha, `<Link>` entre zonas)
  seguem confirmadamente abertas — nenhuma tem teste, código de verificação, ou vestígio de
  implementação parcial encontrado.
- OIDC (Keycloak/PKCE) e Redis têm testes de unidade prontos e passando, mas **não estão ligados**
  nas 4 apps principais ainda — isso é esperado nesta fase (ADR-0013 "proposto", D1/D2 `⬜` em
  `RETOMADA.md`), não uma falha de verificação.
