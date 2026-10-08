'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { OVERLAY_MODAL_Z } from './overlay-z';
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
        // `false` once it knows the confirm succeeded (see Dev Notes). Either
        // way, this primitive's own pending flag must clear so a dialog the
        // consumer chooses to keep open (or reopen later) isn't stuck with
        // Confirm/Cancel/Escape disabled (FIND-080).
        setIsConfirming(false);
      },
      () => {
        // A rejecting `onConfirm` -- including a consumer that caught its
        // own error, toasted, and intentionally did not rethrow -- still
        // means the confirm did not go through: re-enable the controls.
        // Deliberately not rethrown here: this runs inside a `.then`
        // rejection handler with nothing downstream to catch it, so
        // rethrowing only produced an unhandled rejection (FIND-080). The
        // consumer already observed/handled the error on its own promise
        // (e.g. `onConfirm`'s awaited call) before it ever reaches here.
        setIsConfirming(false);
      }
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 ${OVERLAY_MODAL_Z} bg-black bg-opacity-50`} />
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
            `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${OVERLAY_MODAL_Z} bg-white rounded-lg shadow-xl p-6 w-full max-w-md`,
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
