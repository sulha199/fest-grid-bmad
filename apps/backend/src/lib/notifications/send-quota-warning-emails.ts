import { loadBackendEnv } from '../../env.js';
import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import * as emailAdapter from '../email/adapter.js';
import { getUsersWithStaleQueuedPosts } from './get-users-with-stale-queued-posts.js';

export async function sendQuotaWarningEmails(
  deps = { sendTemplatedEmail: emailAdapter.sendTemplatedEmail }
): Promise<void> {
  const env = loadBackendEnv();
  const thresholdDays = env.queueNotificationThresholdDays;
  const thresholdCount = env.queueNotificationThresholdCount;
  const cooldownDays = env.queueNotificationCooldownDays;

  const qualifyingUsers = await getUsersWithStaleQueuedPosts(
    thresholdDays,
    thresholdCount,
    cooldownDays
  );

  if (qualifyingUsers.length === 0) {
    console.info('[Quota Warning] No qualifying users found with stale queued posts.');
    return;
  }

  console.info(`[Quota Warning] Found ${qualifyingUsers.length} users qualifying for quota warning notifications.`);

  for (const user of qualifyingUsers) {
    try {
      const apiKeyManagementUrl = `${env.webAppBaseUrl}/settings/api-keys`;
      const userName = user.name ?? user.email;

      await deps.sendTemplatedEmail('QUOTA_EXHAUSTION_WARNING', user.email, {
        userName,
        queuedPostCount: user.queuedPostCount,
        queuedDays: thresholdDays,
        apiKeyManagementUrl,
      });

      // Update the lastQuotaWarningEmailSentAt timestamp on successful send
      await db
        .update(users)
        .set({ lastQuotaWarningEmailSentAt: new Date() })
        .where(eq(users.id, user.userId));

      console.info(`[Quota Warning] Successfully sent warning email to user: ${user.email}`);
    } catch (error) {
      console.error(
        `[Quota Warning] Failed to send quota warning email to user ${user.email}:`,
        error
      );
    }
  }
}
