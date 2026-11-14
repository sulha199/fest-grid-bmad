import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { users } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import {
  MODERATOR_NOTIFICATION_ENTITY_KEYS,
  MODERATOR_REVIEW_PATHS,
  buildModeratorReviewUrl,
  type EmailTemplateVariables,
  type ModeratorNotificationVars,
  type ModeratorTemplateKey,
  type NotifyModeratorsResult,
} from '@festgrid/domain';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import * as emailAdapter from '../email/adapter.js';
import {
  MODERATOR_NOTIFY_KEY_PREFIX,
  pruneModeratorNotifyThrottle,
  releaseAlertEmailBudget,
  takeAlertEmailBudget,
  type AlertEmailBudgetLimits,
} from '../alerts/alert-email-budget-store.js';

// The one place that notifies moderators (Story 0.i1a, Architecture Spine AD-54). It owns the moderator
// lookup, the fan-out, the `moderatorReviewUrl` and the per-template, per-entity throttle; the templates escape
// their own values (render-template.ts). A call site passes a template key and the template's variables, never
// a URL, an address or a user list. It never throws: every outcome is a typed result.
//
// Throttle: one claim in `alert_email_rate_limits` (key `moderator-notify:<template>:<hash of the entity>`)
// BEFORE any send, so two parallel calls cannot both send; released when every send fails, so a mail nobody
// received does not silence the next occurrence; a database error means nothing is sent (fail closed).
//
// The send is awaited on purpose: the API and AI-processor Lambdas freeze once the response is returned, which
// dropped fire-and-forget mail before (see apply-default-location-change.ts).

export type NotifyModeratorsOptions = {
  /** Tell only this user, and only if they are an active moderator; anyone else is refused (never mailed). */
  recipientUserId?: string;
  /** What this call is about, for the throttle (e.g. an event id). Defaults to the template's own entity rule. */
  entityKey?: string;
};

export type ModeratorRecipient = { id: string; email: string };

export type SendModeratorTemplatedEmail = (
  templateKey: ModeratorTemplateKey,
  to: string,
  variables: EmailTemplateVariables[ModeratorTemplateKey]
) => Promise<unknown>;

/** Every dependency is optional; the defaults are the real ones. They exist so tests never touch SES. */
export type NotifyModeratorsDeps = {
  sendTemplatedEmail?: SendModeratorTemplatedEmail;
  findRecipients?: (recipientUserId?: string) => Promise<ModeratorRecipient[]>;
  takeBudget?: (key: string, limits: AlertEmailBudgetLimits) => Promise<boolean>;
  releaseBudget?: (key: string) => Promise<void>;
  pruneThrottle?: () => Promise<void>;
};

/** The throttle key: the entity text is hashed, never stored (an event name or a handle must not sit in a column). */
export function buildModeratorNotifyThrottleKey(
  templateKey: ModeratorTemplateKey,
  entityKey: string,
  recipientUserId?: string
): string {
  const material = JSON.stringify(recipientUserId === undefined ? [entityKey] : [entityKey, recipientUserId]);
  const digest = createHash('sha256').update(material).digest('hex').slice(0, 32);
  return `${MODERATOR_NOTIFY_KEY_PREFIX}${templateKey}:${digest}`;
}

/** The one moderator lookup: active moderators only (`activeOnly`), all of them or the one named user. */
export async function findActiveModeratorRecipients(recipientUserId?: string): Promise<ModeratorRecipient[]> {
  const conditions = [eq(users.role, 'moderator'), activeOnly(users)];
  if (recipientUserId !== undefined) conditions.push(eq(users.id, recipientUserId));
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(...conditions));
}

function reasonMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'unknown error';
}

function logResult(templateKey: ModeratorTemplateKey, result: NotifyModeratorsResult): void {
  const fields = Object.entries(result)
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(' ');
  const line = `[Moderator Notify] template=${templateKey} ${fields}`;
  if (result.status === 'sent' || result.status === 'throttled' || result.status === 'no_moderators') console.info(line);
  else console.error(line);
}

export async function notifyAllModerators<K extends ModeratorTemplateKey>(
  templateKey: K,
  vars: ModeratorNotificationVars<K>,
  options: NotifyModeratorsOptions = {},
  deps: NotifyModeratorsDeps = {}
): Promise<NotifyModeratorsResult> {
  const result = await run(templateKey, vars, options, deps);
  try {
    logResult(templateKey, result);
  } catch {
    // Logging must never turn a typed result into a throw.
  }
  return result;
}

async function run<K extends ModeratorTemplateKey>(
  templateKey: K,
  vars: ModeratorNotificationVars<K>,
  options: NotifyModeratorsOptions,
  deps: NotifyModeratorsDeps
): Promise<NotifyModeratorsResult> {
  const findRecipients = deps.findRecipients ?? findActiveModeratorRecipients;
  const takeBudget = deps.takeBudget ?? takeAlertEmailBudget;
  const releaseBudget = deps.releaseBudget ?? releaseAlertEmailBudget;
  const pruneThrottle = deps.pruneThrottle ?? pruneModeratorNotifyThrottle;
  const send: SendModeratorTemplatedEmail = deps.sendTemplatedEmail ?? emailAdapter.sendTemplatedEmail;
  const single = options.recipientUserId !== undefined;

  let recipients: ModeratorRecipient[];
  try {
    recipients = await findRecipients(options.recipientUserId);
  } catch (error) {
    console.error(`[Moderator Notify] Recipient lookup failed for ${templateKey}:`, reasonMessage(error));
    return { status: 'error', stage: 'lookup' };
  }
  // Before the throttle claim, so a refusal or an empty list spends no budget.
  if (recipients.length === 0) return { status: single ? 'refused_not_moderator' : 'no_moderators' };

  let throttleKey: string;
  let moderatorReviewUrl: string;
  try {
    const entityKey =
      options.entityKey ?? String((MODERATOR_NOTIFICATION_ENTITY_KEYS[templateKey] as (v: unknown) => unknown)(vars));
    throttleKey = buildModeratorNotifyThrottleKey(templateKey, entityKey, options.recipientUserId);
    const env = loadBackendEnv();
    moderatorReviewUrl = buildModeratorReviewUrl(env.webAppBaseUrl, MODERATOR_REVIEW_PATHS[templateKey]);
    const claimed = await takeBudget(throttleKey, { maxSends: 1, windowMinutes: env.moderatorNotifyCooldownMinutes });
    if (!claimed) return { status: 'throttled' };
  } catch (error) {
    console.error(`[Moderator Notify] Throttle check failed for ${templateKey}, nothing sent:`, reasonMessage(error));
    return { status: 'error', stage: 'throttle' };
  }

  // The URL is spread last: a caller that smuggles `moderatorReviewUrl` in at runtime is overwritten.
  const variables = { ...vars, moderatorReviewUrl } as unknown as EmailTemplateVariables[K];
  const settled = await Promise.allSettled(
    recipients.map(async (recipient) => send(templateKey, recipient.email, variables))
  );

  let sent = 0;
  let failed = 0;
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      sent += 1;
      return;
    }
    failed += 1;
    console.error(
      `[Moderator Notify] Send failed for ${templateKey} to moderator ${recipients[index].id}:`,
      reasonMessage(outcome.reason)
    );
  });

  if (sent === 0) {
    try {
      await releaseBudget(throttleKey);
    } catch (error) {
      console.error(`[Moderator Notify] Failed to release the throttle slot for ${templateKey}:`, reasonMessage(error));
    }
    return { status: 'failed', recipients: recipients.length, failed };
  }

  try {
    await pruneThrottle();
  } catch {
    // Best effort; the store's own prune already swallows and logs.
  }
  return { status: 'sent', recipients: recipients.length, sent, failed };
}
