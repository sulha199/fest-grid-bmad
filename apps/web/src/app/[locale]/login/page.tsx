import { Suspense } from 'react';
import { RouteLoader } from '@festgrid/ui';
import { LoginContent } from './login-content';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('loginTitle'),
    description: t('loginDescription'),
  });
}

export default function LoginPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <LoginContent />
    </Suspense>
  );
}
