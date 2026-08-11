import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';
import { getPlatformByCode } from '@festgrid/domain/scraper';
import { graphqlClient } from '@/lib/graphql-client';
import { GetSocialMediaAccountProfileByAccountIdDocument, GetSocialMediaAccountProfileByAccountIdQuery } from '@/generated/graphql';
import AccountContent from './account-content';

export const dynamic = 'force-dynamic';

interface PageParams {
  locale: string;
  platformSlug: string;
  accountId: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, platformSlug, accountId } = await params;

  const platform = getPlatformByCode(platformSlug);
  if (!platform) {
    notFound();
  }

  let profile = null;
  try {
    const data = await graphqlClient.request<GetSocialMediaAccountProfileByAccountIdQuery>(
      GetSocialMediaAccountProfileByAccountIdDocument,
      { platform, accountId }
    );
    profile = data?.socialMediaAccountProfileByAccountId ?? null;
  } catch (e) {
    // degrade gracefully on error for generateMetadata
  }

  if (!profile) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('accountPageTitle', { displayName: profile.displayName }),
    description: t('accountPageDescription', { displayName: profile.displayName }),
  });
}

export default async function AccountPage({ params }: { params: Promise<PageParams> }) {
  const { platformSlug, accountId } = await params;

  const platform = getPlatformByCode(platformSlug);
  if (!platform) {
    notFound();
  }

  let profile = null;
  try {
    const data = await graphqlClient.request<GetSocialMediaAccountProfileByAccountIdQuery>(
      GetSocialMediaAccountProfileByAccountIdDocument,
      { platform, accountId }
    );
    profile = data?.socialMediaAccountProfileByAccountId ?? null;
  } catch (e) {
    // re-throw on non-null-result errors so Next's error boundary handles it.
    throw e;
  }

  if (!profile) {
    notFound();
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <AccountContent platformSlug={platformSlug} accountId={accountId} profile={profile} />
    </Suspense>
  );
}
