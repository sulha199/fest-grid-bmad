'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { JobAnnouncer, useJobAnnouncements, type UseJobAnnouncementsResult } from '@festgrid/ui';
import { useTranslations } from 'next-intl';

type Announcer = Pick<UseJobAnnouncementsResult, 'observe' | 'announce'>;

const NOOP: Announcer = { observe: () => {}, announce: () => {} };
const AnnouncerContext = createContext<Announcer>(NOOP);

/** The one `JobAnnouncer` of the page. Without a provider (a bare test render) announcements are dropped. */
export function JobAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Jobs');
  const { message, observe, announce } = useJobAnnouncements({ listUpdated: (count) => t('announce.listUpdated', { count }) });
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
