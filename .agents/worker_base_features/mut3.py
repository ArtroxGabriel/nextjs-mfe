import subprocess, re, sys, os, json
T=sys.argv[1]
def run(d):
    p=subprocess.run(f"node --test --test-reporter=tap test/*.test.ts",shell=True,cwd=os.path.join(T,d),capture_output=True,text=True,timeout=300)
    m=lambda k: int((re.search(rf"^# {k} (\d+)",p.stdout,re.M) or [0,0])[1])
    return f"{m('pass')}/{m('fail')}"
def static():
    p=subprocess.run("node scripts/smoke-test.mjs --offline",shell=True,cwd=T,capture_output=True,text=True)
    f=re.findall(r"FAIL\S* \[(STATIC-\d+)\]",p.stdout)
    return "7/0" if not f else "fail:"+",".join(f)
SN='packages/shell-ui/src/SideNavigation.tsx'; HD='packages/shell-ui/src/Header.tsx'; SL='packages/shell-ui/src/ShellLayout.tsx'
TC='packages/shell-ui/src/ToastContainer.tsx'; ZP='apps/remote-app/pages/index.tsx'; MW='apps/host/middleware.ts'
ZP='apps/remote-app/pages/index.tsx'; ZE='apps/remote-app/lib/events.ts'; HE='apps/host/lib/events.ts'
DQ='apps/remote-app/lib/dashboardQuery.ts'; SM='apps/remote-app/lib/sessionMirror.ts'; DT='apps/remote-app/components/DashboardTabs.tsx'
RM='apps/remote-app/components/RemoteMap.tsx'; RD='apps/remote-app/components/RemoteDashboard.tsx'; CP='apps/remote-app/pages/mapa/[cidade].tsx'
SSE='apps/remote-app/lib/sseUrl.ts'
M=[
 ("V1 zone emitToast dispatches a literal",ZE,[("new CustomEvent(MFE_EVENTS.TOAST,","new CustomEvent('mfe:toasts',")]),
 ("V1b host emitToast dispatches a literal",HE,[("new CustomEvent(MFE_EVENTS.TOAST,","new CustomEvent('mfe:toasts',")]),
 ("V1c zone emitToast drops the type",ZE,[("    type,\n    timestamp","    type: 'info',\n    timestamp")]),
 ("SM1 write uses another key",SM,[("storage.setItem(SESSION_MIRROR_KEY,","storage.setItem('zone_session',")]),
 ("SM2 write does nothing",SM,[("    storage.setItem(SESSION_MIRROR_KEY, JSON.stringify(session));\n","")]),
 ("SM3 read accepts entries without userId",SM,[("return parsed && parsed.userId ? parsed : null;","return parsed ?? null;")]),
 ("SM4 read lets storage errors escape",SM,[("  } catch {\n    return null;\n  }","  } finally {\n  }")]),
 ("DQ1 tab not validated",DQ,[("tab: pick(query.tab, DASHBOARD_TABS, 'overview'),","tab: (typeof query.tab === 'string' ? query.tab : 'overview') as DashboardTab,")]),
 ("DQ2 city not validated",DQ,[("city: pick<string>(query.city, cityIds, '') || null,","city: typeof query.city === 'string' && query.city ? query.city : null,")]),
 ("DQ3 filter ignored",DQ,[("filter: pick(query.filter, TELEMETRY_FILTERS, 'all'),","filter: 'all' as TelemetryFilter,")]),
 ("DQ4 city link uses query instead of path",DQ,[("  if (target.tab === 'map' && target.city) {","  if (false) {")]),
 ("P1 page ignores the query",ZP,[("dashboard: parseDashboardQuery(context.query),","dashboard: parseDashboardQuery({}),")]),
 ("P2 dashboard not rendered",ZP,[("          <RemoteDashboard\n","          {null}\n          <RemoteDashboardX\n")]),
 ("P3 tab nav removed",ZP,[("          <DashboardTabs dashboard={dashboard} />\n","")]),
 ("T1 active tab not marked",DT,[("tab === dashboard.tab ? ' zone-tab-active' : ''","''")]),
 ("T2 filters not shown",DT,[("    {dashboard.tab === 'telemetry' && (","    {false && (")]),
 ("M1 map ignores the city",RM,[("SAMPLE_MARKERS.find((m) => m.id === selectedCity) ?? null","null")]),
 ("RD1 dashboard drops the city",RD,[("            selectedCity={queryParams?.city}\n","")]),
 ("C1 unknown city renders instead of 404",CP,[("  if (!dashboard.city) {\n    return { notFound: true };\n  }\n","")]),
 ("C2 path city ignored",CP,[("city: typeof cidade === 'string' ? cidade : undefined","city: 'london'")]),
 ("S1 SSE path without basePath",SSE,[("'/remote-app/api/sse-events'","'/api/sse-events'")]),
 ("U1 zone page stops passing onSessionChange",ZP,[("        onSessionChange={handleSessionChange}\n","")]),
 ("X-TL telemetry uses a literal URL (effect, D10)",'apps/remote-app/components/RemoteTelemetry.tsx',[("const sseUrl = SSE_EVENTS_PATH;","const sseUrl = '/api/sse-events';")]),
 ("P4 page stops calling writeMirroredSession",ZP,[("      writeMirroredSession(storage, nextSession);\n","")]),
]
rows=[]
for name,f,reps in M:
    p=os.path.join(T,f); orig=open(p).read(); s=orig
    for a,b in reps:
        if s.count(a)<1: rows.append((name,"PATTERN NOT FOUND: "+a[:40])); break
        s=s.replace(a,b,1)
    else:
        open(p,'w').write(s)
        try:
            r=(run('packages/shell-ui'),run('apps/remote-app'),run('apps/host'),static())
        finally:
            open(p,'w').write(orig)
        caught = any(x.split('/')[1]!='0' for x in r[:3]) or r[3]!='7/0'
        rows.append((name,f"shell {r[0]} | zone {r[1]} | host {r[2]} | static {r[3]} | {'CAUGHT' if caught else 'SURVIVED'}"))
    print(rows[-1][0],"=>",rows[-1][1],flush=True)
