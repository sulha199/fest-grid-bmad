import { Suspense } from 'react';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';
import { JobDetailContent } from './job-detail-content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; jobId: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('jobDetailTitle'),
    description: t('jobDetailDescription'),
  });
}

export default async function JobDetailPage({ params }: { params: Promise<{ locale: string; jobId: string }> }) {
  const { jobId } = await params;
  return (
    <Suspense fallback={<RouteLoader />}>
      <JobDetailContent jobId={jobId} />
    </Suspense>
  );
}
