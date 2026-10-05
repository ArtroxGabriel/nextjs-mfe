# Handoff auditor_d2_2 (final) — veredito: **VETO**

Gate D2, iteração 2. Correção do veto no principal `0b650ad` (era `d5e42c0` antes da reescrita que mascarou um JWT); erp-nucleo `aeae3af`; erp-shell `bce8f59`.

## Linha de base (conferida no início)
- Principal: `docs/README.md`, `docs/arquitetura/alvo.md` modificados e `docs/arquitetura/infraestrutura-alvo.md` novo (não são meus;
  pré-existentes). Submódulos: só os `pnpm-lock.yaml` de erp-dominio-stub e erp-moldura (pré-existentes).
- `dist` do @erp/nucleo nas 4 apps = tarball 0.10.2 do Verdaccio (`diff -r`).
- Portas 3000–3003 e 4001–4120 livres; nenhum `node` vivo.

## Andamento
- Etapa 0: leitura. Concluída.
- Lote 1 (vetos e variantes, nível unidade; trecho exato em `mutacoes.txt`). Concluído:
  - P04 e variantes: P04, P04c (renova em todas menos `/`), P04d (renova sem esperar, ignora revogada), P04e (só não-GET),
    P04g (`renovar` só com zona), P04f (fábrica não regrava, núcleo fonte) e P04fd (idem no dist, testes do shell): **PEGAS**.
    P04b (renova só em `/`, não nas outras páginas do shell): **sobrevive**, equivalente hoje (o shell só tem a página `/`
    em `app/(app)`; o resto é público ou 404).
  - F04 e variantes: F04, F04b (no domínio), F04c (só o segredo), F04d (`IDP_URL_POS_LOGOUT`), F04e (todo `IDP_*`),
    F04f (zona de acesso com papel shell), F04g (`*_SEGREDO`): **PEGAS**.
  - L04 e L07: **PEGAS** (núcleo, 2 testes). L04d (dist, testes do shell) sobrevive: o dono é o núcleo, que pega na fonte.
  - Variantes de L04 que **sobrevivem**: L04h (`id = sha256(state)`), L04k (`id = state + '.login'`), L04j
    (`codeVerifier = sha256(state)`); L04i (`state = sha256(id)`) sobrevive e é equivalente (o state não revela o id).
    Veto: ver abaixo.
- Lote 2 (dentes dos testes novos e regressão). Concluído:
  - Dentes: T1 (derivação "só do shell" vazia) **reprova** pelo piso; T2 (sem o piso, só a derivação, com F04) **reprova**:
    a derivação sozinha tem dentes; T2s (sem o piso, sem mutação) passa: o teste não reprova à toa. T3 (valores constantes e
    distintos por campo) **reprova** no núcleo pelo teste antigo "unicos a cada chamada" do `identidadeDev`; T3o: o teste novo
    do `identidadeOidc` sozinho passa com valores constantes (não confere unicidade entre chamadas; a suíte pega porque os
    dois provedores usam `novaTransacao`). T4 (todos iguais) **reprova**.
  - Regressão, uma ou mais por família, todas **PEGAS**: O03, O09, O11, O18, L01, H04, C03, R01, R04, A03, N01, N05, N06
    (um arquivo travou; encerrei o processo de teste após ~18 min, 8 testes já reprovados), F01, S04, S05, K01, P05, P03,
    Z01, Y01, J04, J26, B01, G02, F05, F08.
  - `repos/erp-nucleo/dist` (build local, ignorado pelo git) ficou com o F01 depois da última rodada; refeito com `pnpm build`.
- Lote 3 (ponta a ponta, `CONSTRUIR=1 task verificar:oidc`). Concluído:
  - E09 (P04 no `decisao-proxy.ts`) e E09p (P04 no `proxy.ts`: `renovarSessao` só fora de `/`): **PEGAS**
    ("inicio do shell depois do vencimento do primeiro token: HTTP 307").
  - E10 (regressão, stub com tolerância em ms): **PEGA**.
  - E16h (dist do shell, `id = sha256(state)`): **sobrevive** 5/5; o login funciona e nada no ponta a ponta confere o id.

## Números
- 59 execuções (catálogo com trecho exato ANTES/DEPOIS em `mutacoes.txt`): 56 mutações de produto e 3 de teste (dentes).
- Das 56 de produto, 48 reprovaram no nível rodado. As que passaram, contadas uma vez por mutação ao fim de todos os níveis:
  **5 sobreviventes distintas**, 2 equivalentes (P04b, L04i) e **3 de boa-fé** (L04h, L04k, L04j). L04d (dist, testes do
  shell) e T3o (só o teste do `identidadeOidc`) passam, mas o dono pega: L04 no núcleo, T3 pela suíte inteira.
- Vetos da iteração 1: P04, F04, L04 e L07 agora reprovam, inclusive P04 no ponta a ponta (E09, e E09p no `proxy.ts`).
- Regressão: 27 do catálogo da iteração 1, de todas as famílias (O, L, H, C, R, A, N, F, S, K, P, Z, Y, J, B, G, E), todas pegas.

## VETO: variantes de boa-fé do L04 que sobrevivem, com o teste que falta

O teste novo do L04 só afirma **desigualdade** entre `id`, `state`, `nonce` e `codeVerifier`, e que o `id` não aparece
literalmente na URL. Um segredo **derivado** do que vai na URL passa. O efeito é o mesmo do L04: quem vê
`/api/auth/retorno?code&state` antes do navegador calcula o cookie `__Host-erp-login` e conclui o login no navegador dele
(`retorno` em `erp-shell/lib/rotas-auth.ts` só exige o cookie e os parâmetros). O vínculo da transação com o navegador
(ADR-0013, decisão 3) acaba.

1. **L04h: `id = sha256(state)` em base64url** (`erp-nucleo/src/interno/login.ts`, `novaTransacao`). Passa 226/226 no núcleo
   e 5/5 no ponta a ponta OIDC (E16h, no dist do shell). Esconder o state com um hash antes de usá-lo como chave é um erro
   comum.
2. **L04k: `id = state + '.login'`.** É o L04 com um sufixo de "namespace", e passa 226/226. O `id` não aparece na URL, mas
   contém o state.
3. **L04j: `codeVerifier = sha256(state)`.** Passa 226/226. Derivar o verifier do state para não guardá-lo é um "PKCE sem
   estado" que se vê por aí. Com o state na URL, o PKCE deixa de proteger o código. O cliente confidencial atenua (trocar o
   código exige o segredo), mas o ADR-0013 exige PKCE de verdade.

**Teste que falta, um só para as três**, em `erp-nucleo/test/identidade-oidc.test.mjs` e `identidade.test.mjs`, no teste
de `iniciar`:
- para `id` e `codeVerifier`, contra cada valor que vai na URL (`state`, `nonce`, e todo parâmetro da URL de autorização):
  nenhum contém o outro, e o segredo não é `sha256`/`sha512` do valor público em base64url, base64 ou hex;
- ou, mais forte: com `mock.method` em `crypto.randomBytes` e `syncBuiltinESMExports()`, `novaTransacao` faz 4 sorteios
  independentes de 32 bytes, e cada campo é exatamente um deles.

## Sobreviventes sem veto
- **P04b** (renova só em `/`): equivalente hoje, porque a única página autenticada do shell é `app/(app)/page.tsx`. O resto
  é público (`/login`, `/erro-de-zona`, `/api/auth`) ou 404. Recomendo um caso com outro caminho do shell (ex.: `/qualquer`)
  no teste "paginas do shell", para valer quando surgir a segunda página.
- **L04i** (`state = sha256(id)`): equivalente, porque o state público não revela o id.
- **T3o**: o teste novo do `identidadeOidc`, sozinho, passa com valores constantes e distintos por campo, porque não
  confere unicidade entre chamadas. A suíte pega pelo teste antigo do `identidadeDev`, já que os dois usam `novaTransacao`.
  Recomendo duas chamadas também no teste do OIDC.

## Dentes dos testes novos (conferido)
- F04: a derivação vazia reprova pelo piso (T1); sem o piso, a derivação sozinha pega o F04 (T2); sem o piso e sem
  mutação, o teste passa (T2s, controle).
- P04: os 4 casos novos (`/` renova uma vez e grava; `/` revogada vai ao login), nos dois stores, reprovam no P04, P04c,
  P04e e P04g. No P04d também reprova o P0-d.
- L04/L07: reprovam 2 testes cada um. Com valores constantes (T3) e iguais (T4), a suíte reprova.

## Estado no fim (conferido às 18:37 UTC)
- Toda mutação foi restaurada com escrita normal (mtime novo). `git status` dos submódulos é igual à linha de base: só os
  `pnpm-lock.yaml` de erp-dominio-stub e erp-moldura, que já estavam assim. O principal tem só as mudanças pré-existentes
  em `docs/` e esta pasta.
- O `dist` do @erp/nucleo nas 4 apps é igual ao tarball 0.10.2 do Verdaccio (`diff -r`). `repos/erp-nucleo/dist` (build
  local, ignorado) foi refeito depois do F01.
- Na árvore restaurada: `CONSTRUIR=1 task verificar:redis` 118/118; `task verificar:oidc` 5/5; `task test` com
  contratos 20, núcleo 226, moldura 26, stub 75 e shell 86, todos verdes.
- `task showcase:checar` rc=0: Keycloak no padrão.
- Portas 3000–3003 e 4001–4120 livres (`ss -ltn`: 0 linhas). Nenhum `node`/`next`/`pnpm` vivo. Redis, Keycloak e Verdaccio
  continuam no ar.
- Nenhum JWT nesta pasta (`grep eyJ`: 0).
