import { loadBackendEnv } from '../../env.js';
import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import * as emailAdapter from '../email/adapter.js';

export async function sendDangerousReportModeratorAlerts(
  eventName: string,
  deps = { sendTemplatedEmail: emailAdapter.sendTemplatedEmail }
): Promise<void> {
  try {
    const moderators = await db.select().from(users).where(eq(users.role, 'moderator'));
    if (moderators.length === 0) {
      console.info('[Dangerous Report Alert] No moderators found to notify.');
      return;
    }
    const moderatorReviewUrl = `${loadBackendEnv().webAppBaseUrl}/moderator/items`;
    const results = await Promise.allSettled(
      moderators.map((mod) =>
        deps.sendTemplatedEmail('DANGEROUS_EVENT_MODERATOR_ALERT', mod.email, {
          eventName,
          moderatorReviewUrl,
        })
      )
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`[Dangerous Report Alert] Failed to notify moderator ${moderators[i].email}:`, result.reason);
      }
    });
  } catch (err) {
    console.error('[Dangerous Report Alert] Failed loading moderators or dispatching alerts:', err);
  }
}
