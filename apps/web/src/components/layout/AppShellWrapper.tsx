'use client';

import * as React from 'react';
import { ReactNode } from 'react';
import { usePathname, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { AppShell, NavKey } from '@festgrid/ui';
import { useMeQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

export function AppShellWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('Nav');
  const tUserMenu = useTranslations('UserMenu');
  const { user, isLoading, signOut } = useAuthSession();

  const isAuthenticated = !!user && !isLoading;
  const avatarUrl = user?.user_metadata?.avatar_url || undefined;
  const displayName = user?.user_metadata?.full_name || user?.email || undefined;

  const { data: meData } = useMeQuery(graphqlClient, undefined, {
    enabled: isAuthenticated,
  });
  const role = meData?.me?.role || undefined;

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
    notifications: tUserMenu('notifications'),
    reports: tUserMenu('reports'),
    moderatorItems: tUserMenu('moderatorItems'),
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
    >
      {children}
    </AppShell>
  );
}
