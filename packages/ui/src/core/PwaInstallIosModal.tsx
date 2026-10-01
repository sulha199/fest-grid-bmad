'use client';

import * as React from 'react';
import { LucideIcon } from 'lucide-react';

export interface PwaInstallIosModalLabels {
  title: string;
  shareStepText: string;
  addToHomeScreenStepText: string;
  closeLabel: string;
}

export interface PwaInstallIosModalProps {
  open: boolean;
  labels: PwaInstallIosModalLabels;
  /** Story 0.38 (AC13) — `lucide-react`'s `Share` icon, confirmed against this
   * repo's installed `lucide-react` version at implementation time. */
  shareIcon: LucideIcon;
  /** Story 0.38 (AC13) — `lucide-react`'s `SquarePlus` icon (the current
   * canonical name; `PlusSquare` is a deprecated alias in this repo's
   * installed version), confirmed at implementation time. */
  addToHomeScreenIcon: LucideIcon;
  onClose: () => void;
}

/**
 * Story 0.38 (AC13, AC14) — the iOS Safari "how to install" instructions
 * modal. iOS has no native `beforeinstallprompt` UI, so the primary action
 * opens this richer, step-by-step disclosure instead. Reuses DESIGN.md's
 * shared `{components.modal}` overlay/dialog shape (per DESIGN.md's explicit
 * "not inventing new modal chrome" note) rather than a bespoke dialog.
 *
 * Closing (button, overlay click, or Escape) only calls `onClose` — it never
 * touches any dismiss/cooldown `localStorage` state (AC14); that state is
 * owned entirely by the banner's own "Not now"/"Remind me in 2 weeks"
 * actions, a structurally separate user action from closing this modal.
 */
export function PwaInstallIosModal({
  open,
  labels,
  shareIcon: ShareIcon,
  addToHomeScreenIcon: AddToHomeScreenIcon,
  onClose,
}: PwaInstallIosModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      {/* DESIGN.md `components.modal.overlay`, verbatim */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        data-testid="pwa-install-ios-modal-overlay"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="pwa-install-ios-modal"
        // DESIGN.md `components.modal.dialog`, verbatim (pwa_install_ios_modal's own `dialog` token)
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="text-lg font-bold text-gray-900">
            {labels.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.closeLabel}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* DESIGN.md `pwa_install_ios_modal.step`/`step_number`, verbatim */}
        <div className="flex items-center gap-3 py-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold shrink-0">
            1
          </span>
          <ShareIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{labels.shareStepText}</span>
        </div>
        <div className="flex items-center gap-3 py-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold shrink-0">
            2
          </span>
          <AddToHomeScreenIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{labels.addToHomeScreenStepText}</span>
        </div>
      </div>
    </>
  );
}
