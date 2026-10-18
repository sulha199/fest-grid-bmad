import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { RouteLoader } from '@festgrid/ui';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/metadata';
import { buildAccountHref, getPlatformByCode, normalizeUsername } from '@festgrid/domain/scraper';
import { getAccountProfileCached } from '@/features/accounts/get-account-profile-cached';
import AccountContent from './account-content';

export const dynamic = 'force-dynamic';

interface PageParams {
  locale: string;
  platformSlug: string;
  username: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function buildQueryString(searchParams: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, platformSlug, username } = await params;

  const platform = getPlatformByCode(platformSlug);
  if (!platform) {
    notFound();
  }

  let profile = null;
  try {
    profile = await getAccountProfileCached(platform, decodeSegment(username));
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

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, platformSlug, username } = await params;

  const platform = getPlatformByCode(platformSlug);
  if (!platform) {
    notFound();
  }

  const segment = decodeSegment(username);
  // Request errors propagate so Next's error boundary handles them.
  const profile = await getAccountProfileCached(platform, segment);

  if (!profile) {
    notFound();
  }

  // AD-35 Rule 5 -- one canonical URL per account. A numeric-ID, mixed-case or otherwise
  // non-canonical segment redirects (308) to the username URL, keeping the query string: the
  // filters (`q`, `types`, `categories`, `view`) live there and `permanentRedirect` does not carry
  // it. Compared against the NORMALIZED username so a mixed-case stored value cannot loop.
  const canonicalPath = buildAccountHref(platform, profile.username);
  if (canonicalPath && segment !== normalizeUsername(profile.username ?? '')) {
    permanentRedirect(`/${locale}${canonicalPath}${buildQueryString(await searchParams)}`);
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <AccountContent platformSlug={platformSlug} profile={profile} />
    </Suspense>
  );
}
