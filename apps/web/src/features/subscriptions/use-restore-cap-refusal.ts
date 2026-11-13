'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { readSubscriptionCapRefusal } from './subscription-cap-error';
import { useSubscriptionCapRefusal, type SubscriptionCapShowContext, type SubscriptionCapState } from './use-subscription-cap-refusal';

export interface UseRestoreCapRefusalResult {
  state: SubscriptionCapState | null;
  clear: () => void;
  /**
   * For the Undo of a removed subscription: when the restore was refused with the cap, stores the refusal (the caller
   * opens `SubscriptionCapDialog` with `state`) and shows the short `restoreFailedToast`. Returns true for a cap refusal.
   * The caller rethrows either way, so `useSoftDeleteWithUndo` keeps the row removed.
   */
  handleRestoreError: (err: unknown, ctx: Omit<SubscriptionCapShowContext, 'surface'>) => boolean;
}

/** Story 10.3a: the Undo (RESTORE) entry points of the Subscriptions list and Post Selection share this. */
export function useRestoreCapRefusal(): UseRestoreCapRefusalResult {
  const t = useTranslations('SubscriptionCap');
  const { state, show, clear } = useSubscriptionCapRefusal();
  const handleRestoreError = useCallback(
    (err: unknown, ctx: Omit<SubscriptionCapShowContext, 'surface'>) => {
      const refusal = readSubscriptionCapRefusal(err);
      if (!refusal || !show(err, { ...ctx, surface: 'restore' })) return false;
      toast.error(t('restoreFailedToast', { cap: refusal.cap }));
      return true;
    },
    [show, t],
  );
  return { state, clear, handleRestoreError };
}
