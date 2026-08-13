import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const widgetMatch = pathname.match(/(?:\/[a-z]{2})?\/widget\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

  if (widgetMatch) {
    const widgetId = widgetMatch[1];
    const referer = request.headers.get('referer') || request.headers.get('origin');
    let parentOrigin: string | null = null;

    if (referer) {
      try {
        const url = new URL(referer);
        parentOrigin = url.origin;
      } catch {
        // Safe swallow
      }
    }

    const response = intlMiddleware(request);

    if (parentOrigin) {
      try {
        const graphqlUrl = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
        const gqlRes = await fetch(graphqlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query isOriginAllowed($widgetId: ID!, $origin: String!) {
                isOriginAllowedForWidget(widgetId: $widgetId, origin: $origin)
              }
            `,
            variables: { widgetId, origin: parentOrigin }
          })
        });
        const gqlData = await gqlRes.json();
        const isAllowed = gqlData?.data?.isOriginAllowedForWidget === true;

        if (isAllowed) {
          response.headers.set('Content-Security-Policy', `frame-ancestors ${parentOrigin}`);
        } else {
          response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
        }
      } catch {
        response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
      }
    } else {
      response.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
    }

    return response;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)']
};
