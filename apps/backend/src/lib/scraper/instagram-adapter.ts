import { randomUUID } from 'node:crypto';
import { ApifyApiError, ApifyClient } from 'apify-client';
import {
  ScraperAdapter,
  ScraperAccountRef,
  ScrapedPost,
  AccountProfileLookupResult,
  ProfileScrapeOptions,
  ProfileScraperAdapter,
  ScrapedProfile,
  ApifyRequestTimeoutError,
  nextApifyMemoryLimitWaitMs,
  resolveApifyMemoryLimitMaxWaitMs,
} from '@festgrid/domain';
import { assertProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';
import { fetchScrapedProfile, registerProfileScraperAdapter } from './profile-scraper.js';
import { loadBackendEnv } from '../../env.js';
import { compileValidator } from '../../validation/validate.js';
import { scrapedPostSchema } from '../../validation/scraped-post.schema.js';
import { persistUnprocessedPayload } from '../posts/persist-unprocessed-payload.js';
import { recordSyncActorRun } from './record-actor-run.js';
import { callVendor, VendorDpaNotConfirmedError, VendorCallTimeoutError } from '../vendor-gateway/guarded-call.js';

// ============================================================================
// ACTOR INPUT TYPES
// ============================================================================

// BUG-053 (2026-10-01): `apify/instagram-post-scraper`'s by-URL mode does NOT accept
// `directUrls`/`resultsType`/`resultsLimit` (that shape is `apify/instagram-api-scraper`'s,
// carried over by mistake when Story 3.4d switched the sync path to this actor) -- live calls
// fail with "Input is not valid: Field input.username is required". The actor takes the post
// URL itself in `username` instead, confirmed empirically (not just the known workaround) by
// Story 3.4d's Task 1b evidence: `3-4d-task1b-runs/run-03-...-getpostbyurl-valid.md` /
// `run-04-...-invalid.md`, input `{"username": [postUrl], "dataDetailLevel": "basicData"}`.
// `resultsLimit`/`onlyPostsNewerThan` are explicitly documented by the actor as not applying in
// post-URL mode and must stay omitted (see that story's Dev Notes correction, 2026-08-14).
// `detailedData`, not `basicData`: verified live 2026-10-02 that `basicData` omits `childPosts`
// (carousel slides -> additionalImageUrls) and `locationName`, which multi-event extraction
// (Story 3.6s's roundup fixture) depends on.
interface GetPostByUrlActorInput {
  username: string[];
  dataDetailLevel: 'detailedData';
}

interface LookupAccountProfileActorInput {
  directUrls: string[];
  resultsType: 'details';
  resultsLimit: 1;
}

interface GetNewestPostsActorInput {
  username: string[];
  resultsType: 'posts';
  resultsLimit: number;
  onlyPostsNewerThan?: string;
}

interface ClassifyAccountProfileActorInput {
  usernames: string[];
  includeAboutSection: boolean;
}

// ============================================================================
// ACTOR OUTPUT TYPES — Raw responses from Apify
// ============================================================================

interface ApifyClassifyProfileItem {
  id?: string;
  profilePicUrl?: string;
  biography?: string;
  fullName?: string;
  username?: string;
  businessCategoryName?: string | null;
  error?: string;
}

type ClassifyAccountProfileActorOutput = ApifyClassifyProfileItem[];

// Raw post item from Apify (multiple possible field names from different actor versions)
interface ApifyPostItem {
  url?: string;
  postUrl?: string;
  id?: string;
  shortCode?: string;
  caption?: string;
  text?: string;
  description?: string;
  timestamp?: string;
  pubDate?: string;
  publishedAt?: string;
  displayUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  // Error response fields
  error?: string;
  errorDescription?: string;
  locationName?: string;
  ownerFullName?: string;
  ownerUsername?: string;
  ownerId?: string;
  // Native coauthor-producer identities (vendor's own coauthor field — see vendor-role-mapping.md).
  // `taggedUsers` is a materially different (mentioned/tagged, not co-produced) relationship and
  // is deliberately NOT modeled on this interface — see AC2 in Story 3.13.
  coauthorProducers?: { id?: string; username?: string; is_verified?: boolean; profile_pic_url?: string }[];
  hashtags?: string[];
  // Carousel (Sidecar) post marks: `type: 'Sidecar'` with childPosts[] holding every slide
  type?: string;
  childPosts?: { displayUrl?: string }[];
}

// Raw profile item from Apify
interface ApifyProfileItem {
  id?: string;
  username?: string;
  fullName?: string;
  displayName?: string;
  name?: string;
  biography?: string;
  profilePicUrl?: string;
  profileImageUrl?: string;
  // Error response fields
  error?: string;
  errorDescription?: string;
}

// Use-case specific output types
type GetPostByUrlActorOutput = ApifyPostItem[];
type LookupAccountProfileActorOutput = ApifyProfileItem[];
type GetNewestPostsActorOutput = ApifyPostItem[];

// ============================================================================
// ACTOR REGISTRY — Maps actor ID to both input and output types
// ============================================================================

interface ActorRegistry {
  'apify/instagram-post-scraper': {
    input: GetPostByUrlActorInput | LookupAccountProfileActorInput | GetNewestPostsActorInput;
    output: GetPostByUrlActorOutput | LookupAccountProfileActorOutput | GetNewestPostsActorOutput;
  };
  'apify~instagram-profile-scraper': {
    input: ClassifyAccountProfileActorInput;
    output: ClassifyAccountProfileActorOutput;
  };
}

// Strict type extractors
type ActorId = keyof ActorRegistry;
type ActorInputFor<T extends ActorId> = ActorRegistry[T]['input'];
type ActorOutputFor<T extends ActorId> = ActorRegistry[T]['output'];

// Parser version — increment when output types change (tracks data schema evolution)
const APIFY_PARSER_VERSION = '3.13';

const GET_POST_BY_URL_ACTOR = 'apify/instagram-post-scraper';
const LOOKUP_ACCOUNT_PROFILE_ACTOR = 'apify/instagram-post-scraper';
const GET_NEWEST_POSTS_ACTOR = 'apify/instagram-post-scraper';
const CLASSIFY_ACCOUNT_PROFILE_ACTOR = 'apify~instagram-profile-scraper';

// Compile validator once at module scope to avoid recompilation per item
const validateScrapedPost = compileValidator<ScrapedPost>(scrapedPostSchema);

function normalizeApifyError(err: unknown, context: string): Error {
  // Story 0.i2d (AC5) — a deliberate kill-switch rejection or the wrapper's own generic
  // timeout bound are not Apify-vendor-shaped errors to re-wrap; pass them through unchanged
  // so a future caller can still distinguish them via `instanceof`.
  if (err instanceof VendorDpaNotConfirmedError || err instanceof VendorCallTimeoutError || err instanceof ApifyMemoryLimitExhaustedError || err instanceof ApifyMonthlyUsageLimitError) {
    return err;
  }

  if (err instanceof ApifyApiError) {
    const detail = err.data && typeof err.data === 'object' && 'error' in err.data && err.data.error && typeof err.data.error === 'object' && 'message' in err.data.error
      ? String((err.data as any).error.message)
      : err.message;

    return new Error(`Apify request failed while ${context}: ${detail}`);
  }

  if (err instanceof Error) {
    return new Error(`Apify request failed while ${context}: ${err.message}`);
  }

  return new Error(`Apify request failed while ${context}`);
}

export let getApifyClient = (): ApifyClient => {
  const env = loadBackendEnv();
  if (!env.apifyApiToken) {
    throw new Error('APIFY_API_TOKEN is not configured');
  }
  return new ApifyClient({ token: env.apifyApiToken });
};

export function setGetApifyClient(fn: typeof getApifyClient) {
  getApifyClient = fn;
}

// Story 0.i2d (AD-32 Rule 4) — mirrors isGeminiErrorTransient's exact shape (gemini-client.ts):
// a 5xx ApifyApiError, or a network-level error code on the error itself or its `cause`, is
// transient. Never a default-transient fallback.
const TRANSIENT_CONNECTION_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN']);

export function isApifyErrorTransient(error: unknown): boolean {
  if (error instanceof ApifyApiError) {
    return typeof error.statusCode === 'number' && error.statusCode >= 500 && error.statusCode <= 599;
  }

  const code = (error as any)?.code ?? (error as any)?.cause?.code;
  if (typeof code === 'string' && TRANSIENT_CONNECTION_CODES.has(code)) {
    return true;
  }

  return false;
}

// Apify refuses a run with 402 + this type when the account's concurrent-memory cap is already in use
// (prod 2026-10-23: 31 of 35 simultaneous triggers). The account's balance is fine and a later attempt
// succeeds, so it is a capacity condition, not a vendor outage. Lives here because this is the only
// module allowed to import apify-client (no-vendor-call-bypasses-wrapper ratchet).
export function isApifyMemoryLimitError(error: unknown): boolean {
  return error instanceof ApifyApiError && error.statusCode === 402 && error.type === 'actor-memory-limit-exceeded';
}

/**
 * The synchronous (queue) path waited its whole memory budget and Apify still refused to start the run
 * with the account's memory cap (BUG-083). Nothing was started, so nothing is audited and provider health
 * never sees it; the queue worker rethrows it and SQS redelivers the message.
 */
export class ApifyMemoryLimitExhaustedError extends Error {
  constructor(
    public readonly waitedMs: number,
    public readonly attempts: number,
    detail: string
  ) {
    super(`Apify account memory limit still reached after waiting ${waitedMs}ms over ${attempts} attempts (no run started): ${detail}`);
    this.name = 'ApifyMemoryLimitExhaustedError';
  }
}

// The Apify account's monthly spend cap is reached (prod 2026-10-29: the FREE plan's $5): every start is
// refused with 403 `platform-feature-disabled` until the usage cycle resets, whatever the retry. Like the
// memory cap it is a condition of our own account, not the vendor failing.
export function isApifyMonthlyUsageLimitError(error: unknown): boolean {
  return error instanceof ApifyApiError && error.statusCode === 403 && error.type === 'platform-feature-disabled';
}

/**
 * Apify refused to start the run because the account's monthly usage limit is exhausted. Nothing was started,
 * so nothing is audited (it must not count against Apify's health) and redelivery cannot help: the queue
 * worker does not rethrow it, and the next daily batch tries again.
 */
export class ApifyMonthlyUsageLimitError extends Error {
  constructor(detail: string) {
    super(`Apify monthly usage limit reached: ${detail}`);
    this.name = 'ApifyMonthlyUsageLimitError';
  }
}

/** Test seam: the pause between two attempts at a memory-limited start. */
export let sleepForApifyMemory = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function setSleepForApifyMemory(fn: typeof sleepForApifyMemory) {
  sleepForApifyMemory = fn;
}

// Story 0.i2d (AD-32 Rule 1) — the single chokepoint every real Apify call site routes
// through. No `opts.lockKey` is ever passed here (AC4): Apify has exactly one static,
// always-valid credential, no multi-key pool to protect, and no candidate-exclusion retry
// loop to absorb a VendorKeyBusyError if contention occurred.
export async function callApifyClient<T>(
  opts: { timeoutMs: number; maxAttempts?: number; overallTimeoutMs?: number },
  fn: (client: ApifyClient, signal: AbortSignal) => Promise<T>
): Promise<T> {
  return callVendor('apify', {
    timeoutMs: opts.timeoutMs,
    maxAttempts: opts.maxAttempts,
    overallTimeoutMs: opts.overallTimeoutMs,
    isTransient: isApifyErrorTransient,
    call: (signal) => fn(getApifyClient(), signal),
  });
}

// Context for audit recording and run ID threading (set by callers that have profileId)
export let apifyAuditContext:
  | { profileId: string; triggerMode: 'SYNC' | 'ASYNC'; runId?: string; timeoutMs?: number }
  | undefined;

// The apify/instagram-profile-scraper actor is routinely blocked by Instagram on its first
// request(s) and retries on a fresh session internally (prod 2026-10-15: two "Request blocked"
// retries, ~22s end to end incl. container start). The profile lookups therefore get a larger
// budget than the 20s used for post lookups; the actor exposes no proxy/retry inputs to tune.
export const PROFILE_LOOKUP_TIMEOUT_MS = 25_000;
export const APIFY_CALL_TIMEOUT_MS = 26_000;

/** The bound on one synchronous Apify call: the queue worker's own budget if it set one, else the API Lambda's. */
export function getApifyCallTimeoutMs(): number {
  return apifyAuditContext?.timeoutMs ?? APIFY_CALL_TIMEOUT_MS;
}

export let callApifyActor = async <T extends ActorId>(actorId: T, input: ActorInputFor<T>): Promise<ActorOutputFor<T>> => {
  // `timeoutMs` defaults to APIFY_CALL_TIMEOUT_MS: it sits between the sync methods' outer
  // `withTimeout`/`withTimeoutOrThrow` bounds (20_000 for post lookups, PROFILE_LOOKUP_TIMEOUT_MS for the
  // two profile lookups -- both must still win the race, see the Task 2 regression guard) and
  // `apiLambda`'s hard CDK timeout (28s, under API Gateway's 29s integration limit). Only the scraper
  // Lambda's queue path, which runs under a 300s limit and sets `apifyAuditContext.timeoutMs`, gets more.
  // `maxAttempts: 1`: the budget cannot fit a second attempt plus backoff, and today's code has
  // zero retry on this path either -- no behavior regression.
  const timeoutMs = getApifyCallTimeoutMs();
  const auditProfileId = apifyAuditContext?.profileId;
  let startedRunId: string | undefined;

  const callStartedAt = Date.now();
  // Time spent on this call so far. The larger of the wall clock and the time accounted for (each
  // refused attempt plus each requested wait), so a wait that ran short, or a clock that did not move,
  // can never let the loop spin past its budget.
  let accountedMs = 0;
  const elapsedMs = () => Math.max(Date.now() - callStartedAt, accountedMs);
  // Waiting for memory only where there is an audit context, i.e. the queue worker (the API Lambda has
  // none and fails fast). The wait is carved out of `timeoutMs`, never added to it (BUG-083).
  const maxMemoryWaitMs = auditProfileId ? resolveApifyMemoryLimitMaxWaitMs(timeoutMs) : 0;

  let outcome: { run: { id: string; status: string; defaultDatasetId?: string }; items: ActorOutputFor<T> };
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        outcome = await callApifyClient(
          // The first attempt gets the whole budget; a start that waited for memory only what is left of it.
          { timeoutMs: attempt === 0 ? timeoutMs : Math.max(1, timeoutMs - elapsedMs()), maxAttempts: 1 },
          async (client, signal) => {
            // start + waitForFinish, not `.call()`: `.call()` hides the run id, so a timeout could not stop
            // the run, which would keep running (and billing) with its output thrown away.
            const started = await client.actor(actorId).start(input as unknown as Record<string, unknown>);
            startedRunId = started.id;
            const abortRun = () => {
              client.run(started.id).abort().catch((abortErr) => {
                console.error(`Failed to abort Apify run ${started.id} after its call timed out:`, abortErr);
              });
            };
            if (signal.aborted) {
              abortRun();
            } else {
              signal.addEventListener('abort', abortRun, { once: true });
            }
            const runResult = await client.run(started.id).waitForFinish();
            const datasetId = runResult.defaultDatasetId;
            const runItems = datasetId
              ? (await client.dataset(datasetId).listItems({ clean: true, limit: 1000 })).items as ActorOutputFor<T>
              : ([] as ActorOutputFor<T>);
            return { run: runResult, items: runItems };
          }
        );
        break;
      } catch (attemptErr) {
        // The account's memory cap refused the start (402 actor-memory-limit-exceeded): no run exists, so
        // wait for memory to free up and try again inside the budget. The queue's 3 receives are not spent
        // on it, and nothing is audited for a run that never started.
        if (!isApifyMemoryLimitError(attemptErr) || maxMemoryWaitMs === 0) {
          throw attemptErr;
        }
        const spentMs = elapsedMs();
        const waitMs = nextApifyMemoryLimitWaitMs({ attempt, elapsedMs: spentMs, maxWaitMs: maxMemoryWaitMs });
        if (waitMs === null) {
          throw new ApifyMemoryLimitExhaustedError(
            spentMs,
            attempt + 1,
            attemptErr instanceof Error ? attemptErr.message : String(attemptErr)
          );
        }
        console.warn(`Apify memory limit reached; waiting ${waitMs}ms before attempt ${attempt + 2} (waited ${spentMs}ms of ${maxMemoryWaitMs}ms)`);
        await sleepForApifyMemory(waitMs);
        accountedMs = spentMs + waitMs;
      }
    }
  } catch (rawErr) {
    const err = isApifyMonthlyUsageLimitError(rawErr)
      ? new ApifyMonthlyUsageLimitError(rawErr instanceof Error ? rawErr.message : String(rawErr))
      : rawErr;
    // A failed or timed-out call used to leave no trace: no audit row, so provider health never saw it
    // (2026-10-23: 11 profiles dropped on a 26s timeout). Recorded OUTSIDE the guarded call, like the
    // success row below; the caller still gets the original error. Except the memory cap: that is a
    // capacity condition of our own account, not the vendor failing (2026-10-25: 31 such FAILED rows
    // counted against Apify's health), and no run was started. The monthly usage limit is the same kind of
    // condition (2026-10-30: 105 FAILED rows).
    if (auditProfileId && !(err instanceof ApifyMemoryLimitExhaustedError) && !(err instanceof ApifyMonthlyUsageLimitError)) {
      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: auditProfileId,
        runId: startedRunId ?? `sync-unstarted-${randomUUID()}`,
        rawInput: input,
        status: err instanceof VendorCallTimeoutError ? 'TIMED_OUT' : 'FAILED',
        itemCount: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
  const { run, items } = outcome;

  // Record audit trail if context is set (sync path with profileId available). This audit
  // write stays OUTSIDE/after the guarded call (same pattern as adapter.ts's callGemini:
  // recordSuccessfulUsage runs after callVendor returns, never inside the thunk) -- a
  // transient-retry must never risk writing a duplicate/stale audit row.
  if (auditProfileId) {
    const auditRunId = await recordSyncActorRun({
      vendor: 'APIFY',
      profileId: auditProfileId,
      runId: run.id,
      rawInput: input,
      status: run.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
      rawOutput: items,
      itemCount: items.length,
      errorMessage: run.status === 'SUCCEEDED' ? undefined : `Run status: ${run.status}`,
    });
    // Store the recorded run ID in context for callers to thread to persist functions
    if (auditRunId && apifyAuditContext) {
      apifyAuditContext.runId = auditRunId;
    }
    // A run Apify itself ended as failed/timed out/aborted is not a scrape that found nothing: let the
    // queue worker see it, so the account is not stamped as scraped.
    if (run.status !== 'SUCCEEDED') {
      throw new Error(`Apify run ${run.id} ended with status ${run.status}`);
    }
  }

  return items;
};

export function setCallApifyActor(fn: typeof callApifyActor) {
  callApifyActor = fn;
}

export function setApifyAuditContext(profileId: string, triggerMode: 'SYNC' | 'ASYNC', timeoutMs?: number): void {
  apifyAuditContext = { profileId, triggerMode, ...(timeoutMs !== undefined && { timeoutMs }) };
}

export function clearApifyAuditContext(): void {
  apifyAuditContext = undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(null);
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function withTimeoutOrThrow<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ApifyRequestTimeoutError(message));
    }, ms);

    promise
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Maps an Apify item to a ScrapedPost and validates against schema.
 * Returns null if validation fails (after capturing the unprocessed payload).
 */
export async function mapApifyItemToScrapedPost(item: any): Promise<ScrapedPost | null> {
  const publishedAt = item.timestamp || item.pubDate || item.publishedAt || new Date().toISOString();
  const postUrl = item.url || item.postUrl || `https://www.instagram.com/p/${item.shortCode || item.id || ''}/`;
  const imageUrl = item.displayUrl || item.imageUrl;
  const originalPostUrl = item.url || item.postUrl;

  // Role normalization (AC1/AC3): classify each coauthorProducers[] entry. A malformed entry
  // (missing/empty/non-string `id`) is skipped from the resulting coauthors list and persisted
  // via persistUnprocessedPayload for observability -- the rest of the post still ingests
  // normally (this is a per-entry, non-blocking behavior, not the all-or-nothing "reject the
  // whole item" shape every other persistUnprocessedPayload call site in this codebase uses).
  let coauthors: { accountId: string; username?: string }[] | undefined;
  if (Array.isArray(item.coauthorProducers) && item.coauthorProducers.length > 0) {
    const accumulator: { accountId: string; username?: string }[] = [];
    for (const entry of item.coauthorProducers) {
      if (entry && typeof entry.id === 'string' && entry.id.length > 0) {
        accumulator.push({
          accountId: entry.id,
          ...(entry.username && { username: entry.username }),
        });
      } else {
        try {
          await persistUnprocessedPayload({
            rawPayload: entry,
            validationError: { message: 'coauthorProducers entry missing a stable id', entry },
            context: {
              source: 'apify',
              scraperVendor: 'instagram',
              accountId: null,
              postUrl,
              timestamp: new Date().toISOString(),
              parserVersion: APIFY_PARSER_VERSION,
            },
            scraperActorRunId: apifyAuditContext?.runId,
          });
        } catch (err) {
          console.error('Failed to persist unprocessed Apify coauthorProducers entry:', err);
        }
      }
    }
    if (accumulator.length > 0) {
      coauthors = accumulator;
    }
  }

  const candidate: ScrapedPost = {
    content: item.caption || item.text || item.description || '',
    postUrl,
    publishedAt,
    // Only include optional fields if they have values (avoid undefined, which fails nullable check)
    ...(imageUrl && { imageUrl }),
    ...(item.videoUrl && { videoUrl: item.videoUrl }),
    ...(originalPostUrl && { originalPostUrl }),
    ...(item.locationName && { locationName: item.locationName }),
    ...(item.ownerFullName && { ownerDisplayName: item.ownerFullName }),
    ...(item.ownerUsername && { ownerUsername: item.ownerUsername }),
    ...(item.ownerId && { ownerId: item.ownerId }),
    ...(coauthors && { coauthors }),
    // Lowercased for case-insensitive exact-match hashtag search (Sections 3.1/3.7) -- a hashtag
    // is functionally the same regardless of how a user or the source post cased it.
    ...(Array.isArray(item.hashtags) && item.hashtags.length > 0 && {
      hashtags: item.hashtags.map((tag: string) => tag.toLowerCase()),
    }),
    // Carousel/Sidecar post (AC1/AC2): capture every slide's image URL beyond the cover, in Apify's
    // childPosts slide order, dropping falsy/missing displayUrl entries defensively. Omitted entirely
    // for non-Sidecar items or those with no childPosts (no behavior change for single-image posts).
    ...(item.type === 'Sidecar' && Array.isArray(item.childPosts) && item.childPosts.length > 0 && (() => {
      const additionalImageUrls = item.childPosts
        .map((cp: { displayUrl?: string }) => cp.displayUrl)
        .filter((url: string | undefined): url is string => Boolean(url));
      return additionalImageUrls.length > 0 ? { additionalImageUrls } : {};
    })()),
  };

  const isValid = validateScrapedPost(candidate);
  if (!isValid) {
    console.error(`Apify item failed AJV validation:`, validateScrapedPost.errors);
    // Capture unprocessed payload before discarding
    try {
      await persistUnprocessedPayload({
        rawPayload: candidate,
        validationError: validateScrapedPost.errors,
        context: {
          source: 'apify',
          scraperVendor: 'instagram',
          accountId: null,
          postUrl,
          timestamp: new Date().toISOString(),
          parserVersion: APIFY_PARSER_VERSION,
        },
        scraperActorRunId: apifyAuditContext?.runId,
      });
    } catch (err) {
      console.error('Failed to persist unprocessed Apify payload:', err);
    }
    return null;
  }

  return candidate;
}

/**
 * Detects Apify 'not found' responses.
 * Returns true if the item represents a not‑found error based on response shape and kind.
 * Kind determines which fields are required for a valid response.
 */
function isNotFoundItem(item: any, kind: 'post' | 'profile'): boolean {
  if (!item) return false;

  // Primary check: Apify returns error as a string field for not-found cases.
  if (item.error === 'not_found') {
    return true;
  }

  // Fallback: item lacks the fields a real result must have.
  // For posts: must have both caption AND timestamp
  // For profiles: must have both fullName AND biography
  if (kind === 'post') {
    if (!item.caption || !item.timestamp) {
      return true;
    }
  } else if (kind === 'profile') {
    if (!item.fullName || !item.biography) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// APIFY PROFILE ADAPTER -- the Apify side of the profile-scraper chain (profile-scraper.ts)
// ============================================================================

async function apifyLookupProfile(handleOrUrl: string, budgetMs: number): Promise<ScrapedProfile | null> {
  await assertProviderCapacityAvailable('apify', `profile ${handleOrUrl}`);

  const runLookup = async (): Promise<ScrapedProfile | null> => {
    try {
      const url = handleOrUrl.startsWith('http') ? handleOrUrl : `https://www.instagram.com/${handleOrUrl}/`;
      const input: LookupAccountProfileActorInput = {
        directUrls: [url],
        resultsType: 'details',
        resultsLimit: 1,
      };
      const items = (await callApifyActor(LOOKUP_ACCOUNT_PROFILE_ACTOR, input)) as LookupAccountProfileActorOutput;

      if (!items || items.length === 0) {
        return null;
      }

      const item = items[0];
      if (isNotFoundItem(item, 'profile')) {
        return null;
      }
      const result: ScrapedProfile = {
        accountId: item.id || item.username || '',
        displayName: item.fullName || item.displayName || item.name || item.username || '',
        username: item.username || '',
        profileImageUrl: item.profilePicUrl || item.profileImageUrl || undefined,
      };

      await recordProviderUsage('apify', 1);

      return result;
    } catch (err) {
      console.error(`Instagram Scraper Adapter error looking up profile for ${handleOrUrl}:`, err);
      throw normalizeApifyError(err, `looking up profile ${handleOrUrl}`);
    }
  };

  return withTimeoutOrThrow(runLookup(), Math.min(budgetMs, PROFILE_LOOKUP_TIMEOUT_MS), 'Account profile lookup timed out');
}

async function apifyClassificationProfile(username: string, budgetMs: number): Promise<ScrapedProfile | null> {
  await assertProviderCapacityAvailable('apify', `profile-classify ${username}`);

  const runLookup = async (): Promise<ScrapedProfile | null> => {
    try {
      const input: ClassifyAccountProfileActorInput = {
        usernames: [username],
        includeAboutSection: false,
      };
      const items = (await callApifyActor(CLASSIFY_ACCOUNT_PROFILE_ACTOR, input)) as ClassifyAccountProfileActorOutput;

      if (!items || items.length === 0) {
        return null;
      }

      const item = items[0];
      if (item.error === 'not_found' || !item.username || !item.fullName || !item.biography) {
        return null;
      }

      await recordProviderUsage('apify', 1);

      return {
        accountId: item.id || item.username,
        username: item.username,
        displayName: item.fullName,
        profileImageUrl: item.profilePicUrl || undefined,
        biography: item.biography,
        businessCategoryName: item.businessCategoryName || null,
      };
    } catch (err) {
      console.error(`Instagram Scraper Adapter error during account classification profile lookup for ${username}:`, err);
      throw normalizeApifyError(err, `looking up profile for classification ${username}`);
    }
  };

  return withTimeoutOrThrow(runLookup(), Math.min(budgetMs, PROFILE_LOOKUP_TIMEOUT_MS), 'Account profile lookup for classification timed out');
}

export const apifyProfileAdapter: ProfileScraperAdapter = {
  name: 'apify',
  // An Apify profile run answers in seconds, so any budget is worth trying.
  minBudgetMs: 0,
  fetchProfile: (handle, { purpose, budgetMs }) =>
    purpose === 'lookup' ? apifyLookupProfile(handle, budgetMs) : apifyClassificationProfile(handle, budgetMs),
};

registerProfileScraperAdapter(apifyProfileAdapter);

export const instagramScraperAdapter: ScraperAdapter = {
  // apify/instagram-post-scraper filters server-side on both onlyPostsNewerThan and
  // resultsLimit, so the new-subscribe path can fetch once instead of retrying windows.
  supportsNewerThanAndLimitFiltering: true,

  async getPostByUrl(url: string): Promise<ScrapedPost | null> {
    await assertProviderCapacityAvailable('apify', `URL ${url}`);

    const runCall = async (): Promise<ScrapedPost | null> => {
      try {
        const input: GetPostByUrlActorInput = {
          username: [url],
          dataDetailLevel: 'detailedData',
        };
        const items = (await callApifyActor(GET_POST_BY_URL_ACTOR, input)) as GetPostByUrlActorOutput;

        if (!items || items.length === 0) {
          return null;
        }

        const item = items[0];
        if (isNotFoundItem(item, 'post')) {
          return null;
        }

        const post = await mapApifyItemToScrapedPost(item);
        if (!post) {
          return null;
        }

        await recordProviderUsage('apify', 1);
        return post;
      } catch (err) {
        throw normalizeApifyError(err, `fetching post by URL ${url}`);
      }
    };

    return withTimeout(runCall(), 20000);
  },

  async getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]> {
    const env = loadBackendEnv();
    await assertProviderCapacityAvailable('apify', `account ${account.username}`);

    try {
      const input: GetNewestPostsActorInput = {
        username: [account.username],
        resultsType: 'posts',
        resultsLimit: env.scrapeResultsLimit,
        ...(options?.newerThan && { onlyPostsNewerThan: options.newerThan }),
      };

      const items = (await callApifyActor(GET_NEWEST_POSTS_ACTOR, input)) as GetNewestPostsActorOutput;
      const mappedResults = await Promise.all(items.map(mapApifyItemToScrapedPost));
      const mappedPosts = mappedResults.filter((post): post is ScrapedPost => post !== null);

      if (items.length > 0) {
        await recordProviderUsage('apify', items.length);
      }

      return mappedPosts;
    } catch (err) {
      console.error(`Instagram Scraper Adapter error fetching posts for ${account.username}:`, err);
      throw normalizeApifyError(err, `fetching newest posts for ${account.username}`);
    }
  },

  async lookupAccountProfile(handleOrUrl: string, options?: ProfileScrapeOptions): Promise<AccountProfileLookupResult | null> {
    const profile = await fetchScrapedProfile(handleOrUrl, 'lookup', options?.budgetMs ?? PROFILE_LOOKUP_TIMEOUT_MS);
    if (!profile) {
      return null;
    }
    return {
      accountId: profile.accountId,
      displayName: profile.displayName,
      username: profile.username,
      profileImageUrl: profile.profileImageUrl,
    };
  },

  async getAccountClassificationProfile(username: string, options?: ProfileScrapeOptions): Promise<{ biography: string; username: string; displayName: string; businessCategoryName: string | null } | null> {
    const profile = await fetchScrapedProfile(username, 'classification', options?.budgetMs ?? PROFILE_LOOKUP_TIMEOUT_MS);
    if (!profile) {
      return null;
    }
    return {
      biography: profile.biography ?? '',
      username: profile.username,
      displayName: profile.displayName,
      businessCategoryName: profile.businessCategoryName ?? null,
    };
  },
};
