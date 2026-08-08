import { Suspense } from 'react';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';
import { buildPageMetadata } from '@/lib/metadata';
import { ApiKeysContent } from './api-keys-content';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('apiKeysTitle'),
    description: t('apiKeysDescription'),
  });
}

export default function ApiKeysPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <ApiKeysContent />
    </Suspense>
  );
}
