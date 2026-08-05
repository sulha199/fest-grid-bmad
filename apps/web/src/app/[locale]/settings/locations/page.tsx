import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';
import { buildPageMetadata } from '@/lib/metadata';
import { LocationsContent } from './locations-content';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('locationsTitle'),
    description: t('locationsDescription'),
  });
}

export default function LocationsPage() {
  return (
    <Suspense>
      <LocationsContent />
    </Suspense>
  );
}
