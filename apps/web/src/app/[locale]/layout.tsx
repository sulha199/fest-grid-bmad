import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import '../globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthSessionProvider } from '@/components/providers/auth-session-provider';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { PostHogProvider } from '@festgrid/analytics';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '../../i18n/routing';
import { ScopedLocaleProvider, SoftDeleteToaster } from '@festgrid/ui';
import { AppShellWrapper } from '@/components/layout/AppShellWrapper';
import { buildPageMetadata } from '@/lib/metadata';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }>; children?: ReactNode; modal?: ReactNode }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('defaultTitle'),
    description: t('defaultDescription'),
  });
}

export function generateStaticParams() {
  return routing.locales.map((locale: string) => ({ locale }));
}

const localeDirectionMap: Record<string, 'ltr' | 'rtl'> = {
  en: 'ltr',
  id: 'ltr',
};

// next-intl's `routing.locales` are bare language subtags ('en', 'id'); map to a
// region-qualified BCP-47 tag for Intl-consuming components (ScopedLocaleProvider,
// EventCard's Intl.DateTimeFormat) so formatting is explicit rather than relying on
// the bare tag happening to match the desired region's conventions.
const localeIntlTagMap: Record<string, string> = {
  en: 'en-US',
  id: 'id-ID',
};

// BUG-010: wire a real, deterministic app-wide IANA timezone into the layout root's
// ScopedLocaleProvider so useScopedTimezone() (and everything downstream, e.g. EventCard's
// date/time formatting) actually receives a value server-side. The value is a compile-time
// constant derived from the route's bare locale, mirroring localeIntlTagMap above — because
// it is identical on server and browser, it removes the prior server/browser hydration
// mismatch (where EventCard fell back to the *runtime* default timezone, which can differ
// between the two and across request/rendering). Regional default chosen to match each
// locale's BCP-47 region (en-US → America/New_York, id-ID → Asia/Jakarta). This is an
// app-wide fallback only — per-event timezones (LocationDetails.timezone on the event's
// location) remain the intended per-event source for a future pass, overriding this default
// via an explicit EventCard `timezone` prop when wired.
const timezoneIntlMap: Record<string, string> = {
  en: 'America/New_York',
  id: 'Asia/Jakarta',
};

export default async function RootLayout({
  children,
  modal,
  params
}: {
  children: ReactNode;
  modal: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const { locale } = resolvedParams;

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client side
  const messages = await getMessages();

  const dir = localeDirectionMap[locale] || 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <PostHogProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <QueryProvider>
                <NuqsAdapter>
                  <AuthSessionProvider>
                    <ScopedLocaleProvider
                      locale={localeIntlTagMap[locale] ?? locale}
                      timezone={timezoneIntlMap[locale]}
                    >
                      <AppShellWrapper>
                        {children}
                        {modal}
                      </AppShellWrapper>
                      <SoftDeleteToaster />
                    </ScopedLocaleProvider>
                  </AuthSessionProvider>
                </NuqsAdapter>
              </QueryProvider>
            </ThemeProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
