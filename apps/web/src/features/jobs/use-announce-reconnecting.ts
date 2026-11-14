'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useJobAnnouncer } from './job-announcer-provider';

/** Says "Reconnecting" politely once each time the poll starts failing (reconnecting flips to true), not on every failed poll. */
export function useAnnounceReconnecting(reconnecting: boolean): void {
  const t = useTranslations('Jobs');
  const announcer = useJobAnnouncer();
  const was = useRef(false);
  useEffect(() => {
    if (reconnecting && !was.current) announcer.announce(t('announce.reconnecting'));
    was.current = reconnecting;
  }, [reconnecting, announcer, t]);
}
