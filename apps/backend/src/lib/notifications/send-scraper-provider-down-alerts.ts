import { loadBackendEnv } from '../../env.js';
import * as emailAdapter from '../email/adapter.js';
import {
  getProvidersNeedingAlert,
  markProviderAlertSent,
} from '../scraper/scraper-provider-health-store.js';
import { getModeratorEmails } from './get-moderators.js';

// Renders the stored failure reason (a flat enum string or null for pre-3.4r rows) into a
// precomputed, fully-formed sentence for the email template -- the renderer does flat
// {{var}} substitution with no conditional blocks, so this must never pass a raw enum.
export function describeFailureReason(reason: string | null | undefined): string {
  if (reason === 'CAPACITY_EXHAUSTED') {
    return 'Every attempt was skipped due to the provider\'s own capacity/budget limit (an expected, self-imposed condition). Please review budget thresholds if this persists.';
  }
  if (reason === 'TRIGGER_ERROR') {
    return 'Every attempt returned a real trigger/API error (an actual vendor or credential problem, not a capacity limit).';
  }
  if (reason === 'PROVIDER_DEGRADED') {
    return 'The provider accepted its scrapes but returned nothing, or its runs failed, across the whole fleet (its newest runs all came back empty or failed). Scraping was moved to the next provider and the provider is probed again every few hours until it returns posts. A vendor-side outage is the likely cause: check the vendor\'s status page and open a support ticket.';
  }
  if (reason === 'DPA_NOT_CONFIRMED') {
    return 'Every attempt was blocked on purpose: the vendor scraping DPA switch (APIFY_SCRAPING_CONFIRMED / BRIGHTDATA_SCRAPING_CONFIRMED) is set to false. This is not a vendor outage -- set it back to true (or unset it) to resume scraping.';
  }
  return 'The provider returned repeated trigger failures (see CloudWatch logs for detail).';
}

export async function sendScraperProviderDownAlerts(
  deps = { sendTemplatedEmail: emailAdapter.sendTemplatedEmail }
): Promise<void> {
  const env = loadBackendEnv();

  const providersNeedingAlert = await getProvidersNeedingAlert(
    env.scraperProviderAlertThresholdDays,
    env.scraperProviderAlertCooldownDays
  );

  if (providersNeedingAlert.length === 0) {
    console.info('[Scraper Provider Down Alert] No providers currently qualify for an alert.');
    return;
  }

  const moderators = await getModeratorEmails();
  if (moderators.length === 0) {
    console.info('[Scraper Provider Down Alert] No moderators found to notify.');
    return;
  }

  const moderatorReviewUrl = `${env.webAppBaseUrl}/moderator/tools`;

  for (const { provider, consecutiveFailureDays, lastFailureReason } of providersNeedingAlert) {
    const failureReasonSummary = describeFailureReason(lastFailureReason);
    const results = await Promise.allSettled(
      moderators.map((mod) =>
        deps.sendTemplatedEmail('SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT', mod.email, {
          provider,
          consecutiveFailureDays,
          moderatorReviewUrl,
          failureReasonSummary,
        })
      )
    );

    let anySucceeded = false;
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(
          `[Scraper Provider Down Alert] Failed to notify moderator ${moderators[i].email} about ${provider}:`,
          result.reason
        );
      } else {
        anySucceeded = true;
      }
    });

    if (anySucceeded) {
      await markProviderAlertSent(provider);
    }
  }
}
