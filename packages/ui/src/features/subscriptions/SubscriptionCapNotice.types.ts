import type React from 'react';
/** The numbers of a `SUBSCRIPTION_CAP_REACHED` refusal (Story 10.3, reuse and admission control to job start). */
export interface SubscriptionCapRefusalCounts {
  /** Subscriptions the user holds. */
  activeCount: number;
  /** Accounts still being added (reserved slots). */
  reservedCount: number;
  /** The limit. */
  cap: number;
}

/** Plain strings the app resolves with next-intl (this package never imports it). `body` and `announce` are already built from the numbers. */
export interface SubscriptionCapNoticeLabels {
  title: string;
  body: string;
  hint: string;
  blockedNote: string;
  upgradeButton: string;
  comingSoonBadge: string;
  comingSoonNote: string;
  afterClickNote: string;
  manageLink: string;
  /** The one text a screen reader hears when the inline notice appears. */
  announce: string;
}

export interface SubscriptionCapNoticeProps {
  refusal: SubscriptionCapRefusalCounts;
  labels: SubscriptionCapNoticeLabels;
  /** `inline` sits in a form or page (status region, focuses its title); `dialog` sits in a dialog that already has the title. */
  variant: 'inline' | 'dialog';
  /** Show the "adding another account is paused" line. Off where the refusal is not about a form (Retry, restore). */
  showBlockedNote?: boolean;
  /** Where "Manage subscribed accounts" goes; the link renders only when given (the app builds it). */
  manageHref?: string;
  /** Renders the link element; defaults to a plain anchor. The app passes its locale-aware Link. */
  renderLink?: (props: { href: string; className: string; children: React.ReactNode }) => React.ReactNode;
  onUpgradeShown?: () => void;
  onUpgradeClick?: () => void;
  className?: string;
}
