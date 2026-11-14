'use client';

import React, { useEffect, useRef } from 'react';
import { UpgradeCta } from '../../core/upgrade-cta';
import { cn } from '../../lib/utils';
import type { SubscriptionCapNoticeProps } from './SubscriptionCapNotice.types';

const LINK_CLASS = 'inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4';

/**
 * Story 10.3a: what a refused subscribe, restore or retry says. Amber, not red (a limit is information to act on). The
 * inline variant moves focus to its title once and has one hidden status line that is the thing read; the dialog variant
 * leaves the title and the focus to its dialog.
 */
export function SubscriptionCapNotice({
  refusal,
  labels,
  variant,
  showBlockedNote = false,
  manageHref,
  renderLink,
  onUpgradeShown,
  onUpgradeClick,
  className,
}: SubscriptionCapNoticeProps) {
  const titleRef = useRef<HTMLParagraphElement>(null);
  const inline = variant === 'inline';

  useEffect(() => {
    if (inline) titleRef.current?.focus();
  }, [inline]);

  return (
    <div
      className={cn(
        'min-w-0 space-y-3 break-words rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
        className,
      )}
      data-testid="subscription-cap-notice"
      data-variant={variant}
      data-active-count={refusal.activeCount}
      data-reserved-count={refusal.reservedCount}
      data-cap={refusal.cap}
    >
      {inline && (
        <div role="status" className="sr-only" data-testid="subscription-cap-announce">
          {labels.announce}
        </div>
      )}
      {inline && (
        <p ref={titleRef} tabIndex={-1} className="text-sm font-semibold outline-none" data-testid="subscription-cap-title" data-cap-notice-title>
          {labels.title}
        </p>
      )}
      <p data-testid="subscription-cap-body">{labels.body}</p>
      <p>{labels.hint}</p>
      {showBlockedNote && <p data-testid="subscription-cap-blocked-note">{labels.blockedNote}</p>}
      <UpgradeCta
        label={labels.upgradeButton}
        comingSoonLabel={labels.comingSoonBadge}
        note={labels.comingSoonNote}
        afterClickNote={labels.afterClickNote}
        onShown={onUpgradeShown}
        onClick={onUpgradeClick}
      />
      {manageHref &&
        (renderLink ? (
          renderLink({ href: manageHref, className: LINK_CLASS, children: labels.manageLink })
        ) : (
          <a href={manageHref} className={LINK_CLASS}>
            {labels.manageLink}
          </a>
        ))}
    </div>
  );
}
