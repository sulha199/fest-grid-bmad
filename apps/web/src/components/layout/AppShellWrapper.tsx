'use client';

import * as React from 'react';
import { ReactNode } from 'react';
import { usePathname, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { AppShell, NavKey } from '@festgrid/ui';

export function AppShellWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('Nav');
  const { user, isLoading } = useAuthSession();

  const isAuthenticated = !!user && !isLoading;
  const avatarUrl = user?.user_metadata?.avatar_url || undefined;
  const displayName = user?.user_metadata?.full_name || user?.email || undefined;

  const labels: Record<NavKey, string> = {
    discover: t('discover'),
    feed: t('feed'),
    favorites: t('favorites'),
    calendar: t('calendar'),
    login: t('login'),
  };

  return (
    <AppShell
      isAuthenticated={isAuthenticated}
      avatarUrl={avatarUrl}
      displayName={displayName}
      currentPath={pathname}
      renderLink={Link}
      labels={labels}
      onProfileTriggerActivate={undefined} // Story 2.8 wires the User Menu dropdown/bottom-sheet
    >
      {children}
    </AppShell>
  );
}
