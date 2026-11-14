import { and, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { fcmTokens, jobs, userSettings, users } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import {
  JOB_TERMINAL_STATUSES,
  buildJobFinishedPush,
  buildJobFinishedSummary,
  decideJobNotice,
  getJobTypePresentation,
  type JobFinishedNoticeInput,
} from '@festgrid/domain/jobs';
import type { Messaging } from 'firebase-admin/messaging';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { notifyAllModerators, type NotifyModeratorsDeps } from '../notifications/notify-all-moderators.js';
import { getMessagingClient, reportErrorSilently } from '../notifications/send-event-notifications.js';
import { newUserSettingsValues } from '../user-settings/new-user-settings-values.js';
import { readEndedJobSubjects } from './read-jobs.js';

// Story 10.13 (notify when a job finishes; PRD 3.18 FR124, FR130; Architecture Spine AD-53) -- THE ONE announcer. A job reaches a terminal
// state in at least nine places, so nothing here is hooked into an ending write: the 5-minute sweep (`runJobEngineSweep`, last step) reads
// the row state (terminal, user-owned, `owner_notified_at` null) and tells each owner. It is the ONLY file in the job engine that sends a
// push or the moderator mail (`job-announcer-single-sender.ratchet.test.ts`). In-app, the Jobs badge is a count query, not this file.
//
// Claim, send, release: the jobs of a group are claimed by one UPDATE guarded on `owner_notified_at IS NULL` BEFORE anything is sent, so two
// overlapping runs cannot send one job twice; when nothing could be done for a group the claim is released and the next run retries.
// The content comes only from `buildJobFinishedPush` / `buildJobFinishedSummary` (job type and account handle or post count). No log line
// holds a handle, token, address or caption: job ids, counts and statuses only.

const OWNERS_PER_RUN = 50;
const JOBS_PER_BATCH = 200;
const FCM_BATCH_SIZE = 500;

export interface AnnounceEndedJobsDeps {
  /** Replaces `getMessagingClient` (tests never reach Firebase). */
  getMessaging?: () => Messaging;
  /** Passed to the moderator helper (tests never reach SES). */
  moderatorDeps?: NotifyModeratorsDeps;
  now?: Date;
  /** Test seam: only these owners' jobs are looked at (a test run on a shared database never touches other rows). Production passes nothing. */
  onlyOwnerIds?: string[];
}

let defaultDepsForTests: AnnounceEndedJobsDeps | null = null;
/** Test seam: the deps a bare `announceEndedJobs()` (the sweep step) uses, so a test that runs the real sweep stays on its own rows and fakes. `null` restores production. */
export function setDefaultAnnounceDepsForTests(deps: AnnounceEndedJobsDeps | null): void {
  defaultDepsForTests = deps;
}

type PushOutcome = 'sent' | 'failed';
type MailOutcome = 'done' | 'failed';

/** Returns how many notice groups were sent (a push or a mail) in this run. */
export async function announceEndedJobs(deps: AnnounceEndedJobsDeps = defaultDepsForTests ?? {}): Promise<number> {
  const env = loadBackendEnv();
  const now = deps.now ?? new Date();
  const terminal = [...JOB_TERMINAL_STATUSES];
  // USER jobs only (FR130): a system job is never announced or stamped, even if a row somehow carries an owner.
  const scope = [eq(jobs.trigger, 'USER'), isNotNull(jobs.ownerUserId), ...(deps.onlyOwnerIds ? [inArray(jobs.ownerUserId, deps.onlyOwnerIds)] : [])];

  // Past the max age: handled with no notice (the first run after a deploy and an outage); one guarded UPDATE, no rows read.
  await db
    .update(jobs)
    .set({ ownerNotifiedAt: now })
    .where(
      and(
        ...scope,
        inArray(jobs.status, terminal),
        isNull(jobs.ownerNotifiedAt),
        lt(jobs.finishedAt, new Date(now.getTime() - env.jobNotifyMaxAgeMinutes * 60_000))
      )
    );

  const pending = await db
    .select({ id: jobs.id, type: jobs.type, ownerUserId: jobs.ownerUserId, finishedAt: jobs.finishedAt })
    .from(jobs)
    .where(and(...scope, inArray(jobs.status, terminal), isNull(jobs.ownerNotifiedAt), isNotNull(jobs.finishedAt)))
    .orderBy(jobs.finishedAt, jobs.id)
    .limit(JOBS_PER_BATCH);
  if (pending.length === 0) return 0;

  const byOwner = new Map<string, typeof pending>();
  for (const job of pending) {
    const list = byOwner.get(job.ownerUserId as string) ?? [];
    list.push(job);
    byOwner.set(job.ownerUserId as string, list);
  }
  const ownerIds = [...byOwner.keys()].slice(0, OWNERS_PER_RUN);

  const [owners, settings, tokenRows] = await Promise.all([
    db.select({ id: users.id, role: users.role }).from(users).where(and(inArray(users.id, ownerIds), activeOnly(users))),
    db
      .select({ userId: userSettings.userId, pushEnabled: userSettings.pushNotificationsEnabled, lastJobPushAt: userSettings.lastJobPushAt })
      .from(userSettings)
      .where(inArray(userSettings.userId, ownerIds)),
    db.select({ userId: fcmTokens.userId, token: fcmTokens.token }).from(fcmTokens).where(inArray(fcmTokens.userId, ownerIds)),
  ]);
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
  const settingsByUser = new Map(settings.map((row) => [row.userId, row]));
  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows) tokensByUser.set(row.userId, [...(tokensByUser.get(row.userId) ?? []), row.token]);

  // Firebase is initialised at most once per run and only when a push is needed; a failure is reported once and leaves every push undone.
  let messaging: Messaging | null = null;
  let messagingFailed = false;
  const getMessaging = (): Messaging | null => {
    if (messaging || messagingFailed) return messaging;
    try {
      messaging = (deps.getMessaging ?? getMessagingClient)();
    } catch (error) {
      messagingFailed = true;
      console.error('[job-announcer] Firebase initialisation failed, no job push was sent in this run');
      void reportErrorSilently('announceEndedJobs - Firebase initialisation', error instanceof Error ? error.message : String(error), 'job-engine-sweep');
    }
    return messaging;
  };

  let groupsSent = 0;
  for (const ownerId of ownerIds) {
    const ownerJobs = byOwner.get(ownerId) as typeof pending;
    const owner = ownerById.get(ownerId);
    if (!owner) {
      // A deleted owner: nobody to tell.
      await markHandled(ownerJobs.map((job) => job.id), now);
      continue;
    }
    const setting = settingsByUser.get(ownerId);
    const tokens = tokensByUser.get(ownerId) ?? [];
    const decision = decideJobNotice({
      jobs: ownerJobs.map((job) => ({ id: job.id, finishedAt: job.finishedAt as Date })),
      pushEnabled: setting?.pushEnabled ?? true,
      hasDevice: tokens.length > 0,
      isModerator: owner.role === 'moderator',
      lastPushAt: setting?.lastJobPushAt ?? null,
      now,
      windowMinutes: env.jobNotifyWindowMinutes,
      graceSeconds: env.jobNotifyGraceSeconds,
      maxAgeMinutes: env.jobNotifyMaxAgeMinutes,
    });
    await markHandled(decision.markHandled, now);
    if (decision.group === 'NONE') continue;

    const claimed = await claim(decision.notify, now);
    if (claimed.length === 0) continue; // another run took the group
    try {
      const input = await buildNoticeInput(ownerJobs.filter((job) => claimed.includes(job.id)));
      const { summaryEn, summaryId } = buildJobFinishedSummary(input);

      let pushOutcome: PushOutcome | null = null;
      if (decision.push) pushOutcome = await sendPush(getMessaging(), tokens, input);
      let mailOutcome: MailOutcome | null = null;
      let mailSent = false;
      if (decision.mail) {
        const result = await notifyAllModerators(
          'JOB_FINISHED_MODERATOR_NOTICE',
          { jobId: decision.entityJobId as string, summaryEn, summaryId },
          { recipientUserId: ownerId },
          deps.moderatorDeps
        );
        mailOutcome = result.status === 'failed' || result.status === 'error' ? 'failed' : 'done';
        mailSent = result.status === 'sent';
      }

      const pushDone = pushOutcome === null || pushOutcome === 'sent';
      const mailDone = mailOutcome === null || mailOutcome === 'done';
      // A push is never repeated for a mail retry: push sent and mail failed is handled and the mail is lost (logged with the job id).
      const handled = (pushDone && mailDone) || pushOutcome === 'sent';
      if (pushOutcome === 'sent' && !mailDone) {
        console.error(`[job-announcer] moderator mail failed after the push was sent; not retried (job ${decision.entityJobId})`);
      }
      if (pushOutcome === 'sent' || mailSent) {
        groupsSent += 1;
        await recordNoticeSent(ownerId, now);
      }
      if (!handled) await release(claimed);
    } catch (error) {
      console.error(`[job-announcer] announcing failed for ${claimed.length} job(s), will retry:`, error instanceof Error ? error.message : 'unknown error');
      await release(claimed);
    }
  }
  return groupsSent;
}

async function markHandled(ids: string[], now: Date): Promise<void> {
  if (ids.length === 0) return;
  await db.update(jobs).set({ ownerNotifiedAt: now }).where(and(inArray(jobs.id, ids), isNull(jobs.ownerNotifiedAt)));
}

/** One UPDATE guarded on `owner_notified_at IS NULL`; returns the ids this run now holds. */
async function claim(ids: string[], now: Date): Promise<string[]> {
  const rows = await db
    .update(jobs)
    .set({ ownerNotifiedAt: now })
    .where(and(inArray(jobs.id, ids), isNull(jobs.ownerNotifiedAt)))
    .returning({ id: jobs.id });
  return rows.map((row) => row.id).sort();
}

async function release(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await db.update(jobs).set({ ownerNotifiedAt: null }).where(inArray(jobs.id, ids));
  } catch (error) {
    console.error('[job-announcer] could not release the claim; the job(s) will not be announced again:', error instanceof Error ? error.message : 'unknown error');
  }
}

/** `last_job_push_at` is the merge-window state for the push and the moderator mail alike. The row is created when a user has none. */
async function recordNoticeSent(ownerId: string, now: Date): Promise<void> {
  await db
    .insert(userSettings)
    // A new row's badge watermark is the account's creation (the one helper), so the row this creates never hides jobs the user has not seen.
    .values(newUserSettingsValues(ownerId, { lastJobPushAt: now }))
    .onConflictDoUpdate({ target: userSettings.userId, set: { lastJobPushAt: now } });
}

async function buildNoticeInput(group: Array<{ id: string; type: string }>): Promise<JobFinishedNoticeInput> {
  if (group.length > 1) return { mode: 'MERGED', count: group.length };
  const [job] = group;
  const subjects = await readEndedJobSubjects([job]);
  return {
    mode: 'SINGLE',
    jobId: job.id,
    graphqlType: getJobTypePresentation(job.type).graphqlType,
    subject: subjects.get(job.id) ?? { handle: null, postCount: null },
  };
}

const INVALID_TOKEN_CODES = ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'];

/**
 * 'sent' when the push went out, 'failed' when the claim must be released and the next run retries. `sendEachForMulticast` resolves normally
 * even when every token failed, so a batch counts as failed when NONE of its tokens succeeded and a failure was not an invalid-token code (a
 * transient code: unavailable, quota, internal). A batch whose only failures are dead tokens is fine (they are deleted; nothing is
 * deliverable). Several batches: once any batch was delivered a later failing batch ends the push as 'sent' (a retry would push the earlier
 * devices twice; the owner has been told, only some later devices were missed, and it is logged).
 */
async function sendPush(messaging: Messaging | null, tokens: string[], input: JobFinishedNoticeInput): Promise<PushOutcome> {
  if (!messaging) return 'failed';
  const content = buildJobFinishedPush(input);
  let deliveredAny = false;
  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: content.title, body: content.body },
        data: content.data,
      });
      const invalid: string[] = [];
      let succeeded = 0;
      let transientFailures = 0;
      result.responses.forEach((response, index) => {
        if (response.success) {
          succeeded += 1;
          return;
        }
        const code = response.error?.code;
        if (code && INVALID_TOKEN_CODES.includes(code)) invalid.push(batch[index]);
        else transientFailures += 1;
      });
      if (invalid.length > 0) {
        console.log(`[job-announcer] deleting ${invalid.length} invalid or inactive device token(s)`);
        await db.delete(fcmTokens).where(inArray(fcmTokens.token, invalid));
      }
      if (succeeded > 0) deliveredAny = true;
      else if (transientFailures > 0) throw new Error(`no device accepted the push (${transientFailures} transient failure(s))`);
    } catch (error) {
      console.error('[job-announcer] FCM batch failed:', error instanceof Error ? error.message : 'unknown error');
      if (deliveredAny) {
        console.error('[job-announcer] an earlier batch was delivered; not retrying so no device is pushed twice');
        return 'sent';
      }
      return 'failed';
    }
  }
  return 'sent';
}
