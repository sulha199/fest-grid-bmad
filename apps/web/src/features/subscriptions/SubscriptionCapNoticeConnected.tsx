'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { SubscriptionCapNotice, type SubscriptionCapNoticeLabels } from '@festgrid/ui';
import { Link } from '@/i18n/navigation';
import type { SubscriptionCapState } from './use-subscription-cap-refusal';
import { trackSubscriptionCapUpgradeClicked, trackSubscriptionCapUpgradeShown } from './subscription-cap-analytics';

/** Where "Manage subscribed accounts" goes. */
export const MANAGE_SUBSCRIPTIONS_HREF = '/settings/account';

/** Resolves the `SubscriptionCap` copy (numbers formatted by the active locale, plural by ICU) into the plain labels the ui notice takes. */
export function useSubscriptionCapLabels(refusal: SubscriptionCapState['refusal']): SubscriptionCapNoticeLabels {
  const t = useTranslations('SubscriptionCap');
  const body = t('body', { active: refusal.activeCount, reserved: refusal.reservedCount, cap: refusal.cap });
  return {
    title: t('title'),
    body,
    hint: t('hint'),
    blockedNote: t('blockedNote'),
    upgradeButton: t('upgradeButton'),
    comingSoonBadge: t('comingSoonBadge'),
    comingSoonNote: t('comingSoonNote'),
    afterClickNote: t('afterClickNote'),
    manageLink: t('manageLink'),
    announce: t('announce', { body }),
  };
}

/** The one sentence a screen reader hears for a refusal, for screens that show it in a dialog (no status region of their own). */
export function useSubscriptionCapAnnouncement(): (refusal: SubscriptionCapState['refusal']) => string {
  const t = useTranslations('SubscriptionCap');
  return (refusal) => t('announce', { body: t('body', { active: refusal.activeCount, reserved: refusal.reservedCount, cap: refusal.cap }) });
}

export interface SubscriptionCapNoticeConnectedProps {
  state: SubscriptionCapState;
  variant: 'inline' | 'dialog';
  /** The "adding another account is paused" line (forms only). */
  showBlockedNote?: boolean;
  /** The link to Account Settings; off where the screen is that page or must not push the user away (the wizard). */
  showManageLink?: boolean;
  className?: string;
}

/** The apps/web side of the notice: copy, locale, analytics and the app Link. Keyed by the refusal id, so each refusal is one showing. */
export function SubscriptionCapNoticeConnected({ state, variant, showBlockedNote, showManageLink, className }: SubscriptionCapNoticeConnectedProps) {
  const labels = useSubscriptionCapLabels(state.refusal);
  const analytics = { refusal: state.refusal, surface: state.surface, accountId: state.accountId };
  return (
    <SubscriptionCapNotice
      key={state.refusalId}
      refusal={state.refusal}
      labels={labels}
      variant={variant}
      showBlockedNote={showBlockedNote}
      manageHref={showManageLink ? MANAGE_SUBSCRIPTIONS_HREF : undefined}
      renderLink={({ href, className: linkClass, children }) => (
        <Link href={href} className={linkClass}>
          {children}
        </Link>
      )}
      onUpgradeShown={() => trackSubscriptionCapUpgradeShown(analytics)}
      onUpgradeClick={() => trackSubscriptionCapUpgradeClicked(analytics)}
      className={className}
    />
  );
}
