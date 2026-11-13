'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../../core/ui/button';
import { OVERLAY_MODAL_Z } from '../../core/overlay-z';

export interface JobProgressDialogProps {
  open: boolean;
  /** True once the job ended: Escape, an outside tap and the footer button then close the dialog and drop the chip. */
  ended: boolean;
  title: string;
  labels: { description: string; minimize: string; close: string };
  /** Minimize, Escape and an outside tap while the job is open. Nothing here stops a job. */
  onMinimize: () => void;
  onClose: () => void;
  /** Focus return: the host picks the chip (minimize) or the control that started the action (close). */
  onCloseAutoFocus?: (event: Event) => void;
  /** "See all in Jobs" and similar, built by the host with its router link. */
  footerLinks?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The dialog form of the progress component, on the Radix primitives with the shared overlay tier (the same
 * shape as the other dialogs: bounded height, scrolls inside itself, `minmax(0,1fr)` column so no child
 * stretches it past a 320 px screen).
 */
export function JobProgressDialog({ open, ended, title, labels, onMinimize, onClose, onCloseAutoFocus, footerLinks, children }: JobProgressDialogProps) {
  const dismiss = ended ? onClose : onMinimize;
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && dismiss()}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 ${OVERLAY_MODAL_Z} bg-black/80`} />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={`fixed left-[50%] top-[50%] ${OVERLAY_MODAL_Z} grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100vw-2rem)] grid-cols-[minmax(0,1fr)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-6 shadow-lg sm:max-w-md sm:rounded-lg`}
          data-testid="job-progress-dialog"
        >
          <div className="space-y-1.5">
            <Dialog.Title className="break-words text-lg font-semibold leading-tight tracking-tight" tabIndex={-1}>
              {title}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">{labels.description}</Dialog.Description>
          </div>
          {children}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {footerLinks}
            <Button type="button" variant={ended ? 'default' : 'outline'} className="min-h-11 w-full sm:w-auto" onClick={dismiss} data-testid={ended ? 'job-dialog-close' : 'job-dialog-minimize'}>
              {ended ? labels.close : labels.minimize}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
