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
  // Story 3.7d AC10: the event-detail route renders Instagram's oEmbed `html` (Story 3.7e),
  // which loads Instagram's `embed.js` widget script and renders it as an iframe. This CSP
  // is scoped to this route only (via the `source` matcher) -- kept deliberately separate
  // from Story 6.7a's `/widget/[id]` `frame-ancestors` clickjacking-defense header, which is
  // set dynamically per-request in middleware.ts for a different purpose and must not be
  // weakened by this change. No `default-src` is set here, so every other fetch directive
  // (style-src, font-src, etc.) remains unrestricted -- only the directives actually needed
  // for the Instagram embed are constrained.
  //
  // `img-src`/`connect-src` are scheme-broadened to `https:` rather than narrowed to an
  // enumerated allowlist: this route already legitimately loads resources from origins that
  // can't be statically enumerated here -- EventImage hotlinks Post.imageUrl from whatever
  // arbitrary platform/CDN the source post lived on (Story 1.6a), PostHog's script/config/
  // flags endpoints and Supabase's auth endpoint are both environment-configured hosts (see
  // packages/analytics, apps/web/src/lib/supabase). A verified-by-running Playwright pass
  // (`event-details-instagram-csp.spec.ts`) caught the initial narrow-allowlist draft of
  // this CSP blocking PostHog's script/connect calls and a fixture profile image -- do not
  // re-narrow these two directives without re-running that route end-to-end.
  async headers() {
    return [
      {
        source: '/:locale/events/:slug',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
              "frame-src 'self' https://www.instagram.com",
              "child-src 'self' https://www.instagram.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
