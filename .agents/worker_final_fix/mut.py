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
M=[
 ("R1 guard restored",MW,[("export async function middleware(_request: NextRequest): Promise<NextResponse> {\n","export async function middleware(request: NextRequest): Promise<NextResponse> {\n  const pathname = request.nextUrl?.pathname || '';\n  const isZonePath = pathname === '/remote-app' || pathname.startsWith('/remote-app/') || pathname.startsWith('/remote-app-static/');\n  if (!isZonePath) { return NextResponse.next(); }\n")]),
 ("R1b guard with trailing-slash fix only",MW,[("export async function middleware(_request: NextRequest): Promise<NextResponse> {\n","export async function middleware(request: NextRequest): Promise<NextResponse> {\n  const pathname = request.nextUrl?.pathname || '';\n  if (!(pathname.startsWith('/remote-app'))) { return NextResponse.next(); }\n")]),
 ("D1 select loses onChange",HD,[("            onChange={handleUserSelect}\n","")]),
 ("D1b handler never calls onSessionChange",HD,[("    onSessionChange?.(selected);\n","")]),
 ("D2 button needs onToastPing (declared defect)",HD,[("{showToastButton && (","{showToastButton && onToastPing && (")]),
 ("D2b fallback disabled",HD,[("    } else {\n      emitToast(","    } else if (false) {\n      emitToast(")]),
 ("D2c toast event literal diverges in emitToast",'packages/shell-ui/src/events.ts',[("new CustomEvent(MFE_EVENTS.TOAST,","new CustomEvent('mfe:toasts',")]),
 ("D3 next/link-like anchor",SN,[("import React from 'react';","import React from 'react';\nimport ZoneAnchor from 'next/dist/client/link';"),("          <a\n            href=\"/remote-app\"","          <ZoneAnchor\n            href=\"/remote-app\""),("          </a>\n        </li>\n      </ul>","          </ZoneAnchor>\n        </li>\n      </ul>")]),
 ("D3c unused next/link import only",SN,[("import React from 'react';","import React from 'react';\nimport Link from 'next/link';")]),
 ("D4a href typo",SN,[('href="/remote-app"','href="/remote-ap"')]),
 ("D4b preventDefault on remote link",SN,[("onClick={() => onNavigate?.('Remote App Zone', '/remote-app')}","onClick={(e) => { e.preventDefault(); onNavigate?.('Remote App Zone', '/remote-app'); }}")]),
 ("D4d active class inverted",SN,[("${isRemoteActive ? 'nav-link-active' : ''}","${isRemoteActive ? '' : 'nav-link-active'}")]),
 ("D5a ToastContainer removed",SL,[("      <ToastContainer />\n","")]),
 ("D5b {false && ToastContainer}",SL,[("      <ToastContainer />\n","      {false && <ToastContainer />}\n")]),
 ("D6 children dropped",SL,[("          {children}\n","          {null}\n")]),
 ("D13 activeRoute not passed",SL,[("            activeRoute={activeRoute}\n","")]),
 ("D13b onSessionChange not passed",SL,[("        onSessionChange={onSessionChange}\n","")]),
 ("D14 app-header class only in comment",HD,[('<header className="app-header">','<header>{/* className="app-header" */}')]),
 ("D7b zone emits under its own copy",'apps/remote-app/lib/events.ts',[("import { MFE_EVENTS } from '@mfe/shell-ui';\n",""),("export { MFE_EVENTS };\n","export const MFE_EVENTS = { TOAST: 'mfe:toasts', SESSION_CHANGE: 'mfe:session-change', MAP_SELECT: 'mfe:map-select' } as const;\n")]),
 ("D7c host emits under its own equal copy",'apps/host/lib/events.ts',[("import { MFE_EVENTS } from '@mfe/shell-ui';\n",""),("export { MFE_EVENTS };\n","export const MFE_EVENTS = { TOAST: 'mfe:toast', SESSION_CHANGE: 'mfe:session-change', MAP_SELECT: 'mfe:map-select' } as const;\n")]),
 ("D10b ServerCard only in a comment",ZP,[('<ServerCard initialData={serverData} title="Remote Standalone SSR Card" session={session} />','{/* <ServerCard initialData={serverData} title="Remote Standalone SSR Card" session={session} /> */}')]),
 ("D12b host @import points at index.ts",'apps/host/styles/globals.css',[("shell-ui/src/shell-layout.css","shell-ui/src/index.ts")]),
 ("D12c remote extra broken @import",'apps/remote-app/styles/globals.css',[("@import","@import '../missing.css';\n@import")]),
 ("Z1 zone page without ShellLayout",ZP,[('<ShellLayout\n        currentSession={session}\n        onSessionChange={handleSessionChange}\n        activeRoute="/remote-app"\n      >','<>'),("</ShellLayout>","</>")]),
 ("Z2 zone marks shell home active",ZP,[('activeRoute="/remote-app"','activeRoute="/"')]),
 ("CSS rendered class unstyled",'packages/shell-ui/src/shell-layout.css',[(".toast-portal",".toast-portalx")]),
 ("ST1 federation token in packages/",TC,[("import React","// @module-federation leftover\nimport React")]),
 # expected survivors, declared (need effects / DOM)
 ("X-D9 zone stops reading localStorage",ZP,[("const raw = localStorage.getItem('host_user_session');","const raw = null as string | null;")]),
 ("X-D9b zone stops writing localStorage",ZP,[("      localStorage.setItem('host_user_session', JSON.stringify(nextSession));\n","")]),
 ("X-D11 banner shows DEFAULT_SESSION",ZP,[("<strong>{session.userName}</strong>","<strong>{DEFAULT_SESSION.userName}</strong>")]),
 ("X-TC listener on a literal name",TC,[("window.addEventListener(MFE_EVENTS.TOAST, handleToastEvent);","window.addEventListener('mfe:toasts', handleToastEvent);")]),
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
