# Handoff auditor_d2_1 (final) — veredito: **VETO**

Gate D2, iteração 1. Escopo: principal 4c88d33..HEAD; erp-nucleo cf56312..HEAD; erp-shell c8a3683..HEAD;
erp-dominio-stub 29bdc1c..HEAD. Catálogo completo em `mutacoes.txt` (esta pasta): mutação, arquivo, comando,
resultado e os testes que reprovaram. Nenhum token nem JWT nos arquivos (`grep eyJ` = 0; logs com `<jwt-mascarado>`).

## Números
- 162 execuções válidas: 136 pegas, 26 sobreviventes (mais 6 refeitas: 2 não compilavam, 1 inválida no `next build`, 3 sem trecho).
- Contando a mesma mutação em vários níveis (fonte, dist contra o shell, ponta a ponta) uma vez só: **144 mutações distintas,
  127 pegas e 17 sobreviventes** ao fim de todos os níveis.
- Níveis: núcleo (fonte, `pnpm test`), shell e stub (`pnpm test`), ambiente e estáticas (`base/scripts/*.test.mjs`,
  `verificar:estatica`), [dist] instalado contra os testes do shell, e ponta a ponta (`CONSTRUIR=1 task verificar:oidc`,
  `base.test.mjs` por nome, `task verificar`).

## Pegas, por área pedida (detalhe no catálogo)
- PKCE/state/nonce/transação/emissor/redirect_uri/logout sem token: O01–O04, O06–O21, O23–O27b, L01–L03, L05, L06, R04, A02; E03/E04 (logout seguido até o Keycloak).
- Renovação: R01–R03, A01, A03, A04b, N01–N07, N09, N10, N12, Z01–Z03, P01–P03, P05–P07; ponta a ponta E01 (lock sem NX), E02 (vencimento), E05 (janela), E06 (rotação), E08 (proxy.ts sem renovar).
- Rotas entrar/retorno/sair e Set-Cookie: S01, S03–S12, S14, S15, K01, K02b, K03, N08 (pelo teste do shell); 403 do `sair` no `base.test.mjs`: E13b.
- CSP `formularioPara`: C01–C07, Y01; zona sem a origem do IdP no ponta a ponta: E07.
- `ERP_PERMITIR_HTTP_LOCAL` e loopback: H01–H04 (núcleo), J20–J22, J27 (stub).
- Stub RS256/JWKS e token de serviço: J01–J16, J18b, J20–J23, J26, B01–B03, G01–G04; exp no ponta a ponta: E10.
- Lista de inclusão e estáticas: F01–F03, F05–F08; F09 escapa da `verificar:estatica` mas é pega no `base.test.mjs` (E14, N3 estático).

## VETO — sobreviventes que são erro plausível de boa-fé, com o teste que falta

1. **P04 / E09 — páginas do shell sem renovação proativa** (`erp-shell/lib/decisao-proxy.ts:257`, o ramo 4 devolve
   `prosseguir` sem `prosseguirComRenovacao`). Sobrevive a `pnpm test` do shell e a `verificar:oidc`. Efeito: quem fica
   nas páginas do shell (`/`) depois do vencimento do access token cai no login com a sessão válida (a página consulta
   `/v2/eu` com o token vencido); o ADR-0013 (decisão 4) e o AGENTS (inv. 15) dizem que a renovação é no proxy, para toda
   requisição. O P0-d mistura `/` e `/zona1/relatorios` e um vencedor de zona mascara o erro.
   **Teste que falta:** em `erp-shell/test/proxy-renovacao.test.mjs`, só requisições a `/` com o token na janela
   chamam o IdP uma vez e gravam o token novo; e/ou em `oidc.test.mjs`, `pedir('/')` com 200 depois do vencimento.
2. **F04 / E11 — `IDP_CLIENTE_SEGREDO` (e `IDP_CLIENTE_ID`) na lista de inclusão da zona** (`base/scripts/ambiente.mjs`,
   `AMBIENTE_PERMITIDO.zona`). Sobrevive a `base/scripts/*.test.mjs` e a `verificar:oidc`. Efeito: o segredo do cliente
   confidencial chega às zonas; com o D17 (zona lê o refresh token de toda sessão), uma zona comprometida renova
   qualquer sessão. A aceitação do D17 depende dessa ausência ("`IDP_CLIENTE_SEGREDO` só no shell, fora da lista de
   inclusão da zona") e nada a verifica. **Teste que falta:** em `ambiente.test.mjs`, a lista da zona não tem
   `IDP_CLIENTE_SEGREDO` (ou só tem o que a zona lê mais `DO_SISTEMA`); e/ou no ponta a ponta OIDC, `/proc/<pid>/environ`
   das zonas sem `IDP_CLIENTE_SEGREDO` (como já se faz com a senha do Redis).
3. **L04 / E16 — id da transação igual ao `state`** (`erp-nucleo/src/interno/login.ts:25`). Sobrevive ao núcleo, ao
   shell ([dist]) e a `verificar:oidc`. Efeito: o cookie `__Host-erp-login` deixa de ser um "id opaco" (ADR-0013,
   decisão 3): o valor vai na URL de autorização e volta na de retorno, então quem vir `/api/auth/retorno?code&state`
   antes do navegador tem código e cookie, e o vínculo da transação com o navegador acaba. Chavear a transação pelo
   `state` é um padrão comum. **Teste que falta:** no teste de `iniciar` (`identidade-oidc.test.mjs` / `identidade.test.mjs`),
   `transacao.id` diferente de `state`, `nonce` e `codeVerifier`, e ausente da URL de autorização.

## Limite declarado (não veta)
- **X01 / E15** — `proxy.ts` não apaga o cookie da sessão morta (`semSessaoSe`): `task verificar` 114/118 + 4 pulados, verde.
  É o item "cola de `proxy.ts` (`Set-Cookie` no 307) sem teste próprio" do D22.

## Sobreviventes sem veto (equivalentes ou sem defeito; recomendações)
- O05 `idTokenExpected: false`: equivalente (`sessaoDe` devolve `null` sem claims no login).
- O22 `expiraEm` ignora `refresh_expires_in`: o teste usa 1800, igual ao padrão de `ERP_SESSAO_INATIVIDADE_S`, e não
  distingue. Sem defeito de segurança (a renovação expõe a revogação). Recomendo `refresh_expires_in` ≠ 1800 no fixture.
- L07 `nonce = state`: sem impacto (o nonce não é segredo); recomendo cobrir junto com o teste do L04.
- R07 (regravar vencida sem `del`) e R08 (consumir sem conferir `v.id`): equivalentes (TTL do Redis; chave derivada do id).
- N11 / N11d / E12 lock antes de conferir a janela: sem efeito funcional, um `SET NX` por requisição. Recomendo afirmar
  que `adquirirLockRenovacao` não é chamado com o token em dia.
- S02 (`Sec-Fetch-Site: none` aceito no `sair`): o valor só vem de ação do próprio usuário, nunca de outro site.
- S13 (`etapa` na URL de erro): não é dado sensível.
- J19 (buscas do JWKS não compartilhadas): equivalente (o limite de taxa é síncrono).
- J24, J25, B04 (stub: intervalo > TTL aceito; falha do JWKS apaga o cache; verificador sem cache por processo):
  disponibilidade e desempenho do domínio falso, escopo do D23. J17b (`use: enc` aceito): o fixture tem `alg: RSA-OAEP`
  e a checagem de `alg` mascara; recomendo um fixture `use: enc` sem `alg`.

## Estado no fim (conferido)
- Toda mutação restaurada: `git status`/`diff` de cada submódulo igual à linha de base (só os `pnpm-lock.yaml`
  pré-existentes de erp-dominio-stub e erp-moldura); nenhum `.auditbak`; `dist` instalado do @erp/nucleo nas 4 apps
  igual ao tarball 0.10.2 (`diff -r`). Builds refeitos com `CONSTRUIR=tudo` antes das verificações finais.
- Verificações finais na árvore restaurada: `CONSTRUIR=tudo task verificar:redis` 118/118; `task verificar:oidc` 5/5;
  `task test`: contratos 20, núcleo 225, moldura 26, stub 75, shell 82, todos verdes.
- Keycloak: `task showcase:checar` saiu com 0 (a vida do token voltou ao padrão).
- Portas 3000–3003 e 4001–4120 livres (`ss -ltn`: 0 linhas, 15:44 UTC); nenhum `node` de teste vivo. Redis, Keycloak e
  Verdaccio no ar, sem mexer.

## Armadilha para o AMBIENTE.md (o orquestrador decide)
- `CONSTRUIR=1` não vê mudança no `dist` instalado (`node_modules` fora de `ENTRADAS_DO_BUILD`): mutação do dist exige
  tocar a app (`touch next.config.ts`) antes e depois; e restaurar a fonte com `copy2`/`cp -p` devolve o mtime antigo e
  deixa o build mutado valendo. Restaure sem preservar o mtime.
