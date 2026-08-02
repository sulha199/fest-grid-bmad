import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { routing } from '@/i18n/routing';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  const cookieStore = await cookies();
  const nextLocaleCookie = cookieStore.get('NEXT_LOCALE');
  const locale = nextLocaleCookie?.value ?? routing.defaultLocale;

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Successful authentication. Redirect to localized page
        return NextResponse.redirect(`${requestUrl.origin}/${locale}${next}`);
      }
    } catch (e) {
      console.error('OAuth callback error during exchange:', e);
    }
  }

  // On exchange failure, redirect to localized login page with error param
  return NextResponse.redirect(`${requestUrl.origin}/${locale}/login?error=auth_failed`);
}
