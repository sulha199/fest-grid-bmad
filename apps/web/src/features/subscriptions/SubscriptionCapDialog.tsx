'use client';

import React, { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { SubscriptionCapState } from './use-subscription-cap-refusal';
import { SubscriptionCapNoticeConnected } from './SubscriptionCapNoticeConnected';

export interface SubscriptionCapDialogProps {
  state: SubscriptionCapState | null;
  onClose: () => void;
}

/**
 * A small plain dialog (not an alert dialog: a refusal is information) for places with no room inline: the event page
 * toggle and the Undo of a removed subscription. The bounded `DialogContent` keeps a long sentence from stretching it.
 */
export function SubscriptionCapDialog({ state, onClose }: SubscriptionCapDialogProps) {
  const t = useTranslations('SubscriptionCap');
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-background sm:max-w-md"
        data-testid="subscription-cap-dialog"
        aria-describedby={undefined}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl font-bold outline-none">
            {t('dialogTitle')}
          </DialogTitle>
        </DialogHeader>
        {state && <SubscriptionCapNoticeConnected state={state} variant="dialog" showManageLink />}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-auto min-h-11 w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:w-auto"
          >
            {t('closeButton')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
