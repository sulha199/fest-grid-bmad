import { Suspense } from 'react';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';
import { buildPageMetadata } from '@/lib/metadata';
import { FeedContent } from './feed-content';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('feedTitle'),
    description: t('feedDescription'),
  });
}

export default function FeedPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <FeedContent />
    </Suspense>
  );
}
