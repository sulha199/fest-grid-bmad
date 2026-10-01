'use client';

import * as React from 'react';
import { Button } from './ui/button';
import { ambientCapabilityBannerTokens } from './ambient-capability-banner-tokens';

export interface PwaInstallBannerLabels {
  message: string;
  installButtonLabel: string;
  howToInstallButtonLabel: string;
  notNowButtonLabel: string;
  remindLaterButtonLabel: string;
}

export interface PwaInstallBannerProps {
  labels: PwaInstallBannerLabels;
  /** Story 0.38a's `detectInstallPlatform()` result — only `'android'`/`'ios'` change the
   * primary action's label; a parent should not render this component at all for
   * `'unsupported'` (no `canShow` signal would be true in that case anyway). */
  platform: 'android' | 'ios' | 'unsupported';
  onInstallClick: () => void;
  onDismissPermanent: () => void;
  onRemindLater: () => void;
}

/**
 * Story 0.38 (AC10, AC12) — the PWA install ambient-ask banner. Implements
 * DESIGN.md's `pwa_install_banner` tokens: shared `base`/dismiss-button chrome
 * from Story 0.42's `ambientCapabilityBannerTokens`, plus this ask's own
 * `primary_action` (`{components.button.primary}`).
 *
 * Button order, left to right (AC10, matching DESIGN.md's explicit
 * "deliberately lower visual weight than the two real buttons either side of
 * it" ordering): "Not now" (dismiss_permanent) -> "Remind me in 2 weeks"
 * (dismiss_cooldown, lower-weight) -> primary action ("Install" on
 * Android/Chrome, "How to install" on iOS).
 *
 * Props-only, no `next-intl`/`zustand` import — `AppShellWrapper.tsx` is the
 * sole owner of the underlying `usePwaInstallPrompt()` state, wiring
 * callbacks down, mirroring `AmbientLocationBanner`'s established pattern.
 * Purely presentational: renders only when its parent (Story 0.42's slot)
 * chooses to render it — no internal show/hide logic of its own.
 */
export function PwaInstallBanner({
  labels,
  platform,
  onInstallClick,
  onDismissPermanent,
  onRemindLater,
}: PwaInstallBannerProps) {
  const primaryActionLabel = platform === 'ios' ? labels.howToInstallButtonLabel : labels.installButtonLabel;

  return (
    <div className={ambientCapabilityBannerTokens.base}>
      <p className="flex-1">{labels.message}</p>
      <div className="flex items-center gap-2 shrink-0">
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
        <Button onClick={onInstallClick}>{primaryActionLabel}</Button>
      </div>
    </div>
  );
}
