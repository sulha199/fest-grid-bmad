import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

const EVENT_DETAIL_PATH = new RegExp(`^/(${routing.locales.join('|')})/events/[^/]+$`);

// Story 0.38 (AC6/AC7, AD-21) — the event-detail page's iframe loads from https://www.instagram.com,
// a fixed, confirmed origin (unlike Instagram's dynamically-sharded CDN media host, which cannot be
// predicted ahead of the real request — deliberately not hinted here). The HTTP `Link` response
// header is used rather than a JSX `<link>` tag since Next.js App Router's Metadata API has no
// dedicated preconnect field and raw `<link>`s aren't reliably hoisted into `<head>` from a Server
// Component. It is set here, not in `next.config.ts` `headers()`: next-intl's middleware sets its own
// `Link` header (hreflang alternates) and that replaces a config-level one, so the hints must be
// appended to the response the middleware returns.
const INSTAGRAM_CONNECTION_HINTS =
  '<https://www.instagram.com>; rel=preconnect, <https://www.instagram.com>; rel=dns-prefetch';

export default function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);
  if (EVENT_DETAIL_PATH.test(request.nextUrl.pathname)) {
    response.headers.append('link', INSTAGRAM_CONNECTION_HINTS);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)']
};
