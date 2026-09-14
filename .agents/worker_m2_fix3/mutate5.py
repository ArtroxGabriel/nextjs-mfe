import sys, pathlib
root = pathlib.Path(sys.argv[1]); n = sys.argv[2]
def sub(path, old, new):
    p = root / path; s = p.read_text()
    assert old in s, (n, path, old); p.write_text(s.replace(old, new, 1))
if n == '1':  # drop a matcher entry
    sub('middleware.ts', "matcher: ['/remote-app', '/remote-app/:path*', '/remote-app-static/:path*']", "matcher: ['/remote-app', '/remote-app/:path*']")
elif n == '2':  # invert healthy/unhealthy branch
    sub('middleware.ts', "if (isZoneHealthy) {", "if (!isZoneHealthy) {")
elif n == '3':  # effectively infinite production TTL
    sub('lib/zoneLiveness.ts', "ttlMs: ZONE_LIVENESS_TTL_MS,", "ttlMs: Number.MAX_SAFE_INTEGER,")
elif n == '4':  # revert to bare 500 without headers (the original F1 defect)
    p = root / 'middleware.ts'; s = p.read_text()
    i = s.index("  return new NextResponse(renderZoneErrorHtml(), {")
    j = s.index("});", i) + 3
    p.write_text(s[:i] + "  return new NextResponse('Internal Server Error', { status: 500 });" + s[j:])
elif n == '5':  # page copy diverges from the middleware fallback
    sub('pages/erro-de-zona.tsx', "<h2>{ZONE_ERROR_HEADING}</h2>", "<h2>Serviço fora do ar</h2>")
elif n == 'M15':  # page fetches at module load
    sub('pages/erro-de-zona.tsx', "const ErroDeZonaPage: NextPage = () => {", "fetch('http://localhost:3001/remote-app/api/x').catch(() => {});\nconst ErroDeZonaPage: NextPage = () => {")
elif n == 'M6':  # page fetches in an effect (declared residue)
    sub('pages/erro-de-zona.tsx', "import React, { useState } from 'react';", "import React, { useState, useEffect } from 'react';")
    sub('pages/erro-de-zona.tsx', "  const [session] = useState<UserSession>(DEFAULT_SESSION);", "  const [session] = useState<UserSession>(DEFAULT_SESSION);\n  useEffect(() => { fetch('http://localhost:3001/remote-app/api/domain'); }, []);")
elif n == 'A20':  # probe timeout 60 s
    sub('lib/zoneLiveness.ts', "export const ZONE_PROBE_TIMEOUT_MS = 800;", "export const ZONE_PROBE_TIMEOUT_MS = 60000;")
elif n == 'A17':  # swapped env precedence in the probe
    sub('lib/zoneLiveness.ts', "process.env.REMOTE_ZONE_URL || process.env.REMOTE_APP_URL ||", "process.env.REMOTE_APP_URL || process.env.REMOTE_ZONE_URL ||")
elif n == 'A32':  # emptied shared copy
    sub('lib/zoneErrorContent.ts', "export const ZONE_ERROR_RETRY_HINT = 'Tente novamente em alguns instantes.';", "export const ZONE_ERROR_RETRY_HINT = '';")
elif n == 'TTL3000':
    sub('lib/zoneLiveness.ts', "export const ZONE_LIVENESS_TTL_MS = 1000;", "export const ZONE_LIVENESS_TTL_MS = 3000;")
