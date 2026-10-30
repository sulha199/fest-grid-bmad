/**
 * POC (pure, no I/O): what happens when the INITIAL PROFILE SCRAPE (the Apify call that feeds account-type
 * classification, and, per this proposal, country and reach) fails or comes back empty.
 *
 * Today (read from classify-account-type.ts, not run): ANY failure of that call — a timeout, a 429, a
 * capacity limit, a Gemini outage, an unparsable answer — goes straight to `AWAITING_APPROVAL` with a
 * moderator review row, and nothing ever retries it: `subscribeToAccount` only classifies a profile whose
 * `accountTypeStatus` is null. A one-minute Apify blip therefore parks an account (excluding it from
 * scraping) until a person looks at it.
 *
 * This policy separates three things that need different handling:
 *   transient         worth retrying with backoff (timeout, 429/5xx, capacity, model unavailable)
 *   permanent         retrying cannot help and costs money (profile not found / private / deleted)
 *   country-unresolved the scrape WORKED but showed no country: do not re-scrape the profile; wait for new
 *                     evidence (the first scraped posts) and re-evaluate, a limited number of times
 * and only escalates to a human (`NEEDS_REVIEW`) when retrying is exhausted or pointless.
 *
 * No new service: the retry is a query ("status = PENDING and next attempt due") inside a scheduled job that
 * already exists (the daily scrape batch / the EventBridge poll-and-drain), guarded by the claim-with-TTL
 * pattern Story 3.16 already uses (`classificationClaimedAt`).
 */

export type EnrichmentStatus = 'PENDING' | 'AWAITING_EVIDENCE' | 'DONE' | 'NEEDS_REVIEW';

export interface EnrichmentState {
  status: EnrichmentStatus;
  attempts: number;           // profile-scrape attempts that FAILED so far
  evidencePasses: number;     // re-evaluations on new evidence that still found no country
  nextAttemptAt: Date | null; // when a PENDING profile becomes due; null otherwise
  lastReason?: string;
}

export type EnrichmentOutcome =
  | { kind: 'ok' }
  | { kind: 'country-unresolved' }
  | { kind: 'transient'; reason: string; retryAfterSeconds?: number }
  | { kind: 'permanent'; reason: string };

// 15 min, 1 h, 6 h, 1 day, 3 days: five retries over ~4 days, then a person decides.
export const BACKOFF_SECONDS = [900, 3600, 21_600, 86_400, 259_200] as const;
export const MAX_EVIDENCE_PASSES = 3;

export const INITIAL_STATE: EnrichmentState = { status: 'PENDING', attempts: 0, evidencePasses: 0, nextAttemptAt: null };

export function applyOutcome(state: EnrichmentState, outcome: EnrichmentOutcome, now: Date): EnrichmentState {
  switch (outcome.kind) {
    case 'ok':
      return { status: 'DONE', attempts: state.attempts, evidencePasses: state.evidencePasses, nextAttemptAt: null };
    case 'permanent':
      return { status: 'NEEDS_REVIEW', attempts: state.attempts, evidencePasses: state.evidencePasses, nextAttemptAt: null, lastReason: outcome.reason };
    case 'country-unresolved': {
      const evidencePasses = state.evidencePasses + 1;
      if (evidencePasses >= MAX_EVIDENCE_PASSES) return { status: 'NEEDS_REVIEW', attempts: state.attempts, evidencePasses, nextAttemptAt: null, lastReason: 'country still unresolved after new evidence' };
      return { status: 'AWAITING_EVIDENCE', attempts: state.attempts, evidencePasses, nextAttemptAt: null, lastReason: 'no country in profile; waiting for scraped posts' };
    }
    case 'transient': {
      const attempts = state.attempts + 1;
      if (attempts > BACKOFF_SECONDS.length) return { status: 'NEEDS_REVIEW', attempts, evidencePasses: state.evidencePasses, nextAttemptAt: null, lastReason: `gave up after ${state.attempts} retries: ${outcome.reason}` };
      const wait = Math.max(BACKOFF_SECONDS[attempts - 1], outcome.retryAfterSeconds ?? 0);
      return { status: 'PENDING', attempts, evidencePasses: state.evidencePasses, nextAttemptAt: new Date(now.getTime() + wait * 1000), lastReason: outcome.reason };
    }
  }
}

/** A profile the scheduled sweep should pick up now. */
export function isDue(state: EnrichmentState, now: Date): boolean {
  return state.status === 'PENDING' && (state.nextAttemptAt === null || state.nextAttemptAt.getTime() <= now.getTime());
}

/** New evidence arrived (the first scraped posts): a profile waiting for it becomes eligible again. */
export function onNewEvidence(state: EnrichmentState): boolean {
  return state.status === 'AWAITING_EVIDENCE';
}

const TRANSIENT_NAMES = new Set([
  'ApifyRequestTimeoutError', 'ScraperCapacityExceededError', 'AiGatewayExhaustedError', 'AiGatewayBusyError', 'GeminiRateLimitedError', 'GeminiUnknownError', 'BrightDataApiError',
]);

/** Map a thrown error to an outcome by name/shape (the real classes live in src/ and are not imported here). */
export function classifyError(err: unknown): EnrichmentOutcome {
  const e = err as { name?: string; message?: string; status?: number; statusCode?: number; retryAfterSeconds?: number } | null;
  const message = String(e?.message ?? err ?? 'unknown error');
  const status = e?.status ?? e?.statusCode;
  if (status === 404 || status === 410 || /not found|does not exist|private account|account is private|deleted/i.test(message)) return { kind: 'permanent', reason: message.slice(0, 160) };
  if (status === 401 || status === 403 || e?.name === 'GeminiInvalidKeyError') return { kind: 'transient', reason: `credentials/permission: ${message.slice(0, 120)}`, retryAfterSeconds: 21_600 }; // an operator must fix a key; do not hammer
  if ((status !== undefined && (status === 429 || status >= 500)) || TRANSIENT_NAMES.has(e?.name ?? '') || /timeout|timed out|ECONN|ETIMEDOUT|ENOTFOUND|socket hang up|rate.?limit|capacity|overloaded|unavailable/i.test(message)) {
    return { kind: 'transient', reason: message.slice(0, 160), retryAfterSeconds: e?.retryAfterSeconds };
  }
  return { kind: 'transient', reason: `unclassified: ${message.slice(0, 140)}` }; // retried, but it still hits the cap and then a human
}
