APPROVE

# challenger_m2_6: M2 gate, iteration 5 (HEAD fb4c3dd, code 94ccdc2)

A1 is closed. I sent 248 request variants against an oracle stub on :3001. Its health route returns 503, and every
other route logs the request and answers a `ZONE-REACHED` marker. **0/248 reached the zone.** When the stub is
healthy, 73 of the same variants do reach it. With the stub's health failing, all 73 got the middleware's 503 with
text/html and `Retry-After: 5`. Against the real zone, killed more than 1.5 s earlier, all 248 variants returned
status, content-type and `Retry-After` identical to the oracle run. No zone variant returned 500. Under 20 concurrent
clients for 20 s during the outage there were 0 500s in 9540 requests. There are no regressions: smoke `--strict`
passed 16/16 from the repo root and the host unit tests passed 33/33. Every §5.1 sentence I re-measured held.
Two figures fall slightly outside their stated measured ranges. They are listed in §2 and do not block.

Environment: Linux, 16 cores, Node v24.7.0, Next 15.5.24, `next start` for both apps. I used only processes I
started, each in its own process group (`pm.mjs`, `detached: true`, `process.kill(-pgid)`).
**Confounder:** Brave (≈260 % CPU across processes), Xorg and gnome-shell were running. Load average went from 3.9 to
7.4 during the runs (`env.log`, `window.env`, `sustained-case-outage.log`, `steady-outage-c30.log`). Absolute latencies
are inflated by that load.
Evidence: `/home/wilson-castro/Documents/projects/mira/nextjs-mfe/.agents/challenger_m2_6/`.

---

## 1. Adversarial findings (binary, blocking)

**None.**

### A1 re-test: PASS (0 bypasses in 248 variants × 4 conditions)

The oracle is `oracle-stub.mjs`. The runner is `variants.mjs`: raw TCP, with the request target sent byte-for-byte
and a unique `x-chal-id` header on each request. After every request the runner reads the stub's event log, and a
proxied request carries the id, so each forwarded request is tied to its variant. The runs were, in order:
1. Stub in sick mode (health 503), host up for 1.5 s: `variants-oracle-sick.jsonl`
2. Stub in healthy mode: `variants-oracle-healthy.jsonl`
3. Real zone up: `variants-zone-up.jsonl`
4. Real zone killed with SIGKILL, then 1.5 s wait: `variants-zone-down.jsonl`

Summary (`oracle-diff.log`, `real-zone-compare.log`):
```
variants 248  reached zone when healthy 73  reached zone when sick (bypass) 0
of healthy-reaching, statuses when sick: {'503 text/html; charset=utf-8 ra=5': 73}
zone-down identical (status,ct,ra) to sick-oracle run: 248 / 248
zone-down 500s: [(181, '*', 'text/plain', 'Internal Server Error')]   <- not a zone prefix, see O1
```

Variant families and results, identical with the stub sick and with the real zone down:

| Family | Examples | Zone up | Zone down |
|---|---|---|---|
| Case of the prefix: 8 spellings of `remote-app` × 6 subpaths, 7 of `remote-app-static` × 4 | `/REMOTE-APP`, `/Remote-App/api/health`, `/remotE-app/_fragmento/demo/42`, `/remote-APP/api/server-data`, `/REMOTE-APP-STATIC/_next/static/css/…css`, `/remote-app-STATIC/…`, `/remote-App-static/…` | 404 text/html (shell) | 404 text/html (shell), never reaches zone |
| Same, trailing slash | `/REMOTE-APP/`, `/Remote-App-Static/` | 308 → slashless | 308 → slashless (then 404) |
| Percent-encoded letters, **decoding to upper case** | `/%52EMOTE-APP`, `/%52emote-app/api/health`, `/%52EMOTE-%41PP`, `/REMOTE%2DAPP`, `/%52%45%4D%4F%54%45%2D%41%50%50`, `/r%45mote-app`, `/remote-%41pp`, `/remote-app-%53tatic/…css`, `/%52EMOTE-APP-STATIC/…css` | 404 text/html | 404 text/html |
| Percent-encoded letters, **decoding to lower case** | `/%72emote-app`, `/remote%2dapp`, `/%72%65%6d…%70`, `/remote-app%2dstatic/…css`, `/remote-app-%73tatic/…css` | 404 text/html | **503** text/html, Retry-After 5 (O3) |
| Double encoding, overlong UTF-8, long-s `ſ`, fullwidth `Ｒ` | `/%2572emote-app`, `/%c1%b2emote-app`, `/remote-app-%C5%BFtatic/…`, `/%EF%BC%B2EMOTE-APP` | 404 | 404 |
| Case/encoding in the subpath (prefix lower case) | `/remote-app/API/HEALTH`, `/remote-app/%41PI/health`, `/remote-app-static/_NEXT/static/css/…` | proxied (404 / 200 css) | 503 |
| Double slashes, backslashes | `//remote-app`, `///remote-app/api/health`, `//REMOTE-APP`, `/remote-app//api//health`, `/remote-app\api\health`, `/\remote-app` | 308 to the normalised path | 308 |
| Dot segments | `/remote-app/./api/health`, `/remote-app/x/../api/health`, `/remote-app/%2e%2e/remote-app`, `/remote-app/../REMOTE-APP` | proxied | 503 (O4) |
| Dot segments before the prefix | `/x/../remote-app`, `/X/../REMOTE-APP`, `/./remote-app`, `/%2e/remote-app`, `/REMOTE-APP/../remote-app` | 404 | 404 |
| Encoded slash | `/remote-app%2fapi/health`, `/%2FREMOTE-APP` | 404 | 503 / 404 |
| Suffixes and separators | `/remote-app.json`, `.rsc`, `;x`, `%3bx`, `%00`, `%20`, `%09`, `%5c`, `#frag`, `?x=1`, `?__nextDataReq=1`, `?_rsc=1` | 404 or proxied | 503 or 404 |
| `/_next/data` | `/_next/data/<hostBuild>/remote-app.json` (proxied as `/remote-app`), `…/remote-app/api/health.json`, `/_next/data/x/remote-app.json`, `/_next/data/<hostBuild>/REMOTE-APP.json`, `/_next/data/x/Remote-App.json`, `/remote-app/_next/data/<zoneBuild>/index.json`, `/REMOTE-APP/_next/data/<zoneBuild>/index.json` | 200 / 404 json / 404 | 503 (lower case) / 404 json (upper case) / 404 |
| Request-target forms | absolute-form `http://localhost:3000/REMOTE-APP`, `http://localhost:3001/remote-app`; origin-less `remote-app`, `\remote-app`; `*` | 308 / 400 / 500 text/plain (O1) | same |
| Header tricks | `x-middleware-subrequest` (3 payloads incl. `middleware:`×5), `x-nextjs-data`, `rsc`, `next-router-prefetch`, `x-middleware-prefetch`, `purpose: prefetch`, `x-matched-path`, `x-invoke-path`, `x-now-route-matches`, `x-forwarded-host`, `Host: localhost:3001` | 200 proxied | 503 on all 27 |
| Methods | HEAD/POST/PUT/DELETE/PATCH/OPTIONS on `/remote-app`, `/REMOTE-APP`, `/remote-app/api/server-data`, `/Remote-App/api/server-data`, `/%52EMOTE-APP/api/server-data`, static CSS | lower case: 200/405/400; case variants: 404 | lower case: 503; case variants: 404 |
| Controls | `/`, `/erro-de-zona`, `/Erro-De-Zona` | 200, 200, 404 | 200, 200, 404 |

Sustained load during the outage (`sustained-case.mjs 20000 20`, `sustained-case-outage.log`): 14 targets, 10 of them
case or encoding variants, 20 workers for 20 s, 9540 requests, **any500=0**. Every case variant got
404 text/html; `/_next/data/x/Remote-App.json` got 404 application/json; the lower-case controls got
503 text/html with Retry-After 5.

The built host confirms the fix: `apps/host/.next/routes-manifest.json` has `caseSensitive: true`. The rewrite regexes
(`^/remote-app(?:/…)?(?:/)?$`) have no `i` flag.

---

## 2. Declared vs. observed divergences (`docs/design-bff/mfe/01-operacao.md` §5.1)

| # | Sentence | Observed | Verdict |
|---|---|---|---|
| — | "As rotas do shell diferenciam maiúsculas… Hoje ela recebe o 404 do shell." | `/REMOTE-APP` → 404 text/html, and the oracle confirms the zone never saw it. Variants with a trailing slash get 308 first, then 404. Under `/_next/data` the 404 is `application/json` | Matches |
| D-1 | "o primeiro 503 chegou entre 871 e 940 ms num cliente sequencial (11 quedas…)" | 5 new sequential SIGKILL runs: first 503 **received** at 949.9, 902.2, 919.4, 918.9 and 910.8 ms. Run 1 is 9.9 ms above the stated upper bound | Minor. The sentence reports a measured range, and the new sample widens it to 871–950 ms over 16 kills. Optional doc edit |
| D-2 | "…depois de 79 a 190 requisições" (same sentence, about the sequential client) | Sequential: 93, 101, 117, 118, 136, which is inside the range. With 30 workers: 181, 206, 179 requests before the first 503 was received. The previous challenger's own data (`challenger_m2_5` §3.3) has sequential 79–143 and concurrent 128–213. So "79 a 190" matches neither series; it looks like a merge of both | Minor wording issue: the sequential range is 79–143, the concurrent one 128–213 |
| — | "Com 30 clientes concorrentes a fronteira, medida pelo envio, ficou entre 826 e 1010 ms." | Last bare 500 **sent** at 852.4, 891.0 and 842.7 ms; last one received at 958.7, 990.4 and 958.9 ms; first 503 received at 1017, 1050.5 and 1038.2 ms | Matches (3 runs) |
| — | Hung zone: "espera o timeout do proxy do Next, observado em 30 s… 800 ms (815 a 817 ms medidos), e recebe 503" | 1 SIGSTOP run: the stale-window request got **500, no content-type, after 30019 ms**; the next request got 503 after 817 ms (`hang-single.jsonl`) | Matches (n=1) |
| — | "Uma zona que já está fora quando o shell sobe… recebe 503 na primeira requisição" | 3/3 got 503 text/html, Retry-After 5 and the shell page on the first request, sent as soon as :3000 accepted connections (latency 1220.7, 955.1 and 1027 ms, which is host startup). The second request also got 503 (`cold-cache.jsonl`) | Matches |
| — | "no máximo uma vez por segundo por processo do shell: 30 clientes durante 6 s geraram 7 sondas" | 30 workers for 6 s, 1222 requests, **6** probes, gaps 1004–1012 ms (`probe-count-c30.jsonl`) | Matches the bound (6 against 7 depends on phase) |
| — | "de 3 a 6 ms a mais" | Not re-measured (see the last section) | — |

Recovery: §5.1 gives no number. The task expected about 1 s. In 3 runs (`recovery.jsonl`) the host's first 200 was
sent 990, 1019 and 1017 ms after the zone was spawned, and received 103–152 ms after the zone's own direct health
check first returned 200. During recovery the host answered 503 ×26/29/29, then 200, then 20/20 × 200. **No 500s.**
This fits "1 s TTL plus zone boot".

---

## 3. Measurements, one per condition

### 3.1 Build (condition 1)
`npx next build` in `apps/remote-app` and `apps/host`: both exited 0 (`build-remote.log`, `build-host.log`). The host
build lists `ƒ Middleware 35.3 kB` and `○ /erro-de-zona`. No tracked-file diff before or after (`git-status-before.log`,
`git-status-after.log`, `git diff --stat` empty).

### 3.2 A1 closed (condition 2): PASS
See §1. Four conditions × 248 raw variants, plus 9540 requests under sustained concurrent load while the zone was down.

### 3.3 No regression from the flag (condition 3): PASS
`regress.mjs` (`regress.log`), zone up:
```
/                                   200 text/html
/erro-de-zona                       200 text/html, shell outage copy present
/remote-app (via host)              200 text/html 3317 B (direct zone varies 3316/3317 B between calls: dynamic SSR)
/remote-app/nao/existe              404 text/html (zone 404, zone asset prefix present)
/remote-app/api/health              200 application/json {"ok":true}
/remote-app/_fragmento/demo/42      200 text/html 72 B, hasScript=false: <div class="fragment fragment--demo"><p>Demo fragment (id: 42)</p></div>
/remote-app/_fragmento/unknown/1    204, no content-type, 0 B
/remote-app/api/server-data         200 application/json
static assets: 10 zone refs -> 200 (1 css, 9 js), bytes equal to direct :3001; 10 shell refs -> 200
SSE /remote-app/api/sse-events via host: 200 text/event-stream, headers at 16 ms,
    events at 16 ms (connected), 1516 ms, 3016 ms  -> streamed, not buffered
```
- `node scripts/smoke-test.mjs --strict` from the repo root: exit 0, `Total tests: 16 Passed: 16 Failed: 0` (`smoke-strict.log`).
- `node --test test/*.test.ts` in `apps/host`: tests 33, pass 33, fail 0 (`host-unit-tests.log`). This confirms the worker's 33/33.

### 3.4 Cheap §5.1 re-checks (condition 4)

**Steady outage, 30 concurrent workers** (`steady.mjs 12000 30`, `steady-outage-c30.log`), started 1.5 s after the kill,
12 s, 3862 requests, 12 targets. Every zone target got 322 × `503 text/html; charset=utf-8, retry-after=5,
cache-control=no-store` with the shell page: `/remote-app`, `/remote-app/`, api/health, not-found path, fragment,
SSE, static CSS, missing chunk, HEAD, POST. `/` got 321 × 200 and `/erro-de-zona` got 321 × 200.
**bare/any 500 count: 0.** Latency over all paths: p50 86.1, p95 157.6, p99 196.1, max 348.0 ms (load average 7.4).

**Crash window** (`window.mjs`: kill 0.15–0.66 ms after a warm request that paid a probe):

| Series | Runs | last 500 sent (ms) | first 503 received (ms) | requests before first 503 | non-503 after first 503 |
|---|---|---|---|---|---|
| SIGKILL, sequential (`window-sigkill-seq.jsonl`) | 5 | 927.2, 880.2, 900.2, 903.4, 896.0 | 949.9, 902.2, 919.4, 918.9, 910.8 | 93, 101, 117, 118, 136 (all bare 500, ct=null) | 0 |
| SIGKILL, 30 workers (`window-sigkill-c30.jsonl`) | 3 | 852.4, 891.0, 842.7 | 1017.0, 1050.5, 1038.2 | 181, 206 (+12 × 503 sent earlier but received later), 179 | 0 |

Request latency in the concurrent runs: p50 122.8, 100.0 and 136.4 ms. The window stays at about 0.9 s by send time.

**Cold cache**: 3/3 got 503 on the first request (see §2). **Recovery**: 3/3 (see §2).

### What this unblocks or blocks
It unblocks the M2 gate on A1. Nothing measured here blocks it.

---

## Observations outside the gate (not findings, not blocking)

- **O1: `GET *` (asterisk-form request target) → 500 `text/plain` "Internal Server Error"**, whether the zone is up or
  down. The host log shows `TypeError: Invalid URL … input: 'http://localhost:3000*'` with a stack trace; the
  response carries none. It is not a zone prefix and browsers cannot send it. I did not check whether it predates
  94ccdc2, because that would need a rebuild without the flag.
- **O2: absolute-form target** `GET http://evil.example/remote-app` → `308 Location: http:/evil.example/remote-app`
  (`absolute-form.log`). WHATWG resolution against the request URL gives
  `http://localhost:3000/evil.example/remote-app`, same origin, so this is not an open redirect in a browser. Browsers
  do not send absolute-form to origin servers. Not tested behind a forward or reverse proxy.
- **O3: the reverse mismatch.** 21 variants match the middleware matcher but not the rewrite: lower-case
  percent-encoding, `%2f`, `.json`/`.rsc` suffixes, and `/_next/data/<non-host-build>/remote-app.json`. With the zone up
  they get the shell's 404; during an outage they get the 503 "zona indisponível" page. That is over-blocking and never
  reaches the zone.
- **O4: the path is normalised between the middleware and the proxy.** `/remote-app/../REMOTE-APP` passes the
  middleware (raw lower-case prefix), but the zone receives `GET /REMOTE-APP`, outside its basePath, and returns 404.
  `/remote-app/%2e%2e/remote-app` reaches the zone as `/remote-app`. The middleware still ran every time (sick oracle:
  503), so this is not a bypass. It does mean the path the middleware matched can differ from the path the zone
  receives. That matters if the middleware later makes decisions based on the path (authorisation, routing).

---

## What I could not run, or ran only partly

- **Probe overhead "3 a 6 ms"** was not re-measured. The machine was loaded by Brave (load average 3.9–7.4), and the
  previous challenger showed the figure depends on the environment. A paired series under this load would not add
  information.
- **Hung zone**: 1 SIGSTOP run only (n=1). The claim matched, but one run describes no distribution.
- **Crash window depth**: 8 kills (5 sequential, 3 concurrent). That confirms the range, not the tail. SIGTERM was
  not repeated.
- **Variant coverage is finite.** I tried 248 hand-picked targets. Not tried: HTTP/2 (`next start` serves HTTP/1.1
  only here), request smuggling or pipelining, Unicode normalisation forms other than `ſ` and fullwidth `Ｒ`, and
  variants behind a real reverse proxy that re-encodes paths. "0 bypasses in 248" is the result. It is not a proof
  that no bypass exists.
- **O1 pre-existence**: not checked (would require rebuilding without `caseSensitiveRoutes`).
- **SSE during a kill**: only streaming through the rewrite while healthy (3 events) and 503 in a steady outage were
  observed. An open stream at the moment the zone dies was not observed (D1 deferred).

## Housekeeping
- Ports 3000/3001 were free before building. Everything I started was stopped by process group: host pgids 29372
  and 31636/31656 (SIGKILL in `cold.mjs`), final host 31672 (SIGTERM); zone generations (SIGKILL); stubs 29354,
  30034 and 32856 (SIGTERM). Afterwards: `ports 3000/3001 free`, `no next/stub processes` (`ports-after.log`).
- No tracked file changed (`git diff --stat` empty). `.agents/reviewer_m2_6/` appeared during my run; another agent
  wrote it, not me. `apps/host/tsconfig.tsbuildinfo` was already untracked before I started (D5).
- By mistake I once ran `node -e "import('./variants.mjs')"` as a syntax check. It executed against the closed :3000
  (connection refused, output discarded) before any server was up. Nothing was affected.
