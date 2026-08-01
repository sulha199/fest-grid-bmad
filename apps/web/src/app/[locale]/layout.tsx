import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import '../globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { PostHogProvider } from '@festgrid/analytics';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '../../i18n/routing';
import { AppShell, ScopedLocaleProvider } from '@festgrid/ui';
import { buildPageMetadata } from '@/lib/metadata';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
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

export default async function RootLayout({
  children,
  params
}: {
  children: ReactNode;
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
                  <ScopedLocaleProvider locale={localeIntlTagMap[locale] ?? locale}>
                    <AppShell>{children}</AppShell>
                  </ScopedLocaleProvider>
                </NuqsAdapter>
              </QueryProvider>
            </ThemeProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
