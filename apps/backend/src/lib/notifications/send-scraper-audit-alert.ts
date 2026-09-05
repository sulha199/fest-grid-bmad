import { loadBackendEnv } from '../../env.js';
import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import * as emailAdapter from '../email/adapter.js';

export type ScraperAuditFailureSource =
  | 'recordActorRunStart'
  | 'recordActorRunResult'
  | 'recordSyncActorRun'
  | 'persistUnprocessedPayload';

export interface ScraperAuditFailureDetails {
  source: ScraperAuditFailureSource;
  message: string;
  context: string;
}

export let sendScraperAuditAlert = async (
  details: ScraperAuditFailureDetails,
  deps = { sendTemplatedEmail: emailAdapter.sendTemplatedEmail }
): Promise<void> => {
  try {
    const moderators = await db.select().from(users).where(eq(users.role, 'moderator'));
    if (moderators.length === 0) {
      console.info('[Scraper Audit Alert] No moderators found to notify.');
      return;
    }
    const moderatorReviewUrl = `${loadBackendEnv().webAppBaseUrl}/moderator/items`;
    const results = await Promise.allSettled(
      moderators.map((mod) =>
        deps.sendTemplatedEmail('SCRAPER_AUDIT_TRAIL_FAILURE_ALERT', mod.email, {
          source: details.source,
          message: details.message,
          context: details.context,
          moderatorReviewUrl,
        })
      )
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`[Scraper Audit Alert] Failed to notify moderator ${moderators[i].email}:`, result.reason);
      }
    });
  } catch (err) {
    console.error('[Scraper Audit Alert] Failed loading moderators or dispatching alerts:', err);
  }
};

export function setSendScraperAuditAlert(fn: typeof sendScraperAuditAlert) {
  sendScraperAuditAlert = fn;
}
