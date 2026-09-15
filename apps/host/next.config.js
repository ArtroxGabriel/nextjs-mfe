/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mfe/shell-ui'],
  experimental: {
    // Rewrites match case-insensitively by default, but the middleware matcher
    // is case-sensitive. Without this, /REMOTE-APP reached the zone around
    // middleware.ts and a down zone answered it with a bare 500.
    // Experimental in Next 15: Next only warns on an unknown experimental key,
    // so re-check it on every Next upgrade. ONLINE-10 in the smoke suite fails
    // if a mixed-case prefix reaches the zone again.
    caseSensitiveRoutes: true,
  },
  async rewrites() {
    const remoteZoneUrl =
      process.env.REMOTE_ZONE_URL ||
      process.env.REMOTE_APP_URL ||
      'http://localhost:3001';

    return [
      // 1. Zone root: explicit match for /remote-app
      {
        source: '/remote-app',
        destination: `${remoteZoneUrl}/remote-app`,
      },
      // 2. Zone sub-routes: matches all paths and endpoints under /remote-app/
      {
        source: '/remote-app/:path*',
        destination: `${remoteZoneUrl}/remote-app/:path*`,
      },
      // 3. Zone static assets: matches static chunks and assets under /remote-app-static/
      {
        source: '/remote-app-static/:path*',
        destination: `${remoteZoneUrl}/remote-app-static/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
