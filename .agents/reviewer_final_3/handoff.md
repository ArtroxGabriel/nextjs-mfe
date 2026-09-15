# reviewer_final_3 — final combined gate, iteration 3 (deb23f2), model sonnet

Saved by the orchestrator from the agent's final report (revisor-mfe has no write tool).

`APPROVE`

Scratch copy `scratchpad/reviewer_final_3`; control shell-ui 15/15, zone 17/17, host 46/46, static 7/7; every mutation
restored, diff against pristine clean. No builds, servers or ports.

1. **F1 CONFIRMED.** U2 (HostLayout drops onSessionChange) → `host-page.test.ts:57` fails (`expected [Function], actual
   undefined`); U5 (fragment instead of HostLayout) → `:47` fails (no `layout-root`); U3 (drops onToastPing/onNavigate) →
   third test fails (`typeof onNavigate` undefined); U4 (`activeRoute="/remote-app"`) → first test fails. D10 accurate: calling
   `RemoteHomePage` as a function throws "Invalid hook call"; function props do not survive HTML serialization; U1 reproduced
   green in all suites. Nit (non-blocking): "can be neither rendered into markup" — the component is rendered; the callback does
   not survive serialization.
2. **F2 CONFIRMED, no false-failure risk.** middleware never dereferences the request; `NextResponse.next()` takes no argument;
   `.endsWith('.ico')` guard → `middleware.test.ts:168` fails with `Error: middleware read request.nextUrl`.
3. **F3 CONFIRMED harmless.** Fragment around `<ul>` → shell 15/15; className without trailing space → shell 15/15, zone 17/17.
4. **F4 CONFIRMED.** `import type … from './../../../apps/remote-app/types'` → `shell-ui.test.ts:208` fails. Note: the check
   (`path.dirname(resolved) === sourceDir`) would also reject a future `./sub/foo` import; src is flat today.
5. **F5 CONFIRMED.** class only in a comment → `shell-ui.test.ts:223` fails (`.layout-root is rendered but not styled`).
6. **No new problems.** Minor: third host-page test calls `onNavigate` without asserting its effect (the `typeof` check already
   catches U3). `deb23f2` message accurate ("40 of 40" matches mutations2.txt: 40 caught, 5 D10 survivors, 2 harmless).
