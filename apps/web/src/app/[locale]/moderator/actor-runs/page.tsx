import { Suspense } from 'react';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';
import { ActorRunsContent } from './actor-runs-content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('actorRunsTitle'),
    description: t('actorRunsDescription'),
  });
}

export default function ActorRunsPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <ActorRunsContent />
    </Suspense>
  );
}
