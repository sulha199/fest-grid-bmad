'use client';

import React, { createContext, useContext, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { JobAnnouncer, useJobAnnouncements, type UseJobAnnouncementsResult } from '@festgrid/ui';
import { useTranslations } from 'next-intl';

type Announcer = Pick<UseJobAnnouncementsResult, 'observe' | 'announce'>;

const NOOP: Announcer = { observe: () => {}, announce: () => {} };
const AnnouncerContext = createContext<Announcer>(NOOP);

/** The one `JobAnnouncer` of the page. Without a provider (a bare test render) announcements are dropped. */
export function JobAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Jobs');
  const { message, observe, announce, resetSeen } = useJobAnnouncements({ listUpdated: (count) => t('announce.listUpdated', { count }) });
  // Forget what was seen when the page changes. Done while rendering (before the new page's effects run), so the new page's first
  // observation is recorded silently instead of being cleared after it. Within one page announcements stay change-only.
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  if (lastPath.current !== pathname) {
    lastPath.current = pathname;
    resetSeen();
  }
  const value = useMemo(() => ({ observe, announce }), [observe, announce]);
  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <JobAnnouncer message={message} />
    </AnnouncerContext.Provider>
  );
}

export function useJobAnnouncer(): Announcer {
  return useContext(AnnouncerContext);
}
