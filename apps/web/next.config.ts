import path from 'path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // apps/web sits two levels below the bmad monorepo root (which owns the
  // pnpm-workspace.yaml/turbo.json/pnpm-lock.yaml this project actually uses).
  // Without this, Next.js's lockfile-based root inference walks up into the
  // unrelated outer `festgrid/` repo instead, since it also has a pnpm-lock.yaml.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  transpilePackages: ['@festgrid/domain'],
  async redirects() {
    return [
      {
        source: '/posts/extract',
        destination: '/posts/select',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
