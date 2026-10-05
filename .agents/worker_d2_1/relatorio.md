# Relatório worker_d2_1 — DONE

Correção do veto do gate do D2, iteração 1: testes para as mutações sobreviventes P04, F04 e L04
(`.agents/auditor_d2_1/handoff.md`). O catálogo traz só a descrição de cada mutação; o trecho aplicado aqui
reproduz a descrição. Nenhum defeito de produto: só testes. Toda fonte mutada foi copiada antes para o scratchpad
e restaurada com `cat orig > fonte` (mtime novo, sem `cp -p`); `git status` dos submódulos confere depois.

## 1. P04 — páginas do shell sem renovação

Testes novos:
- `repos/erp-shell/test/proxy-renovacao.test.mjs`, nos dois stores (memória e redis falso):
  - "paginas do shell: so requisicoes a / com o token na janela renovam uma vez e gravam o token novo"
    (5 requisições a `/`, nenhuma de zona: IdP chamado 1 vez, todas `prosseguir`, token novo gravado);
  - "pagina do shell com sessao revogada: navegacao a / vai ao login com o cookie apagado".
- `base/verificacao/oidc/oidc.test.mjs`: `inicioComDominios` (200, "Seus módulos", sem "Avisos indisponíveis")
  antes de vencer e, depois do vencimento do primeiro token, `pedir('/')` **antes** de qualquer página de zona.

Mutação (ramo 4 de `decidirAcaoDoProxy` devolve `prosseguir` sem `prosseguirComRenovacao`):
```
-  return prosseguirComRenovacao(contexto, renovar, nonce)
+  return { acao: 'prosseguir', nonce }
```
- `cd repos/erp-shell && pnpm test` → rc=1, 82/86, **PEGA**:
  - ✖ pagina do shell com sessao revogada (memoria|redis falso)
  - ✖ paginas do shell (memoria|redis falso): so requisicoes a / ... renovam uma vez
- `CONSTRUIR=1 task verificar:oidc` → rc=201, 4/5, **PEGA**:
  - ✖ pagina de zona ainda 200 ... depois do vencimento: `inicio do shell depois do vencimento do primeiro token: HTTP 307`
- Restaurado (`git status`: só o teste modificado); sem mutação: shell 86/86; `CONSTRUIR=1 task verificar:oidc` 5/5.

## 2. F04 — segredo do cliente na lista da zona

Teste novo em `base/scripts/ambiente.test.mjs`: "F04: variavel so do shell (segredo do cliente OIDC e afins) nunca
entra no ambiente de zona nem de dominio". A lista sai do código, não do `CONFIGURACAO.md` (a tabela de lá não marca
"só do shell" de forma que se leia sem ambiguidade): o que o shell lê (`repos/erp-shell` mais `LIDAS_SO_NO_SHELL` do
núcleo) e nem zona nem domínio leem, com o piso explícito `IDP_CLIENTE_SEGREDO`, `IDP_CLIENTE_ID`, `IDP_URL_RETORNO`,
`IDP_URL_POS_LOGOUT` (precisa estar na derivação: dá dentes a ela), mais `REDIS_URL` e `ERP_REDIS_SENHA_SHELL`.
Confere a lista (`AMBIENTE_PERMITIDO`) e o comportamento (`ambienteDoPapel` de zona e domínio só devolve `PATH`).
O helper `lidas` do teste V1 passou ao nível do módulo para ser reusado.

Mutação (`AMBIENTE_PERMITIDO.zona` com o cliente OIDC):
```
-    'IDP_EMISSOR',
+    'IDP_EMISSOR', 'IDP_CLIENTE_ID', 'IDP_CLIENTE_SEGREDO',
```
- `node --test base/scripts/*.test.mjs` → rc=1, 20/21, **PEGA**:
  - ✖ F04: variavel so do shell ... nunca entra no ambiente de zona nem de dominio (`variavel so do shell na lista de zona`)
- Restaurado (`git diff base/scripts/ambiente.mjs` vazio); sem mutação: 21/21.

## 3. L04 — id da transação igual ao state

Testes no núcleo (só teste; versão do núcleo intocada):
- `repos/erp-nucleo/test/identidade-oidc.test.mjs`: "iniciar: id da transacao (cookie __Host-erp-login) independente
  de state, nonce e code_verifier, e fora da URL" (os quatro valores distintos e com 43+ caracteres; o id não aparece
  na URL nem em nenhum parâmetro dela).
- `repos/erp-nucleo/test/identidade.test.mjs` (identidadeDev): mesma afirmação no teste de `iniciar`.

Mutação L04 (`novaTransacao`):
```
+  const state = aleatorio()
-    id: aleatorio(), state: aleatorio(), codeVerifier: aleatorio(), nonce: aleatorio(),
+    id: state, state, codeVerifier: aleatorio(), nonce: aleatorio(),
```
- `cd repos/erp-nucleo && pnpm test` → rc=1, 224/226, **PEGA**:
  - ✖ iniciar devolve url e transacao com segredos aleatorios e unicos a cada chamada
  - ✖ iniciar: id da transacao (cookie __Host-erp-login) independente de state, nonce e code_verifier, e fora da URL

Bônus L07 (`nonce: state`, recomendação do auditor): `pnpm test` → rc=1, 224/226, **PEGA** (os mesmos dois testes).
- Restaurado (`git status`: só os dois testes); sem mutação: núcleo 226/226.

## Verificação final (árvore restaurada)
- `cd repos/erp-shell && pnpm test`: 86/86.
- `cd repos/erp-nucleo && pnpm test`: 226/226.
- `task scripts:test`: 21/21.
- `task verificar:estatica`: 51/51.
- `CONSTRUIR=1 task verificar:oidc`: 5/5 (rc=0), com o shell reconstruído depois da restauração.
- `task showcase:checar`: rc=0 (vida do token de volta ao padrão). Portas 3000–3003 e 4001–4120 livres.

## Commits
- erp-shell `bce8f59` test(proxy): shell pages alone renew the token in the window and log out on revocation (push feito).
- erp-nucleo `aeae3af` test(identity): login transaction id is independent of state, nonce and code_verifier and
  stays out of the authorization URL (push feito; versão do núcleo intocada).

## Pendente no principal (para o orquestrador commitar; nenhum commit feito aqui)
- `base/scripts/ambiente.test.mjs` (teste F04; helper `lidas` ao nível do módulo).
- `base/verificacao/oidc/oidc.test.mjs` (`inicioComDominios` e `pedir('/')` depois do vencimento).
- Ponteiros de submódulo `repos/erp-shell` (bce8f59) e `repos/erp-nucleo` (aeae3af).
- `.agents/worker_d2_1/relatorio.md` (este arquivo).
Não toquei `.agents/orchestrator/*`, `docs/*` nem os `pnpm-lock.yaml` de erp-dominio-stub e erp-moldura.
