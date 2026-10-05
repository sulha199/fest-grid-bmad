import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';
import { getPlatformByCode } from '@festgrid/domain/scraper';
import { graphqlClient } from '@/lib/graphql-client';
import { GetPostByPlatformIdentifiersDocument, GetPostByPlatformIdentifiersQuery } from '@/generated/graphql';
import PostEventsContent from './post-events-content';

export const dynamic = 'force-dynamic';

interface PageParams {
  locale: string;
  platformSlug: string;
  postType: string;
  platformPostId: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, platformSlug, postType, platformPostId } = await params;

  const platform = getPlatformByCode(platformSlug);
  if (!platform) {
    notFound();
  }

  let post = null;
  try {
    const data = await graphqlClient.request<GetPostByPlatformIdentifiersQuery>(
      GetPostByPlatformIdentifiersDocument,
      { platform, postType, platformPostId }
    );
    post = data?.postByPlatformIdentifiers ?? null;
  } catch (e) {
    // degrade gracefully on error for generateMetadata
  }

  if (!post) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const displayName = post.account?.displayName ?? post.account?.username ?? '';

  return buildPageMetadata({
    title: t('postCollectionPageTitle', { displayName }),
    description: t('postCollectionPageDescription', { displayName }),
  });
}

export default async function PostEventsPage({ params }: { params: Promise<PageParams> }) {
  const { platformSlug, postType, platformPostId } = await params;

  const platform = getPlatformByCode(platformSlug);
  if (!platform) {
    notFound();
  }

  let post = null;
  try {
    const data = await graphqlClient.request<GetPostByPlatformIdentifiersQuery>(
      GetPostByPlatformIdentifiersDocument,
      { platform, postType, platformPostId }
    );
    post = data?.postByPlatformIdentifiers ?? null;
  } catch (e) {
    // re-throw on non-null-result errors so Next's error boundary handles it.
    throw e;
  }

  if (!post) {
    notFound();
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <PostEventsContent postId={post.postId} account={post.account ?? null} />
    </Suspense>
  );
}
