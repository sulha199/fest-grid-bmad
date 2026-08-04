import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';
import { FavoritesContent } from './favorites-content';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('favoritesTitle'),
    description: t('favoritesDescription'),
  });
}

export default function FavoritesPage() {
  return (
    <Suspense>
      <FavoritesContent />
    </Suspense>
  );
}