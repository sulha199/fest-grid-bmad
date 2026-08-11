import type { EventBridgeEvent, Context } from 'aws-lambda';
import * as orchestration from '../lib/notifications/send-quota-warning-emails.js';

export const handler = async (
  event: EventBridgeEvent<string, unknown> | any,
  context: Context | any,
  deps = { sendQuotaWarningEmails: orchestration.sendQuotaWarningEmails }
): Promise<void> => {
  console.log('Notifier lambda invoked', JSON.stringify({ event }));
  try {
    await deps.sendQuotaWarningEmails();
    console.log('Notifier Lambda executed successfully.');
  } catch (err) {
    console.error('Notifier Lambda execution failed:', err);
    throw err;
  }
};
