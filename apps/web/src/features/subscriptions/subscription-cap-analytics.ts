import { capturePostHogEvent } from '@festgrid/analytics';
import type { SubscriptionCapRefusal } from './subscription-cap-error';

/** Where the refusal was shown. */
export type SubscriptionCapSurface =
  | 'subscribe_dialog'
  | 'onboarding_wizard'
  | 'event_detail_source'
  | 'event_detail_coauthor'
  | 'restore'
  | 'job_retry';

export interface SubscriptionCapAnalyticsInput {
  refusal: SubscriptionCapRefusal;
  surface: SubscriptionCapSurface;
  /** The platform account id, only when the screen knows it. Never a handle, a name or a URL. */
  accountId?: string;
}

function payload({ refusal, surface, accountId }: SubscriptionCapAnalyticsInput) {
  return {
    currentSubscriptionCount: refusal.activeCount,
    reservedCount: refusal.reservedCount,
    cap: refusal.cap,
    surface,
    ...(accountId ? { accountId } : {}),
  };
}

/** The Upgrade button first appeared for a refusal (PRD Section 6, Upgrade CTA and Analytics). Once per refusal. */
export function trackSubscriptionCapUpgradeShown(input: SubscriptionCapAnalyticsInput): void {
  capturePostHogEvent('subscription_cap_upgrade_cta_shown', payload(input));
}

/** Every click on the Upgrade button. */
export function trackSubscriptionCapUpgradeClicked(input: SubscriptionCapAnalyticsInput): void {
  capturePostHogEvent('subscription_cap_upgrade_cta_clicked', payload(input));
}
