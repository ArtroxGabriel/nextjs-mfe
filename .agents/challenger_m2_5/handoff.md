REQUEST_CHANGES

# challenger_m2_5: M2 gate, iteration 4 (HEAD 59507e4)

Why: condition 2 ("never a bare 500" once the zone has been down > 1 s) fails. Any change of letter
case in the three prefixes still goes through the rewrite but skips the middleware. That gives a
bare 500 for as long as the outage lasts: 100/100 requests over about 20 s. Everything else the
worker claimed held up when I measured it. The bare-500 window after a crash, cold cache, recovery,
at most one probe per second, and no regressions all matched. The ≈3 ms overhead matched in size
but came out a bit higher.

Environment: Linux, 16 cores, Node v24.7.0, Next 15.5.24, `next start` on both apps. Only
processes I started myself, on localhost:3000 and :3001, each in its own process group
(`pm.mjs`, `detached: true`, killed with `process.kill(-pgid)`).
**Confounder:** OBS (≈100 % CPU) and Brave (≈140 % CPU across processes) were running the whole
time. Load average was 4.2–6.9 (`cpu-contention.log`, `overhead-zone-up.jsonl`). Absolute
latencies are about 2–4x the worker's numbers (for example, direct zone health p50 4.92 ms here
against 2.59 ms in `worker_m2_fix2/overhead.txt`).
Evidence: `.agents/challenger_m2_5/` (every `*.jsonl`/`*.log` file named below, plus the scripts
that produced them).

---

## 1. Adversarial findings (binary, blocking)

### A1: FAIL. A case variant of the prefix skips the middleware and gets a bare 500 for the whole outage

The rewrite matches regardless of case, but the middleware `matcher` only matches lowercase. With
the zone **up**, the uppercase paths are served normally through the zone (`case-variant-zone-up.log`):

```
HTTP/1.1 200 OK content-type: text/html; charset=utf-8        bytes=3317  <- /REMOTE-APP
HTTP/1.1 200 OK content-type: application/json; charset=utf-8 bytes=11 {"ok":true} <- /Remote-App/api/health
HTTP/1.1 200 OK content-type: text/css; charset=UTF-8         bytes=5284  <- /REMOTE-APP-STATIC/_next/static/css/7328242de7a8f19b.css
```

With the zone **down**, well past the TTL: one request every 200 ms per path for about 20 s
(`case-variant-outage.log`):

```
/REMOTE-APP :      25 500
/Remote-App/api/health :      25 500
/REMOTE-APP-STATIC/_next/static/css/7328242de7a8f19b.css :      25 500
/remote-APP/nao/existe :      25 500
-- full headers /Remote-App/api/health (zone down):
HTTP/1.1 500 Internal Server Error
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

Internal Server Error
-- control, lowercase same instant:
503 text/html; charset=utf-8
```

That is 100/100 bare 500s with no `Content-Type`. They are byte-for-byte the defect F1 was meant
to remove, and they are not limited in time. No `caseSensitive` setting exists in
`apps/host/next.config.js` or `middleware.ts`.
Other variants I tried with `--path-as-is`, 3 attempts each (`path-variants-outage.log`):
`/%72emote-app`, `/remote%2Dapp`, `/remote-app%2F`, `/%72emote-app-static/...css`,
`/remote-app/../remote-app`, `/remote-app?x=1`, `/_next/data/x/remote-app.json` and `/remote-app-static`
all got 503. `//remote-app`, `/remote-app/` and `/remote-app-static/` got 308. `/./remote-app`, `/remote-app;x` and
`/remote-app%00` got 404. **Only the case variants reached the rewrite without passing through the middleware.**
Beyond liveness: whatever logic this middleware gains later is skipped by the same request.

Possible fixes, for the worker to choose from: normalise case before matching, or make routing
case-sensitive. One way is a wider matcher plus a lowercase `pathname` check inside the middleware.
Whatever the fix, it needs a behavioural test with a mixed-case path.

No other adversarial check failed. The steady outage on lowercase paths is covered in §3.2.

---

## 2. Declared vs. observed divergences

| # | `01-operacao.md` §5.1 sentence | Observed | Doc to correct |
|---|---|---|---|
| D-a | "A terceira linha vale em regime, com uma exceção limitada… com a zona fora, responde 503 com `Retry-After` e a página de erro." | False for case variants of the prefixes: permanent bare 500 (A1). | §5.1 once A1 is fixed, or state the exception if it is not fixed |
| D-b | "A janela é limitada por tempo, e quantas requisições caem nela depende da taxa." | True for a **crashed** zone (connection refused): §3.3. For a **hung** zone (process alive, socket accepting; tested with SIGSTOP), a request sent during the stale-healthy window **waited 30.03, 30.03 and 30.06 s and then got a bare 500** (3/3, `hang-single.jsonl`). The next request paid the 800 ms probe timeout (815–817 ms, 3/3) and got 503. With 10 workers, 10/10 requests sent in the first second hung until my 4 s client timeout, and every later request got 503: n=226, p50 47 ms, max 871 ms (`hang-sigstop.jsonl`). The window's *length* is capped by the TTL, but what the user experiences in it is 30 s, not under 1 s. §5.1 measures only the crash case and does not say so. | §5.1: say the numbers are for a killed process and add the hung-zone case (30 s Next proxy timeout, plus ≈800 ms latency on each re-probe while hung) |
| D-c | "levaram o primeiro 503 a 871, 929 e 940 ms" | Matches for a **sequential** loop (8/8 runs received the first 503 at 900–939 ms). With **30 concurrent** workers the first 503 was *received* at 965–1098 ms (8/8 above 940 ms), because the requests themselves took p50 ≈150–170 ms under load. The TTL boundary, measured by send time, stayed at 826–1010 ms. | Optional: say the figures are for a sequential client |
| D-d | "a sonda soma cerca de 3 ms à requisição que a dispara (mediana medida)" | Paired median 3.5–5.8 ms across 4 series (n=80–100 each), on a machine loaded by OBS and Brave. Same size, slightly higher. Not a contradiction, but the figure depends on the environment. | None required; could say "3–6 ms on localhost" |
| D-e | Overhead paragraph only covers "com a zona no ar" | While the zone is down (crash), the request that triggers a re-probe pays a paired median of 4.37 ms (n=20). While hung, it pays ≈815 ms (see D-b). | §5.1 (gap in the doc) |

Confirmed and not contradicted: cold cache gets 503 on the first request; at most one probe per
second per process, also under concurrency; `/` stays 200 during the outage; recovery works.

---

## 3. Measurements, one per condition

### 3.1 Build (condition 1)
`npx next build` in `apps/remote-app` and `apps/host`: both exited 0 (`build-remote.log`, `build-host.log`).
Host has `ƒ Middleware 35.3 kB` and `○ /erro-de-zona`. `git status --short` was identical before and after the
builds (`git-status-before.log` / `git-status-after-build.log`).

### 3.2 Steady-state outage, 50 concurrent workers (condition 2): PASS for lowercase paths, FAIL overall because of A1
`node steady.mjs 12000 50` started 1.5 s after the zone died, ran 12 s, 2705 requests, 12 targets rotated (`steady-outage-c50.log`):
```
226 GET /remote-app                          -> 503 ct=text/html; charset=utf-8 retry-after=5 cc=no-store body=shell-outage-page
226 GET /remote-app/                         -> 503 (same headers, shell page)
226 GET /remote-app/api/health               -> 503 (same)
226 GET /remote-app/nao/existe/x             -> 503 (same)
226 GET /remote-app/_fragmento/demo/1        -> 503 (same)
225 GET /remote-app/api/sse-events           -> 503 (same)
225 GET /remote-app-static/.../7328242de7a8f19b.css -> 503 (same, HTML body for a CSS URL, the known caveat)
225 GET /remote-app-static/_next/static/chunks/nope.js -> 503 (same)
225 HEAD /remote-app                         -> 503 (same headers)
225 POST /remote-app/api/server-data         -> 503 (same)
225 GET /                                    -> 200 text/html
225 GET /erro-de-zona                        -> 200 text/html, shell outage page
bare/any 500 count: 0
latency all paths ms: p50=207.7 p95=392.8 p99=499.1 max=972.0
```
The run covered about 12 TTL expiries under concurrency, and no 500 appeared at an expiry.

### 3.3 Bare-500 window after a kill that immediately follows a healthy probe (condition 3)
`window.mjs`: idle 1.3 s, then a warm `GET /remote-app` that pays a probe (200), then a signal to the zone process group 0.15–0.93 ms
later, then polling until the first 503 and for 500 ms beyond it.

| Series | Runs | first 503 sent (ms after kill) | first 503 received | bare 500s before it | non-503 after first 503 |
|---|---|---|---|---|---|
| SIGKILL, sequential (`window-sigkill-seq.jsonl`) | 5 | 916.5, 909.2, 903.4, 897.8, 893.3 | 938.8, 918.1, 916.4, 909.4, 928.1 | 79, 95, 106, 103, 114 | 0 in every run |
| SIGTERM, sequential (`window-sigterm-seq.jsonl`) | 3 | 887.3, 896.5, 906.6 | 900.5, 907.1, 917.6 | 104, 143, 133 | 0 |
| SIGKILL, 30 workers (`window-sigkill-c30.jsonl`) | 3 | 855.0, 882.4, 863.5 | 1025.9, 1049.5, 964.7 | 178, 190, 213 | 0 |
| SIGKILL, 30 workers, rerun (`window-sigkill-c30-rerun.jsonl`) | 3 | 834.4, 825.9, 829.7 | 1062.6, 1094.8, 1037.7 | 135, 172, 128; last bare 500 **received** at 994.8, 995.6, 981.9 ms; request latency p50 167.7/151.8/151.8 ms | 0 |
| SIGKILL, 30 workers, static CSS path (`window-sigkill-c30-static.jsonl`) | 2 | 886.8, 1010.3 | 1098.3, 1065.2 | 199, 213 (last non-503 sent at 885.0, 936.2 ms) | 0 |

Every bare 500 sampled had `ct=null`, body `Internal Server Error`. Every first 503 had `text/html; charset=utf-8`, `Retry-After: 5`.
**Matches §5.1 for a sequential client** (8 runs, 900–939 ms against the claimed 871–940). Under concurrency, see D-c.
Under 1 s holds for the send-time boundary in 15/16 runs (the exception is 1010.3 ms). It holds for the last bare 500 *received*
in the 3 runs where I measured it (≤ 996 ms). For a hung zone it does not hold (D-b).

### 3.4 Cold cache (condition 4): PASS, 3/3
`cold.mjs`: host SIGKILLed and respawned with the zone dead. The first request was sent as soon as :3000 accepted connections (`cold-cache.jsonl`):
```
/remote-app              port open 671.7 ms after spawn, latency 986.2 ms -> 503 text/html; charset=utf-8 retry-after 5, shell page; 2nd: 503
/remote-app/api/health   port open 690.0 ms,             latency 965.1 ms -> 503 (same); 2nd: 503
/remote-app-static/...css port open 640.0 ms,            latency 981.8 ms -> 503 (same); 2nd: 503
```
The ≈970 ms latency matches the host's own `✓ Ready in 993ms` (`host-1789389830489.log`). It is host startup, not probe cost.

### 3.5 Recovery (condition 5): PASS, 3/3
`recovery.mjs` (host up, zone dead, cache holding "unhealthy"; zone respawned; polling the zone every 10 ms and the host every 25 ms), `recovery-rerun.jsonl`:

| run | zone port open | zone's first direct health 200 received | host first 200 received | host − zone | host statuses during recovery |
|---|---|---|---|---|---|
| 1 | 778 ms | 1650 ms | 1792 ms | +142 ms | 503×27, 200×1, **no 500** |
| 2 | 797 ms | 1651 ms | 1770 ms | +119 ms | 503×29, 200×1 |
| 3 | 798 ms | 1621 ms | 1739 ms | +118 ms | 503×28, 200×1 |

After that, 20/20 requests got 200 in every run. The request that re-probed was sent 988–1016 ms after spawn and waited for the zone to
finish booting (its probe returned in about 650–800 ms, close to the 800 ms probe timeout). Recovery happened within
about 120–140 ms of the zone being able to serve, well inside "1 s plus polling granularity".

### 3.6 Probe overhead with the zone up (condition 6)
First I checked by observation, not by reading the code, which requests trigger a probe. I put a counting stub on :3001
(`stub.mjs`, `classify.mjs`, `probe-classification.log`). With the worker's pattern (gap 1100 ms, request A then B
immediately), A had `probe=true` 5/5 and B had `probe=false` 5/5. With equal 600 ms spacing, the odd requests had
`probe=true` 5/5 and the even ones `probe=false` 5/5.
Under concurrency, 30 workers for 6 s gave 1086 requests but only **7 probes**, 1006–1011 ms apart
(`probe-count-concurrency.jsonl`). That confirms "no máximo uma vez por segundo por processo".

Real zone, `overhead-zone-up.jsonl`:
```
direct zone /remote-app            n=200 p50=11.00 p90=14.60 p99=27.58
direct zone /remote-app/api/health n=200 p50=4.92  p90=6.44  p99=13.44
worker-method /remote-app n=100: A(probe) p50=24.59 p90=29.99 | B(hit) p50=19.76 p90=23.28 | paired A−B p50=5.82 p90=10.48
equal-spacing /remote-app n=100+100: probe p50=23.98 p90=28.17 | hit p50=19.35 p90=22.85 | p50 diff=4.63
worker-method /remote-app/api/health n=100: A p50=17.65 | B p50=12.10 | paired A−B p50=5.28
worker-method-raw /remote-app n=80: A p50=22.37 | B p50=18.08 | paired A−B p50=3.50
  excluding i=0: A p50 22.2 p90 25.9 max 29.1 | B p50 18 p90 21.3 max 28.8
outage (zone down) n=20: A p50=12.84 | B p50=9.37 | paired A−B p50=4.37
```
Each series had one A outlier of 168–200 ms. The raw dump shows it at index 0 (`A>60ms at index: [[0,189.3]]`). It is a
client first-request artefact, not a probe tail; without it the probe request's maximum is 29.1 ms.
**Verdict on "≈3 ms":** same size, median 3.5–5.8 ms, under the CPU contention described above (D-d).
Run time: about 6 minutes.

### 3.7 No regression (condition 7): PASS
- `node scripts/smoke-test.mjs --strict` with both up: exit 0, 16/16, before the experiments (`smoke-strict-before.log`) and after (`smoke-strict-after.log`).
- `/` returned 200 in 225/225 requests during the 12 s outage. `/erro-de-zona` returned 200 with the shell page in 225/225 (§3.2).
- `node --test test/*.test.ts` in `apps/host`: exit 0, tests 29, pass 29, fail 0 (`host-unit-tests.log`).
- Zone-up baseline (`baseline.log`): `/` 200, `/remote-app` 200, health 200 JSON, CSS 200 `text/css`, `/erro-de-zona` 200.

### What this unblocks or blocks
It unblocks the TTL-1 s claim for crashed zones and the claims about cold cache, recovery and probe
deduplication. It blocks the gate on A1. D-b is not a gate condition, but §5.1 currently generalises a
crash-only measurement to every case of "zona inteira fora".

---

## What I could not run, or ran only partly

- **A realistic hung zone.** SIGSTOP stands in for a frozen process. A zone that is alive but slow, or that accepts
  and then stalls mid-response, was not tested. The 30 s figure is Next's proxy timeout as observed (3/3); I did
  not locate where it is configured.
- **Case variants beyond the ones listed.** I did not try Unicode case folding, or case variants combined with
  encoding (e.g. `/%52EMOTE-APP`).
- **SSE through the rewrite during a kill.** `/remote-app/api/sse-events` was only checked for 503 once the outage was
  already steady. An open stream at the moment of the kill was not observed (D1 is deferred anyway).
- **Overhead on a quiet machine.** OBS and Brave belong to the user; I did not stop them (they are outside my
  authority). The absolute latencies and the 3.5–5.8 ms overhead are measured under that contention and cannot be
  separated from it.
- **Statistical depth of the window.** 16 kill runs in total (8 sequential, 8 concurrent). Enough to confirm the
  bound, not to describe a tail.
- **Remote-app unit tests** (`health.test.ts`/`fragmento.test.ts`, reported as failing under `node --test`) were not
  run; outside this gate's conditions.

## Housekeeping
- Every server I started was stopped (host pgid 18637 and zone pgid 19874 with SIGTERM; earlier generations with SIGKILL, plus the stub).
  After cleanup: `ports 3000/3001 free`, `no next/stub processes`.
- There is no tracked-file diff (`git diff --stat` empty). The untracked `.agents/auditor_m2_4/` and
  `.agents/worker_m2_fix2/{overhead,window}.mjs` appeared during my run (mtimes 09:44 and 09:53) and were written by other agents, not me.
- One procedural slip: `pkill -f "node stub.mjs"` matched my own wrapper shell (exit 144). The pattern only matched
  that string, and afterwards `ps` showed no stub and only my two next-server processes. After that I killed the stub by its own PID.
