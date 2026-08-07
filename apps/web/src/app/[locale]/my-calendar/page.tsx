import { Suspense } from 'react';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';
import { buildPageMetadata } from '@/lib/metadata';
import { MyCalendarContent } from './my-calendar-content';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('myCalendarTitle'),
    description: t('myCalendarDescription'),
  });
}

export default function MyCalendarPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <MyCalendarContent />
    </Suspense>
  );
}
