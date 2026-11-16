import type { EmailTemplateKey, EmailTemplateVariables } from './types.js';

// The pure contract of the moderator-notification helper (Story 0.i1a, Epic 0.i1, Architecture Spine AD-54).
// The helper itself (`notifyAllModerators`, apps/backend) does the database and mail work; everything that is
// a rule lives here so it is covered and cannot drift: which templates are moderator templates, where each
// links, what a call is "about" for the throttle, and what a call can answer.

/** Templates sent to moderators. `SYSTEM_ERROR_ALERT` goes to one fixed address and the two user mails go to users: none is a member. */
export const MODERATOR_TEMPLATE_KEYS = [
  'DANGEROUS_EVENT_MODERATOR_ALERT',
  'DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT',
  'DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT',
  'SCRAPER_AUDIT_TRAIL_FAILURE_ALERT',
  'SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT',
  'JOB_FINISHED_MODERATOR_NOTICE',
] as const satisfies readonly EmailTemplateKey[];

export type ModeratorTemplateKey = (typeof MODERATOR_TEMPLATE_KEYS)[number];

/** What a caller supplies: the template's variables without `moderatorReviewUrl`, which only the helper builds. */
export type ModeratorNotificationVars<K extends ModeratorTemplateKey> = Omit<
  EmailTemplateVariables[K],
  'moderatorReviewUrl'
>;

/** The page each template links to (what each linked to before the helper existed). */
export const MODERATOR_REVIEW_PATHS: Record<ModeratorTemplateKey, string> = {
  DANGEROUS_EVENT_MODERATOR_ALERT: '/moderator/items',
  DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT: '/moderator/items',
  DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT: '/moderator/items',
  SCRAPER_AUDIT_TRAIL_FAILURE_ALERT: '/moderator/items',
  SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT: '/moderator/tools',
  JOB_FINISHED_MODERATOR_NOTICE: '/jobs',
};

/** Joins the web base URL and a path with exactly one slash between them. */
export function buildModeratorReviewUrl(webAppBaseUrl: string, path: string): string {
  return `${webAppBaseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * The default "entity" a call is about, the second half of the throttle key. It must be stable across repeats
 * of the same problem: the audit trail uses `source`, never `message` or `context` (they vary per failure and
 * would defeat the throttle). A caller that knows a better entity (an event id) passes `entityKey` instead.
 * An exhaustive Record, so a new moderator template fails the type check until it has a rule.
 */
export const MODERATOR_NOTIFICATION_ENTITY_KEYS: {
  [K in ModeratorTemplateKey]: (vars: ModeratorNotificationVars<K>) => string;
} = {
  DANGEROUS_EVENT_MODERATOR_ALERT: (vars) => vars.eventName,
  DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT: (vars) => vars.accountDisplayName,
  DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT: (vars) => vars.accountDisplayName,
  SCRAPER_AUDIT_TRAIL_FAILURE_ALERT: (vars) => vars.source,
  SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT: (vars) => vars.provider,
  JOB_FINISHED_MODERATOR_NOTICE: (vars) => vars.jobId,
};

/** What a call answers. No field holds an e-mail address, a name or a variable value. */
export type NotifyModeratorsResult =
  | { status: 'sent'; recipients: number; sent: number; failed: number }
  | { status: 'failed'; recipients: number; failed: number }
  | { status: 'throttled' }
  | { status: 'no_moderators' }
  | { status: 'refused_not_moderator' }
  | { status: 'error'; stage: 'lookup' | 'throttle' };
