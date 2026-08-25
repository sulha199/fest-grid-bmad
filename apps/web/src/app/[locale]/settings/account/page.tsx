import { Suspense } from 'react';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';
import { buildPageMetadata } from '@/lib/metadata';
import { AccountSettingsContent } from './account-settings-content';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('accountSettingsTitle'),
    description: t('accountSettingsDescription'),
  });
}

export default function AccountSettingsPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <AccountSettingsContent />
    </Suspense>
  );
}
