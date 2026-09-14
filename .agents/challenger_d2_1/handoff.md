# Challenger Verification Report — Defect D2 (@mfe/shell-ui Shared Chrome)

## 1. Observation

### Observation 1: TypeScript Compilation Failure in `apps/host`
Command executed: `node apps/host/node_modules/typescript/bin/tsc --project apps/host/tsconfig.json --noEmit`
Result: Exited with code 1; 16 errors across 4 files:
```text
apps/host/pages/index.tsx:53:51 - error TS2322: Type '(nextSession: UserSession) => void' is not assignable to type '(session: UserSession) => void'.
  Types of parameters 'nextSession' and 'session' are incompatible.
    Property 'tenant' is missing in type 'import("/home/gabrigas/Selene/Adventure/nextjs-mfe/packages/shell-ui/src/types").UserSession' but required in type 'import("/home/gabrigas/Selene/Adventure/nextjs-mfe/apps/host/lib/session").UserSession'.

53       <HostLayout currentSession={currentSession} onSessionChange={handleSessionChange} activeRoute="/">
                                                     ~~~~~~~~~~~~~~~

packages/shell-ui/src/Header.tsx:1:19 - error TS2307: Cannot find module 'react' or its corresponding type declarations.
1 import React from 'react';
                    ~~~~~~~
packages/shell-ui/src/Header.tsx:16:3 - error TS7031: Binding element 'onSessionChange' implicitly has an 'any' type.
packages/shell-ui/src/Header.tsx:17:3 - error TS7031: Binding element 'onToastPing' implicitly has an 'any' type.
packages/shell-ui/src/ShellLayout.tsx:1:19 - error TS2307: Cannot find module 'react' or its corresponding type declarations.
packages/shell-ui/src/ShellLayout.tsx:20:3 - error TS7031: Binding element 'children' implicitly has an 'any' type.
[... 8 more TS7031 binding element errors in ShellLayout.tsx ...]
packages/shell-ui/src/SideNavigation.tsx:1:19 - error TS2307: Cannot find module 'react' or its corresponding type declarations.
packages/shell-ui/src/SideNavigation.tsx:10:3 - error TS7031: Binding element 'onNavigate' implicitly has an 'any' type.
```

### Observation 2: TypeScript Compilation Failure in `apps/remote-app`
Command executed: `node apps/host/node_modules/typescript/bin/tsc --project apps/remote-app/tsconfig.json --noEmit`
Result: Exited with code 1; 15 errors across 3 files:
- All 15 `TS2307` (`Cannot find module 'react'`) and `TS7031` (`implicitly has an 'any' type`) errors in `packages/shell-ui/src/Header.tsx`, `ShellLayout.tsx`, and `SideNavigation.tsx`.

### Observation 3: Exact Optional Property Types (`exactOptionalPropertyTypes`) Violation in `apps/remote-app`
When simulating React module resolution, `apps/remote-app` (`apps/remote-app/tsconfig.json` has `"exactOptionalPropertyTypes": true`) produces:
```text
packages/shell-ui/src/ShellLayout.tsx: Type '{ currentSession: UserSession | undefined; onSessionChange: ((session: UserSession) => void) | undefined; onToastPing: (() => void) | undefined; brandTitle: string | undefined; brandSubtitle: string | undefined; systemPillText: string | undefined; showToastButton: boolean | undefined; }' is not assignable to type 'HeaderProps' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
  Types of property 'currentSession' are incompatible.
    Type 'UserSession | undefined' is not assignable to type 'UserSession'.
      Type 'undefined' is not assignable to type 'UserSession'.
packages/shell-ui/src/ShellLayout.tsx: Type '{ activeRoute: string; onNavigate: ((label: string, destination: string) => void) | undefined; }' is not assignable to type 'SideNavigationProps' with 'exactOptionalPropertyTypes: true'.
  Types of property 'onNavigate' are incompatible.
    Type '((label: string, destination: string) => void) | undefined' is not assignable to type '(label: string, destination: string) => void'.
```

### Observation 4: Node Runtime Module Resolution Failure for `@mfe/shell-ui`
Command: `node -e "require.resolve('@mfe/shell-ui')"` in `apps/host` and `apps/remote-app`
Result:
```text
Resolve error: Cannot find module '@mfe/shell-ui'
Require stack:
- /home/gabrigas/Selene/Adventure/nextjs-mfe/apps/host/[eval]
```
`apps/host/package.json` and `apps/remote-app/package.json` do not declare `"@mfe/shell-ui": "workspace:*"`.

### Observation 5: Session Data Model & Mock Identity Disjointness
Inspecting `apps/host/lib/session.ts` vs `packages/shell-ui/src/types.ts`:
- Host `UserSession`:
  - `role: 'admin' | 'operator' | 'viewer'`
  - `readonly tenant: string`
  - Mock IDs: `['usr_admin_01', 'usr_operator_02', 'usr_viewer_03']`
- Shell-ui `UserSession`:
  - `role: string`
  - `tenant`: absent
  - Mock IDs: `['usr_001', 'usr_002', 'usr_003']`
- Matching user IDs between Host and Shell-ui: `[]` (empty set).
- When host renders `Header`, `currentSession.userId` is `'usr_admin_01'`. The `<select>` element contains options for `usr_001`, `usr_002`, `usr_003`, resulting in no matching `<option>`.
- Selecting any option from the dropdown emits a session object with no `tenant`, corrupting `localStorage` upon save.

### Observation 6: Isolated Local State in `apps/remote-app/pages/index.tsx`
`apps/remote-app/pages/index.tsx` lines 14-27:
```tsx
const [session, setSession] = useState<UserSession>(DEFAULT_SESSION);
```
`localStorage` is never queried or written. Cross-zone navigation resets the session back to default.

### Observation 7: CSS Duplication and Global Styles Drift
- `packages/shell-ui/src/shell-layout.css` was extracted (251 lines).
- `apps/remote-app/styles/globals.css` imports it via relative `@import '../../packages/shell-ui/src/shell-layout.css';`.
- `apps/host/styles/globals.css` does NOT import `shell-layout.css` and still contains 220+ lines of duplicated layout CSS.

### Observation 8: Standalone Port 3001 Navigation Returns 404
In `SideNavigation.tsx`, "Shell Home" links to `<a href="/">`. When `apps/remote-app` runs standalone on `:3001` with `basePath: '/remote-app'`, navigating to `/` returns HTTP 404.

---

## 2. Logic Chain

1. **Static Analysis & Buildability**:
   - `packages/shell-ui` was created as an isolated package without its own `node_modules` or `tsconfig.json`.
   - In a pnpm monorepo with workspace isolation, `@types/react` is hoisted inside `apps/host/node_modules` and `apps/remote-app/node_modules`, not at the workspace root (Observation 1, 2).
   - TypeScript resolves dependencies from the directory of the file being compiled up to the filesystem root. Because `packages/shell-ui` is outside `apps/host`, TypeScript never inspects `apps/host/node_modules/@types`, causing `Cannot find module 'react'` (TS2307).
   - Because `React` is missing, `React.FC` resolves to `any`, cascading into TS7031 ("Binding element implicitly has an 'any' type") for all props.
   - Furthermore, `exactOptionalPropertyTypes: true` in `apps/remote-app/tsconfig.json` forbids passing `undefined` to optional properties unless explicitly typed with `| undefined` (Observation 3).

2. **Data & Multi-Tenancy Invariants**:
   - Multi-Zones host architecture (Milestones 1 & 2) established tenant isolation (`tenant: string`) and role enforcement (`'admin' | 'operator' | 'viewer'`).
   - `packages/shell-ui/src/types.ts` relaxed `role` to `string` and omitted `tenant` completely (Observation 5).
   - This violates TypeScript assignment contravariance in `apps/host/pages/index.tsx` (TS2322) and leads to runtime data degradation if a user changes session in the host UI.
   - The disjoint mock user sets (`usr_admin_01` vs `usr_001`) break controlled `<select>` binding in `Header.tsx`.

3. **Packaging & Monorepo Integrity**:
   - `pnpm-workspace.yaml` was updated with `packages/*`, but neither `apps/host/package.json` nor `apps/remote-app/package.json` added `@mfe/shell-ui` as a workspace dependency (Observation 4).
   - Standard Node resolution fails (`Cannot find module '@mfe/shell-ui'`). While Next.js `transpilePackages` can intercept bundle imports if aliased via `tsconfig.json`, external scripts, tests, or server runtimes lacking webpack path aliases cannot resolve the package.

---

## 3. Caveats

- `rtk next build` was not run directly to completion due to terminal interactive permission timeout in the subagent session. However, TypeScript compilation via the project's TypeScript compiler (`apps/host/node_modules/typescript/bin/tsc`) was fully executed and verified.
- All existing 10 unit test files (`apps/host/test/*.test.ts` and `apps/remote-app/test/*.test.ts`) currently pass because none of them cover UI components or `packages/shell-ui`.
- Cross-zone session inheritance (Defect D3) remains tracked as deferred; the lack of localStorage synchronization in `remote-app` is noted as a behavioral flaw of the shared header, not a new regression.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES / GATE FAIL**
Overall Risk Assessment: **CRITICAL (Blocks compilation and violates type safety contracts)**.

The current implementation of `@mfe/shell-ui` cannot be merged or committed in its present state. The changes break `tsc --noEmit` across both applications (`apps/host` and `apps/remote-app`).

### Concrete Remediation Plan for the Worker:
1. **Align `packages/shell-ui/src/types.ts`**:
   - Make `UserSession` match `apps/host/lib/session.ts` exactly:
     ```ts
     export type UserRole = 'admin' | 'operator' | 'viewer';
     export interface UserSession {
       readonly userId: string;
       readonly userName: string;
       readonly email: string;
       readonly role: UserRole;
       readonly tenant: string;
     }
     ```
   - Update `PRESET_USERS` to match `usr_admin_01`, `usr_operator_02`, `usr_viewer_03` with their respective tenants.
2. **Support `exactOptionalPropertyTypes`**:
   - In `HeaderProps`, `SideNavigationProps`, and `ShellLayoutProps`, add `| undefined` to optional properties:
     `readonly currentSession?: UserSession | undefined;`, `readonly onNavigate?: ((label: string, destination: string) => void) | undefined;`, etc.
3. **Configure Path Mappings & Monorepo Dependencies**:
   - In `apps/host/tsconfig.json` and `apps/remote-app/tsconfig.json`:
     Add `"baseUrl": "."` and `"paths": { ..., "react": ["./node_modules/@types/react"], "react-dom": ["./node_modules/@types/react-dom"] }`.
   - Add `"@mfe/shell-ui": "workspace:*"` to `apps/host/package.json` and `apps/remote-app/package.json`.
   - Add `packages/shell-ui/tsconfig.json` with `"jsx": "preserve"`, `"moduleResolution": "bundler"`, `"strict": true`.
4. **Deduplicate Host CSS**:
   - Import `shell-layout.css` into `apps/host/styles/globals.css` and remove the duplicated `.layout-root` through `.app-header` CSS rules.
5. **Add Unit Tests for `@mfe/shell-ui`**:
   - Add unit tests validating `Header`, `SideNavigation`, `ShellLayout`, and `types.ts` exports to satisfy the 80% test coverage requirement.

---

## 5. Verification Method

To independently verify after remediation:
1. Run host typecheck:
   ```bash
   node apps/host/node_modules/typescript/bin/tsc --project apps/host/tsconfig.json --noEmit
   ```
   *Expected: 0 errors.*
2. Run remote-app typecheck:
   ```bash
   node apps/host/node_modules/typescript/bin/tsc --project apps/remote-app/tsconfig.json --noEmit
   ```
   *Expected: 0 errors.*
3. Run all existing tests:
   ```bash
   node --test apps/host/test/rewrites.test.ts apps/host/test/erro-de-zona-page.test.ts apps/host/test/middleware-config.test.ts apps/host/test/zone-error-page.test.ts apps/host/test/zone-liveness.test.ts
   node --test apps/remote-app/test/fragmento.test.ts apps/remote-app/test/health.test.ts apps/remote-app/test/next-config.test.ts
   ```
   *Expected: all 34 tests pass.*
4. Invalidation condition: Any error reported by `tsc --noEmit` on either app invalidates the fix.
