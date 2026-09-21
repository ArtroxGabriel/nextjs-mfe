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
