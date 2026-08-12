import { Suspense } from 'react';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';
import { ArchiveContent } from './archive-content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('archiveTitle'),
    description: t('archiveDescription'),
  });
}

export default function ArchivePage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <ArchiveContent />
    </Suspense>
  );
}
