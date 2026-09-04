/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const remoteUrl = process.env.REMOTE_ZONE_URL || 'http://localhost:3001';
    return [
      {
        source: '/remote-app',
        destination: `${remoteUrl}/remote-app`,
      },
      {
        source: '/remote-app/:path*',
        destination: `${remoteUrl}/remote-app/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
