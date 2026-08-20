'use client';

import * as React from 'react';
import { ReactNode } from 'react';
import { usePathname, useRouter, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { AppShell, NavKey } from '@festgrid/ui';
import { useMeQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { useHasApiKey } from '@/features/onboarding/use-has-api-key';

// Any slug works here — the goal is only to warm the shared @modal
// layout/loading JS chunks once per session (identical for every real event
// slug); the target page's own data fetch is skipped during prefetch since
// it's inside a Suspense boundary bounded by loading.tsx.
const MODAL_PREFETCH_WARMUP_SLUG = '__prefetch-warmup__';

export function AppShellWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('Nav');
  const tUserMenu = useTranslations('UserMenu');
  const { user, isLoading, signOut } = useAuthSession();
  const hasApiKey = useHasApiKey();

  const isAuthenticated = !!user && !isLoading;
  const avatarUrl = user?.user_metadata?.avatar_url || undefined;
  const displayName = user?.user_metadata?.full_name || user?.email || undefined;

  const { data: meData } = useMeQuery(graphqlClient, undefined, {
    enabled: isAuthenticated,
  });
  const role = meData?.me?.role || undefined;

  React.useEffect(() => {
    router.prefetch(`/events/${MODAL_PREFETCH_WARMUP_SLUG}`);
  }, [router]);

  const labels: Record<NavKey, string> = {
    discover: t('discover'),
    feed: t('feed'),
    favorites: t('favorites'),
    calendar: t('calendar'),
    login: t('login'),
  };

  const userMenuLabels = {
    profile: tUserMenu('profile'),
    locations: tUserMenu('locations'),
    subscriptions: tUserMenu('subscriptions'),
    apiKeys: tUserMenu('apiKeys'),
    queueStatus: tUserMenu('queueStatus'),
    notifications: tUserMenu('notifications'),
    reports: tUserMenu('reports'),
    moderatorItems: tUserMenu('moderatorItems'),
    unprocessedPayloads: tUserMenu('unprocessedPayloads'),
    actorRuns: tUserMenu('actorRuns'),
    logout: tUserMenu('logout'),
    close: tUserMenu('close'),
  };

  return (
    <AppShell
      isAuthenticated={isAuthenticated}
      avatarUrl={avatarUrl}
      displayName={displayName}
      currentPath={pathname}
      renderLink={Link}
      labels={labels}
      role={role}
      onSignOut={signOut}
      userMenuLabels={userMenuLabels}
      resolveHref={(entry) => (entry.requiresApiKey && !hasApiKey ? `/wizard/onboarding/api-key?redirect=${encodeURIComponent(entry.href || '/')}` : entry.href || '/')}
    >
      {children}
    </AppShell>
  );
}
