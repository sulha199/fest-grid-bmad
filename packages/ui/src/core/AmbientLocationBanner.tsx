'use client';

import * as React from 'react';
import { Button } from './ui/button';
import { ambientCapabilityBannerTokens } from './ambient-capability-banner-tokens';

export interface AmbientLocationBannerLabels {
  message: string;
  enableButtonLabel: string;
  notNowButtonLabel: string;
  remindLaterButtonLabel: string;
}

export interface AmbientLocationBannerProps {
  labels: AmbientLocationBannerLabels;
  onEnableClick: () => void;
  onDismissPermanent: () => void;
  onRemindLater: () => void;
  /** True while the primary action's triggered browser permission dialog is pending resolution (AC7). */
  isPending?: boolean;
}

/**
 * Story 0.39 (AC6-AC8, AC13) — the ambient viewer-location consent banner.
 * Props-only, no `useViewerLocation()`/Zustand import — `AppShellWrapper.tsx`
 * is the sole owner of that state, wiring callbacks down (AC13), mirroring
 * this codebase's established `AppShell`/`AppShellWrapper` split.
 *
 * Renders only when the parent (Story 0.42's slot) decides to render it —
 * this component has no visibility logic of its own.
 */
export function AmbientLocationBanner({
  labels,
  onEnableClick,
  onDismissPermanent,
  onRemindLater,
  isPending = false,
}: AmbientLocationBannerProps) {
  return (
    <div className={ambientCapabilityBannerTokens.base}>
      <p className="flex-1">{labels.message}</p>
      <div className="flex items-center gap-2 shrink-0">
        <Button onClick={onEnableClick} disabled={isPending}>
          {labels.enableButtonLabel}
        </Button>
        <button
          type="button"
          className={ambientCapabilityBannerTokens.dismissPermanent}
          onClick={onDismissPermanent}
        >
          {labels.notNowButtonLabel}
        </button>
        <button
          type="button"
          className={ambientCapabilityBannerTokens.dismissCooldown}
          onClick={onRemindLater}
        >
          {labels.remindLaterButtonLabel}
        </button>
      </div>
    </div>
  );
}
