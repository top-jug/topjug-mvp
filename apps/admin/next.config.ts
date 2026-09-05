import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apiOrigin = process.env.ADMIN_API_PROXY_ORIGIN?.replace(/\/$/, '') || 'http://127.0.0.1:3000';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  reactStrictMode: true,
  turbopack: { root: repoRoot },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
