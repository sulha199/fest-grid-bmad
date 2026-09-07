import { loadBackendEnv } from '../../env.js';
import * as emailAdapter from '../email/adapter.js';
import {
  getProvidersNeedingAlert,
  markProviderAlertSent,
} from '../scraper/scraper-provider-health-store.js';
import { getModeratorEmails } from './get-moderators.js';

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

  for (const { provider, consecutiveFailureDays } of providersNeedingAlert) {
    const results = await Promise.allSettled(
      moderators.map((mod) =>
        deps.sendTemplatedEmail('SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT', mod.email, {
          provider,
          consecutiveFailureDays,
          moderatorReviewUrl,
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
