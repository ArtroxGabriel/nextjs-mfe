# D2 + K6: Login OIDC, Renovação Proativa com Lock e Fechamento de Lacunas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement production-ready OIDC + PKCE authentication against Keycloak with serialized proactive token renewal via Redis lock (`SET NX PX`), dual-mode mock domain JWT verification, actor "eva" (closing D13), and address all non-veto deferred gaps from iteration 9 (K6).

**Architecture:** 
- `@erp/nucleo` 0.10.0 refactors `ProvedorDeIdentidade` into an OIDC lifecycle interface (`iniciar`, `concluir`, `renovar`, `encerrar`).
- Login state and PKCE verifier stored server-side in the session store (10 min TTL, single-use) identified by `__Host-erp-login`.
- Proactive token renewal serializes in `erp-shell/proxy.ts` using Redis `SET NX PX` lock: winner re-reads session, refreshes tokens with Keycloak without reuse (`refreshTokenMaxReuse: 0`), and updates the store; losers proceed without waiting.
- Subdomain mock in `erp-dominio-stub` validates Keycloak RS256 JWTs via cached JWKS when `IDP_EMISSOR` is configured.
- Static analyzers and test harnesses hardened to close deferred gaps D15 (LA–LG).

**Tech Stack:** Next.js 16, TypeScript, Node.js `node:crypto`, `openid-client` v6, Redis (`node-redis` 6.2.1), Keycloak 26.

**Spec:** [ADR-0013](file:///home/gabrigas/projects/nextjs-mfe/docs/adr/0013-login-oidc-e-renovacao-proativa.md), [ADR-0009](file:///home/gabrigas/projects/nextjs-mfe/docs/adr/0009-modelo-de-comunicacao-entre-zonas-e-dominios.md), [docs/CONFIGURACAO.md](file:///home/gabrigas/projects/nextjs-mfe/docs/CONFIGURACAO.md), [.agents/orchestrator/DEFERRED.md](file:///home/gabrigas/projects/nextjs-mfe/.agents/orchestrator/DEFERRED.md).

## Global Constraints

- Never expose access token, refresh token, or id token to the browser (`AGENTS.md` Invariant 1).
- Shell is the single writer and renewer of sessions; zones only read opaquely (`AGENTS.md` Invariant 15).
- No hardcoded timeouts or lifespans: use environment variables documented in `docs/CONFIGURACAO.md` with safe fallbacks.
- Single-use login transaction stored server-side; browser only carries opaque cookie ID `__Host-erp-login`.
- Zero token reuse policy (`refreshTokenMaxReuse: 0`): concurrent refresh race must be prevented by Redis `SET NX PX` lock and session re-read.
- Package versions synchronized across all 4 apps in lockstep (`@erp/nucleo` 0.10.0).

---

## Proposed Dependency Installations (For Human Approval)

Before executing implementation, the following package changes will be installed:
1. `repos/erp-nucleo/package.json`:
   - `peerDependencies`: add `"openid-client": "^6.8.8"` (optional).
   - `devDependencies`: add `"openid-client": "^6.8.8"` (for typing and tests).
2. `repos/erp-shell/package.json`:
   - `dependencies`: add `"openid-client": "^6.8.8"`.

---

## Tasks

### Task 1: K6 — Lacunas sem veto da iteração 9 e Ator Eva (D13, D15)

**Files:**
- Modify: `repos/erp-nucleo/src/adaptadores/identidade-dev.ts`
- Modify: `base/scripts/ambiente.mjs`
- Modify: `base/verificacao/saida-de-rede.mjs`
- Modify: `base/verificacao/seguranca-estatica.mjs`
- Modify: `base/showcase/subir.mjs`
- Modify: `base/showcase/keycloak/realm-erp.json`
- Modify: `repos/erp-dominio-stub/src/dados/acesso.json`
- Test: `base/verificacao/test/seguranca-estatica.test.mjs`
- Test: `base/verificacao/test/saida-de-rede.test.mjs`
- Test: `repos/erp-nucleo/test/fronteira.test.mjs`

**Interfaces:**
- Consumes: Existing static analyzers and dev identity.
- Produces: Actor `eva` with `tarefas.ver` only; static analyzer ignores `declare` and flags `assetPrefix` assignments (`??=`, `+=`, `||=`, `defineProperty`); `precisaConstruir` watches `ambiente.mjs`.

- [ ] **Step 1: Write tests for static analyzer enhancements and actor Eva**
  - Add test in `base/verificacao/test/saida-de-rede.test.mjs` ensuring `declare const fetch` does not suppress network check errors.
  - Add test in `base/verificacao/test/seguranca-estatica.test.mjs` covering `assetPrefix ??=`, `+=`, `defineProperty`, and `let` constant rejection.
  - Add test in `repos/erp-nucleo/test/fronteira.test.mjs` verifying union and Promise branches of `temEscrita`.
  - Add test verifying that actor `eva` is denied in `concluirTarefa`.

- [ ] **Step 2: Run tests to verify failures**
  - Run: `node --test base/verificacao/test/*.test.mjs`
  - Expected: FAIL on the new test cases.

- [ ] **Step 3: Implement fixes for K6 and actor Eva**
  - Update `base/scripts/ambiente.mjs` in `precisaConstruir` to compare mtime against `ambiente.mjs`.
  - Update `base/verificacao/saida-de-rede.mjs` to ignore AST nodes with `declare` modifier in `nomesLigados`.
  - Update `base/verificacao/seguranca-estatica.mjs` to flag assignment operators on `assetPrefix`.
  - Add `eva: 'Eva Apenas Leitora'` to `ATORES` in `identidade-dev.ts`, `realm-erp.json`, and `acesso.json` with permissions restricted to `tarefas.ver`.
  - In `base/showcase/subir.mjs`, mask Redis password from CLI args / banner.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `node --test base/verificacao/test/*.test.mjs repos/erp-nucleo/test/*.test.mjs`
  - Expected: PASS

- [ ] **Step 5: Commit K6**
  - Commit: `feat(k6): close deferred items D13 and D15 (actor eva, static checks, build freshness)`

---

### Task 2: Core Identity Port & Redis Renewal Lock (`@erp/nucleo` 0.10.0)

**Files:**
- Modify: `repos/erp-nucleo/src/portas/identidade.ts`
- Modify: `repos/erp-nucleo/src/portas/sessao.ts`
- Modify: `repos/erp-nucleo/src/adaptadores/sessao-redis.ts`
- Modify: `repos/erp-nucleo/src/adaptadores/sessao-arquivo.ts`
- Modify: `repos/erp-nucleo/src/adaptadores/identidade-dev.ts`
- Modify: `repos/erp-nucleo/src/fabricas/criarNucleo.ts`
- Modify: `repos/erp-nucleo/src/shell/index.ts`
- Modify: `repos/erp-nucleo/package.json`
- Test: `repos/erp-nucleo/test/identidade.test.mjs`
- Test: `repos/erp-nucleo/test/sessao-redis.test.mjs`

**Interfaces:**
- Consumes: Redis client, `node:crypto`.
- Produces: 
  ```typescript
  export interface TransacaoDeLogin {
    id: string
    state: string
    codeVerifier: string
    nonce: string
    destino: string
    expiraEm: number
  }

  export type ResultadoRenovacao = 
    | { status: 'renovada'; sessao: SessaoArmazenada }
    | { status: 'revogada' }

  export interface ProvedorDeIdentidade {
    iniciar(destino?: string): Promise<{ url: string; transacao: TransacaoDeLogin }>
    concluir(parametros: Record<string, string>, transacao: TransacaoDeLogin): Promise<SessaoArmazenada | null>
    renovar(sessao: SessaoArmazenada): Promise<ResultadoRenovacao>
    encerrar(sessao: SessaoArmazenada): Promise<{ urlLogout: string | null }>
  }

  export interface EscritorDeSessao {
    gravar(id: string, s: SessaoArmazenada): Promise<void>
    remover(id: string): Promise<void>
    gravarTransacao(transacao: TransacaoDeLogin): Promise<void>
    consumirTransacao(id: string): Promise<TransacaoDeLogin | null>
    adquirirLockRenovacao(idSessao: string, ttlMs: number): Promise<boolean>
  }
  ```

- [ ] **Step 1: Write failing tests for new identity lifecycle and Redis lock**
  - Create `repos/erp-nucleo/test/identidade.test.mjs`:
    - Test `iniciar()` returns unique URL, state, codeVerifier, nonce.
    - Test `concluir()` accepts valid return, validates state/nonce, returns session.
    - Test `concluir()` rejects tampered state or nonce.
    - Test single-use transaction consumption.
    - Test `renovar()` returns `'renovada'` with refreshed timestamps.
    - Test `renovar()` returns `'revogada'` when refresh token invalid.
  - In `sessao-redis.test.mjs`:
    - Test `adquirirLockRenovacao`: first caller gets true, second caller gets false while TTL active.

- [ ] **Step 2: Run tests to verify failures**
  - Run: `node --test repos/erp-nucleo/test/identidade.test.mjs repos/erp-nucleo/test/sessao-redis.test.mjs`
  - Expected: FAIL

- [ ] **Step 3: Implement new identity port, transaction storage, and Redis lock**
  - Update `portas/identidade.ts` and `portas/sessao.ts`.
  - In `sessao-redis.ts`: implement `adquirirLockRenovacao` using `cliente.set(lockKey, '1', { PX: ttlMs, NX: true })`, and login transaction persistence.
  - In `sessao-arquivo.ts`: implement file-based lock and transaction storage for dev mode.
  - In `identidade-dev.ts`: refactor to implement `iniciar`, `concluir`, `renovar`, `encerrar`.
  - In `fabricas/criarNucleo.ts`: update `criarNucleoDoShell` to support `iniciarLogin`, `concluirLogin`, `renovarSessao`, `encerrarSessao`.
  - Bump `@erp/nucleo` version to `0.10.0`.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `pnpm --filter @erp/nucleo test`
  - Expected: PASS

- [ ] **Step 5: Commit core identity port**
  - Commit: `feat(nucleo): identity lifecycle v2 with proactive renewal lock and transaction store`

---

### Task 3: OIDC Adapter with `openid-client` (`@erp/nucleo/shell`)

**Files:**
- Create: `repos/erp-nucleo/src/adaptadores/identidade-oidc.ts`
- Modify: `repos/erp-nucleo/src/shell/index.ts`
- Modify: `repos/erp-nucleo/package.json`
- Test: `repos/erp-nucleo/test/identidade-oidc.test.mjs`

**Interfaces:**
- Consumes: `openid-client` v6, OIDC server endpoints.
- Produces: `identidadeOidc(config: ConfigIdentidadeOidc): ProvedorDeIdentidade`.

- [ ] **Step 1: Write unit tests with mock OIDC discovery and token endpoints**
  - Mock OIDC server response for discovery, authorization URL generation with S256 PKCE, code token exchange, and refresh token exchange.
  - Test validation of `sub`, `preferred_username`, `aud` contains `erp-dominios`.
  - Test mapping of `invalid_grant` to `{ status: 'revogada' }`.
  - Test transient error (500, network error) rethrows to allow caller backoff without destroying session.

- [ ] **Step 2: Run tests to verify failures**
  - Run: `node --test repos/erp-nucleo/test/identidade-oidc.test.mjs`
  - Expected: FAIL

- [ ] **Step 3: Implement `identidade-oidc.ts`**
  - Use `openid-client` v6 discovery (`discovery(issuerUrl, clientId, clientSecret)`).
  - Use `customFetch` with `redirect: 'manual'` and timeout `ERP_DESTINO_TIMEOUT_MS`.
  - Enforce HTTPS in production (`http://` only allowed if `NODE_ENV !== 'production'`).
  - Implement `iniciar`, `concluir`, `renovar`, and `encerrar`.
  - Export `identidadeOidc` from `@erp/nucleo/shell`.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `node --test repos/erp-nucleo/test/identidade-oidc.test.mjs`
  - Expected: PASS

- [ ] **Step 5: Commit OIDC adapter**
  - Commit: `feat(nucleo): add OIDC PKCE adapter with token rotation and revocation mapping`

---

### Task 4: Shell Integration: Proactive Renewal in Proxy and Auth Route Handlers

**Files:**
- Modify: `repos/erp-shell/proxy.ts`
- Modify: `repos/erp-shell/lib/decisao-proxy.ts`
- Modify: `repos/erp-shell/lib/nucleo.ts`
- Modify: `repos/erp-shell/app/api/auth/entrar/route.ts`
- Create: `repos/erp-shell/app/api/auth/retorno/route.ts`
- Modify: `repos/erp-shell/app/api/auth/sair/route.ts`
- Modify: `repos/erp-shell/package.json`
- Test: `repos/erp-shell/test/proxy-renovacao.test.mjs`
- Test: `repos/erp-shell/test/rotas-auth.test.mjs`

**Interfaces:**
- Consumes: `@erp/nucleo/shell` 0.10.0, `adquirirLockRenovacao`, `renovarSessao`.
- Produces: Proactive non-blocking renewal on zone/shell requests, OIDC auth initiation, callback exchange with single-use cookie `__Host-erp-login`.

- [ ] **Step 1: Write integration tests for proactive renewal and auth flows**
  - Test 20 concurrent requests hitting `proxy.ts` with expiring token: only 1 renewal happens, 19 continue with existing session without waiting.
  - Test `GET /api/auth/entrar` sets `__Host-erp-login` and redirects to IdP.
  - Test `GET /api/auth/retorno` exchanges valid code, sets `__Host-session`, clears `__Host-erp-login`.
  - Test `GET /api/auth/retorno` with mismatched state/nonce returns error / redirect to `/login` and destroys transaction.
  - Test `POST /api/auth/sair` calls `encerrar`, clears cookie, redirects.

- [ ] **Step 2: Run tests to verify failures**
  - Run: `node --test repos/erp-shell/test/proxy-renovacao.test.mjs repos/erp-shell/test/rotas-auth.test.mjs`
  - Expected: FAIL

- [ ] **Step 3: Implement proxy renewal and auth endpoints in `erp-shell`**
  - In `lib/nucleo.ts`: instantiate `identidadeOidc` if `IDP_EMISSOR` is configured, otherwise `identidadeDev`.
  - In `proxy.ts`: implement proactive renewal check:
    - If `temCookieSessao`: read session from store. If token expiring in < `ERP_RENOVACAO_JANELA_S`:
      - Call `store.adquirirLockRenovacao(sessionId, ERP_RENOVACAO_LOCK_S * 1000)`.
      - If acquired: re-read session from store. If still expiring, call `nucleo.sessao.renovar(...)`.
      - If revogada: clear cookie, redirect to `/login`.
      - If renovada: update session in store with new expiry and tokens.
  - Implement `GET /api/auth/entrar` and `GET /api/auth/retorno`.
  - Update `sair/route.ts` to call IdP logout if available.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `node --test repos/erp-shell/test/*.test.mjs`
  - Expected: PASS

- [ ] **Step 5: Commit shell proactive renewal and auth routes**
  - Commit: `feat(shell): proactive token renewal in proxy and OIDC auth routes`

---

### Task 5: Domain Stub RS256 JWT Verification & Showcase Keycloak Integration

**Files:**
- Modify: `repos/erp-dominio-stub/src/servidor.ts`
- Modify: `repos/erp-dominio-stub/package.json`
- Modify: `base/showcase/keycloak/realm-erp.json`
- Modify: `base/showcase/checar-keycloak.mjs`
- Test: `repos/erp-dominio-stub/test/jwt-verificacao.test.mjs`
- Test: `base/verificacao/base.test.mjs`

**Interfaces:**
- Consumes: Keycloak JWKS, `node:crypto`.
- Produces: RS256 token verification rejecting `alg: none`, HMAC with public key, wrong issuer, expired token, or missing `erp-dominios` audience.

- [ ] **Step 1: Write security tests for domain JWT validation**
  - Test token with `alg: none` -> 401.
  - Test token signed with HMAC using RS256 public key -> 401.
  - Test token with wrong audience or issuer -> 401.
  - Test valid Keycloak token with `preferred_username` -> 200 with actor mapped.

- [ ] **Step 2: Run tests to verify failures**
  - Run: `node --test repos/erp-dominio-stub/test/jwt-verificacao.test.mjs`
  - Expected: FAIL

- [ ] **Step 3: Implement domain JWT verification and Keycloak realm updates**
  - In `erp-dominio-stub`: implement JWKS client with cache and kid lookup using `node:crypto.createPublicKey` and `crypto.verify`.
  - In `realm-erp.json`: configure `audience-mapper` adding `erp-dominios` to `aud`, ensure `revokeRefreshToken: true` and `refreshTokenMaxReuse: 0`.
  - Synchronize `@erp/nucleo` 0.10.0 across all 4 apps and stub.

- [ ] **Step 4: Run tests to verify they pass**
  - Run: `node --test repos/erp-dominio-stub/test/*.test.mjs`
  - Expected: PASS

- [ ] **Step 5: Commit domain stub and Keycloak integration**
  - Commit: `feat(dominio-stub): RS256 JWKS verification for OIDC Keycloak tokens`

---

### Task 6: Full Verification & Orchestration Documentation

**Files:**
- Modify: `.agents/orchestrator/RETOMADA.md`
- Modify: `.agents/orchestrator/ATIVIDADES.md`
- Modify: `.agents/orchestrator/DEFERRED.md`
- Modify: `docs/CONFIGURACAO.md`

- [ ] **Step 1: Run full verification suite**
  - Run: `task test`
  - Run: `task typecheck`
  - Run: `task verificar:estatica`
  - Run: `task verificar:redis`
  - Expected: All tests passing, 0 regressions.

- [ ] **Step 2: Update orchestration records**
  - Update `docs/CONFIGURACAO.md` with active D2 configuration variables.
  - Update `.agents/orchestrator/DEFERRED.md` closing D13 and D15.
  - Update `.agents/orchestrator/RETOMADA.md` and `.agents/orchestrator/ATIVIDADES.md` (#9 in progress, K6 complete).

- [ ] **Step 3: Commit documentation updates**
  - Commit: `docs(orchestrator): update RETOMADA and ATIVIDADES for D2 and K6`
