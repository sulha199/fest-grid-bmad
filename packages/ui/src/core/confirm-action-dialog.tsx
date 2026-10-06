'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { ConfirmActionDialogProps } from './confirm-action-dialog.types';

/**
 * Reusable, focus-trapping confirm/cancel dialog primitive, built on
 * `@radix-ui/react-dialog`'s `Root`/`Portal`/`Overlay`/`Content`.
 *
 * Implements EXPERIENCE.md's CC-024 merge-confirmation contract: opening
 * moves focus into the dialog (Radix's own `Content` behavior); `Escape`
 * and an overlay click both behave identically to Cancel (both surface as
 * `onOpenChange(false)`); Cancel and Confirm both return focus to whichever
 * element had focus immediately before the dialog opened, captured
 * internally (not a prop) and restored via `onCloseAutoFocus` once the
 * dialog unmounts.
 *
 * This component does not auto-close itself after a successful `onConfirm`
 * — the consumer owns `open` state and is expected to set `open={false}`
 * once it knows the confirm succeeded (see Story 0.47 Dev Notes).
 */
export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'default',
  onConfirm,
  onCancel,
  className,
}: ConfirmActionDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const descriptionId = React.useId();
  const previouslyFocusedElementRef = React.useRef<HTMLElement | null>(null);

  // Capture whichever element had focus immediately before the dialog
  // opened, so it can be restored on close (AC1). This primitive has no
  // `Dialog.Trigger` of its own -- the triggering control lives in the
  // consumer, outside this component -- so Radix's own trigger-focused
  // `onCloseAutoFocus` default (which only knows about a real
  // `Dialog.Trigger`) cannot do this for us; see the `onCloseAutoFocus`
  // override below.
  React.useEffect(() => {
    if (open) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) onCancel();
  };

  const handleConfirm = () => {
    setIsConfirming(true);
    Promise.resolve(onConfirm()).then(
      () => {
        // Consumer owns `open` state; it is responsible for flipping it to
        // `false` once it knows the confirm succeeded (see Dev Notes).
      },
      (err) => {
        setIsConfirming(false);
        throw err;
      }
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50" />
        <Dialog.Content
          role="alertdialog"
          aria-describedby={description ? descriptionId : undefined}
          onEscapeKeyDown={(event) => {
            if (isConfirming) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isConfirming) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previouslyFocusedElementRef.current?.focus();
          }}
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md',
            className
          )}
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {description && (
            <Dialog.Description id={descriptionId} className="mt-2 text-sm text-muted-foreground">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" disabled={isConfirming} onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant === 'destructive' ? 'destructive' : 'default'}
              disabled={isConfirming}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export * from './confirm-action-dialog.types';
