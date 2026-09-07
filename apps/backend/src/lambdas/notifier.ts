import type { EventBridgeEvent, Context } from 'aws-lambda';
import * as orchestration from '../lib/notifications/send-quota-warning-emails.js';
import * as scraperProviderAlerts from '../lib/notifications/send-scraper-provider-down-alerts.js';

export const handler = async (
  event: EventBridgeEvent<string, unknown> | any,
  context: Context | any,
  deps = {
    sendQuotaWarningEmails: orchestration.sendQuotaWarningEmails,
    sendScraperProviderDownAlerts: scraperProviderAlerts.sendScraperProviderDownAlerts,
  }
): Promise<void> => {
  console.log('Notifier lambda invoked', JSON.stringify({ event }));

  // Each daily sweep call is wrapped in its own try/catch so a failure in one
  // doesn't silently swallow or prevent the other's own error handling
  // (Story 3.4q) -- previously a single outer try/catch meant a throw from
  // whichever call ran first would short-circuit the rest.
  let hadFailure = false;

  try {
    await deps.sendQuotaWarningEmails();
  } catch (err) {
    hadFailure = true;
    console.error('Notifier Lambda: sendQuotaWarningEmails failed:', err);
  }

  try {
    await deps.sendScraperProviderDownAlerts();
  } catch (err) {
    hadFailure = true;
    console.error('Notifier Lambda: sendScraperProviderDownAlerts failed:', err);
  }

  if (hadFailure) {
    throw new Error('Notifier Lambda execution failed: one or more notification sweeps threw. See preceding logs for details.');
  }

  console.log('Notifier Lambda executed successfully.');
};
